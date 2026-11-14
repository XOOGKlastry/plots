/* Dane o terenie: Spis 2021 (obwody spisowe), nowe inwestycje (GUNB RWDZ), ruchy terenu (EGMS przez PIG-PIB),
   drzewostany (Bank Danych o Lasach), osuwiska (SOPO), tereny górnicze i złoża (MIDAS), warunki dla pomp ciepła (MPGN),
   ruch na drogach krajowych (GDDKiA GPR 2025). Warstwy w panelu i sekcja „Teren i otoczenie” w karcie miejsca. */
(function () {
  "use strict";
  const app = window.PLOTS, map = app.map, esc = app.esc, BASE = app.base;
  const PIG = "https://cbdgmapa.pgi.gov.pl/arcgis/rest/services";
  const arcExport = (svc, layers) => `${PIG}/${svc}/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&dpi=96&format=png32&transparent=true&layers=show:${layers}&f=image`;
  const GAT = { SO: ["sosna", "#e3b94f"], "ŚW": ["świerk", "#2f6b3a"], JD: ["jodła", "#3f8f6a"], MD: ["modrzew", "#9bbf4a"], DG: ["daglezja", "#5a8f3c"],
    DB: ["dąb", "#8c6d31"], BK: ["buk", "#c0712f"], BRZ: ["brzoza", "#efe08a"], OL: ["olsza", "#6aa6a0"], OS: ["osika", "#c9d97a"], GB: ["grab", "#a07d5a"],
    JS: ["jesion", "#7e9c6b"], KL: ["klon", "#d08a4e"], JW: ["jawor", "#d08a4e"], LP: ["lipa", "#d7b77a"], TP: ["topola", "#a9bfd8"], WB: ["wierzba", "#9ccc65"],
    AK: ["robinia", "#d4a5a5"], WZ: ["wiąz", "#b39a6b"], CZR: ["czereśnia", "#d98c8c"], SO_: ["", ""] };
  const gatName = c => { const k = String(c || "").split(".")[0]; return (GAT[k] || [k.toLowerCase() || "brak danych"])[0]; };
  const FUN = { GOSP: "gospodarczy", OCHR: "ochronny", REZ: "rezerwat", "OCH": "ochronny" };
  const KAT = { I: "dom jednorodzinny", XIII: "budynek wielorodzinny", XVII: "budynek przemysłowy", XVIII: "magazyn", XVI: "budynek handlowy lub biurowy", XIV: "hotel", XII: "budynek użyteczności publicznej", IX: "kultura, nauka, sport", XI: "szkoła, szpital", II: "budynek gospodarczy", III: "budynek gospodarczy", IV: "budynek gospodarczy", XXX: "stacja paliw", XXVIII: "elektrownia" };
  const katName = k => KAT[k] || "inny obiekt";
  /* Nowe inwestycje: kwadratowe znaczki z budynkiem, żeby nie myliły się z okrągłymi znaczkami usług z modułu odległości. */
  const GLYPH = {"house": "M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z", "buildings": "M240,208H224V96a16,16,0,0,0-16-16H144V32a16,16,0,0,0-24.88-13.32L39.12,72A16,16,0,0,0,32,85.34V208H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM208,96V208H144V96ZM48,85.34,128,32V208H48ZM112,112v16a8,8,0,0,1-16,0V112a8,8,0,1,1,16,0Zm-32,0v16a8,8,0,0,1-16,0V112a8,8,0,1,1,16,0Zm0,56v16a8,8,0,0,1-16,0V168a8,8,0,0,1,16,0Zm32,0v16a8,8,0,0,1-16,0V168a8,8,0,0,1,16,0Z", "factory": "M116,176a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h28A8,8,0,0,1,116,176Zm60-8H148a8,8,0,0,0,0,16h28a8,8,0,0,0,0-16Zm64,48a8,8,0,0,1-8,8H24a8,8,0,0,1,0-16h8V88a8,8,0,0,1,12.8-6.4L96,120V88a8,8,0,0,1,12.8-6.4l38.74,29.05L159.1,29.74A16.08,16.08,0,0,1,174.94,16h18.12A16.08,16.08,0,0,1,208.9,29.74l15,105.13s.08.78.08,1.13v72h8A8,8,0,0,1,240,216Zm-77.86-94.4,8.53,6.4h36.11L193.06,32H174.94ZM48,208H208V144H168a8,8,0,0,1-4.8-1.6l-14.4-10.8,0,0L112,104v32a8,8,0,0,1-12.8,6.4L48,104Z", "storefront": "M232,96a7.89,7.89,0,0,0-.3-2.2L217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.8A7.89,7.89,0,0,0,24,96h0v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32V96ZM54,48H202l11.42,40H42.61Zm50,56h48v8a24,24,0,0,1-48,0Zm-16,0v8a24,24,0,0,1-35.12,21.26,7.88,7.88,0,0,0-1.82-1.06A24,24,0,0,1,40,112v-8ZM200,208H56V151.2a40.57,40.57,0,0,0,8,.8,40,40,0,0,0,32-16,40,40,0,0,0,64,0,40,40,0,0,0,32,16,40.57,40.57,0,0,0,8-.8Zm4.93-75.8a8.08,8.08,0,0,0-1.8,1.05A24,24,0,0,1,168,112v-8h48v8A24,24,0,0,1,204.93,132.2Z", "crane": "M228.12,17.14a8,8,0,0,0-7.88-.2L102,80H32A16,16,0,0,0,16,96V200a16,16,0,0,0,16,16h88a16,16,0,0,0,16-16V168a7.81,7.81,0,0,0-.34-2.3L113.54,92,216,37.33V160H200v-8a8,8,0,0,0-16,0v8a16,16,0,0,0,16,16h16a16,16,0,0,0,16-16V24A8,8,0,0,0,228.12,17.14ZM98.05,96l19.2,64H64V96ZM48,96v64H32V96ZM32,200h0V176h88v24Z"};
  const GUNB = [["dom", "#2e7d32", "house", "domy"], ["blok", "#1565c0", "buildings", "bloki"], ["prz", "#6d4c41", "factory", "przemysł, magazyny"], ["usl", "#8e24aa", "storefront", "usługi"], ["inne", "#757575", "crane", "inne"]];
  const gunbKey = ["match", ["get", "kat"], "I", "gunb-dom", "XIII", "gunb-blok", ["XVII", "XVIII"], "gunb-prz", ["XVI", "XIV", "XII", "IX", "XI"], "gunb-usl", "gunb-inne"];
  const SQ = 22, SPR = 2, sqCache = {};
  function sqBadge(col, glyph) {
    const n = SQ * SPR, c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d");
    const rr = (o, rad) => { x.beginPath(); x.roundRect(o, o, n - 2 * o, n - 2 * o, rad); };
    x.shadowColor = "rgba(0,0,0,.3)"; x.shadowBlur = 2 * SPR; x.shadowOffsetY = SPR * .6; rr(1.5 * SPR, 5 * SPR); x.fillStyle = "#fff"; x.fill();
    x.shadowColor = "transparent"; rr(3 * SPR, 3.6 * SPR); x.fillStyle = col; x.fill();
    const k = (12.5 * SPR) / 256; x.save(); x.translate(n / 2 - 128 * k, n / 2 - 128 * k); x.scale(k, k); x.fillStyle = "#fff"; x.fill(new Path2D(GLYPH[glyph])); x.restore();
    return c;
  }
  const sqUrl = (col, glyph) => sqCache[glyph] || (sqCache[glyph] = sqBadge(col, glyph).toDataURL());
  function addGunbImages() { for (const [id, col, glyph] of GUNB) if (!map.hasImage("gunb-" + id)) { const c = sqBadge(col, glyph); map.addImage("gunb-" + id, c.getContext("2d").getImageData(0, 0, c.width, c.height), { pixelRatio: SPR }); } }
  map.on("styleimagemissing", e => { if (e.id.startsWith("gunb-")) addGunbImages(); });
  const spisModes = {
    gest: { label: "Gęstość", unit: "os./km²", field: "gest", stops: [50, 150, 500, 1500, 4000, 10000], colors: ["#fff5eb", "#fdd0a2", "#fdae6b", "#fd8d3c", "#e6550d", "#a63603", "#6b2104"] },
    senior: { label: "Seniorzy", unit: "% w wieku poprodukcyjnym", field: "p_senior", stops: [15, 20, 25, 30, 35], colors: ["#f2f0f7", "#dadaeb", "#bcbddc", "#9e9ac8", "#756bb1", "#54278f"] },
    dzieci: { label: "Dzieci", unit: "% w wieku przedprodukcyjnym", field: "p_dzieci", stops: [12, 15, 18, 21, 24], colors: ["#f7fcf5", "#c7e9c0", "#a1d99b", "#74c476", "#31a354", "#006d2c"] }
  };
  let spisMode = app.store.get("terrain.spisMode", "gest");
  const stepExpr = m => { const M = spisModes[m], e = ["step", ["coalesce", ["get", M.field], -1], "rgba(0,0,0,0)", 0, M.colors[0]]; M.stops.forEach((s, i) => e.push(s, M.colors[i + 1])); return e; };
  const legendRow = (colors, labels) => `<div class="terr-legend">${colors.map((c, i) => `<span><i style="background:${c}"></i>${esc(labels[i])}</span>`).join("")}</div>`;
  const spisLegend = () => { const M = spisModes[spisMode], l = [`< ${M.stops[0]}`, ...M.stops.map((s, i) => i < M.stops.length - 1 ? `${s}–${M.stops[i + 1]}` : `> ${s}`)]; return `<div class="stats-seg terr-seg" role="group">${Object.entries(spisModes).map(([k, v]) => `<button type="button" data-spis="${k}" aria-pressed="${k === spisMode}">${v.label}</button>`).join("")}</div>` + legendRow(M.colors, l) + `<small class="terr-unit">${esc(M.unit)}</small>`; };

  const LAYERS = [
    { id: "spis", label: "Mieszkańcy (Spis 2021)", desc: "Obwody spisowe GUS: gęstość, seniorzy, dzieci", kw: "ludność mieszkańcy spis gus gęstość seniorzy dzieci wiek",
      add() { map.addSource("terr-spis", { type: "vector", tiles: [BASE + "/tiles/spis/{z}/{x}/{y}.pbf"], minzoom: 8, maxzoom: 14, attribution: "GUS, NSP 2021" });
        map.addLayer({ id: "terr-spis", type: "fill", source: "terr-spis", "source-layer": "spis", paint: { "fill-color": stepExpr(spisMode), "fill-opacity": .62, "fill-outline-color": "rgba(80,60,40,.25)" } }, firstSymbol());
        map.addLayer({ id: "terr-spis-lbl", type: "symbol", source: "terr-spis", "source-layer": "spis_pkt", minzoom: 13.5,
          layout: { "text-field": ["to-string", ["get", "lud"]], "text-size": 11, "text-font": ["Noto Sans Regular"], "symbol-placement": "point", "text-allow-overlap": false },
          paint: { "text-color": "#3a2a1a", "text-halo-color": "rgba(255,255,255,.9)", "text-halo-width": 1.4 } });
        if (!map.getSource("terr-spis-sel")) map.addSource("terr-spis-sel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "terr-spis-sel", type: "line", source: "terr-spis-sel", paint: { "line-color": "#1c1c1e", "line-width": 2.4 } }); },
      ids: ["terr-spis", "terr-spis-lbl", "terr-spis-sel"], legend: spisLegend },
    { id: "gunb", label: "Nowe inwestycje", desc: "Pozwolenia na budowę i zgłoszenia od 2021 r. (GUNB)", kw: "pozwolenia na budowę inwestycje gunb zgłoszenia budowy deweloper",
      add() { map.addSource("terr-gunb", { type: "vector", tiles: [BASE + "/tiles/gunb/{z}/{x}/{y}.pbf"], minzoom: 12, maxzoom: 16, attribution: "GUNB, RWDZ" });
        addGunbImages();
        map.addLayer({ id: "terr-gunb", type: "symbol", source: "terr-gunb", "source-layer": "gunb", layout: { "icon-image": gunbKey, "icon-size": ["interpolate", ["linear"], ["zoom"], 12, .5, 14, .75, 17, 1], "icon-allow-overlap": ["step", ["zoom"], false, 15, true], "icon-padding": 0 } }); },
      ids: ["terr-gunb"], legend: () => `<div class="terr-legend">${GUNB.map(([, col, glyph, lab]) => `<span><img class="terr-sq" src="${sqUrl(col, glyph)}" alt="">${esc(lab)}</span>`).join("")}</div>` + `<small class="terr-unit">Widoczne po przybliżeniu. Punkt to środek działki z wniosku.</small>` },
    { id: "egms", label: "Ruchy terenu", desc: "Osiadanie i wypiętrzanie 2016–2020 (Copernicus EGMS)", kw: "osiadanie ruchy terenu szkody górnicze egms satelita",
      add() { map.addSource("terr-egms", { type: "raster", tiles: [BASE + "/tiles/egms/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 13, attribution: "Copernicus EGMS · PIG-PIB" });
        map.addLayer({ id: "terr-egms", type: "raster", source: "terr-egms", paint: { "raster-opacity": .8 } }, firstSymbol()); },
      ids: ["terr-egms"], legend: () => legendRow(["#7f0000", "#b30000", "#d7301f", "#fc8d59", "#fdcc8a", "#9ecae1", "#2171b5"], ["< −20", "−20…−10", "−10…−5", "−5…−3", "−3…−2", "+2…+3", "> +3"]) + `<small class="terr-unit">mm na rok, ruch pionowy; bez koloru = stabilnie</small>` },
    { id: "lasy", label: "Lasy: gatunki drzew", desc: "Drzewostany z Banku Danych o Lasach", kw: "lasy drzewostany gatunki drzew sosna dąb bdl lasy państwowe wiek",
      add() { const m = ["match", ["get", "gat"]]; for (const [k, [, c]] of Object.entries(GAT)) if (c) m.push(k, c); m.push("#8bc34a");
        map.addSource("terr-lasy", { type: "vector", tiles: [BASE + "/tiles/lasy/{z}/{x}/{y}.pbf"], minzoom: 11, maxzoom: 15, attribution: "Bank Danych o Lasach" });
        map.addLayer({ id: "terr-lasy", type: "fill", source: "terr-lasy", "source-layer": "lasy", paint: { "fill-color": m, "fill-opacity": .6, "fill-outline-color": "rgba(30,60,30,.35)" } }, firstSymbol()); },
      ids: ["terr-lasy"], legend: () => legendRow(["SO", "ŚW", "DB", "BK", "BRZ", "OL", "JD", "MD"].map(k => GAT[k][1]), ["SO", "ŚW", "DB", "BK", "BRZ", "OL", "JD", "MD"].map(k => GAT[k][0])) + `<small class="terr-unit">Dominujący gatunek drzewostanu; widoczne po przybliżeniu</small>` },
    { id: "osuwiska", label: "Osuwiska", desc: "Osuwiska i tereny zagrożone (SOPO, PIG-PIB)", kw: "osuwiska sopo zagrożenia geologiczne skarpy",
      add() { map.addSource("terr-osuwiska", { type: "raster", tiles: [arcExport("geozagrozenia/sopo_obszary", "14,12")], tileSize: 256, attribution: "PIG-PIB, SOPO" });
        map.addLayer({ id: "terr-osuwiska", type: "raster", source: "terr-osuwiska", minzoom: 9, paint: { "raster-opacity": .85 } }, firstSymbol()); },
      ids: ["terr-osuwiska"], legend: () => `<small class="terr-unit">Kolory jak w SOPO: osuwiska według aktywności i tereny zagrożone ruchami masowymi</small>` },
    { id: "gornicze", label: "Tereny górnicze i złoża", desc: "MIDAS, PIG-PIB", kw: "tereny górnicze złoża kopalnie węgiel kruszywo midas",
      add() { map.addSource("terr-gornicze", { type: "raster", tiles: [arcExport("midas", "0,2")], tileSize: 256, attribution: "PIG-PIB, MIDAS" });
        map.addLayer({ id: "terr-gornicze", type: "raster", source: "terr-gornicze", minzoom: 7, paint: { "raster-opacity": .75 } }, firstSymbol()); },
      ids: ["terr-gornicze"], legend: () => `<small class="terr-unit">Udokumentowane złoża kopalin i tereny górnicze</small>` },
    { id: "geotermia", label: "Warunki dla pomp ciepła", desc: "Odwierty pod gruntowe pompy ciepła (MPGN, PIG-PIB)", kw: "pompy ciepła geotermia płytka odwiert gruntowa mpgn",
      add() { map.addSource("terr-geotermia", { type: "raster", tiles: [arcExport("geotermia/mpgn", "7")], tileSize: 256, attribution: "PIG-PIB, MPGN" });
        map.addLayer({ id: "terr-geotermia", type: "raster", source: "terr-geotermia", minzoom: 6, paint: { "raster-opacity": .7 } }, firstSymbol()); },
      ids: ["terr-geotermia"], legend: () => `<small class="terr-unit">Zielone: odwiert bez przeciwwskazań; żółte i czerwone: z ograniczeniami lub zakazem</small>` },
    { id: "ruch", label: "Ruch na drogach krajowych", desc: "Pojazdy na dobę, GDDKiA GPR 2025", kw: "ruch drogowy natężenie gddkia gpr samochody droga krajowa",
      add() { map.addSource("terr-ruch", { type: "geojson", data: "data/gpr2025.geojson", attribution: "GDDKiA, GPR 2025" });
        map.addLayer({ id: "terr-ruch", type: "line", source: "terr-ruch", layout: { "line-cap": "round" },
          paint: { "line-color": ["step", ["get", "s"], "#ffd54f", 10000, "#ffa726", 20000, "#f4511e", 40000, "#c62828", 70000, "#6a1b9a"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["step", ["get", "s"], 1, 20000, 2, 40000, 3], 12, ["step", ["get", "s"], 3, 20000, 5, 40000, 8]] } });
        map.addLayer({ id: "terr-ruch-lbl", type: "symbol", source: "terr-ruch", minzoom: 10, layout: { "symbol-placement": "line", "text-field": ["concat", ["number-format", ["get", "s"], { locale: "pl-PL" }], " poj./dobę"], "text-size": 11, "text-font": ["Noto Sans Regular"] }, paint: { "text-color": "#4a2c00", "text-halo-color": "#fff", "text-halo-width": 1.5 } }); },
      ids: ["terr-ruch", "terr-ruch-lbl"], legend: () => legendRow(["#ffd54f", "#ffa726", "#f4511e", "#c62828", "#6a1b9a"], ["< 10 tys.", "10–20 tys.", "20–40 tys.", "40–70 tys.", "> 70 tys."]) + `<small class="terr-unit">Średni dobowy ruch roczny (SDRR) 2025</small>` }
  ];
  function firstSymbol() { return map.getStyle().layers.find(l => l.type === "symbol")?.id; }

  const panel = document.getElementById("terrainLayers");
  panel.innerHTML = `<h3>Dane o terenie</h3>` + LAYERS.map(L => `<div class="layer-entry" data-keywords="${esc(L.kw)}"><label class="sw"><input type="checkbox" id="terr-${L.id}"/><span></span><div>${esc(L.label)}<small>${esc(L.desc)}</small></div></label><div class="terr-legend-box" id="terr-leg-${L.id}" hidden></div></div>`).join("") +
    `<p class="source-note muted">Źródła: GUS (NSP 2021), GUNB (rejestr RWDZ, dane.gov.pl), Copernicus EGMS i PIG-PIB, Bank Danych o Lasach, GDDKiA.</p>`;
  const added = new Set();
  function apply(L, on) {
    if (on && !added.has(L.id)) { try { L.add(); added.add(L.id); L.ids.forEach(id => app.registerOverlaySource?.(map.getLayer(id)?.source)); } catch (e) { console.warn(e); } }
    for (const id of L.ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    const leg = document.getElementById("terr-leg-" + L.id); leg.hidden = !on; if (on) leg.innerHTML = L.legend();
  }
  function init() {
    for (const L of LAYERS) {
      const cb = document.getElementById("terr-" + L.id);
      cb.checked = app.store.get("terrain." + L.id, false);
      if (cb.checked) apply(L, true);
      cb.onchange = () => { app.store.set("terrain." + L.id, cb.checked); apply(L, cb.checked); if (cb.checked && map.getZoom() < (L.id === "gunb" ? 12 : L.id === "lasy" ? 11 : 0)) app.toast("Przybliż mapę, aby zobaczyć tę warstwę"); };
    }
    panel.dispatchEvent(new Event("change", { bubbles: true }));
  }
  // basemap switches rebuild the style: re-add what was on
  map.on("styledata", () => { for (const L of LAYERS) if (added.has(L.id) && !map.getLayer(L.ids[0])) { added.delete(L.id); if (document.getElementById("terr-" + L.id).checked) apply(L, true); } });
  panel.addEventListener("click", e => {
    const b = e.target.closest("[data-spis]"); if (!b) return;
    spisMode = b.dataset.spis; app.store.set("terrain.spisMode", spisMode);
    if (map.getLayer("terr-spis")) map.setPaintProperty("terr-spis", "fill-color", stepExpr(spisMode));
    document.getElementById("terr-leg-spis").innerHTML = spisLegend();
  });
  if (map.loaded()) init(); else map.once("load", init);

  /* ---------- „Teren i otoczenie” w karcie miejsca ---------- */
  const fmt = n => Math.round(n).toLocaleString("pl-PL");
  function row(icon, title, html) { return `<div class="terr-row">${window.Icons.svg(icon)}<div><strong>${esc(title)}</strong>${html}</div></div>`; }
  function render(t, l) {
    const out = [];
    if (l && l.r) {
      const r1 = l.r["1000"], ages = ["0–9", "10–19", "20–29", "30–39", "40–49", "50–59", "60–69", "70–79", "80+"], mx = Math.max(1, ...r1.wiek);
      out.push(row("users-three", "Mieszkańcy w okolicy", `<p>${["500", "1000", "3000"].map(k => `<span class="terr-chip"><b>${fmt(l.r[k].lud)}</b> do ${k === "1000" ? "1 km" : k === "3000" ? "3 km" : "500 m"}</span>`).join("")}</p>` +
        (r1.lud > 30 ? agesHTML(r1.wiek, l.polska || null, "mieszkańców w promieniu 1 km") : "")));
    }
    if (t) {
      if (t.pozwolenia?.length) {
        const g = {}; t.pozwolenia.forEach(p => { const k = katName(p.kat); g[k] = (g[k] || 0) + 1; });
        out.push(row("crane", "Nowe inwestycje do 500 m (3 lata)", `<p>${Object.entries(g).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="terr-chip"><b>${n}</b> ${esc(k)}</span>`).join("")}</p><ul class="terr-list">${t.pozwolenia.slice(0, 5).map(p => `<li>${esc((p.opis || p.zam || "").replace(/\s+/g, " ").slice(0, 110))}<small>${esc(p.data || "")} · ${p.m} m · ${p.typ === "zgloszenie" ? "zgłoszenie" : "wniosek o pozwolenie"}</small></li>`).join("")}</ul>`));
      }
      if (t.las) out.push(row("tree", "Las w tym miejscu", `<p>${t.las.gatunek ? `Drzewostan: <b>${esc(gatName(t.las.gatunek))}</b>${t.las.wiek && t.las.wiek !== "0" ? `, ${esc(t.las.wiek)} lat` : ""}` : "Grunt leśny bez drzewostanu"}${t.las.funkcja ? `, las ${esc(FUN[t.las.funkcja] || t.las.funkcja.toLowerCase())}` : ""}.</p><small class="muted">${esc((t.las.nadlesnictwo || "").replace(/^BDL_\d+_\d+_/, "Nadleśnictwo ").replace(/_\d{4}$/, "").replace(/_/g, " ").toLowerCase().replace(/^n/, "N").replace(/ (\p{L})/gu, (m, c) => " " + c.toUpperCase()))}</small>`));
      else if (t.las_najblizszy) out.push(row("tree", "Najbliższy las", `<p><b>${fmt(t.las_najblizszy.m)} m</b>, ${esc(gatName(t.las_najblizszy.gatunek))}${t.las_najblizszy.wiek ? `, ${t.las_najblizszy.wiek} lat` : ""}</p>`));
      if (t.ruch) out.push(row("road-horizon", `Droga krajowa nr ${t.ruch.droga}`, `<p><b>${fmt(t.ruch.sdrr)}</b> pojazdów na dobę, ${fmt(t.ruch.m)} m stąd</p><small class="muted">${esc(t.ruch.odcinek || "")} · GDDKiA GPR ${t.ruch.rok}</small>`));
      if (t.egms != null) { const v = t.egms, txt = v <= -10 ? "szybko osiada" : v <= -3 ? "osiada" : v <= -1.5 ? "lekko osiada" : v >= 3 ? "wypiętrza się" : v >= 1.5 ? "lekko się wypiętrza" : "stabilny";
        out.push(row(v <= -3 ? "warning-circle" : "mountains", "Ruch terenu 2016–2020", `<p>Teren <b>${txt}</b>: ${v > 0 ? "+" : ""}${String(v).replace(".", ",")} mm/rok</p><small class="muted">Copernicus EGMS, pomiar satelitarny, uśrednienie ok. 150 m</small>`)); }
      if (t.tereny_gornicze?.length || t.zloza?.length) out.push(row("shovel", t.tereny_gornicze?.length ? "Teren górniczy" : "Złoże kopaliny", `<p>${[...(t.tereny_gornicze || []).map(x => `Teren górniczy <b>${esc(x.nazwa)}</b> (${esc((x.kopalina || "").toLowerCase())})`), ...(t.zloza || []).map(x => `Złoże <b>${esc(x.nazwa)}</b>: ${esc((x.kopalina || "").toLowerCase())}`)].join("<br>")}</p><small class="muted">PIG-PIB, MIDAS</small>`));
      if (t.osuwiska?.length) out.push(row("warning-circle", "Osuwisko", `<p>${t.osuwiska.map(o => `${esc((o.warstwa || "").replace(/^SOPO\s*.\s*/, ""))}${o.aktywnosc ? `: ${esc(o.aktywnosc)}` : ""}`).join("<br>")}</p><small class="muted">PIG-PIB, SOPO</small>`));
      if (t.geotermia?.length) { const g = t.geotermia[0], txt = g["Opis klasy"] || Object.values(g).find(v => typeof v === "string") || "";
        out.push(row("thermometer-hot", "Gruntowa pompa ciepła", `<p>${esc(txt.charAt(0).toUpperCase() + txt.slice(1))}</p><small class="muted">PIG-PIB, mapa potencjału geotermii niskotemperaturowej</small>`)); }
    }
    return out.join("") || `<p class="muted small">Brak danych dla tego miejsca.</p>`;
  }
  /* Interactive age bars: tap a bar to see the count and share; the thin mark shows the share in Poland. */
  const AGES10 = ["0–9", "10–19", "20–29", "30–39", "40–49", "50–59", "60–69", "70–79", "80+"];
  function agesHTML(wiek, pl, label) {
    const tot = wiek.reduce((a, b) => a + b, 0) || 1, plTot = pl ? pl.reduce((a, b) => a + b, 0) : 0;
    const sh = wiek.map(v => v / tot * 100), plSh = pl ? pl.map(v => v / plTot * 100) : null, mx = Math.max(...sh, ...(plSh || [0]));
    const data = { w: wiek, s: sh, p: plSh, l: label };
    return `<div class="terr-ages2" data-ages='${esc(JSON.stringify(data))}'><div class="terr-ages">${wiek.map((v, i) => `<button type="button" data-i="${i}" aria-label="${AGES10[i]} lat"><i style="height:${Math.max(2, sh[i] / mx * 40)}px"></i>${plSh ? `<b style="bottom:${(plSh[i] / mx * 40 + 14).toFixed(1)}px"></b>` : ""}<small>${AGES10[i]}</small></button>`).join("")}</div>
      <p class="terr-ages-info">${plSh ? `<span class="terr-pl-mark"></span> udział w Polsce · ` : ""}Stuknij słupek, aby zobaczyć liczbę osób.</p></div>`;
  }
  function bindAges(root) {
    root.querySelectorAll(".terr-ages2[data-ages]").forEach(el => {
      if (el.dataset.bound) return; el.dataset.bound = 1;
      const d = JSON.parse(el.dataset.ages), info = el.querySelector(".terr-ages-info"), def = info.innerHTML;
      let sel = -1;
      el.addEventListener("click", e => {
        const b = e.target.closest("button[data-i]"); if (!b) return;
        const i = +b.dataset.i; sel = sel === i ? -1 : i;
        el.querySelectorAll("button[data-i]").forEach(x => x.classList.toggle("on", +x.dataset.i === sel));
        el.classList.toggle("has-sel", sel >= 0);
        if (sel < 0) { info.innerHTML = def; return; }
        const diff = d.p ? d.s[i] - d.p[i] : 0;
        info.innerHTML = `<b>${AGES10[i]} lat: ${fmt(d.w[i])} ${window.GminaProfile?.plural ? window.GminaProfile.plural(Math.round(d.w[i]), "osoba", "osoby", "osób") : "osób"}</b> · ${d.s[i].toFixed(1).replace(".", ",")}% ${esc(d.l)}` +
          (d.p ? `<br>W Polsce ${d.p[i].toFixed(1).replace(".", ",")}%${Math.abs(diff) >= .5 ? `, tu ${diff > 0 ? "więcej" : "mniej"} o ${Math.abs(diff).toFixed(1).replace(".", ",")} pkt proc.` : ", podobnie jak tutaj."}` : "");
      });
    });
  }
  const pct = v => (+v).toFixed(1).replace(".", ",");
  function femLine(m, k) {
    if (!m || !k) return "";
    const f = k / m * 100, d = Math.abs(k - m);
    return `${fmt(f)} kobiet na 100 mężczyzn${d ? `, przewaga ${k > m ? "kobiet" : "mężczyzn"} o ${fmt(d)}` : ""}`;
  }
  function obwodHTML(r) {
    const o = r.obwod, g = r.gmina, pl = r.polska;
    const gName = r.gminaNazwa || (o.gmina || "").replace(/^gm\.\s*(m\.|w\.|m\.-w\.)?\s*/i, "");
    const sexW = o.m + o.k ? o.k / (o.m + o.k) * 100 : 50;
    const top = (p, more, less) => p >= 90 ? `<span class="terr-tag hi">${more} niż w ${p}% obwodów w Polsce</span>` : p <= 10 ? `<span class="terr-tag lo">${less} niż w ${100 - p}% obwodów w Polsce</span>` : "";
    return `<div class="terr-obwod">
      <p class="terr-obw-big"><b>${fmt(o.lud)}</b> ${window.GminaProfile?.plural ? window.GminaProfile.plural(o.lud, "mieszkaniec", "mieszkańców", "mieszkańców") : "mieszkańców"}</p>
      <p><span class="terr-chip"><b>${fmt(o.gestosc || 0)}</b> os./km²</span><span class="terr-chip">${o.km2 < 1 ? `${fmt(o.km2 * 100)} ha` : `${pct(o.km2)} km²`}</span></p>
      <p class="terr-sex-txt">${o.gn > 1 ? `${o.gr === 1 ? "Najludniejszy" : o.gr <= 10 ? `${o.gr}. najludniejszy` : "Jeden"} z ${fmt(o.gn)} obwodów ${gName ? `gminy ${esc(gName)}` : "w gminie"}` : `Jedyny obwód ${gName ? `gminy ${esc(gName)}` : "w gminie"}`}${g.lud ? `, ${(o.lud / g.lud * 100).toLocaleString("pl-PL", { maximumFractionDigits: o.lud / g.lud < .01 ? 2 : 1 })}% jej mieszkańców` : ""}.</p>
      ${top(o.pg, "Gęściej zaludniony", "Rzadziej zaludniony")}
      <div class="terr-sex"><span class="m" style="flex:${o.m}">Mężczyźni ${fmt(o.m)}</span><span class="k" style="flex:${o.k}">Kobiety ${fmt(o.k)}</span></div>
      <p class="terr-sex-txt">${femLine(o.m, o.k)}. <small>Gmina: ${fmt(g.k / g.m * 100)}, Polska: ${fmt(pl.k / pl.m * 100)} kobiet na 100 mężczyzn.</small></p>
      ${agesHTML(o.wiek, pl.wiek, "mieszkańców obwodu")}
      <p class="terr-sex-txt">W wieku poprodukcyjnym <b>${pct(o.p_poprod)}%</b>, przedprodukcyjnym <b>${pct(o.p_przedprod)}%</b>.</p>
      ${top(o.ps, "Więcej seniorów", "Mniej seniorów")}${top(o.pd, "Więcej dzieci i młodzieży", "Mniej dzieci i młodzieży")}
      <small class="muted">Obwód statystyczny ${esc(o.nr || o.id)} · GUS, Narodowy Spis Powszechny 2021</small></div>`;
  }
  function showSel(geom) {
    const src = map.getSource("terr-spis-sel");
    if (src) src.setData(geom ? { type: "Feature", geometry: geom, properties: {} } : { type: "FeatureCollection", features: [] });
  }
  const spisOn = () => !!map.getLayer("terr-spis") && map.getLayoutProperty("terr-spis", "visibility") !== "none";
  let obwSeq = 0;
  async function gminaName(k) {
    try { const all = await window.PLOTS_GMINY?.all(); const g = all && all.find(x => x.k === k); return g ? g.n : ""; } catch { return ""; }
  }
  async function obwodInto(place, el, bare) {
    const my = ++obwSeq;
    const r = await app.api(`/api/obwod?lon=${place.lon}&lat=${place.lat}`).catch(() => null);
    if (my !== obwSeq || !el.isConnected) return;
    if (!r || !r.obwod || !r.obwod.lud) { el.innerHTML = bare ? `<p class="muted small">W tym miejscu nikt nie mieszka według Spisu 2021.</p>` : ""; return; }
    r.gminaNazwa = await gminaName(r.obwod.teryt);
    if (my !== obwSeq || !el.isConnected) return;
    el.innerHTML = bare ? obwodHTML(r) : row("users-three", "Obwód spisowy (Spis 2021)", obwodHTML(r));
    bindAges(el);
    if (spisOn()) showSel(r.obwod.geom);
  }
  // Below the parcel zoom a tap on the census layer opens the district card.
  function handleClick(e) {
    if (!spisOn() || map.getZoom() >= (window.PLOTS_CFG_MINZ || 13)) return false;
    if (!map.queryRenderedFeatures(e.point, { layers: ["terr-spis"] }).length) return false;
    const place = { lon: e.lngLat.lng, lat: e.lngLat.lat };
    app.showInfo(`<div class="phead"><h2>Obwód spisowy</h2></div><div id="terrObwod"><p class="muted small">Wczytuję dane spisu…</p></div>`);
    obwodInto(place, document.getElementById("terrObwod"), true);
    return true;
  }

  let seq = 0;
  async function loadInto(place, el) {
    if (!place || !el) return;
    const my = ++seq; el.innerHTML = `<p class="muted small">Wczytuję dane o terenie…</p>`;
    const q = `?lon=${place.lon}&lat=${place.lat}`;
    const [t, l] = await Promise.all([app.api("/api/teren" + q).catch(() => null), app.api("/api/ludnosc" + q).catch(() => null)]);
    if (my !== seq || !el.isConnected) return;
    el.innerHTML = render(t, l) + `<div class="terr-obw-slot"></div>`;
    bindAges(el);
    obwodInto(place, el.querySelector(".terr-obw-slot"));
  }
  window.PLOTS_TERRAIN = { loadInto, handleClick };
  // Every place card has the MPZP section (#placePlans): put „Teren i otoczenie” right after it.
  const P = window.PLOTS_PLANNING;
  if (P && P.loadInto) {
    const orig = P.loadInto;
    P.loadInto = function (place, el) {
      const r = orig.apply(this, arguments);
      try {
        const sec = el && el.closest("details");
        if (sec) {
          let box = document.getElementById("placeTerrain");
          if (!box) { sec.insertAdjacentHTML("afterend", `<details class="place-section terr-section" open><summary>${window.Icons.svg("mountains")}Teren i otoczenie</summary><div id="placeTerrain"></div></details>`); box = document.getElementById("placeTerrain"); }
          loadInto(place, box);
        }
      } catch (e) { console.warn(e); }
      return r;
    };
  }
})();
