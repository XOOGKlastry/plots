/* Energetyka: sieci elektroenergetyczne, stacje GPZ i źródła energii jako warstwy mapy (grupa „Energetyka” w panelu warstw).
   Dane: kafle /tiles/energia z serwera (podwarstwy wn, sn, gpz, turbiny, turbiny_plan, pv, woda, biogaz, cieplownie).
   Stuknięcie w obiekt otwiera krótką kartę z nazwą, mocą i źródłem. */
(function () {
  "use strict";
  const app = window.PLOTS, map = app.map, esc = app.esc, BASE = app.base;
  const SRC = "energia";
  const KV = { 400: "#7f0000", 220: "#c62828", 110: "#ef5350" };
  const SOURCES = {
    wn: "OpenStreetMap (linie elektroenergetyczne, stan 2023)", sn: "BDOT10k, GUGiK (linie średniego napięcia)", gpz: "OpenStreetMap (stacje elektroenergetyczne)",
    turbiny: "Prezes URE, rejestr koncesji", turbiny_plan: "GDOŚ i RDOŚ, decyzje środowiskowe dla farm wiatrowych (zestawienie bazamocy.pl)",
    pv: "bazamocy.pl, GDOŚ", woda: "bazamocy.pl, GDOŚ", biogaz: "KOWR, rejestr wytwórców biogazu rolniczego", cieplownie: "bazamocy.pl"
  };
  const dot = (id, layer, color, r, extra = {}) => ({ id, type: "circle", source: SRC, "source-layer": layer, ...extra,
    paint: { "circle-color": color, "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, r * .45, 10, r * .8, 15, r * 1.2], "circle-stroke-color": "#fff", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, .6, 12, 1.6] } });
  const LAYERS = [
    { id: "wn", label: "Linie wysokich napięć i stacje GPZ", desc: "110, 220 i 400 kV oraz stacje elektroenergetyczne", kw: "linie elektroenergetyczne wysokie napięcie 110 kv 220 kv 400 kv gpz stacje sieć przesyłowa pse",
      layers: () => [
        { id: "en-wn", type: "line", source: SRC, "source-layer": "wn", layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ["case", [">=", ["get", "kv"], 380], KV[400], [">=", ["get", "kv"], 220], KV[220], KV[110]],
            "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["case", [">=", ["get", "kv"], 380], 1.6, [">=", ["get", "kv"], 220], 1.1, .6], 12, ["case", [">=", ["get", "kv"], 380], 4, [">=", ["get", "kv"], 220], 3, 2]] } },
        { id: "en-gpz", type: "circle", source: SRC, "source-layer": "gpz", minzoom: 7,
          paint: { "circle-color": "#fff", "circle-stroke-color": KV[220], "circle-stroke-width": 2.2, "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 2.5, 12, 6] } },
        { id: "en-gpz-lbl", type: "symbol", source: SRC, "source-layer": "gpz", minzoom: 11,
          layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.1], "text-anchor": "top", "text-max-width": 12 },
          paint: { "text-color": "#7f0000", "text-halo-color": "#fff", "text-halo-width": 1.5 } }],
      legend: () => legendRow([[KV[400], "400 kV", "line"], [KV[220], "220 kV", "line"], [KV[110], "110 kV", "line"], ["#fff", "stacja GPZ", "ring"]]) + note("Źródło: OpenStreetMap, stan 2023. Przebieg linii orientacyjny.") },
    { id: "sn", label: "Linie średniego napięcia", desc: "Sieć SN z BDOT10k, widoczna po przybliżeniu", kw: "linie średniego napięcia sn 15 kv 20 kv sieć dystrybucyjna bdot",
      layers: () => [{ id: "en-sn", type: "line", source: SRC, "source-layer": "sn", minzoom: 12, paint: { "line-color": "#f57c00", "line-width": ["interpolate", ["linear"], ["zoom"], 12, .8, 16, 2], "line-opacity": .85 } }],
      legend: () => legendRow([["#f57c00", "linia SN", "line"]]) + note("Źródło: BDOT10k (GUGiK). Widoczne od skali około 1:100 000."), minz: 12 },
    { id: "wiatr", label: "Elektrownie wiatrowe", desc: "Działające (URE) i planowane (decyzje środowiskowe)", kw: "wiatraki elektrownie wiatrowe turbiny farmy wiatrowe planowane gdoś rdoś",
      layers: () => [dot("en-turb-plan", "turbiny_plan", "#90caf9", 7), dot("en-turb", "turbiny", "#1565c0", 7)],
      legend: () => legendRow([["#1565c0", "działająca"], ["#90caf9", "planowana"]]) + note("Działające: rejestr koncesji URE. Planowane: decyzje środowiskowe GDOŚ i RDOŚ (zestawienie bazamocy.pl).") },
    { id: "pv", label: "Farmy fotowoltaiczne", desc: "Elektrownie słoneczne", kw: "fotowoltaika farmy pv panele słoneczne elektrownie słoneczne",
      layers: () => [dot("en-pv", "pv", "#f9a825", 7)], legend: () => legendRow([["#f9a825", "farma PV"]]) + note("Źródło: bazamocy.pl, GDOŚ.") },
    { id: "inne", label: "Biogazownie, elektrownie wodne i ciepłownie", desc: "Pozostałe źródła energii i ciepła", kw: "biogazownie biogaz elektrownie wodne hydro ciepłownie elektrociepłownie kowr",
      layers: () => [dot("en-woda", "woda", "#0097a7", 7), dot("en-bio", "biogaz", "#43a047", 8), dot("en-cie", "cieplownie", "#6d4c41", 8)],
      legend: () => legendRow([["#43a047", "biogazownia"], ["#0097a7", "elektrownia wodna"], ["#6d4c41", "ciepłownia, elektrociepłownia"]]) + note("Biogazownie: KOWR. Elektrownie wodne i ciepłownie: bazamocy.pl, GDOŚ.") }
  ];
  const LOOK = { wn: ["lightning", "#c62828"], sn: ["plug", "#f57c00"], wiatr: ["wind", "#1565c0"], pv: ["solar-panel", "#f9a825"], inne: ["factory", "#43a047"] };
  window.LayerLook = Object.assign(window.LayerLook || {}, Object.fromEntries(Object.entries(LOOK).map(([k, v]) => ["en-" + k, v])));
  function legendRow(items) {
    return `<div class="terr-legend">${items.map(([c, l, kind]) => `<span><i style="${kind === "line" ? `background:${c};height:3px;border-radius:2px` : kind === "ring" ? `background:#fff;border:2px solid ${KV[220]};border-radius:50%` : `background:${c};border-radius:50%`}"></i>${esc(l)}</span>`).join("")}</div>`;
  }
  const note = t => `<small class="terr-unit">${esc(t)}</small>`;

  const panel = document.getElementById("energyLayers");
  if (!panel) return;
  panel.innerHTML = `<h3>Energetyka</h3>` + LAYERS.map(L => `<div class="layer-entry" data-keywords="${esc(L.kw)}"><label class="sw"><input type="checkbox" id="en-${L.id}"/><span></span><div>${esc(L.label)}<small>${esc(L.desc)}</small></div></label><div class="terr-legend-box" id="en-leg-${L.id}" hidden></div></div>`).join("") +
    `<p class="source-note muted">Źródła: Prezes URE, GDOŚ i RDOŚ, KOWR, GUGiK (BDOT10k), OpenStreetMap, bazamocy.pl.</p>`;

  const firstSymbol = () => map.getStyle().layers.find(l => l.type === "symbol")?.id;
  function ensureSource() {
    if (!map.getSource(SRC)) { map.addSource(SRC, { type: "vector", tiles: [BASE + "/tiles/energia/{z}/{x}/{y}.pbf"], minzoom: 5, maxzoom: 14, attribution: "URE, GDOŚ, KOWR, GUGiK, © OpenStreetMap" }); app.registerOverlaySource?.(SRC); }
  }
  const added = new Set();
  function apply(L, on) {
    if (on && !added.has(L.id)) {
      try { ensureSource(); for (const spec of L.layers()) if (!map.getLayer(spec.id)) map.addLayer(spec, spec.type === "line" ? firstSymbol() : undefined); added.add(L.id); } catch (e) { console.warn(e); }
    }
    for (const spec of L.layers()) if (map.getLayer(spec.id)) map.setLayoutProperty(spec.id, "visibility", on ? "visible" : "none");
    const leg = document.getElementById("en-leg-" + L.id); leg.hidden = !on; if (on) leg.innerHTML = L.legend();
  }
  function init() {
    for (const L of LAYERS) {
      const cb = document.getElementById("en-" + L.id);
      cb.checked = app.store.get("energy." + L.id, false);
      if (cb.checked) apply(L, true);
      cb.onchange = () => { app.store.set("energy." + L.id, cb.checked); apply(L, cb.checked); if (cb.checked && L.minz && map.getZoom() < L.minz) app.toast("Przybliż mapę, aby zobaczyć tę warstwę"); };
    }
    panel.dispatchEvent(new Event("change", { bubbles: true }));
  }
  map.on("styledata", () => { for (const L of LAYERS) if (added.has(L.id) && !map.getLayer(L.layers()[0].id)) { added.delete(L.id); if (document.getElementById("en-" + L.id).checked) apply(L, true); } });
  if (map.loaded()) init(); else map.once("load", init);

  /* Karta obiektu: tylko punkty (linie nie przechwytują stuknięć, żeby nie zasłaniać działek). */
  const POINTS = ["en-turb", "en-turb-plan", "en-pv", "en-woda", "en-bio", "en-cie", "en-gpz"];
  const fmt = (v, d = 1) => (+v).toLocaleString("pl-PL", { maximumFractionDigits: d });
  function card(f) {
    const p = f.properties || {}, l = f.sourceLayer;
    const row = (k, v) => v ? `<p><span class="muted">${esc(k)}:</span> <b>${esc(v)}</b></p>` : "";
    let title = "", body = "";
    if (l === "turbiny") { title = "Elektrownia wiatrowa"; body = `<p>Działająca turbina wiatrowa.</p>`; }
    else if (l === "turbiny_plan") { title = "Planowana elektrownia wiatrowa"; body = row("Przedsięwzięcie", p.n) + row("Moc farmy", p.mw ? `${fmt(p.mw)} MW` : "") + row("Turbin w farmie", p.t) + row("Wysokość całkowita", p.h ? `${fmt(p.h, 0)} m` : "") + row("Decyzja środowiskowa", p.org); }
    else if (l === "pv") { title = "Farma fotowoltaiczna"; }
    else if (l === "woda") { title = "Elektrownia wodna"; }
    else if (l === "biogaz") { title = "Biogazownia rolnicza"; body = row("Wytwórca", p.n) + row("Moc elektryczna", p.mw ? `${fmt(p.mw, 3)} MW` : ""); }
    else if (l === "cieplownie") { title = p.r ? p.r.charAt(0).toUpperCase() + p.r.slice(1) : "Ciepłownia"; }
    else if (l === "gpz") { title = "Stacja elektroenergetyczna (GPZ)"; body = row("Nazwa", (p.n || "").trim().replace(/^[„"]|[”"]$/g, "")); }
    const [lon, lat] = f.geometry.coordinates;
    app.showInfo(`<div class="phead"><h2>${esc(title)}</h2></div><div class="en-card">${body}<p><small class="muted">Źródło: ${esc(SOURCES[l] || "")}</small></p>
      <p><a href="https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}" target="_blank" rel="noopener noreferrer">Zobacz w Google Maps</a></p></div>`);
  }
  function handleClick(e) {
    const ids = POINTS.filter(id => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none");
    if (!ids.length) return false;
    const r = window.matchMedia("(max-width: 760px)").matches ? 14 : 8;
    const hits = map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers: ids });
    if (!hits.length) return false;
    const near = hits.map(f => { const q = map.project(f.geometry.coordinates); return [Math.hypot(q.x - e.point.x, q.y - e.point.y), f]; }).sort((a, b) => a[0] - b[0])[0][1];
    card(near);
    return true;
  }
  /* „Pokaż na mapie” w karcie gminy: włącza warstwę (karta sama się zamyka i pokazuje gminę na mapie). */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-en-layer]"); if (!b) return;
    const L = LAYERS.find(x => x.id === b.dataset.enLayer), cb = document.getElementById("en-" + b.dataset.enLayer);
    if (!L || !cb || cb.checked) return;
    cb.checked = true; app.store.set("energy." + L.id, true); apply(L, true);
    panel.dispatchEvent(new Event("change", { bubbles: true }));
    app.toast(`Włączono warstwę: ${L.label}`);
  }, true);
  window.PLOTS_ENERGY = { handleClick, layers: LAYERS.map(L => L.id) };
})();
