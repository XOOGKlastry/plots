/* Siedziba urzędu gminy: znacznik na mapie (widoczny z daleka), zdjęcie budynku i okolicy, kontakty.
   Dane: data/urzedy.json (Katalog Podmiotów Publicznych, gov.pl; zdjęcia z Wikimedia Commons na wolnych licencjach).
   Gmina „obwarzankowa” (urząd w sąsiednim mieście, np. gmina wiejska Szczecinek) ma pole `poza` z TERYT gminy siedziby:
   wtedy rysujemy przerywaną linię od środka gminy do urzędu i piszemy to w karcie.
   Pole `bip` (w przyszłości, z BIP gmin) jest wyświetlane ogólnie: {etykieta: wartość}. */
(function () {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = n => window.Icons?.svg(n) || "";
  const ORTO = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}";
  const HIDE = /\b(stats-open|distance-mode|transit-module)\b/;
  let data = null, centra = null, cur = null, marker = null, viewer = null;
  const load = () => data || (data = Promise.all([
    fetch("data/urzedy.json").then(r => r.ok ? r.json() : null).catch(() => null),
    fetch("data/gminy-centra.json").then(r => r.ok ? r.json() : null).catch(() => null)
  ]).then(([u, c]) => { centra = c || {}; return u; }));

  async function nameOf(k) {
    const all = (await (window.PLOTS_GMINY?.all?.() || Promise.resolve([]))) || [];
    const g = all.find(x => x.k === k);
    return g ? g.n + (k[6] === "1" ? " (miasto)" : "") : k;
  }
  // Commons serves only standard thumbnail widths (500, 960, 1280...); other widths answer 400.
  const px = (u, w) => String(u).replace(/\/\d+px-/, `/${w}px-`), small = u => px(u, 500);

  /* Orthophoto around the seat (3x5 GUGiK tiles centred on the point): the fallback when no free photo exists. */
  function orto(lon, lat, z = 18) {
    const n = 2 ** z, la = lat * Math.PI / 180;
    const px = (lon + 180) / 360 * n * 256, py = (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n * 256;
    const tx = Math.floor(px / 256), ty = Math.floor(py / 256); let h = "";
    for (let x = tx - 2; x <= tx + 2; x++) for (let y = ty - 1; y <= ty + 1; y++)
      h += `<img alt="" loading="lazy" src="${ORTO.replace("{z}", z).replace("{y}", y).replace("{x}", x)}" style="left:calc(50% + ${Math.round(x * 256 - px)}px);top:calc(50% + ${Math.round(y * 256 - py)}px)">`;
    return `<div class="urz-orto">${h}<i class="urz-orto-pin"></i></div>`;
  }
  const credit = f => `${f.a ? esc(f.a) + ", " : ""}${f.d ? esc(f.d) + ", " : ""}<a href="${esc(f.p)}" target="_blank" rel="noopener noreferrer">${esc(f.l || "Wikimedia Commons")}</a>`;

  /* ---------- map ---------- */
  function mapRef() { return window.PLOTS?.map; }
  function hideAll() {
    marker?.remove(); marker = null;
    const map = mapRef(); if (map?.getSource("urz-link")) map.getSource("urz-link").setData({ type: "FeatureCollection", features: [] });
  }
  function draw() {
    const map = mapRef(); hideAll();
    if (map && !map.__urzHook) { map.__urzHook = true; map.on("styledata", () => { if (cur?.u.poza && !map.getSource("urz-link") && !HIDE.test(document.body.className)) setTimeout(draw, 50); }); }
    if (!map || !cur || HIDE.test(document.body.className)) return;
    const u = cur.u, el = document.createElement("div");
    el.className = "urz-pin";
    el.innerHTML = `<button type="button" class="urz-pin-b" aria-label="Urząd: ${esc(u.n)}. Zdjęcie i kontakty">${ic("bank")}<b>Urząd</b></button>` +
      `<div class="urz-peek" aria-hidden="true">${u.foto ? `<img alt="" src="${esc(small(u.foto.u))}">` : orto(u.c[0], u.c[1], 17)}<span>${esc(u.n)}<small>${esc(u.a)}</small></span></div>`;
    el.querySelector("button").addEventListener("click", e => { e.stopPropagation(); openPanel(); });
    marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(u.c).addTo(map);
    if (u.poza && centra?.[cur.k]) {
      if (!map.getSource("urz-link")) {
        map.addSource("urz-link", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "urz-link", type: "line", source: "urz-link", layout: { "line-cap": "round" }, paint: { "line-color": "#1c1c1e", "line-width": 2, "line-dasharray": [1.5, 2], "line-opacity": .8 } });
        map.addLayer({ id: "urz-link-c", type: "circle", source: "urz-link", filter: ["==", "$type", "Point"], paint: { "circle-radius": 4, "circle-color": "#fff", "circle-stroke-color": "#1c1c1e", "circle-stroke-width": 2 } });
      }
      const c = centra[cur.k];
      map.getSource("urz-link").setData({ type: "FeatureCollection", features: [
        { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [c, u.c] } },
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } }] });
    }
  }

  /* ---------- photo viewer ---------- */
  function items(u) {
    const list = [];
    if (u.foto) list.push({ ...u.foto, main: true });
    else list.push({ orto: true });
    (u.okolica || []).forEach(f => list.push(f));
    return list;
  }
  function openViewer(i) {
    if (!cur) return;
    const u = cur.u, list = items(u); let at = Math.max(0, Math.min(list.length - 1, i));
    viewer?.remove();
    viewer = document.createElement("div");
    viewer.className = "urz-view"; viewer.setAttribute("role", "dialog"); viewer.setAttribute("aria-label", "Zdjęcia urzędu i okolicy");
    const paint = () => {
      const f = list[at];
      viewer.innerHTML = `<div class="urz-view-top"><div><small>${f.main || f.orto ? "Siedziba urzędu" : "Okolica urzędu"}</small><b>${esc(u.n)}</b></div><button type="button" class="urz-x" data-urz-close aria-label="Zamknij">${ic("x")}</button></div>
        <div class="urz-stage">${f.orto ? orto(u.c[0], u.c[1], 19) : `<img alt="${esc(f.t || u.n)}" src="${esc(px(f.u, 1280))}">`}
        ${list.length > 1 ? `<button type="button" class="urz-nav" data-urz-step="-1" aria-label="Poprzednie" ${at ? "" : "disabled"}>${ic("caret-left")}</button><button type="button" class="urz-nav nx" data-urz-step="1" aria-label="Następne" ${at < list.length - 1 ? "" : "disabled"}>${ic("caret-right")}</button>` : ""}</div>
        <p class="urz-cap">${f.orto ? "Brak wolnego zdjęcia budynku. Widok z góry: ortofotomapa GUGiK, geoportal.gov.pl." : `${esc(f.t || "")}<br><span>Fot. ${credit(f)} · Wikimedia Commons</span>`}</p>
        ${list.length > 1 ? `<div class="urz-strip">${list.map((g, j) => `<button type="button" data-urz-go="${j}" aria-pressed="${j === at}" aria-label="Zdjęcie ${j + 1}">${g.orto ? orto(u.c[0], u.c[1], 17) : `<img alt="" loading="lazy" src="${esc(small(g.u))}">`}</button>`).join("")}</div>` : ""}`;
    };
    viewer.addEventListener("click", e => {
      if (e.target === viewer || e.target.closest("[data-urz-close]")) return closeViewer();
      const s = e.target.closest("[data-urz-step]"), g = e.target.closest("[data-urz-go]");
      if (s) { at = Math.max(0, Math.min(list.length - 1, at + +s.dataset.urzStep)); paint(); }
      if (g) { at = +g.dataset.urzGo; paint(); }
    });
    paint(); document.body.appendChild(viewer); viewer.querySelector(".urz-x").focus();
  }
  function closeViewer() { viewer?.remove(); viewer = null; }
  document.addEventListener("keydown", e => {
    if (!viewer) return;
    if (e.key === "Escape") closeViewer();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") viewer.querySelector(`[data-urz-step="${e.key === "ArrowLeft" ? -1 : 1}"]:not([disabled])`)?.click();
  });

  /* ---------- office panel (opened from the map button) ---------- */
  function row(label, value, href) {
    if (!value) return "";
    return `<div class="urz-row"><dt>${esc(label)}</dt><dd>${href ? `<a href="${esc(href)}" ${href.startsWith("http") ? 'target="_blank" rel="noopener noreferrer"' : ""}>${esc(value)}</a>` : esc(value)}</dd></div>`;
  }
  // Catalogue numbers come as "0757136438" or "+48 75..."; shown as 75 713 64 38 and dialled as +48757136438.
  const digits = n => String(n).replace(/\D/g, "").replace(/^48(?=\d{9}$)/, "").replace(/^0(?=\d{9}$)/, "");
  // Mobile prefixes read as 602 579 881, landlines with an area code as 75 713 64 38.
  const MOBILE = /^(45|50|51|53|57|60|66|69|72|73|78|79|88)/;
  const fmtTel = n => { const d = digits(n); return d.length !== 9 ? String(n) : MOBILE.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`; };
  const telHref = n => "tel:+48" + digits(n);
  // Phone numbers: the main one from the public-entity catalogue, then any found on the gmina's website (labelled).
  function phones(u) {
    const main = u.tel ? fmtTel(u.tel) : null;
    let h = row("Telefon", main, u.tel ? telHref(u.tel) : null);
    (u.tels || []).filter(t => fmtTel(t.n) !== main).slice(0, 12).forEach(t => { h += row(t.l || "Telefon", fmtTel(t.n), telHref(t.n)); });
    return h;
  }
  const g = q => "https://www.google.com/search?q=" + encodeURIComponent(q);
  // The head of the gmina elected in 2024 (PKW): name, committee, party; photo from Wikidata when it is the same person.
  function head(u) {
    const w = u.w; if (!w) return "";
    const where = (cur && document.querySelector("#gminaCard h2")?.firstChild?.textContent?.trim()) || u.n.replace(/^Urząd\s+/i, "");
    const ini = w.n.split(" ").map(x => x[0]).join("").slice(0, 2);
    const role = { Wójt: w.plec === "K" ? "Wójt" : "Wójt", Burmistrz: w.plec === "K" ? "Burmistrz" : "Burmistrz", Prezydent: w.plec === "K" ? "Prezydentka miasta" : "Prezydent miasta" }[w.f] || w.f;
    const bez = w.plec === "K" ? "bezpartyjna" : "bezpartyjny";
    const party = w.partia ? w.partia : w.lk ? `${bez}, z listy ${LISTA[w.logo] || w.kom}` : bez;
    const logo = w.logo ? `<img class="urz-wl-logo" alt="${esc(LOGO[w.logo])}" title="${esc(LOGO[w.logo])}" src="icons/partie/${esc(w.logo)}.png">` : "";
    const ph = w.foto ? `<a class="urz-wl-ph" href="${esc(w.wd || w.foto)}" target="_blank" rel="noopener noreferrer"><img alt="${esc(w.n)}" src="${esc(w.foto)}"></a>${logo ? `<span class="urz-wl-mini">${logo}</span>` : ""}`
      : logo ? `<span class="urz-wl-ph urz-wl-party">${logo}</span>` : `<span class="urz-wl-ph urz-wl-ini">${esc(ini)}</span>`;
    return `<section class="urz-wl"><div class="urz-wl-top"><span class="urz-wl-av">${ph}</span>
      <div><small>${esc(role)}</small><b>${esc(w.n)}</b><em>${esc(party)}</em>${staz(w)}</div></div>
      <dl class="urz-kontakt urz-wl-dl">${row("Komitet", w.kom)}${w.pop ? row("Poparcie", w.pop) : ""}${w.proc != null ? row("Wynik w 2024", `${String(w.proc).replace(".", ",")}%${w.tura === 2 ? " w II turze" : " w I turze"}`) : ""}${w.wiek ? row("Wiek w 2024", w.wiek + " lat") : ""}</dl>
      <div class="urz-wl-acts"><button type="button" data-wl-pl>${ic("poland")}Pokaż komitet w Polsce</button><button type="button" data-wl-hist>${ic("clock")}Zobacz historię</button></div>
      <div class="urz-wl-links"><a href="${g(`${w.n} ${w.urzad || where}`)}" target="_blank" rel="noopener noreferrer">${ic("magnifying-glass")}Szukaj w Google</a><a href="${g(`${w.n} ${w.f}`)}&tbm=isch" target="_blank" rel="noopener noreferrer">${ic("image")}Zdjęcia w Google</a></div>
      <p class="urz-src">Wybrany w wyborach samorządowych 2024 (PKW). Staż liczony z wyborów powszechnych od 2002 r. (PKW, danewyborcze.kbw.gov.pl); objęcie urzędu w wyborach przedterminowych nie jest liczone. Późniejsze zmiany nie są uwzględnione.${w.logo ? " Znaczki partii: Wikimedia Commons." : ""}</p></section>`;
  }
  const LOGO = { pis: "Prawo i Sprawiedliwość", psl: "Polskie Stronnictwo Ludowe", ko: "Koalicja Obywatelska", lewica: "Nowa Lewica", pl2050: "Polska 2050", nowoczesna: "Nowoczesna", sp: "Suwerenna Polska", nn: "Nowa Nadzieja", td: "Trzecia Droga" };
  const LISTA = { pis: "PiS", ko: "Koalicji Obywatelskiej", td: "Trzeciej Drogi", lewica: "Lewicy" };
  function staz(w) {
    if (!w.od) return "";
    const lat = new Date().getFullYear() - w.od, kad = w.kad || 1;
    const lw = lat === 1 ? "rok" : lat % 10 >= 2 && lat % 10 <= 4 && (lat % 100 < 12 || lat % 100 > 14) ? "lata" : "lat";
    const txt = w.od >= 2024 ? `Pierwsza kadencja, od ${w.od} r.` : `Rządzi od ${w.od} r. · ${lat} ${lw} · ${kad}. kadencja${w.od === 2002 ? " (od pierwszych wyborów bezpośrednich)" : ""}`;
    return `<span class="urz-wl-staz">${ic("clock")}${esc(txt)}</span>`;
  }
  /* Who ran the gmina since 2002 (PKW general elections), for the Wybory tab: one row per election, same person joined. */
  function rulers(u) {
    const w = u?.w; if (!w) return "";
    const rows = [[2024, w.n, w.komn || w.kom, w.proc, w.tura], ...(w.hist || [])];
    const people = [...new Set(rows.map(r => r[1]))];
    const hue = n => ["#0a84ff", "#e8590c", "#2f9e44", "#ae3ec9", "#c2255c", "#1098ad", "#f08c00"][people.indexOf(n) % 7];
    const where = u.n.replace(/^Urząd\s+/i, "");
    const li = (r, i) => {
      const same = rows[i + 1] && rows[i + 1][1] === r[1];
      const pr = r[3] != null ? `${String(r[3]).replace(".", ",")}%${r[4] === 2 ? " w II turze" : ""}` : r[4] === 2 ? "w II turze" : "";
      return `<li class="rl-row${same ? " rl-same" : ""}" style="--rl:${hue(r[1])}"><span class="rl-year">${r[0]}</span><div><a href="${g(`${r[1]} ${where}`)}" target="_blank" rel="noopener noreferrer">${esc(r[1])}</a><small>${esc(r[2] || "")}</small></div><b>${esc(pr)}</b></li>`;
    };
    const n = people.length;
    return `<section class="rl"><h3>Kto rządził gminą</h3><p class="muted small">Od 2002 r. ${n === 1 ? "rządzi ta sama osoba" : `${n < 5 ? `rządziły ${n} osoby` : `rządziło ${n} osób`}`}. Wyniki zwycięzców w wyborach powszechnych, nazwisko otwiera wyszukiwanie w Google.</p>
      <ol class="rl-list">${rows.map(li).join("")}</ol>
      <p class="urz-src">Źródło: PKW (danewyborcze.kbw.gov.pl, wybory2018.pkw.gov.pl, wybory2024.pkw.gov.pl). Wybory przedterminowe i odwołania w referendum nie są ujęte.</p></section>`;
  }
  /* People we add ourselves (osoby.json in the generator): name links to a Google search. */
  function people(u) {
    if (!u.os?.length) return "";
    const item = p => `<li class="urz-my-item"><div class="urz-my-main">${p.n ? `<a class="urz-my-name" href="${g(`${p.n} ${p.r || ""} ${u.n}`.replace(/\s+/g, " ").trim())}" target="_blank" rel="noopener noreferrer">${esc(p.n)}${ic("magnifying-glass")}</a>` : ""}${p.r ? `<small>${esc(p.r)}</small>` : ""}
        ${p.t ? `<a class="urz-my-tel" href="${telHref(p.t)}">${ic("phone")}${esc(fmtTel(p.t))}</a>` : ""}${p.m ? `<a class="urz-my-tel" href="mailto:${esc(p.m)}">${ic("envelope")}${esc(p.m)}</a>` : ""}${p.x ? `<p>${esc(p.x)}</p>` : ""}</div></li>`;
    return `<h3 class="urz-h">Osoby do kontaktu</h3><section class="urz-my"><ul>${u.os.map(item).join("")}</ul></section>`;
  }
  /* Companies the gmina owns shares in (KRS) and its budget units (KPP). Board names only when the company's own site matches KRS. */
  const BR = { "Woda i ścieki": ["drop", "#1c7ed6"], "Odpady": ["recycle", "#2f9e44"], "Energia i ciepło": ["lightning", "#e8590c"], "Transport": ["bus", "#7048e8"],
    "Mieszkania (TBS)": ["house-line", "#c2255c"], "Mieszkania i nieruchomości": ["house", "#c2255c"], "Zdrowie i opieka": ["first-aid-kit", "#e03131"], "Sport i rekreacja": ["soccer-ball", "#0ca678"],
    "Kultura": ["books", "#ae3ec9"], "Turystyka": ["mountains", "#1098ad"], "Usługi komunalne": ["buildings", "#5c7cfa"], "Drogi i budowy": ["road-horizon", "#868e96"], "Zieleń i utrzymanie": ["tree", "#37b24d"],
    "Finanse": ["coins", "#f08c00"], "Handel": ["storefront", "#d6336c"], "Cmentarze": ["cross", "#495057"], "Edukacja i badania": ["graduation-cap", "#4263eb"], "Rolnictwo i lasy": ["plant", "#5c940d"], "Weterynaria": ["paw-print", "#a61e4d"], "Telekomunikacja i IT": ["wifi-high", "#0b7285"], "Usługi i zarządzanie": ["buildings", "#5c7cfa"] };
  const zl = v => v >= 1e6 ? `${(v / 1e6).toLocaleString("pl-PL", { maximumFractionDigits: v >= 1e8 ? 0 : 1 })} mln zł` : `${Math.round(v).toLocaleString("pl-PL")} zł`;
  const hrefWww = w => /^https?:\/\//i.test(w) ? w : "http://" + w.toLowerCase();
  function companies(u) {
    const all = u.sp || []; if (!all.length) return "";
    const sp = all.filter(x => x.krs), jd = all.filter(x => !x.krs);
    const card = (x, i) => {
      const [ico, col] = BR[x.br] || ["buildings", "#495057"];
      const share = x.u != null ? `<span class="sp-u">${String(x.u).replace(".", ",")}% udziałów gminy</span>` : "";
      const board = x.z?.length ? x.z.map(p => row(p.f, p.n, g(`${p.n} ${x.n}`))).join("")
        : (x.zarz?.length ? row("Zarząd", x.zarz.join(", ")) + `<div class="urz-row"><dt></dt><dd><a href="${g(`prezes zarządu ${x.n}`)}" target="_blank" rel="noopener noreferrer">Kto jest prezesem? Szukaj w Google</a></dd></div>` : "");
      const tel = x.tel || x.tels?.[0]?.n;
      return `<li class="sp-card${i >= 3 ? " sp-more" : ""}" style="--sp:${col}"><div class="sp-top"><span class="sp-ic">${ic(ico)}</span><div><b>${esc(x.n)}</b><small>${esc(x.br || "")}${x.forma ? " · " + esc(x.forma) : ""}${x.lik ? " · w likwidacji" : ""}</small>${share}</div></div>
        <dl class="urz-kontakt sp-dl">${row("Adres", `${x.a}, ${x.pc}`)}${tel ? row("Telefon", fmtTel(tel), telHref(tel)) : ""}${x.www ? row("Strona", x.www.replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase(), hrefWww(x.www)) : ""}
        ${board}${x.kap ? row("Kapitał", zl(x.kap)) : ""}${x.pkd ? row("Działalność", x.pkd) : ""}${x.w?.length ? row("Wspólnicy", x.w.join(", ")) : ""}${x.rn ? row("Rada nadzorcza", `${x.rn} ${x.rn === 1 ? "osoba" : x.rn < 5 ? "osoby" : "osób"}`) : ""}${x.krs ? row("KRS", `${x.krs}${x.od ? ` · w rejestrze od ${x.od}` : ""}`) : ""}</dl></li>`;
    };
    const kap = sp.reduce((t, x) => t + (x.kap && x.u != null ? x.kap * x.u / 100 : 0), 0);
    const head = sp.length ? `<p class="muted small">Gmina ma udziały w ${sp.length} ${sp.length === 1 ? "spółce" : "spółkach"}${kap ? `; jej część kapitału to ok. ${zl(kap)}` : ""}.</p>` : "";
    const units = jd.length ? `<h4 class="sp-h4">Jednostki gminy</h4><ul class="sp-units">${jd.map(x => `<li><b>${esc(x.n)}</b><span>${esc(x.a)}, ${esc(x.pc)}</span>${x.tel ? `<a href="${telHref(x.tel)}">${esc(fmtTel(x.tel))}</a>` : ""}${x.www ? `<a href="${esc(hrefWww(x.www))}" target="_blank" rel="noopener noreferrer">${esc(x.www.replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase())}</a>` : ""}</li>`).join("")}</ul>` : "";
    return `<h3 class="urz-h">Spółki i jednostki gminy</h3>${head}${sp.length ? `<ul class="sp-list">${sp.map(card).join("")}</ul>${sp.length > 3 ? `<button type="button" class="sp-all" data-sp-all>Pokaż wszystkie spółki (${sp.length})</button>` : ""}` : ""}${units}
      <p class="urz-src">Spółki: Krajowy Rejestr Sądowy (api-krs.ms.gov.pl) i Katalog Podmiotów Publicznych. Nazwiska zarządu ze stron spółek, tylko gdy zgadzają się z wpisem w KRS. Udział z wartości udziałów gminy w kapitale zakładowym.</p>`;
  }
  /* From the gmina's BIP: office hours (today highlighted) and departments with their phones. */
  function bipBlock(u) {
    if (!u.godz?.length && !u.ref?.length) return "";
    const today = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"][new Date().getDay()];
    const hours = u.godz?.length ? `<h3 class="urz-h">Godziny pracy</h3><dl class="urz-kontakt urz-godz">${u.godz.map(([d, h]) => `<div class="urz-row${d === today ? " is-today" : ""}"><dt>${esc(d)}${d === today ? " · dziś" : ""}</dt><dd>${esc(h)}</dd></div>`).join("")}</dl>` : "";
    const refs = u.ref?.length ? `<h3 class="urz-h">Referaty i wydziały</h3><dl class="urz-kontakt urz-ref">${u.ref.map(r => `<div class="urz-row"><dt>${esc(r.n)}</dt><dd>${r.t ? `<a href="${telHref(r.t)}">${esc(fmtTel(r.t))}</a>` : ""}</dd></div>`).join("")}</dl>` : "";
    return hours + refs + `<p class="urz-src">Z <a href="${esc(u.bipu)}" target="_blank" rel="noopener noreferrer">Biuletynu Informacji Publicznej gminy</a>, zebrane automatycznie. Mogą być nieaktualne.</p>`;
  }
  let panel = null, src = null;
  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("aside");
    panel.id = "urzPanel"; panel.className = "floating-panel urz-panel"; panel.hidden = true; panel.setAttribute("aria-label", "Urząd gminy");
    document.body.append(panel);
    return panel;
  }
  async function renderPanel() {
    const p = ensurePanel(); if (!cur) return;
    const { k, u } = cur, poza = u.poza ? await nameOf(u.poza) : null;
    if (!cur || cur.k !== k) return;
    const hero = u.foto ? `<img alt="Budynek: ${esc(u.n)}" src="${esc(px(u.foto.u, 960))}">` : orto(u.c[0], u.c[1], 18);
    const n = (u.okolica || []).length;
    p.innerHTML = `<header class="section-head urz-head"><h2>${ic("bank")}Urząd gminy</h2><button class="icbtn" type="button" data-urz-panel-close aria-label="Zamknij panel urzędu">${ic("x")}</button></header>
     <div class="urz-body"><section class="urz">
      <button type="button" class="urz-hero" data-urz-open="0">${hero}<span class="urz-grad"></span><span class="urz-ttl"><small>Siedziba urzędu</small><b>${esc(u.n)}</b><em>${esc(u.a)}, ${esc(u.pc)}</em></span>${n ? `<span class="urz-cnt">${ic("image")}${n + 1}</span>` : ""}</button>
      ${n ? `<div class="urz-thumbs" aria-label="Okolica urzędu">${u.okolica.map((f, j) => `<button type="button" data-urz-open="${j + 1}" aria-label="Okolica, zdjęcie ${j + 1}"><img alt="" loading="lazy" src="${esc(small(f.u))}"></button>`).join("")}</div>` : ""}
      ${poza ? `<p class="urz-poza">${ic("map-pin")}<span>Urząd stoi poza gminą, w gminie ${esc(poza)}. To częste w gminach wiejskich otaczających miasto. Na mapie łączy go przerywana linia ze środkiem gminy.</span></p>` : ""}
      <div class="urz-actions">${u.tel ? `<a class="urz-act" href="${telHref(u.tel)}">${ic("phone")}Zadzwoń</a>` : ""}<a class="urz-act" href="https://www.google.com/maps/dir/?api=1&destination=${u.c[1]},${u.c[0]}" target="_blank" rel="noopener noreferrer">${ic("navigation-arrow")}Prowadź</a>${u.www ? `<a class="urz-act" href="${esc(u.www)}" target="_blank" rel="noopener noreferrer">${ic("link")}Strona</a>` : ""}</div>
      ${head(u)}
      <h3 class="urz-h">Kontakt</h3>
      <dl class="urz-kontakt">
        ${row("Adres", `${u.a}, ${u.pc}`)}${phones(u)}
        ${row("Strona", u.www?.replace(/^https?:\/\//, "").replace(/\/$/, ""), u.www)}${u.mail ? row("E-mail", u.mail, "mailto:" + u.mail) : ""}${u.bipu ? row("BIP", u.bipu.replace(/^https?:\/\//, "").replace(/\/$/, ""), u.bipu) : ""}
      </dl>
      ${u.tels?.length ? `<p class="urz-src">Dodatkowe numery zebrano automatycznie ze <a href="${esc(u.tsrc || u.www)}" target="_blank" rel="noopener noreferrer">strony gminy</a>. Mogą być nieaktualne.</p>` : ""}
      ${bipBlock(u)}
      ${companies(u)}
      ${people(u)}
      <button type="button" class="urz-map" data-urz-map>${ic("map-pin")}Pokaż urząd na mapie</button>
      <p class="urz-src">Dane: <a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(src.name)}</a>${u.q === 2 ? " · położenie przybliżone" : ""}${u.foto ? ` · fot. ${credit(u.foto)}, Wikimedia Commons` : " · widok: ortofotomapa GUGiK"}</p>
     </section></div>`;
  }
  function openPanel() {
    if (!cur) return;
    window.StatsMap?.isOpen() && window.StatsMap.close(); window.PLOTS?.closeLayers?.();
    if (window.DistanceModule?.isOpen()) window.DistanceModule.close();
    const was = !ensurePanel().hidden;
    panel.hidden = false; document.body.classList.add("urz-open"); renderPanel(); panel.querySelector(".urz-body")?.scrollTo(0, 0);
    if (!was) window.UIHistory?.open?.("urzad", () => closePanel({ history: false }));
  }
  function closePanel(o = {}) {
    if (!panel || panel.hidden) return;
    panel.hidden = true; document.body.classList.remove("urz-open");
    if (o.history !== false) window.UIHistory?.dismiss?.("urzad");
  }
  document.addEventListener("click", e => {
    const o = e.target.closest("[data-urz-open]"); if (o) { openViewer(+o.dataset.urzOpen); return; }
    if (e.target.closest("[data-urz-panel-close]")) { closePanel(); return; }
    const all = e.target.closest("[data-sp-all]"); if (all) { all.previousElementSibling?.classList.add("sp-open"); all.remove(); return; }
    if (e.target.closest("[data-wl-pl]") && cur?.u.w) { const w = cur.u.w; closePanel(); window.StatsMap?.open("wl_komitet", { hl: w.komn || w.kom }); return; }
    if (e.target.closest("[data-wl-hist]") && cur) { closePanel(); window.PLOTS_GMINY?.openDetails(false, "Wybory"); return; }
    if (e.target.closest("[data-urz-map]") && cur) { draw(); window.PLOTS?.framePoint(cur.u.c[0], cur.u.c[1], 16.5); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !viewer && panel && !panel.hidden) closePanel(); });

  document.addEventListener("plots:gmina", async e => {
    const k = e.detail?.id;
    if (!k) { cur = null; hideAll(); closePanel(); return; }
    const d = await load(); const u = d?.urzedy?.[k];
    if (!u) { cur = null; hideAll(); closePanel(); return; }
    src = { name: d.zrodlo || "Katalog Podmiotów Publicznych, gov.pl", url: d.zrodloUrl || "https://www.gov.pl/web/kap" };
    cur = { k, u }; draw();
    if (panel && !panel.hidden) renderPanel();
  });
  // Like the commuting arrows: the seat marker belongs to the gmina view only, not to statistics or distances.
  new MutationObserver(() => {
    const hid = HIDE.test(document.body.className);
    if (hid) closePanel();
    if (!cur) return;
    if (hid && marker) hideAll(); else if (!hid && !marker) draw();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  window.Urzedy = { rulers, open: openPanel, close: closePanel, photos: openViewer, get: k => load().then(d => d?.urzedy?.[k] || null) };
})();
