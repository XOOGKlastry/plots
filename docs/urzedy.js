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
  // Phone numbers: the main one from the public-entity catalogue, then any found on the gmina's website (labelled).
  function phones(u) {
    const tel = n => "tel:+48" + String(n).replace(/\D/g, "").replace(/^48(?=\d{9}$)/, "");
    let h = row("Telefon", u.tel, u.tel ? tel(u.tel) : null);
    (u.tels || []).filter(t => t.n !== u.tel).slice(0, 12).forEach(t => { h += row(t.l || "Telefon", t.n, tel(t.n)); });
    return h;
  }
  const g = q => "https://www.google.com/search?q=" + encodeURIComponent(q);
  // The head of the gmina elected in 2024 (PKW): name, committee, party; photo from Wikidata when it is the same person.
  function head(u) {
    const w = u.w; if (!w) return "";
    const where = (cur && document.querySelector("#gminaCard h2")?.firstChild?.textContent?.trim()) || u.n.replace(/^Urząd\s+/i, "");
    const ini = w.n.split(" ").map(x => x[0]).join("").slice(0, 2);
    const role = { Wójt: w.plec === "K" ? "Wójt" : "Wójt", Burmistrz: w.plec === "K" ? "Burmistrz" : "Burmistrz", Prezydent: w.plec === "K" ? "Prezydentka miasta" : "Prezydent miasta" }[w.f] || w.f;
    const party = w.partia ? w.partia : (w.plec === "K" ? "bezpartyjna" : "bezpartyjny");
    return `<section class="urz-wl"><div class="urz-wl-top">${w.foto ? `<a class="urz-wl-ph" href="${esc(w.wd || w.foto)}" target="_blank" rel="noopener noreferrer"><img alt="${esc(w.n)}" src="${esc(w.foto)}"></a>` : `<span class="urz-wl-ph urz-wl-ini">${esc(ini)}</span>`}
      <div><small>${esc(role)}</small><b>${esc(w.n)}</b><em>${esc(party)}</em></div></div>
      <dl class="urz-kontakt urz-wl-dl">${row("Komitet", w.kom)}${w.pop ? row("Poparcie", w.pop) : ""}${w.proc != null ? row("Wynik w 2024", `${String(w.proc).replace(".", ",")}%${w.tura === 2 ? " w II turze" : " w I turze"}`) : ""}${w.wiek ? row("Wiek w 2024", w.wiek + " lat") : ""}</dl>
      <div class="urz-wl-links"><a href="${g(`${w.n} ${w.urzad || where}`)}" target="_blank" rel="noopener noreferrer">${ic("magnifying-glass")}Szukaj w Google</a><a href="${g(`${w.n} ${w.f}`)}&tbm=isch" target="_blank" rel="noopener noreferrer">${ic("image")}Zdjęcia w Google</a></div>
      <p class="urz-src">Wybrany w wyborach samorządowych 2024 (PKW). Późniejsze zmiany, np. przedterminowe wybory, nie są tu uwzględnione.</p></section>`;
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
    const bip = u.bip && typeof u.bip === "object" ? Object.entries(u.bip).map(([a, b]) => row(a, String(b))).join("") : "";
    p.innerHTML = `<header class="section-head urz-head"><h2>${ic("bank")}Urząd gminy</h2><button class="icbtn" type="button" data-urz-panel-close aria-label="Zamknij panel urzędu">${ic("x")}</button></header>
     <div class="urz-body"><section class="urz">
      <button type="button" class="urz-hero" data-urz-open="0">${hero}<span class="urz-grad"></span><span class="urz-ttl"><small>Siedziba urzędu</small><b>${esc(u.n)}</b><em>${esc(u.a)}, ${esc(u.pc)}</em></span>${n ? `<span class="urz-cnt">${ic("image")}${n + 1}</span>` : ""}</button>
      ${n ? `<div class="urz-thumbs" aria-label="Okolica urzędu">${u.okolica.map((f, j) => `<button type="button" data-urz-open="${j + 1}" aria-label="Okolica, zdjęcie ${j + 1}"><img alt="" loading="lazy" src="${esc(small(f.u))}"></button>`).join("")}</div>` : ""}
      ${poza ? `<p class="urz-poza">${ic("map-pin")}<span>Urząd stoi poza gminą, w gminie ${esc(poza)}. To częste w gminach wiejskich otaczających miasto. Na mapie łączy go przerywana linia ze środkiem gminy.</span></p>` : ""}
      <div class="urz-actions">${u.tel ? `<a class="urz-act" href="tel:+48${u.tel.replace(/\D/g, "")}">${ic("phone")}Zadzwoń</a>` : ""}<a class="urz-act" href="https://www.google.com/maps/dir/?api=1&destination=${u.c[1]},${u.c[0]}" target="_blank" rel="noopener noreferrer">${ic("navigation-arrow")}Prowadź</a>${u.www ? `<a class="urz-act" href="${esc(u.www)}" target="_blank" rel="noopener noreferrer">${ic("link")}Strona</a>` : ""}</div>
      ${head(u)}
      <h3 class="urz-h">Kontakt</h3>
      <dl class="urz-kontakt">
        ${row("Adres", `${u.a}, ${u.pc}`)}${phones(u)}
        ${row("Strona", u.www?.replace(/^https?:\/\//, "").replace(/\/$/, ""), u.www)}${u.mail ? row("E-mail", u.mail, "mailto:" + u.mail) : ""}${bip}
      </dl>
      ${u.tels?.length ? `<p class="urz-src">Dodatkowe numery zebrano automatycznie ze <a href="${esc(u.tsrc || u.www)}" target="_blank" rel="noopener noreferrer">strony gminy</a>. Mogą być nieaktualne.</p>` : ""}
      ${bip ? "" : `<p class="urz-soon">${ic("clock")}Wkrótce tu: sekretariat, referaty i godziny pracy z BIP gminy.</p>`}
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
  window.Urzedy = { open: openPanel, close: closePanel, photos: openViewer, get: k => load().then(d => d?.urzedy?.[k] || null) };
})();
