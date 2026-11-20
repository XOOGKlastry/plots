/* Extra thematic layers built from static files in docs/data (GeoJSON or JSON turned into GeoJSON): air quality stations,
   road and rail investments, planned high-speed rail, airports, military zones and other national datasets.
   Each layer is a small description (panel entry, map style, legend, card); data is fetched only when the layer is switched on.
   Tapping a point or line opens a short card with the source and a link to the official page. */
(function () {
  "use strict";
  const app = window.PLOTS, map = app && app.map, esc = app && app.esc, svg = n => window.Icons.svg(n);
  if (!app || !map) return;
  const fmt = (v, d = 1) => (+v).toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
  const link = (href, text) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>` : "";
  const row = (k, v) => v || v === 0 ? `<p><span class="muted">${esc(k)}:</span> <b>${esc(String(v))}</b></p>` : "";
  const legendRow = items => `<div class="terr-legend">${items.map(([c, l, kind]) => `<span><i style="${kind === "line" ? `background:${c};height:3px;border-radius:2px` : kind === "dash" ? `background:repeating-linear-gradient(90deg,${c} 0 5px,transparent 5px 8px);height:3px;border:0` : kind === "box" ? `background:${c};opacity:.75;border-radius:2px` : `background:${c};border-radius:50%`}"></i>${esc(l)}</span>`).join("")}</div>`;
  const note = t => `<small class="terr-unit">${esc(t)}</small>`;
  const dist = (a, b) => { const k = Math.PI / 180, x = (b.lon - a.lon) * k * Math.cos((a.lat + b.lat) / 2 * k), y = (b.lat - a.lat) * k; return Math.hypot(x, y) * 6371000; };
  const fmtD = m => m < 950 ? `${Math.round(m / 10) * 10} m` : `${fmt(m / 1000, m < 10000 ? 1 : 0)} km`;

  /* ---------- Susza (PPSS 2021, Wody Polskie): hexagon hazard classes dissolved per type, one file per type ---------- */
  const SU_T = { r: ["rolnicza", "suszą rolniczą", "susza_rolnicza_klasa"], h: ["hydrologiczna", "suszą hydrologiczną", "susza_hydro_klasa"],
    g: ["hydrogeologiczna", "suszą hydrogeologiczną", "susza_hgeo_klasa"], l: ["łącznie", "suszą (wszystkie rodzaje łącznie)", "susza_lacz_proc"], a: ["atmosferyczna", "suszą atmosferyczną", "susza_atmo_proc"] };
  const SU_C = { 1: ["#9bc96b", "I słabe"], 2: ["#f2e14c", "II umiarkowane"], 3: ["#f59f1b", "III silne"], 4: ["#e0441f", "IV ekstremalne"] };
  let suT = (() => { try { const v = app.store.get("susza.t", "r"); return SU_T[v] ? v : "r"; } catch (e) { return "r"; } })();
  const suFile = t => fetch(`data/susza/ppss2021_${t}.geojson`).then(r => { if (!r.ok) throw Error(r.status); return r.json(); });
  const suLegend = () => `<div class="stats-seg ext-seg su-seg" role="group" aria-label="Rodzaj suszy">${Object.entries(SU_T).map(([k, v]) => `<button type="button" data-su="${k}" aria-pressed="${k === suT}">${esc(v[0])}</button>`).join("")}</div>` +
    legendRow(Object.entries(SU_C).filter(([c]) => suT !== "a" || c > 1).map(([, [c, l]]) => [c, l, "box"])) +
    note("Klasy zagrożenia z Planu przeciwdziałania skutkom suszy z 2021 r. (Wody Polskie), siatka heksagonów około 3,5 km². Projekt aktualizacji planu z 2026 r. (konsultacje do 6.02.2027) podaje klasy dla całych gmin, są w Statystykach w grupie „Susza (plany Wód Polskich)”.");

  /* ---------- Wody Polskie: Geobaza 2aPGW (plany gospodarowania wodami), zlewnie JCWP, wody podziemne, rzeki, administracja, obszary chronione ---------- */
  const WP_SRC = "Wody Polskie, Geobaza 2aPGW (drugie aktualizacje planów gospodarowania wodami na obszarach dorzeczy, wersja 15.09.2023)";
  const WP_T = { s: ["stan wód", "Ogólny stan wód"], e: ["ekologiczny", "Stan lub potencjał ekologiczny"], c: ["chemiczny", "Stan chemiczny"], r: ["ryzyko", "Ryzyko nieosiągnięcia celów środowiskowych"] };
  const WP_C = { s: [[0, "#4dabf7", "dobry"], [1, "#e8590c", "zły"], [9, "#ced4da", "brak oceny"]],
    e: [[1, "#1c7ed6", "bardzo dobry"], [2, "#40c057", "dobry"], [3, "#fcc419", "umiarkowany"], [4, "#fd7e14", "słaby"], [5, "#e03131", "zły"], [9, "#ced4da", "brak oceny"]],
    c: [[0, "#4dabf7", "dobry"], [1, "#e03131", "poniżej dobrego"], [9, "#ced4da", "brak oceny"]],
    r: [[0, "#69db7c", "niezagrożone"], [1, "#f76707", "zagrożone"]] };
  let wpT = (() => { try { const v = app.store.get("wody.t", "s"); return WP_T[v] ? v : "s"; } catch (e) { return "s"; } })();
  const wpColor = t => ["match", ["get", t], ...WP_C[t].flatMap(([v, c]) => [v, c]), "#ced4da"];
  const wpLegend = () => `<div class="stats-seg ext-seg su-seg" role="group" aria-label="Co pokazać">${Object.entries(WP_T).map(([k, v]) => `<button type="button" data-wp="${k}" aria-pressed="${k === wpT}">${esc(v[0])}</button>`).join("")}</div>` +
    legendRow(WP_C[wpT].map(([, c, l]) => [c, l, "box"])) + note("Zlewnie jednolitych części wód powierzchniowych (JCWP) z planów gospodarowania wodami. Kliknij zlewnię: stan, presje, cele i terminy.");
  const wpRow = (l, v) => v ? `<p><span class="muted">${esc(l)}:</span> ${esc(v)}</p>` : "";
  function jcwpBody(kod, d) {
    const r = d?.jcwp?.[kod]; if (!r) return `<p class="muted">Kod ${esc(kod)}. Szczegóły jeszcze się wczytują, kliknij ponownie za chwilę.</p>`;
    const F = d.pola, v = n => { const x = r[F.indexOf(n) + 1]; return x == null ? "" : d.slownik[x]; };
    const zly = /zły/.test(v("ocena_st")), ryz = /^jcwp zagrożona/.test(v("oc_ryz"));
    return `<p class="gs-st"><i style="background:${zly ? "#e8590c" : v("ocena_st") ? "#4dabf7" : "#ced4da"}"></i>${esc(v("ocena_st") || "stan nieoceniony")}</p>` +
      wpRow("Kod", kod) + wpRow("Typ", v("typ_jcwp")) + wpRow("Status", v("status_os")) + wpRow("Stan ekologiczny", v("st_eko")) + wpRow("Stan chemiczny", v("st_chem")) +
      `<p><span class="muted">Ryzyko:</span> <b style="color:${ryz ? "#d9480f" : "#2b8a3e"}">${esc(v("oc_ryz") || "brak danych")}</b></p>` +
      wpRow("Odstępstwo", v("typ_odst")) + wpRow("Termin osiągnięcia celu", v("cs_termin")) +
      wpRow("Presja: źródła eutrofizacji", v("pr_trofi")) + wpRow("Presja hydromorfologiczna", v("pr_hymo")) + wpRow("Presja ilościowa", v("pr_il")) +
      wpRow("Region wodny", v("reg_wodny")) + wpRow("RZGW", v("rzgw")) +
      `<p class="muted small">${link("https://apgw.gov.pl/", "Plany gospodarowania wodami (apgw.gov.pl)")}</p>`;
  }
  let pdT = "s";
  const pdColor = () => ["match", ["get", pdT], 1, "#e8590c", "#74c0fc"];
  const pdLegend = () => `<div class="stats-seg ext-seg su-seg" role="group" aria-label="Co pokazać"><button type="button" data-pd="s" aria-pressed="${pdT === "s"}">stan</button><button type="button" data-pd="r" aria-pressed="${pdT === "r"}">ryzyko</button></div>` +
    legendRow(pdT === "s" ? [["#74c0fc", "dobry", "box"], ["#e8590c", "słaby", "box"]] : [["#74c0fc", "niezagrożone", "box"], ["#e8590c", "zagrożone", "box"]]) + note("Jednolite części wód podziemnych (JCWPd), 174 obszary w Polsce.");
  const OCH = { PN: ["park narodowy", "#2b8a3e"], PK: ["park krajobrazowy", "#74b816"], Rez: ["rezerwat", "#087f5b"], "N2k SOO": ["Natura 2000, siedliska", "#1971c2"], "N2k OSO": ["Natura 2000, ptaki", "#4dabf7"],
    UE: ["użytek ekologiczny", "#f08c00"], OchK: ["obszar chronionego krajobrazu", "#c0eb75"], ZPK: ["zespół przyrodniczo-krajobrazowy", "#a9e34b"], SD: ["stanowisko dokumentacyjne", "#ae3ec9"], PP: ["pomnik przyrody", "#9c36b5"] };
  const ochColor = ["match", ["get", "t"], ...Object.entries(OCH).flatMap(([k, v]) => [k, v[1]]), "#868e96"];

  /* ---------- Stare mapy: zeskanowane arkusze z georeferencją z narożników ramki, kafle XYZ w data/stare/<seria> (mapgen/stare_mapy/stare.py) ---------- */
  const STARE = {
    mtb: { n: "Messtischblatt", d: "pruska mapa 1:25 000, arkusz 5878 Orzesche, 1884", src: "Archiwum Map Zachodniej Polski (igrek.amzp.pl), skan Biblioteki Narodowej" },
    wig: { n: "WIG", d: "mapa Wojskowego Instytutu Geograficznego 1:25 000, arkusz Orzesze, 1933", src: "Archiwum Map Zachodniej Polski (igrek.amzp.pl), skan Archiwum Map WIG" } };
  const STARE_BB = [18.6667, 50.0833, 18.8333, 50.2];
  let stT = (() => { try { const v = app.store.get("stare.t", "mtb"); return STARE[v] ? v : "mtb"; } catch (e) { return "mtb"; } })();
  let stOp = 1;
  const stUrl = t => new URL(`data/stare/${t}/{z}/{x}/{y}.webp`, location.href).href.replace(/%7B/g, "{").replace(/%7D/g, "}");
  const stLegend = () => `<div class="stats-seg ext-seg su-seg" role="group" aria-label="Seria map">${Object.entries(STARE).map(([k, v]) => `<button type="button" data-st="${k}" aria-pressed="${k === stT}">${esc(v.n)}</button>`).join("")}</div>` +
    `<div class="stats-seg ext-seg su-seg" role="group" aria-label="Przezroczystość">${[[1, "pełna"], [.7, "70%"], [.45, "45%"]].map(([v, l]) => `<button type="button" data-sto="${v}" aria-pressed="${v === stOp}">${l}</button>`).join("")}</div>` +
    note(`${STARE[stT].d}. Na razie tylko gmina Orzesze (próba). Arkusz ustawiony według narożników ramki, możliwe przesunięcie do około 100 m. Źródło: ${STARE[stT].src}.`) +
    `<p class="small"><a href="#" data-st-go>Pokaż Orzesze na mapie</a></p>`;

  /* ---------- GIOŚ stations ---------- */
  const NORM = { pm25: [10, 20], pm10: [20, 40], pm10_36: [45, 50], no2: [20, 40], bap: [1, 1], arsen: [6, 6], o3_dni: [18, 25], so2: [20, 20] };
  const PNAME = { pm25: "PM2,5", pm10: "PM10", pm10_36: "PM10, 36. doba", no2: "NO₂", bap: "benzo(a)piren", arsen: "arsen", o3_dni: "ozon, dni > 120", so2: "SO₂" };
  const PUNIT = { pm25: "µg/m³", pm10: "µg/m³", pm10_36: "µg/m³", no2: "µg/m³", bap: "ng/m³", arsen: "ng/m³", o3_dni: "dni", so2: "µg/m³" };
  const status = pom => { let s = Object.keys(pom).length ? 1 : 0; for (const [k, v] of Object.entries(pom)) { const n = NORM[k]; if (!n) continue; if (v > n[1]) s = Math.max(s, 3); else if (v > n[0]) s = Math.max(s, 2); } return s; };
  const ST_COL = ["#8e8e93", "#34a383", "#f59e3e", "#e5513d"], ST_TXT = ["brak rocznej serii", "normy dotrzymane", "powyżej norm UE od 2030 r.", "przekroczona obecna norma"];
  const stationsGeo = d => ({ type: "FeatureCollection", features: d.stacje.map(s => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lon, s.lat] }, properties: { ...s, pom: JSON.stringify(s.pom), mod: JSON.stringify(s.mod), wsk: JSON.stringify(s.wsk), st: status(s.pom) } })) });
  const J = v => { try { return typeof v === "string" ? JSON.parse(v) : v || {}; } catch (e) { return {}; } };
  function stationBody(p, year) {
    const pom = J(p.pom), mod = J(p.mod), wsk = J(p.wsk), keys = Object.keys(PNAME).filter(k => pom[k] != null);
    const dg = k => PUNIT[k] === "ng/m³" ? 2 : PUNIT[k] === "dni" ? 0 : 1;
    return `<p class="gs-st"><i style="background:${ST_COL[p.st]}"></i>${esc(ST_TXT[p.st])}</p>` +
      row("Adres", [p.adres, p.miasto].filter(Boolean).join(", ")) + row("Typ stacji", [p.typ, p.obszar && "obszar " + p.obszar].filter(Boolean).join(", ")) + row("Działa od", p.od) +
      (wsk.length ? `<p><span class="muted">Mierzy:</span> ${esc(wsk.join(", "))}</p>` : "") +
      (keys.length ? `<table class="gs-tab"><thead><tr><th>Średnio w ${year} r.</th><th>pomiar</th><th>model</th></tr></thead><tbody>${keys.map(k => `<tr><td>${esc(PNAME[k])}</td><td><b class="gs-${pom[k] > NORM[k][1] ? "bad" : pom[k] > NORM[k][0] ? "warn" : "ok"}">${fmt(pom[k], dg(k))}</b></td><td>${mod[k] != null ? fmt(mod[k], dg(k)) : "–"}</td></tr>`).join("")}</tbody></table><p class="muted small">Jednostki: µg/m³, benzo(a)piren i arsen ng/m³, ozon w dniach. Model: ocena roczna GIOŚ 2025 w kratce, w której stoi stacja.</p>` : `<p class="muted small">Brak rocznej serii pomiarowej o kompletności co najmniej 75% w ${year} r.</p>`) +
      `<p>${link(`https://powietrze.gios.gov.pl/pjp/current/station_details/info/${p.id}`, "Aktualne pomiary i indeks jakości powietrza (GIOŚ)")}</p>`;
  }

  /* ---------- road investments ---------- */
  const ROAD_COL = { b: "#d9480f", p: "#7048e8" };
  const RS = { r: ["w realizacji", "#d9480f"], t: ["w przetargu", "#e8590c"], p: ["w przygotowaniu", "#7048e8"], u: ["w użytkowaniu", "#2b8a3e"] };
  const CLS = { A: "autostrada", S: "droga ekspresowa", DK: "droga krajowa", DW: "droga wojewódzka lub lokalna" };
  function roadCard(p, d, side) {
    const refs = (p.ref || "").split(";").map(x => x.trim()).filter(Boolean);
    const title = [refs.map(r => /^\d+$/.test(r) ? (+r < 100 ? "DK" : "DW") + r : r).join(", "), p.n].filter(Boolean).join(" ") || (p.k === "b" ? "Droga w budowie" : "Planowana droga");
    const odc = side && refs.length ? side.odcinki.filter(o => o.s !== "u" && o.r.some(r => refs.includes(r))) : [];
    odc.sort((a, b) => "rtp".indexOf(a.s) - "rtp".indexOf(b.s));
    const date = p.od ? p.od.replace(/^(\d{4})-(\d{2}).*/, "$2.$1").replace(/^(\d{4})$/, "$1") : "";
    return { title, src: `OpenStreetMap (przebieg, stan ${d?.osm || ""}), GDDKiA Mapa Stanu Budowy Dróg (status i strony odcinków dróg krajowych)`,
      body: `<p class="gs-st"><i style="background:${ROAD_COL[p.k]}"></i>${p.k === "b" ? "W budowie lub przebudowie" : "Planowana"} · ${esc(CLS[p.c] || "")}</p>` + row("Planowane otwarcie (OpenStreetMap)", date) + (p.refx ? `<p class="muted small">Numer drogi przypisany z sąsiedniego odcinka, bo w OpenStreetMap ten fragment go nie ma.</p>` : "") +
        (odc.length ? `<p class="ext-sub"><b>Inwestycje GDDKiA na ${esc(refs.join(", "))}</b></p><ul class="terr-list">${odc.slice(0, 10).map(o => `<li><a href="${esc(o.u)}" target="_blank" rel="noopener noreferrer">${esc(o.n || o.d)}</a><small><span style="color:${RS[o.s][1]};font-weight:600">${RS[o.s][0]}</span>${o.w ? " · " + esc(o.w) : ""}</small></li>`).join("")}</ul>${odc.length > 10 ? `<p class="muted small">i ${odc.length - 10} dalszych odcinków.</p>` : ""}` : "") +
        `<p class="muted small">Przebieg planowanej drogi jest orientacyjny. O tym, którędy pójdzie droga, rozstrzyga decyzja o środowiskowych uwarunkowaniach, a potem decyzja ZRID.</p>` };
  }

  const zridCard = p => ({ title: p.n, src: "GUNB, Rejestr wniosków, decyzji i zgłoszeń (RWDZ), dane.gov.pl",
    body: `<p class="gs-st"><i style="background:${p.z ? "#e8590c" : "#f59f00"}"></i>${p.z ? "Zezwolenie na realizację inwestycji drogowej (ZRID)" : "Pozwolenie na budowę drogi"}</p>` + row("Miejscowość", p.m) + row("Wniosek złożony", p.w) + row("Decyzja wydana", p.d) + row("Działek we wniosku", p.dz) +
      `<p class="muted small">Decyzja pozwala rozpocząć budowę. ZRID dodatkowo przejmuje pod drogę działki w liniach rozgraniczających. Szczegóły wniosku: ${link("https://wyszukiwarka.gunb.gov.pl/", "wyszukiwarka GUNB")}.</p>` });

  /* ---------- road map over time: roads, rail and road decisions in one view, with a year slider ---------- */
  const MD_Y0 = 2023, MD_Y1 = 2032;
  let mdYear = Math.min(MD_Y1, Math.max(MD_Y0, new Date().getFullYear()));
  const yearOf = s => { const m = /(20\d\d)/.exec(s || ""); return m ? +m[1] : 0; };
  async function mdFetch() {
    const get = u => fetch(u).then(r => { if (!r.ok) throw Error(r.status); return r.json(); });
    const [dr, kol, dec] = await Promise.all([get("data/drogi/inwestycje.geojson"), get("data/kolej/inwestycje.geojson"), get("data/drogi/decyzje.geojson")]);
    const lenKm = g => { let s = 0; const cs = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : []; for (const c of cs) for (let i = 1; i < c.length; i++) s += dist({ lon: c[i - 1][0], lat: c[i - 1][1] }, { lon: c[i][0], lat: c[i][1] }); return s / 1000; };
    const feats = [];
    for (const f of dr.features) feats.push({ ...f, properties: { ...f.properties, src: "d", y: yearOf(f.properties.od), km: lenKm(f.geometry) } });
    for (const f of kol.features) if (f.properties.c === "rail" || f.properties.c === "kdp") feats.push({ ...f, properties: { ...f.properties, src: "k", y: yearOf(f.properties.od), km: lenKm(f.geometry) } });
    for (const f of dec.features) feats.push({ ...f, properties: { ...f.properties, src: "z", y: yearOf(f.properties.d) } });
    return { type: "FeatureCollection", osm: dr.osm, features: feats };
  }
  const MD_OPEN = "#2b8a3e";
  function mdFilters(Y) {
    const lin = ["in", ["get", "src"], ["literal", ["d", "k"]]], dated = [">", ["get", "y"], 0];
    return {
      "x-md-open": ["all", lin, dated, ["<=", ["get", "y"], Y]],
      "x-md-b": ["all", lin, ["==", ["get", "k"], "b"], ["any", ["!", dated], [">", ["get", "y"], Y]]],
      "x-md-p": ["all", lin, ["==", ["get", "k"], "p"], ["any", ["!", dated], [">", ["get", "y"], Y]]],
      "x-md-z": ["all", ["==", ["get", "src"], "z"], [">", ["get", "y"], 0], ["<=", ["get", "y"], Y]]
    };
  }
  function mdApply(Y) {
    mdYear = Y;
    for (const [id, f] of Object.entries(mdFilters(Y))) if (map.getLayer(id)) map.setFilter(id, f);
    if (map.getLayer("x-md-z")) map.setPaintProperty("x-md-z", "circle-radius", ["interpolate", ["linear"], ["zoom"], 6, ["case", ["==", ["get", "y"], Y], 3, 1.2], 13, ["case", ["==", ["get", "y"], Y], 7, 3.5]]);
    const box = document.getElementById("x-leg-mapa-drogowa"), d = raw["mapa-drogowa"];
    if (!box) return;
    const lab = box.querySelector("[data-md-y]"); if (lab) lab.textContent = Y;
    const out = box.querySelector("[data-md-stat]"); if (!out || !d) return;
    let open = 0, bud = 0, plan = 0, dec = 0, decY = 0;
    for (const f of d.features) {
      const p = f.properties;
      if (p.src === "z") { if (p.y && p.y <= Y) dec++; if (p.y === Y) decY++; continue; }
      if (p.y && p.y <= Y) open += p.km; else if (p.k === "b") bud += p.km; else plan += p.km;
    }
    out.innerHTML = `<b>${fmt(open, 0)} km</b> dróg i torów z planowanym otwarciem do końca ${Y} r. · <b>${fmt(bud, 0)} km</b> w budowie · <b>${fmt(plan, 0)} km</b> planowanych · <b>${fmt(dec, 0)}</b> decyzji drogowych od 2023 r., w tym <b>${fmt(decY, 0)}</b> w ${Y} r.`;
  }
  const mdLegend = () => `<div class="md-year"><label for="md-range">Rok: <b data-md-y>${mdYear}</b></label><input id="md-range" type="range" min="${MD_Y0}" max="${MD_Y1}" step="1" value="${mdYear}"><div class="md-ticks"><span>${MD_Y0}</span><span>${MD_Y1}</span></div></div><p class="small" data-md-stat></p>` +
    legendRow([[MD_OPEN, "planowane otwarcie do wybranego roku", "line"], ["#d9480f", "w budowie", "line"], ["#7048e8", "planowane", "dash"], ["#e8590c", "decyzja ZRID lub pozwolenie na drogę"]]) +
    note("Daty otwarcia pochodzą z OpenStreetMap i ma je tylko część odcinków; bez daty odcinek zostaje w stanie „w budowie” lub „planowany”. Drogi: OpenStreetMap i GDDKiA. Kolej: OpenStreetMap i PKP PLK. Decyzje: GUNB, RWDZ (rok wydania), widoczne od skali około 1:8 000 000.");

  /* ---------- rail investments ---------- */
  const RAIL_COL = { b: "#1971c2", p: "#4dabf7" };
  const RCLS = { rail: "linia kolejowa", tram: "linia tramwajowa", metro: "metro", kdp: "kolej dużych prędkości" };
  function railCard(p, d, side) {
    if (p.c === "st") return { title: p.n || (p.st === "station" ? "Nowa stacja" : "Nowy przystanek"), src: `OpenStreetMap (stan ${d?.osm || ""})`,
      body: `<p class="gs-st"><i style="background:${RAIL_COL[p.k]}"></i>${p.k === "b" ? "W budowie" : "Planowany"} ${p.st === "station" ? "stacja" : "przystanek"}</p><p class="muted small">Termin otwarcia i zakres prac podaje ${link("https://www.plk-inwestycje.pl/", "mapa inwestycji PKP PLK")}.</p>` };
    const refs = (p.ref || "").split(/[;,]/).map(x => x.trim()).filter(Boolean);
    const fold = t => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
    const STOP = /^(linia|linii|kolejowa|kolejowej|proponowana|planowana|wariant|budowa|odcinek|odcinku|polaczenie|polaczenia|nowej|modernizacji)$/;
    const toks = fold(p.n).split(/[^a-z0-9]+/).filter(w => w.length >= 5 && !STOP.test(w));
    const kp = side ? side.projekty.filter(x => (refs.length && x.l.some(l => refs.includes(l))) || (toks.length >= 2 && toks.filter(w => fold(x.n).includes(w)).length >= 2)) : [];
    return { title: p.n || (refs.length ? `Linia kolejowa nr ${refs.join(", ")}` : (p.k === "b" ? "Linia w budowie" : "Planowana linia")), src: `OpenStreetMap (przebieg, stan ${d?.osm || ""}), PKP PLK (Program Kolej Plus)`,
      body: `<p class="gs-st"><i style="background:${RAIL_COL[p.k]}"></i>${p.k === "b" ? "W budowie lub modernizacji" : "Planowana"} · ${esc(RCLS[p.c] || "")}</p>` + row("Numer linii", refs.join(", ")) + row("Planowane otwarcie (OpenStreetMap)", p.od) +
        (kp.length ? `<p class="ext-sub"><b>Program Kolej Plus na tej linii</b></p><ul class="terr-list">${kp.map(x => `<li>${link(x.u, x.n)}</li>`).join("")}</ul>` : "") +
        `<p class="muted small">Zakres i terminy prac PKP PLK: ${link("https://www.plk-inwestycje.pl/", "mapa inwestycji PKP PLK")}.</p>` };
  }

  /* ---------- E-PRTR industrial sources ---------- */
  const SEC = { 1: ["energetyka", "#c92a2a"], 2: ["produkcja i obróbka metali", "#4263eb"], 3: ["przemysł mineralny", "#868e96"], 4: ["przemysł chemiczny", "#ae3ec9"],
    5: ["odpady i ścieki", "#2f9e44"], 6: ["papier i drewno", "#a9743f"], 7: ["hodowla zwierząt", "#f08c00"], 8: ["przetwórstwo spożywcze", "#e8590c"], 9: ["inna działalność", "#495057"] };
  const EPOL = { co2: "dwutlenek węgla CO₂", nox: "tlenki azotu NOx", sox: "tlenki siarki SOx", pm10: "pył PM10", co: "tlenek węgla CO", nh3: "amoniak NH₃", ch4: "metan CH₄",
    n2o: "podtlenek azotu N₂O", nmvoc: "lotne związki organiczne (NMVOC)", hg: "rtęć", benzen: "benzen", wwa: "WWA", dioksyny: "dioksyny i furany", hcl: "chlor (HCl)", hf: "fluor (HF)",
    as: "arsen", cd: "kadm", pb: "ołów", zn: "cynk", ni: "nikiel", cr: "chrom", cu: "miedź", hfc: "HFC", hcfc: "HCFC", hcn: "cyjanowodór" };
  const mass = kg => kg >= 1e9 ? `${fmt(kg / 1e9, 1)} mln t` : kg >= 1e6 ? `${fmt(kg / 1e6, kg >= 1e8 ? 0 : 1)} tys. t` : kg >= 1000 ? `${fmt(kg / 1000, kg >= 1e5 ? 0 : 1)} t` : kg >= 1 ? `${fmt(kg, kg >= 100 ? 0 : 1)} kg` : `${fmt(kg * 1000, 0)} g`;
  function trendSvg(ser, y0) {
    const v = ser.map(x => x == null ? null : x), max = Math.max(...v.filter(x => x != null)); if (!(max > 0)) return "";
    const w = 260, h = 54, bw = w / v.length;
    return `<svg class="ep-trend" viewBox="0 0 ${w} ${h + 14}" role="img" aria-label="Emisja w kolejnych latach">${v.map((x, i) => x == null ? "" : `<rect x="${(i * bw + 1).toFixed(1)}" y="${(h - x / max * h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(1, x / max * h).toFixed(1)}" rx="1.5"></rect>`).join("")}<text x="0" y="${h + 12}">${y0}</text><text x="${w}" y="${h + 12}" text-anchor="end">${y0 + v.length - 1}</text></svg>`;
  }
  function eprtrCard(p, d) {
    const f = (d?.features || []).find(x => x.properties.id === p.id), q = f ? f.properties : p, sec = SEC[q.s] || SEC[9];
    const e = J(q.e), t = J(q.t), y0 = d?.lata?.[0] || 2007;
    const tk = ["co2", "nox", "pm10", "sox"].find(k => t[k]);
    return { title: q.n, src: "EEA, Industrial Reporting under IED and E-PRTR, wersja 16 (luty 2026), licencja CC BY 4.0",
      body: `<p class="gs-st"><i style="background:${sec[1]}"></i>${esc(sec[0])} · działalność ${esc(q.a)} wg załącznika I E-PRTR</p>` + row("Miejscowość", q.m) + row("Rok sprawozdania", q.y) +
        (Object.keys(e).length ? `<table class="gs-tab"><thead><tr><th>Emisja do powietrza w ${q.y} r.</th><th>rocznie</th></tr></thead><tbody>${Object.entries(e).slice(0, 12).map(([k, v]) => `<tr><td>${esc(EPOL[k] || k)}</td><td><b>${esc(mass(v))}</b></td></tr>`).join("")}</tbody></table>` : "<p class=\"muted\">Zakład nie zgłosił emisji do powietrza powyżej progów.</p>") +
        (tk ? `<p class="ext-sub"><b>${esc(EPOL[tk])} w latach ${y0}–${y0 + t[tk].length - 1}</b></p>${trendSvg(t[tk], y0)}` : "") +
        `<p class="muted small">Dane podaje sam zakład, tylko dla substancji powyżej progów rozporządzenia E-PRTR. Mniejsze źródła, jak domowe piece i ruch drogowy, nie są tu ujęte.</p><p>${link("https://industry.eea.europa.eu/", "Europejski portal emisji przemysłowych (EEA)")}</p>` };
  }

  /* ---------- airports, military areas, transmission investments ---------- */
  const AERO = { p: ["port lotniczy", "#1c7ed6"], a: ["lotnisko", "#4dabf7"], w: ["lotnisko wojskowe", "#495057"], l: ["lądowisko lub lotnisko bez kodu ICAO", "#91a7ff"], h: ["lądowisko dla śmigłowców", "#ae3ec9"] };
  const LAW_H = "Obiekty o wysokości od 50 do 100 m zgłasza się Ministrowi Obrony Narodowej najpóźniej 2 miesiące przed osiągnięciem 50 m (Prawo lotnicze, art. 87¹a). Obiekty od 100 m wzwyż są przeszkodami lotniczymi w całym kraju, a w pobliżu lotnisk także niższe obiekty w powierzchniach ograniczających (art. 87).";
  async function lotFetch() {
    const get = u => fetch(u).then(r => { if (!r.ok) throw Error(r.status); return r.json(); });
    const [a, z] = await Promise.all([get("data/lotnictwo/lotniska.geojson"), get("data/lotnictwo/strefy.geojson")]);
    return { type: "FeatureCollection", osm: a.osm, features: [...z.features.map(f => ({ ...f, properties: { ...f.properties, src: "s" } })), ...a.features.map(f => ({ ...f, properties: { ...f.properties, src: "a" } }))] };
  }
  const aeroLinks = `<p>${link("https://dronemap.pansa.pl", "Strefy w przestrzeni powietrznej: DroneMap PAŻP")} · ${link("https://www.ais.pansa.pl/publikacje/aip-polska/", "AIP Polska")} · ${link("https://ulc.gov.pl/pl/lotniska-i-infrastruktura", "lotniska w ULC")}</p>`;
  function lotCard(p) {
    if (p.src === "s") return { title: `${p.n || p.icao}: ${p.s === "i" ? "pozioma powierzchnia ograniczająca" : "stożkowa powierzchnia ograniczająca"} (szacunek)`, src: "Szacunek według ICAO, załącznik 14, z drogi startowej w OpenStreetMap",
      body: `<p class="gs-st"><i style="background:${p.s === "i" ? "#e03131" : "#f08c00"}"></i>${p.s === "i" ? `Zabudowa do około ${p.h} m nad poziomem lotniska` : `Dopuszczalna wysokość rośnie od 45 do około ${p.h} m nad poziomem lotniska`}</p>
        <p>Szacunek dla drogi startowej kodu ${p.cd}. Wysokości liczy się od poziomu lotniska, nie od terenu działki. Wiążące powierzchnie i ograniczenia wysokości podaje zarządzający lotniskiem i Urząd Lotnictwa Cywilnego, a dla lotnisk wojskowych organ wojskowy.</p><p class="muted small">${esc(LAW_H)}</p>` + aeroLinks };
    const t = AERO[p.k] || AERO.l;
    return { title: p.n || t[0], src: "OpenStreetMap (współtwórcy OpenStreetMap, ODbL)",
      body: `<p class="gs-st"><i style="background:${t[1]}"></i>${esc(t[0])}</p>` + row("Kod ICAO", p.icao) + row("Kod IATA", p.iata) + row("Najdłuższa droga startowa", p.rw ? `${fmt(p.rw, 0)} m${p.tw ? ", utwardzona" : ""}` : "") + row("Zarządzający", p.op) +
        (p.www ? `<p>${link(p.www, "Strona lotniska")}</p>` : "") + `<p class="muted small">${esc(LAW_H)}</p>` + aeroLinks };
  }
  const MIL = { t: ["teren wojskowy", "#868e96"], p: ["poligon lub strzelnica", "#e8590c"], c: ["teren ćwiczeń", "#f59f00"], l: ["lotnisko wojskowe", "#495057"], b: ["baza wojskowa", "#5c7cfa"], n: ["obszar niebezpieczny", "#e03131"] };
  const PSE_COL = { b: "#c2255c", p: "#f783ac" };

  const LAYERS = [
    { id: "gios", box: "airLayers", label: "Stacje pomiarowe GIOŚ", desc: "Pomiary 2025 na tle norm, link do bieżących danych", kw: "stacje pomiarowe gioś monitoring powietrza pomiary indeks jakości powietrza smog",
      icon: ["broadcast", "#34a383"], url: "data/gios/stacje.json", toGeo: stationsGeo,
      layers: s => [{ id: "x-gios", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "st"], 3, ST_COL[3], 2, ST_COL[2], 1, ST_COL[1], ST_COL[0]], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 7, 14, 9], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
        { id: "x-gios-lbl", type: "symbol", source: s, minzoom: 10, layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#1f5d4c", "text-halo-color": "#fff", "text-halo-width": 1.5 } }],
      legend: () => legendRow([[ST_COL[1], "normy dotrzymane"], [ST_COL[2], "powyżej norm od 2030 r."], [ST_COL[3], "przekroczona norma"], [ST_COL[0], "bez rocznej serii"]]) + note("Kolor według średnich rocznych 2025 z pomiarów stacji. Źródło: GIOŚ, Państwowy Monitoring Środowiska (lista stacji z API PJP, statystyki roczne z Banku danych pomiarowych)."),
      card: (p, d) => ({ title: p.n, body: stationBody(p, d?.rok || 2025), src: "GIOŚ, Państwowy Monitoring Środowiska: lista stacji (API PJP), statystyki roczne 2025 (Bank danych pomiarowych), ocena roczna 2025 (modelowanie)" }) },
    { id: "eprtr", box: "airLayers", label: "Duże źródła emisji (E-PRTR)", desc: "Elektrownie, huty, zakłady i fermy, emisje zgłoszone za 2024 r.", kw: "e-prtr eprtr emisje przemysłowe zakłady elektrownia huta ciepłownia ferma co2 pył tlenki azotu źródła zanieczyszczeń komin",
      icon: ["factory", "#c92a2a"], url: "data/emisje/eprtr.geojson",
      layers: s => {
        const r = k => ["min", 26, ["+", 3, ["*", k, ["sqrt", ["max", ["get", "co2"], ["/", ["get", "nx"], 4000]]]]]];
        return [{ id: "x-eprtr", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "s"], ...Object.entries(SEC).flatMap(([k, v]) => [+k, v[1]]), "#495057"], "circle-opacity": .78,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, r(.11), 10, r(.2), 14, r(.3)], "circle-stroke-color": "#fff", "circle-stroke-width": 1.3 } },
        { id: "x-eprtr-lbl", type: "symbol", source: s, minzoom: 10, layout: { "text-field": ["get", "m"], "text-size": 10.5, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#5c1a1a", "text-halo-color": "#fff", "text-halo-width": 1.5 } }];
      },
      legend: () => legendRow(Object.values(SEC).map(([l, c]) => [c, l])) + note("Wielkość punktu według rocznej emisji CO₂ (gdy jej brak, według tlenków azotu). Ponad 680 zakładów, które zgłosiły emisje za lata 2022–2024. Źródło: Europejska Agencja Środowiska, Industrial Reporting (E-PRTR), wersja 16 z lutego 2026 r., CC BY 4.0."),
      card: (p, d) => eprtrCard(p, d) },
    { id: "mapa-drogowa", box: "transportLayers", label: "Mapa drogowa na osi czasu", desc: "Drogi, kolej i decyzje drogowe, suwak lat 2023–2032", kw: "mapa drogowa oś czasu harmonogram kiedy otwarcie drogi kolej inwestycje suwak lat zrid plan",
      icon: ["calendar-dots", "#2b8a3e"], url: "mapa-drogowa", fetch: mdFetch, side: "data/drogi/gddkia.json", side2: ["mapa-drogowa-k", "data/kolej/kolejplus.json"],
      layers: s => [
        { id: "x-md-p", type: "line", source: s, filter: mdFilters(mdYear)["x-md-p"], layout: { "line-cap": "round" }, paint: { "line-color": "#7048e8", "line-dasharray": [1.6, 1.4], "line-opacity": .85, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 12, 3.5] } },
        { id: "x-md-b", type: "line", source: s, filter: mdFilters(mdYear)["x-md-b"], layout: { "line-cap": "round" }, paint: { "line-color": "#d9480f", "line-opacity": .9, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.3, 12, 4] } },
        { id: "x-md-open", type: "line", source: s, filter: mdFilters(mdYear)["x-md-open"], layout: { "line-cap": "round" }, paint: { "line-color": MD_OPEN, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 2, 12, 5.5] } },
        { id: "x-md-z", type: "circle", source: s, minzoom: 6, filter: mdFilters(mdYear)["x-md-z"], paint: { "circle-color": ["match", ["get", "z"], 1, "#e8590c", "#f59f00"], "circle-opacity": .85, "circle-radius": 3, "circle-stroke-color": "#fff", "circle-stroke-width": 1 } }],
      legend: mdLegend,
      legendInit: box => { const r = box.querySelector("#md-range"); if (r) r.oninput = () => mdApply(+r.value); mdApply(mdYear); },
      card: (p, d, f, side) => p.src === "z" ? zridCard(p) : p.src === "k" ? railCard(p, d, sideData["mapa-drogowa-k"]) : roadCard(p, d, side) },
    { id: "lotniska", box: "limitLayers", label: "Lotniska i ograniczenia wysokości", desc: "Lotniska, lądowiska i orientacyjne strefy wokół dróg startowych", kw: "lotnisko lotniska lądowisko port lotniczy ograniczenie wysokości przeszkody lotnicze powierzchnie ograniczające wiatrak komin maszt ulc",
      icon: ["airplane-tilt", "#1c7ed6"], url: "lotniska", fetch: lotFetch, fillClick: true,
      layers: s => [
        { id: "x-lot-c", type: "fill", source: s, filter: ["all", ["==", ["get", "src"], "s"], ["==", ["get", "s"], "c"]], paint: { "fill-color": "#f08c00", "fill-opacity": .12 } },
        { id: "x-lot-i", type: "fill", source: s, filter: ["all", ["==", ["get", "src"], "s"], ["==", ["get", "s"], "i"]], paint: { "fill-color": "#e03131", "fill-opacity": .13 } },
        { id: "x-lot-ol", type: "line", source: s, filter: ["==", ["get", "src"], "s"], paint: { "line-color": ["match", ["get", "s"], "i", "#e03131", "#f08c00"], "line-width": 1, "line-dasharray": [2, 2], "line-opacity": .7 }, noClick: true },
        { id: "x-lot-a", type: "circle", source: s, filter: ["==", ["get", "src"], "a"], paint: { "circle-color": ["match", ["get", "k"], ...Object.entries(AERO).flatMap(([k, v]) => [k, v[1]]), "#91a7ff"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "k"], "p", 6, "a", 4.5, "w", 4.5, 3], 12, ["match", ["get", "k"], "p", 11, 8]], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
        { id: "x-lot-lbl", type: "symbol", source: s, minzoom: 8, filter: ["==", ["get", "src"], "a"], layout: { "text-field": ["coalesce", ["get", "n"], ""], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#164a7a", "text-halo-color": "#fff", "text-halo-width": 1.5 } }],
      legend: () => legendRow(Object.values(AERO).map(([l, c]) => [c, l])) + legendRow([["#e03131", "pozioma powierzchnia (około 45 m nad lotniskiem)", "box"], ["#f08c00", "powierzchnia stożkowa (do 100 m)", "box"]]) +
        note("Strefy są szacunkiem według ICAO (załącznik 14) z długości drogi startowej, tylko dla lotnisk z kodem ICAO. Wiążące są powierzchnie ograniczające z rejestracji lotniska w ULC. Strefy przestrzeni powietrznej (zakazane, ograniczone, niebezpieczne, TSA) publikuje PAŻP na mapie DroneMap i w AIP, bez otwartego pliku danych. Źródło lotnisk: OpenStreetMap.") + aeroLinks,
      card: p => lotCard(p) },
    { id: "wojsko", box: "limitLayers", label: "Tereny wojskowe", desc: "Tereny zamknięte, poligony, strzelnice, lotniska wojskowe", kw: "teren wojskowy wojsko poligon strzelnica teren zamknięty jednostka wojskowa baza obszar niebezpieczny",
      icon: ["shield-warning", "#495057"], url: "data/lotnictwo/wojsko.geojson", fillClick: true,
      layers: s => [
        { id: "x-woj-f", type: "fill", source: s, paint: { "fill-color": ["match", ["get", "k"], ...Object.entries(MIL).flatMap(([k, v]) => [k, v[1]]), "#868e96"], "fill-opacity": .22 } },
        { id: "x-woj-l", type: "line", source: s, paint: { "line-color": ["match", ["get", "k"], ...Object.entries(MIL).flatMap(([k, v]) => [k, v[1]]), "#868e96"], "line-width": ["interpolate", ["linear"], ["zoom"], 6, .6, 13, 2], "line-dasharray": [3, 1.5] }, noClick: true }],
      legend: () => legendRow(Object.values(MIL).map(([l, c]) => [c, l, "box"])) + note("Obszary co najmniej 2 ha według OpenStreetMap. Granice terenów zamkniętych ustala Minister Obrony Narodowej, a wiążące dane ma starostwo (ewidencja gruntów i budynków). Na terenie zamkniętym plan ogólny i plan miejscowy nie obowiązują."),
      card: p => { const t = MIL[p.k] || MIL.t; return { title: p.n || t[0], src: "OpenStreetMap (współtwórcy OpenStreetMap, ODbL)",
        body: `<p class="gs-st"><i style="background:${t[1]}"></i>${esc(t[0])}</p>` + row("Powierzchnia", p.ha ? `${fmt(p.ha, 0)} ha` : "") +
          `<p class="muted small">Granice według OpenStreetMap są orientacyjne. Czy działka leży na terenie zamkniętym, potwierdza wypis z ewidencji gruntów w starostwie. Budowa w sąsiedztwie poligonu może wymagać uzgodnienia z organem wojskowym.</p>` }; } },
    { id: "przesyl", box: "limitLayers", label: "Linie przesyłowe w budowie", desc: "Linie 110 kV i wyższe oraz stacje w budowie lub planowane", kw: "linie przesyłowe pse budowa linii 400 kv 220 kv 110 kv planowana linia stacja elektroenergetyczna przesył energii",
      icon: ["lightning", "#c2255c"], url: "data/przesyl/inwestycje.geojson",
      layers: s => [
        { id: "x-pse-p", type: "line", source: s, filter: ["all", ["==", ["get", "k"], "p"], ["!=", ["get", "c"], "st"]], layout: { "line-cap": "round" }, paint: { "line-color": PSE_COL.p, "line-dasharray": [1.6, 1.4], "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.4, 12, 4] } },
        { id: "x-pse-b", type: "line", source: s, filter: ["all", ["==", ["get", "k"], "b"], ["!=", ["get", "c"], "st"]], layout: { "line-cap": "round" }, paint: { "line-color": PSE_COL.b, "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["case", [">=", ["get", "v"], 220], 2.2, 1.4], 12, ["case", [">=", ["get", "v"], 220], 5, 3.5]] } },
        { id: "x-pse-st", type: "circle", source: s, filter: ["==", ["get", "c"], "st"], paint: { "circle-color": "#fff", "circle-stroke-color": ["match", ["get", "k"], "b", PSE_COL.b, PSE_COL.p], "circle-stroke-width": 2.5, "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 7] } }],
      legend: () => legendRow([[PSE_COL.b, "w budowie", "line"], [PSE_COL.p, "planowana", "dash"], ["#fff", "nowa stacja"]]) + note("Linie 110 kV i wyższe oznaczone w OpenStreetMap jako budowane lub planowane, przebieg orientacyjny. Zakres i terminy inwestycji podaje PSE (linie 220 i 400 kV) i operator sieci dystrybucyjnej (110 kV).") + `<p class="small">${link("https://www.pse.pl/inwestycje", "Inwestycje PSE")}</p>`,
      card: (p, d) => ({ title: p.n || (p.c === "st" ? "Nowa stacja elektroenergetyczna" : `Linia ${p.v ? p.v + " kV" : "wysokiego napięcia"}`), src: `OpenStreetMap (stan ${d?.osm || ""}, ODbL)`,
        body: `<p class="gs-st"><i style="background:${PSE_COL[p.k]}"></i>${p.k === "b" ? "W budowie" : "Planowana"}${p.c === "kab" ? " · linia kablowa" : ""}</p>` + row("Napięcie", p.v ? `${p.v} kV` : "") + row("Operator", p.op) +
          `<p class="muted small">Przebieg z OpenStreetMap jest orientacyjny. Pas technologiczny linii ogranicza zabudowę, jego szerokość podaje operator.</p><p>${link("https://www.pse.pl/inwestycje", "Inwestycje PSE")}</p>` }) },
    { id: "drogi", box: "transportLayers", label: "Inwestycje drogowe", desc: "Drogi w budowie i planowane, status GDDKiA", kw: "inwestycje drogowe budowa dróg gddkia autostrady drogi ekspresowe obwodnice planowane drogi w budowie przetarg przygotowanie s19 s10 s74",
      icon: ["road-horizon", "#d9480f"], url: "data/drogi/inwestycje.geojson", side: "data/drogi/gddkia.json",
      layers: s => [
        { id: "x-drogi-p", type: "line", source: s, filter: ["==", ["get", "k"], "p"], layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ROAD_COL.p, "line-dasharray": [1.6, 1.4], "line-opacity": .9, "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "c"], ["A", "S"], 1.6, "DK", 1, .6], 12, ["match", ["get", "c"], ["A", "S"], 4.5, "DK", 3.5, 2.5]] } },
        { id: "x-drogi-b", type: "line", source: s, filter: ["==", ["get", "k"], "b"], layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ROAD_COL.b, "line-opacity": .95, "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "c"], ["A", "S"], 2, "DK", 1.2, .7], 12, ["match", ["get", "c"], ["A", "S"], 5.5, "DK", 4, 3]] } },
        { id: "x-drogi-lbl", type: "symbol", source: s, minzoom: 8, filter: ["has", "ref"], layout: { "symbol-placement": "line", "symbol-spacing": 320, "text-field": ["get", "ref"], "text-size": 11, "text-font": ["Noto Sans Bold"] }, paint: { "text-color": "#7a2a05", "text-halo-color": "#fff", "text-halo-width": 1.6 } }],
      legend: () => legendRow([[ROAD_COL.b, "w budowie lub przebudowie", "line"], [ROAD_COL.p, "planowana", "dash"]]) + note("Grubość linii: autostrady i drogi ekspresowe, drogi krajowe, wojewódzkie. Przebieg: OpenStreetMap. Stan inwestycji i strony odcinków: GDDKiA, Mapa Stanu Budowy Dróg. Przebieg planowanych dróg jest orientacyjny, wiążące są decyzje środowiskowe i ZRID."),
      card: (p, d, f, side) => roadCard(p, d, side) },
    { id: "zrid", box: "transportLayers", label: "Decyzje na budowę dróg", desc: "ZRID i pozwolenia na drogi od 2023 r. (GUNB)", kw: "zrid zezwolenie na realizację inwestycji drogowej decyzje drogowe pozwolenie na budowę drogi przebudowa rozbudowa ulicy gunb rwdz",
      icon: ["stamp", "#e8590c"], url: "data/drogi/decyzje.geojson", minz: 8,
      layers: s => [{ id: "x-zrid", type: "circle", source: s, minzoom: 8, paint: { "circle-color": ["match", ["get", "z"], 1, "#e8590c", "#f59f00"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, ["match", ["get", "z"], 1, 4, 2.5], 13, ["match", ["get", "z"], 1, 8, 6]], "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } }],
      legend: () => legendRow([["#e8590c", "zezwolenie na realizację inwestycji drogowej (ZRID)"], ["#f59f00", "pozwolenie na budowę drogi lub ulicy"]]) + note("Decyzje wydane od 2023 r. w kategorii XXV (drogi), punkt w środku działek objętych wnioskiem. Źródło: GUNB, Rejestr wniosków, decyzji i zgłoszeń (dane.gov.pl). Rejestr nie obejmuje wszystkich decyzji wojewodów, więc brak punktu nie oznacza braku inwestycji. Widoczne od skali około 1:2 000 000."),
      card: p => zridCard(p) },
    ...[["ldwn", "Hałas drogowy w ciągu doby", "Wskaźnik LDWN, mapy akustyczne GDDKiA 2022"], ["ln", "Hałas drogowy nocą", "Wskaźnik LN, mapy akustyczne GDDKiA 2022"]].map(([k, label, desc]) => ({
      id: "halas-" + k, box: "transportLayers", label, desc, kw: "hałas drogowy mapa akustyczna strategiczna mapa hałasu gddkia ldwn ln decybele db noc", icon: ["speaker-high", k === "ln" ? "#5f3dc4" : "#e8590c"], minz: 13,
      tiles: () => app.base + "/tiles/halas/" + k + "/{z}/{x}/{y}.png", attr: "GDDKiA, strategiczne mapy hałasu 2022",
      layers: s => [{ id: "x-halas-" + k, type: "raster", source: s, minzoom: 13, paint: { "raster-opacity": .62, "raster-fade-duration": 0 } }],
      legend: () => legendRow([["#fa881d", "55–60 dB", "box"], ["#fa5704", "60–65", "box"], ["#dc3c3c", "65–70", "box"], ["#ae7cd6", "70–75", "box"], ["#02a9df", "75–80", "box"], ["#004be4", "80 i więcej", "box"]]) +
        note(`${k === "ln" ? "Średni poziom hałasu w porze nocnej (22–6)." : "Średni poziom hałasu z całej doby, z wagą dla wieczoru i nocy."} Drogi krajowe o ruchu powyżej 3 mln pojazdów rocznie, poza dużymi miastami, które mają własne mapy. Źródło: GDDKiA, strategiczne mapy hałasu 2022 (Geoportal). Widoczne od skali około 1:70 000.`) })),
    { id: "kolej", box: "transportLayers", label: "Inwestycje kolejowe", desc: "Linie w budowie i planowane, nowe przystanki, Kolej Plus", kw: "inwestycje kolejowe kolej plk modernizacja linii nowe przystanki kolej plus tramwaj metro planowana linia kolejowa",
      icon: ["train", "#1971c2"], url: "data/kolej/inwestycje.geojson", side: "data/kolej/kolejplus.json",
      layers: s => [
        { id: "x-kolej-p", type: "line", source: s, filter: ["all", ["==", ["get", "k"], "p"], ["in", ["get", "c"], ["literal", ["rail", "tram", "metro"]]]], layout: { "line-cap": "round" },
          paint: { "line-color": RAIL_COL.p, "line-dasharray": [1.2, 1.6], "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "c"], "rail", 1.2, .5], 12, ["match", ["get", "c"], "rail", 3.5, 2]] } },
        { id: "x-kolej-b", type: "line", source: s, filter: ["all", ["==", ["get", "k"], "b"], ["in", ["get", "c"], ["literal", ["rail", "tram", "metro"]]]], layout: { "line-cap": "round" },
          paint: { "line-color": RAIL_COL.b, "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "c"], "rail", 1.6, .6], 12, ["match", ["get", "c"], "rail", 4.5, 2.5]] } },
        { id: "x-kolej-st", type: "circle", source: s, minzoom: 7, filter: ["==", ["get", "c"], "st"], paint: { "circle-color": "#fff", "circle-stroke-color": ["match", ["get", "k"], "b", RAIL_COL.b, RAIL_COL.p], "circle-stroke-width": 2.5, "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 3, 13, 6] } },
        { id: "x-kolej-lbl", type: "symbol", source: s, minzoom: 11, filter: ["==", ["get", "c"], "st"], layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.1], "text-anchor": "top" }, paint: { "text-color": "#0b4a8b", "text-halo-color": "#fff", "text-halo-width": 1.5 } }],
      legend: () => legendRow([[RAIL_COL.b, "w budowie lub modernizacji", "line"], [RAIL_COL.p, "planowana", "dash"], ["#fff", "nowy przystanek lub stacja"]]) + note("Cieńsze linie: tramwaj i metro. Przebieg: OpenStreetMap. Projekty Programu Kolej Plus: PKP PLK.") + `<p class="small">${link("https://www.plk-inwestycje.pl/", "Mapa inwestycji PKP PLK")} · ${link("https://www.plk-inwestycje.pl/projekty/program-kolej-plus/", "Program Kolej Plus")}</p>`,
      card: (p, d, f, side) => railCard(p, d, side) },
    { id: "kdp", box: "transportLayers", label: "Kolej dużych prędkości", desc: "Planowane linie KDP, w tym linia Y", kw: "kolej dużych prędkości kdp linia y cpk port polska szybka kolej korytarz planowana kolej przez działkę",
      icon: ["train", "#c2255c"], url: "data/kolej/inwestycje.geojson",
      layers: s => [
        { id: "x-kdp-glow", type: "line", source: s, filter: ["==", ["get", "c"], "kdp"], layout: { "line-cap": "round" }, paint: { "line-color": "#c2255c", "line-opacity": .18, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 6, 12, 22] }, noClick: true },
        { id: "x-kdp", type: "line", source: s, filter: ["==", ["get", "c"], "kdp"], layout: { "line-cap": "round" }, paint: { "line-color": "#c2255c", "line-dasharray": [2, 1.2], "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.8, 12, 4] } }],
      legend: () => legendRow([["#c2255c", "planowana linia KDP (przebieg orientacyjny)", "dash"]]) + note("Przebieg z OpenStreetMap, odwzorowany przez wolontariuszy na podstawie publikowanych wariantów. Wiążące są decyzje środowiskowe i lokalizacyjne Port Polska (CPK). Mapy Port Polska nie wolno powielać, dlatego podajemy tylko odnośnik.") + `<p class="small">${link("https://portpolska.pl/pl/program-kolejowy", "Mapa inwestycji kolejowych Port Polska z działkami")}</p>`,
      card: p => ({ title: p.n || "Planowana linia kolei dużych prędkości", src: "OpenStreetMap (przebieg orientacyjny)",
        body: `<p class="gs-st"><i style="background:#c2255c"></i>${p.k === "b" ? "W budowie" : "Planowana"}</p><p>Linia kolei dużych prędkości. Przebieg w OpenStreetMap jest orientacyjny i może dotyczyć jednego z wariantów.</p><p>Czy działka leży w pasie inwestycji, sprawdzisz na ${link("https://portpolska.pl/pl/program-kolejowy", "mapie inwestycji kolejowych Port Polska")} (decyzje środowiskowe, plany rezerwacji terenu, decyzje lokalizacyjne).</p>` }) },
    { id: "susza", box: "terrainLayers", label: "Zagrożenie suszą", desc: "Rolnicza, hydrologiczna, hydrogeologiczna, atmosferyczna (PPSS 2021)", kw: "susza zagrożenie suszą rolnicza hydrologiczna hydrogeologiczna atmosferyczna ppss appss wody polskie retencja niedobór wody",
      icon: ["drop", "#e0441f"], url: "susza-ppss2021", fetch: () => suFile(suT), fillClick: true,
      layers: s => [
        { id: "x-susza-f", type: "fill", source: s, paint: { "fill-color": ["match", ["get", "c"], ...Object.entries(SU_C).flatMap(([k, v]) => [+k, v[0]]), "#ccc"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, .55, 12, .35] } },
        { id: "x-susza-l", type: "line", source: s, minzoom: 9, paint: { "line-color": "#7a4a12", "line-opacity": .25, "line-width": .6 }, noClick: true }],
      legend: suLegend,
      legendInit: box => box.querySelectorAll("[data-su]").forEach(b => b.onclick = async () => {
        const t = b.dataset.su; if (t === suT) return;
        suT = t; try { app.store.set("susza.t", t); } catch (e) {}
        box.innerHTML = suLegend(); window.ExtraLayers.LAYERS.find(L => L.id === "susza").legendInit(box);
        try { map.getSource("x-susza")?.setData(await suFile(t)); } catch (e) { app.toast("Nie udało się wczytać warstwy"); }
      }),
      card: p => { const t = SU_T[suT], c = SU_C[p.c] || ["#ccc", "brak klasy"];
        return { title: "Zagrożenie " + t[1], src: "Wody Polskie, Plan przeciwdziałania skutkom suszy 2021 (warstwy GIS zagrożenia suszą)",
          body: `<p class="gs-st"><i style="background:${c[0]}"></i>Klasa ${esc(c[1])}</p>` +
            `<p>Klasa zagrożenia w siatce heksagonów z planu z 2021 r. Pokazuje, jak często i jak silnie susza występowała w tym miejscu w latach przyjętych do analizy, nie ocenia pojedynczej działki.</p>` +
            `<p class="muted small">W projekcie aktualizacji planu (2026) klasy są podane dla całych gmin i bywają wyższe, zwłaszcza dla suszy hydrologicznej i hydrogeologicznej. <a href="?stat=${t[2]}">Pokaż klasy gmin na mapie</a> · ${link("https://www.gov.pl/web/infrastruktura/konsultacje-spoleczne-projektu-aktualizacji-planu-przeciwdzialania-skutkom-suszy-appss", "projekt aPPSS")}</p>` }; } },
    { id: "wp-zlewnie", box: "terrainLayers", label: "Stan wód w zlewniach", desc: "Zlewnie JCWP: stan, ryzyko, presje (Wody Polskie)", kw: "wody polskie zlewnie zlewnia jcwp stan wód ekologiczny chemiczny ryzyko presje plan gospodarowania wodami apgw dorzecze",
      icon: ["drop", "#1c7ed6"], url: "data/wody/zlewnie.geojson", side: "data/wody/jcwp.json", fillClick: true,
      layers: s => [
        { id: "x-wp-zlewnie-f", type: "fill", source: s, paint: { "fill-color": wpColor(wpT), "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, .55, 12, .3] } },
        { id: "x-wp-zlewnie-l", type: "line", source: s, minzoom: 7, paint: { "line-color": "#1c4f80", "line-opacity": .45, "line-width": ["interpolate", ["linear"], ["zoom"], 7, .4, 12, 1.2] }, noClick: true }],
      legend: wpLegend,
      legendInit: box => box.querySelectorAll("[data-wp]").forEach(b => b.onclick = () => {
        wpT = b.dataset.wp; try { app.store.set("wody.t", wpT); } catch (e) {}
        box.innerHTML = wpLegend(); window.ExtraLayers.LAYERS.find(L => L.id === "wp-zlewnie").legendInit(box);
        if (map.getLayer("x-wp-zlewnie-f")) map.setPaintProperty("x-wp-zlewnie-f", "fill-color", wpColor(wpT));
      }),
      card: (p, d, f, side) => ({ title: "Zlewnia: " + (p.n || p.k), src: WP_SRC, body: jcwpBody(p.k, side) + `<p class="muted small"><a href="?stat=wp_stan_zly">Gminy w zlewniach o złym stanie</a> · <a href="?stat=wp_presja_opadowa">presja wód opadowych</a></p>` }) },
    { id: "wp-rzeki", box: "terrainLayers", label: "Rzeki (jednolite części wód)", desc: "3116 odcinków rzek z planów Wód Polskich", kw: "rzeki rzeka cieki jcwp wody polskie hydrografia",
      icon: ["drop", "#1971c2"], url: "data/wody/rzeki.geojson", side: "data/wody/jcwp.json",
      layers: s => [{ id: "x-wp-rzeki", type: "line", source: s, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#1971c2", "line-opacity": .85, "line-width": ["interpolate", ["linear"], ["zoom"], 5, .6, 10, 1.6, 14, 3] } }],
      legend: () => legendRow([["#1971c2", "rzeka (JCWP)", "line"]]) + note("Linie jednolitych części wód rzecznych. Kliknij, aby zobaczyć stan i presje."),
      card: (p, d, f, side) => ({ title: p.n || "Rzeka", src: WP_SRC, body: jcwpBody(p.k, side) }) },
    { id: "wp-podziemne", box: "terrainLayers", label: "Wody podziemne (JCWPd)", desc: "Stan i ryzyko jednolitych części wód podziemnych", kw: "wody podziemne jcwpd stan chemiczny ilościowy ujęcia wody wody polskie",
      icon: ["drop", "#0b7285"], url: "data/wody/jcwpd.geojson", fillClick: true,
      layers: s => [{ id: "x-wp-pd-f", type: "fill", source: s, paint: { "fill-color": pdColor(), "fill-opacity": .35 } },
        { id: "x-wp-pd-l", type: "line", source: s, paint: { "line-color": "#0b7285", "line-width": 1.2, "line-opacity": .7 }, noClick: true }],
      legend: pdLegend,
      legendInit: box => box.querySelectorAll("[data-pd]").forEach(b => b.onclick = () => {
        pdT = b.dataset.pd; box.innerHTML = pdLegend(); window.ExtraLayers.LAYERS.find(L => L.id === "wp-podziemne").legendInit(box);
        if (map.getLayer("x-wp-pd-f")) map.setPaintProperty("x-wp-pd-f", "fill-color", pdColor());
      }),
      card: p => ({ title: "Wody podziemne " + p.k, src: WP_SRC, body: `<p class="gs-st"><i style="background:${p.s ? "#e8590c" : "#74c0fc"}"></i>Stan ${p.s ? "słaby" : "dobry"}</p>` +
        wpRow("Ryzyko", p.ryz) + wpRow("Presje", p.pres) + `<p class="muted small"><a href="?stat=wp_podziemne_slaby">Pokaż gminy na mapie</a></p>` }) },
    { id: "wp-nadzory", box: "terrainLayers", label: "Administracja wodna", desc: "Nadzory wodne, zarządy zlewni i RZGW Wód Polskich", kw: "wody polskie nadzór wodny zarząd zlewni rzgw regionalny zarząd gospodarki wodnej pozwolenie wodnoprawne urząd kontakt",
      icon: ["buildings", "#1864ab"], url: "data/wody/nadzory.geojson", fillClick: true,
      layers: s => [{ id: "x-wp-nw-f", type: "fill", source: s, paint: { "fill-color": "#1864ab", "fill-opacity": .03 } },
        { id: "x-wp-nw-l", type: "line", source: s, paint: { "line-color": "#1864ab", "line-width": ["interpolate", ["linear"], ["zoom"], 5, .5, 10, 1.6], "line-opacity": .7, "line-dasharray": [3, 2] }, noClick: true }],
      legend: () => legendRow([["#1864ab", "granica nadzoru wodnego", "dash"]]) + note("Kliknij obszar: nadzór wodny, zarząd zlewni i RZGW właściwe dla miejsca (sprawy wodnoprawne, urządzenia wodne, melioracje)."),
      card: p => ({ title: p.nw || "Nadzór wodny", src: "Wody Polskie, granice RZGW, zarządów zlewni i nadzorów wodnych (wersja 1.08, 20.12.2023)",
        body: wpRow("Siedziba nadzoru", p.siedziba) + wpRow("Zarząd zlewni", p.zz) + wpRow("Regionalny zarząd", p.rzgw) +
          `<p class="muted small">${link("https://www.gov.pl/web/wody-polskie/kontakt", "Kontakty Wód Polskich")}</p>` }) },
    { id: "wp-chronione", box: "terrainLayers", label: "Obszary chronione zależne od wód", desc: "Rejestr obszarów chronionych z planów Wód Polskich", kw: "obszary chronione wodozależne natura 2000 rezerwat park użytek ekologiczny wody polskie",
      icon: ["tree", "#2b8a3e"], url: "data/wody/chronione.geojson", fillClick: true,
      layers: s => [{ id: "x-wp-och-f", type: "fill", source: s, paint: { "fill-color": ochColor, "fill-opacity": .35 } },
        { id: "x-wp-och-l", type: "line", source: s, minzoom: 8, paint: { "line-color": ochColor, "line-width": 1 }, noClick: true }],
      legend: () => legendRow(Object.values(OCH).filter(v => !/pomnik|stanowisko/.test(v[0])).map(([l, c]) => [c, l, "box"])) + note("Obszary chronione, których stan zależy od wód (bez otulin; obszary poniżej 10 ha pominięte, poza rezerwatami, parkami narodowymi i pomnikami)."),
      card: p => ({ title: p.n || "Obszar chroniony", src: WP_SRC + ", rejestr obszarów chronionych", body: `<p class="gs-st"><i style="background:${(OCH[p.t] || ["", "#868e96"])[1]}"></i>${esc((OCH[p.t] || [p.t])[0])}</p>` }) },
    { id: "stare-mapy", box: "terrainLayers", label: "Stare mapy", desc: "Messtischblatt 1884 i WIG 1933 (na razie gmina Orzesze)", kw: "stare mapy archiwalne historyczne messtischblatt wig mapa topograficzna przedwojenna niemiecka pruska orzesze igrek amzp",
      icon: ["map-trifold", "#8d6e3f"], tiles: () => stUrl(stT), minz: 11, maxz: 16, bounds: STARE_BB, attr: "Archiwum Map Zachodniej Polski",
      layers: s => [{ id: "x-stare", type: "raster", source: s, paint: { "raster-opacity": stOp, "raster-fade-duration": 0 } }],
      legend: stLegend,
      onToggle: on => { if (on && map.getZoom() < 11) map.fitBounds([[STARE_BB[0], STARE_BB[1]], [STARE_BB[2], STARE_BB[3]]], { padding: 30 }); },
      legendInit: box => {
        const again = () => { box.innerHTML = stLegend(); window.ExtraLayers.LAYERS.find(L => L.id === "stare-mapy").legendInit(box); };
        box.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { stT = b.dataset.st; try { app.store.set("stare.t", stT); } catch (e) {} map.getSource("x-stare-mapy")?.setTiles([stUrl(stT)]); again(); });
        box.querySelectorAll("[data-sto]").forEach(b => b.onclick = () => { stOp = +b.dataset.sto; if (map.getLayer("x-stare")) map.setPaintProperty("x-stare", "raster-opacity", stOp); again(); });
        const go = box.querySelector("[data-st-go]"); if (go) go.onclick = e => { e.preventDefault(); map.fitBounds([[STARE_BB[0], STARE_BB[1]], [STARE_BB[2], STARE_BB[3]]], { padding: 30 }); };
      } },
  ];
  const TITLES = { transportLayers: "Drogi i kolej", limitLayers: "Lotnictwo, wojsko, przesył" };
  window.ExtraLayers = { LAYERS, legendRow, note, row, link, fmt };

  /* ---------- engine ---------- */
  const cache = {};
  const load = L => cache[L.url] || (cache[L.url] = (L.fetch ? L.fetch() : fetch(L.url).then(r => { if (!r.ok) throw Error(r.status); return r.json(); })).catch(e => { delete cache[L.url]; throw e; }));
  const raw = {}, sideData = {};
  const firstSymbol = () => map.getStyle().layers.find(l => l.type === "symbol")?.id;
  const added = new Set();
  async function apply(L, on) {
    const leg = document.getElementById("x-leg-" + L.id);
    if (leg) { leg.hidden = !on; if (on) leg.innerHTML = L.legend(); }
    if (on && !added.has(L.id)) {
      let d = null;
      if (!L.tiles) { try { d = await load(L); } catch (e) { app.toast("Nie udało się wczytać warstwy"); return; } }
      raw[L.id] = d;
      if (L.side) fetch(L.side).then(r => r.ok ? r.json() : null).then(x => { sideData[L.id] = x; }).catch(() => {});
      if (L.side2) fetch(L.side2[1]).then(r => r.ok ? r.json() : null).then(x => { sideData[L.side2[0]] = x; }).catch(() => {});
      const src = "x-" + L.id;
      try {
        if (!map.getSource(src)) { map.addSource(src, L.tiles ? { type: "raster", tiles: [L.tiles()], tileSize: 256, minzoom: L.minz || 0, maxzoom: L.maxz || 19, ...(L.bounds ? { bounds: L.bounds } : {}), attribution: L.attr || "" } : { type: "geojson", data: L.toGeo ? L.toGeo(d) : d, attribution: L.attr || "" }); app.registerOverlaySource?.(src); }
        for (const spec of L.layers(src)) if (!map.getLayer(spec.id)) map.addLayer(spec, spec.type === "fill" || spec.type === "line" || spec.type === "raster" ? firstSymbol() : undefined);
        added.add(L.id);
      } catch (e) { console.warn(e); return; }
    }
    if (!added.has(L.id)) return;
    for (const spec of L.layers("x-" + L.id)) if (map.getLayer(spec.id)) map.setLayoutProperty(spec.id, "visibility", on ? "visible" : "none");
    if (on && leg && L.legendInit) L.legendInit(leg);
    L.onToggle?.(on);
  }
  function mount() {
    const boxes = {};
    for (const L of LAYERS) (boxes[L.box] = boxes[L.box] || []).push(L);
    for (const [id, ls] of Object.entries(boxes)) {
      const el = document.getElementById(id); if (!el) continue;
      const html = ls.map(L => `<div class="layer-entry" data-keywords="${esc(L.kw)}"><label class="sw"><input type="checkbox" id="x-${L.id}"/><span></span><div>${esc(L.label)}<small>${esc(L.desc)}</small></div></label><div class="terr-legend-box" id="x-leg-${L.id}" hidden></div></div>`).join("");
      if (!el.querySelector(":scope > h3")) el.insertAdjacentHTML("afterbegin", `<h3>${esc(TITLES[id] || "")}</h3>`);
      const tail = el.querySelector(":scope > p.source-note");
      if (tail) tail.insertAdjacentHTML("beforebegin", html); else el.insertAdjacentHTML("beforeend", html);
    }
    window.LayerLook = Object.assign(window.LayerLook || {}, Object.fromEntries(LAYERS.map(L => ["x-" + L.id, L.icon])));
    for (const L of LAYERS) {
      const cb = document.getElementById("x-" + L.id); if (!cb) continue;
      cb.checked = app.store.get("extra." + L.id, false);
      cb.onchange = () => { app.store.set("extra." + L.id, cb.checked); apply(L, cb.checked); if (cb.checked && L.minz && map.getZoom() < L.minz) app.toast("Przybliż mapę, aby zobaczyć tę warstwę"); };
    }
  }
  mount();
  function init() { for (const L of LAYERS) if (document.getElementById("x-" + L.id)?.checked) apply(L, true); document.getElementById("layerPanel")?.dispatchEvent(new Event("change", { bubbles: true })); }
  if (map.isStyleLoaded()) init(); else map.once("load", init);
  map.on("styledata", () => { for (const L of LAYERS) if (added.has(L.id) && !map.getLayer(L.layers("x-" + L.id)[0].id)) { added.delete(L.id); if (document.getElementById("x-" + L.id)?.checked) apply(L, true); } });

  function card(L, f, ll) {
    const c = L.card(f.properties || {}, raw[L.id], f, sideData[L.id]); if (!c) return false;
    const [lon, lat] = ll;
    app.showInfo(`<div class="phead"><h2>${esc(c.title || L.label)}</h2></div><div class="en-card">${c.body || ""}<p><small class="muted">Źródło: ${esc(c.src || "")}</small></p>
      <p><a href="https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}" target="_blank" rel="noopener noreferrer">Zobacz w Google Maps</a></p></div>`);
    return true;
  }
  function handleClick(e) {
    const vis = id => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none";
    const r = window.matchMedia("(max-width: 760px)").matches ? 14 : 8;
    const box = [[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]];
    for (const L of LAYERS) {
      if (!added.has(L.id) || !L.card) continue;
      const specs = L.layers("x-" + L.id).filter(s => s.type !== "symbol" && s.type !== "raster" && (s.type !== "fill" || L.fillClick) && !s.noClick && vis(s.id));
      if (!specs.length) continue;
      // points and lines get a finger-sized box; areas only the exact point, so a point inside an area wins
      const near = specs.filter(s => s.type !== "fill").map(s => s.id), areas = specs.filter(s => s.type === "fill").map(s => s.id);
      let hits = near.length ? map.queryRenderedFeatures(box, { layers: near }) : [];
      if (!hits.length && areas.length) hits = map.queryRenderedFeatures(e.point, { layers: areas });
      if (!hits.length) continue;
      const pick = hits.map(f => { const g = f.geometry, c = g.type === "Point" ? g.coordinates : [e.lngLat.lng, e.lngLat.lat], q = map.project(c); return [Math.hypot(q.x - e.point.x, q.y - e.point.y), f, c]; }).sort((a, b) => a[0] - b[0])[0];
      if (card(L, pick[1], pick[2])) return true;
    }
    return false;
  }
  window.ExtraLayers.handleClick = handleClick;
  window.ExtraLayers.data = id => { const L = LAYERS.find(x => x.id === id); return L ? load(L) : Promise.reject(); };
  window.ExtraLayers.show = id => { const cb = document.getElementById("x-" + id); if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); } };

  /* Nearest GIOŚ station in the air quality section of the place card. */
  window.GiosNear = async function (place, box) {
    let d; try { d = await window.ExtraLayers.data("gios"); } catch (e) { return; }
    if (!box.isConnected) return;
    const here = { lon: +place.lon, lat: +place.lat };
    const best = d.stacje.map(s => [dist(here, s), s]).filter(x => Object.keys(x[1].pom).length).sort((a, b) => a[0] - b[0])[0];
    if (!best) return;
    const [m, s] = best, keys = Object.keys(PNAME).filter(k => s.pom[k] != null && s.mod[k] != null).slice(0, 4);
    const dg = k => PUNIT[k] === "ng/m³" ? 2 : PUNIT[k] === "dni" ? 0 : 1;
    box.insertAdjacentHTML("beforeend", `<div class="zas-block gs-near"><div class="zas-head"><span class="zas-ic" style="--c:#34a383">${svg("broadcast")}</span><div><b>Najbliższa stacja pomiarowa</b><small>${esc(s.n)} · ${fmtD(m)} stąd</small></div><button type="button" class="zas-map" data-gios-show="${s.id}">${svg("map-trifold")}Mapa</button></div>
      ${keys.length ? `<div class="zas-chips">${keys.map(k => `<span>${esc(PNAME[k])}: <b>${fmt(s.pom[k], dg(k))}</b> pomiar, ${fmt(s.mod[k], dg(k))} model</span>`).join("")}</div>` : ""}
      <p class="muted small">Średnie roczne ${d.rok} r. ${s.typ ? `Stacja ${esc(s.typ)}${s.obszar ? ", obszar " + esc(s.obszar) : ""}.` : ""} Model GIOŚ jest dopasowany do pomiarów, więc przy stacji obie wartości są zbliżone, a dalej od niej rośnie niepewność. ${link(`https://powietrze.gios.gov.pl/pjp/current/station_details/info/${s.id}`, "Bieżące pomiary")}</p></div>`);
  };
  document.getElementById("card")?.addEventListener("click", e => {
    const b = e.target.closest("[data-gios-show]"); if (!b) return;
    window.ExtraLayers.show("gios");
    window.ExtraLayers.data("gios").then(d => { const s = d.stacje.find(x => x.id === +b.dataset.giosShow); if (s) map.easeTo({ center: [s.lon, s.lat], zoom: Math.max(map.getZoom(), 12), duration: 700 }); });
  });
})();
