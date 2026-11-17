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
    pv: "bazamocy.pl, GDOŚ", woda: "bazamocy.pl, GDOŚ", biogaz: "KOWR, rejestr wytwórców biogazu rolniczego", cieplownie: "bazamocy.pl",
    ladowanie: "Ewidencja Infrastruktury Paliw Alternatywnych EIPA (UDT)", magazyny: "OpenStreetMap (magazyny energii), stan 17.11.2026",
    pog: "plany ogólne gmin (Rejestr Urbanistyczny, zestawienie bazamocy.pl)", odb: "BDOT10k, GUGiK (kompleksy przemysłowo-gospodarcze)",
    wiatr: "obliczenia własne na podstawie BDOT10k (GUGiK), CRFOP (GDOŚ) i ustawy o inwestycjach w zakresie elektrowni wiatrowych"
  };
  const OZE = "oze";
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
      legend: () => legendRow([["#43a047", "biogazownia"], ["#0097a7", "elektrownia wodna"], ["#6d4c41", "ciepłownia, elektrociepłownia"]]) + note("Biogazownie: KOWR. Elektrownie wodne i ciepłownie: bazamocy.pl, GDOŚ.") },
    { id: "magazyny", label: "Magazyny energii", desc: "Bateryjne i szczytowo-pompowe", kw: "magazyny energii bess baterie akumulatory elektrownie szczytowo-pompowe szczytowo pompowe",
      layers: () => [(({ "source-layer": _, ...s }) => ({ ...s, source: "energia-mag" }))(dot("en-mag", "magazyny", "#d81b60", 9)), { id: "en-mag-lbl", type: "symbol", source: "energia-mag", minzoom: 9,
          layout: { "text-field": ["coalesce", ["get", "n"], ""], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.1], "text-anchor": "top", "text-max-width": 12 },
          paint: { "text-color": "#880e4f", "text-halo-color": "#fff", "text-halo-width": 1.5 } }],
      legend: () => legendRow([["#d81b60", "magazyn energii"]]) + note("Źródło: OpenStreetMap. Rejestry URE nie podają położenia magazynów, więc lista może być niepełna.") },
    { id: "ladowanie", label: "Stacje ładowania samochodów", desc: "Ogólnodostępne stacje z ewidencji EIPA", kw: "stacje ładowania ładowarki samochody elektryczne elektromobilność eipa udt",
      layers: () => [dot("en-lad", "ladowanie", "#7b1fa2", 6, { minzoom: 7 })], legend: () => legendRow([["#7b1fa2", "stacja ładowania"]]) + note("Źródło: Ewidencja Infrastruktury Paliw Alternatywnych EIPA (UDT)."), minz: 7 },
    { id: "wdost", label: "Obszary dla elektrowni wiatrowych", desc: "Poza strefami zakazu z ustawy wiatrakowej", kw: "obszary dostępne wiatraki elektrownie wiatrowe 700 m 10h lokalizacja farmy wiatrowej natura 2000 ustawa wiatrakowa",
      layers: () => [{ id: "oze-wiatr", type: "fill", source: OZE, "source-layer": "wiatr", minzoom: 7,
        paint: { "fill-color": ["match", ["get", "c"], 1, "#2e7d32", "#c0ca33"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 7, .55, 14, .35] } }],
      legend: () => legendRow([["#2e7d32", "dostępny", "box"], ["#c0ca33", "dostępny z ograniczeniami", "box"]]) +
        note("Zieleń: poza wszystkimi wykluczeniami z ustawy o inwestycjach w zakresie elektrowni wiatrowych (Dz.U. 2024 poz. 317): 700 m od budynków mieszkalnych, parki narodowe z pasem 10H, rezerwaty z pasem 500 m, parki krajobrazowe, Natura 2000, linie 220 i 400 kV z pasem 480 m. Przyjęto turbinę o wysokości 200 m i wirniku 160 m. Żółć: według ustawy dopuszczalne, ale w lesie lub do 200 m od lasu (wytyczne GDOŚ dotyczące nietoperzy), na wodach, w użytkach ekologicznych lub zespołach przyrodniczo-krajobrazowych. Mapa orientacyjna: nie zastępuje planu miejscowego ani oceny oddziaływania na środowisko."), minz: 7 },
    { id: "pog", label: "Strefy OZE w planach ogólnych", desc: "Strefy planów ogólnych dopuszczające źródła odnawialne", kw: "plan ogólny pog strefy oze fotowoltaika biogazownie wiatraki strefa planistyczna uchwalony projekt",
      layers: () => [{ id: "oze-pog", type: "fill", source: OZE, "source-layer": "pog", minzoom: 9, paint: { "fill-color": ["match", ["get", "u"], 1, "#7e57c2", "#d1c4e9"], "fill-opacity": .35 } },
        { id: "oze-pog-line", type: "line", source: OZE, "source-layer": "pog", minzoom: 11, paint: { "line-color": "#5e35b1", "line-width": .7 } }],
      legend: () => legendRow([["#7e57c2", "plan uchwalony", "box"], ["#d1c4e9", "plan w trakcie uchwalania", "box"]]) + note("Strefy planów ogólnych gmin, w których profil dopuszcza elektrownie słoneczne, biogazownie lub wiatrowe. Źródło: Rejestr Urbanistyczny (zestawienie bazamocy.pl). Widoczne od skali około 1:1 000 000."), minz: 9 },
    { id: "odb", label: "Duzi odbiorcy energii", desc: "Zakłady, kopalnie, oczyszczalnie, fermy i inne", kw: "duzi odbiorcy energii zakłady przemysłowe kopalnie oczyszczalnie ścieków fermy hodowlane huty odbiorcy mocy",
      layers: () => [dot("en-odb", "odb", "#455a64", 6, { source: OZE, minzoom: 9 })], legend: () => legendRow([["#455a64", "zakład lub obiekt"]]) + note("Kompleksy przemysłowo-gospodarcze z BDOT10k (GUGiK): zakłady produkcyjne, fermy, oczyszczalnie, kopalnie, wodociągi, huty i inne. Widoczne od skali około 1:1 000 000."), minz: 9 }
  ];
  const LOOK = { wn: ["lightning", "#c62828"], sn: ["plug", "#f57c00"], wiatr: ["wind", "#1565c0"], pv: ["solar-panel", "#f9a825"], inne: ["factory", "#43a047"], magazyny: ["battery-charging", "#d81b60"], ladowanie: ["charging-station", "#7b1fa2"], wdost: ["wind", "#2e7d32"], pog: ["map-trifold", "#7e57c2"], odb: ["factory", "#455a64"] };
  window.LayerLook = Object.assign(window.LayerLook || {}, Object.fromEntries(Object.entries(LOOK).map(([k, v]) => ["en-" + k, v])));
  function legendRow(items) {
    return `<div class="terr-legend">${items.map(([c, l, kind]) => `<span><i style="${kind === "line" ? `background:${c};height:3px;border-radius:2px` : kind === "box" ? `background:${c};opacity:.7;border-radius:2px` : kind === "ring" ? `background:#fff;border:2px solid ${KV[220]};border-radius:50%` : `background:${c};border-radius:50%`}"></i>${esc(l)}</span>`).join("")}</div>`;
  }
  const note = t => `<small class="terr-unit">${esc(t)}</small>`;

  const panel = document.getElementById("energyLayers");
  if (!panel) return;
  panel.innerHTML = `<h3>Energetyka</h3>` + LAYERS.map(L => `<div class="layer-entry" data-keywords="${esc(L.kw)}"><label class="sw"><input type="checkbox" id="en-${L.id}"/><span></span><div>${esc(L.label)}<small>${esc(L.desc)}</small></div></label><div class="terr-legend-box" id="en-leg-${L.id}" hidden></div></div>`).join("") +
    `<p class="source-note muted">Źródła: Prezes URE, GDOŚ i RDOŚ, KOWR, GUGiK (BDOT10k), Rejestr Urbanistyczny, OpenStreetMap, bazamocy.pl.</p>`;

  const firstSymbol = () => map.getStyle().layers.find(l => l.type === "symbol")?.id;
  function ensureSource() {
    if (!map.getSource(SRC)) { map.addSource(SRC, { type: "vector", tiles: [BASE + "/tiles/energia/{z}/{x}/{y}.pbf"], minzoom: 5, maxzoom: 14, attribution: "URE, GDOŚ, KOWR, UDT, GUGiK, © OpenStreetMap" }); app.registerOverlaySource?.(SRC); }
    if (!map.getSource(OZE)) { map.addSource(OZE, { type: "vector", tiles: [BASE + "/tiles/oze/{z}/{x}/{y}.pbf"], minzoom: 7, maxzoom: 14, attribution: "GUGiK, GDOŚ, Rejestr Urbanistyczny" }); app.registerOverlaySource?.(OZE); }
    if (!map.getSource("energia-mag")) map.addSource("energia-mag", { type: "geojson", data: "data/magazyny-energii.geojson", attribution: "© OpenStreetMap" });
  }
  const added = new Set();
  function apply(L, on) {
    if (on && !added.has(L.id)) {
      try { ensureSource(); for (const spec of L.layers()) if (!map.getLayer(spec.id)) map.addLayer(spec, spec.type === "line" || spec.type === "fill" ? firstSymbol() : undefined); added.add(L.id); } catch (e) { console.warn(e); }
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
  const POINTS = ["en-mag", "en-turb", "en-turb-plan", "en-pv", "en-woda", "en-bio", "en-cie", "en-gpz", "en-lad", "en-odb"];
  const AREAS = ["oze-pog", "oze-wiatr"];
  const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  const fmt = (v, d = 1) => (+v).toLocaleString("pl-PL", { maximumFractionDigits: d });
  function card(f, ll) {
    const p = f.properties || {}, l = f.sourceLayer;
    const row = (k, v) => v ? `<p><span class="muted">${esc(k)}:</span> <b>${esc(v)}</b></p>` : "";
    let title = "", body = "";
    if (l === "turbiny") { title = "Elektrownia wiatrowa"; body = `<p>Działająca turbina wiatrowa.</p>`; }
    else if (l === "turbiny_plan") { title = "Planowana elektrownia wiatrowa"; body = row("Przedsięwzięcie", p.n) + row("Moc farmy", p.mw ? `${fmt(p.mw)} MW` : "") + row("Turbin w farmie", p.t) + row("Wysokość całkowita", p.h ? `${fmt(p.h, 0)} m` : "") + row("Decyzja środowiskowa", p.org); }
    else if (l === "pv") { title = "Farma fotowoltaiczna"; }
    else if (l === "woda") { title = "Elektrownia wodna"; }
    else if (l === "biogaz") { title = "Biogazownia rolnicza"; body = row("Wytwórca", p.n) + row("Moc elektryczna", p.mw ? `${fmt(p.mw, 3)} MW` : ""); }
    else if (l === "cieplownie") { title = p.r ? p.r.charAt(0).toUpperCase() + p.r.slice(1) : "Ciepłownia"; }
    else if (l === "ladowanie") { title = "Stacja ładowania samochodów"; body = `<p>Ogólnodostępna stacja ładowania. Moc, złącza i ceny sprawdzisz w <a href="https://eipa.udt.gov.pl/" target="_blank" rel="noopener noreferrer">EIPA</a>.</p>`; }
    else if (f.source === "energia-mag") { title = p.typ === "szczytowo-pompowy" ? "Elektrownia szczytowo-pompowa" : "Magazyn energii"; body = row("Nazwa", p.n) + row("Operator", p.op) + row("Moc", p.mw ? `${fmt(p.mw)} MW` : "") + row("Pojemność", p.mwh ? `${fmt(p.mwh)} MWh` : ""); }
    else if (l === "odb") { title = cap(p.r) || "Duży odbiorca energii"; body = row("Opis", p.i) + `<p class="muted small">Kompleks przemysłowo-gospodarczy z bazy BDOT10k, potencjalny duży odbiorca energii lub ciepła.</p>`; }
    else if (l === "pog") { title = cap(p.n) || "Strefa planu ogólnego"; body = row("Oznaczenie", p.o) + row("Gmina", p.gm) + row("Plan ogólny", p.u ? "uchwalony" : "w trakcie uchwalania") +
        row("Dopuszczone OZE", [p.pv && "elektrownie słoneczne", p.bio && "biogazownie", p.wi && "elektrownie wiatrowe"].filter(Boolean).join(", ")) + row("Powierzchnia strefy", p.ha ? `${fmt(p.ha)} ha` : ""); }
    else if (l === "wiatr") { title = "Obszar dla elektrowni wiatrowych"; body = p.c === 1 ? `<p>Miejsce <b>poza wszystkimi strefami zakazu</b> z ustawy wiatrakowej i poza lasami, wodami oraz pasem 200 m od lasu.</p>` : `<p>Według ustawy <b>dopuszczalne</b>, ale w lesie lub do 200 m od lasu, na wodach, w użytku ekologicznym albo zespole przyrodniczo-krajobrazowym. Wytyczne środowiskowe zalecają tu ostrożność.</p>`;
      body += `<p class="muted small">Założono turbinę o wysokości 200 m i wirniku 160 m oraz 700 m od budynków mieszkalnych (minimum, które może ustalić plan miejscowy). Lokalizację rozstrzyga plan miejscowy i decyzja środowiskowa.</p>`; }
    else if (l === "gpz") { title = "Stacja elektroenergetyczna (GPZ)"; body = row("Nazwa", (p.n || "").trim().replace(/^[„"]|[”"]$/g, "")); }
    const [lon, lat] = ll || f.geometry.coordinates;
    app.showInfo(`<div class="phead"><h2>${esc(title)}</h2></div><div class="en-card">${body}<p><small class="muted">Źródło: ${esc(SOURCES[f.source === "energia-mag" ? "magazyny" : l] || "")}</small></p>
      <p><a href="https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}" target="_blank" rel="noopener noreferrer">Zobacz w Google Maps</a></p></div>`);
  }
  function handleClick(e) {
    const vis = id => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none";
    const ids = POINTS.filter(vis);
    const r = window.matchMedia("(max-width: 760px)").matches ? 14 : 8;
    const hits = ids.length ? map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers: ids }) : [];
    if (!hits.length) {
      // Areas answer only below parcel scale; closer in the parcel card says the same for the clicked parcel.
      const aids = AREAS.filter(vis);
      if (!aids.length || map.getZoom() >= (app.minZoom || 13)) return false;
      const a = map.queryRenderedFeatures(e.point, { layers: aids });
      if (!a.length) return false;
      card(a.find(f => f.sourceLayer === "pog") || a[0], [e.lngLat.lng, e.lngLat.lat]);
      return true;
    }
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
