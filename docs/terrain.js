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
  const katColor = ["match", ["get", "kat"], "I", "#2e7d32", "XIII", "#1565c0", ["XVII", "XVIII"], "#6d4c41", ["XVI", "XIV", "XII", "IX", "XI"], "#8e24aa", "#9e9e9e"];
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
        map.addLayer({ id: "terr-spis", type: "fill", source: "terr-spis", "source-layer": "spis", paint: { "fill-color": stepExpr(spisMode), "fill-opacity": .62, "fill-outline-color": "rgba(80,60,40,.25)" } }, firstSymbol()); },
      ids: ["terr-spis"], legend: spisLegend },
    { id: "gunb", label: "Nowe inwestycje", desc: "Pozwolenia na budowę i zgłoszenia od 2021 r. (GUNB)", kw: "pozwolenia na budowę inwestycje gunb zgłoszenia budowy deweloper",
      add() { map.addSource("terr-gunb", { type: "vector", tiles: [BASE + "/tiles/gunb/{z}/{x}/{y}.pbf"], minzoom: 12, maxzoom: 16, attribution: "GUNB, RWDZ" });
        map.addLayer({ id: "terr-gunb", type: "circle", source: "terr-gunb", "source-layer": "gunb", paint: { "circle-color": katColor, "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 16, 6], "circle-stroke-color": "#fff", "circle-stroke-width": 1, "circle-opacity": .9 } }); },
      ids: ["terr-gunb"], legend: () => legendRow(["#2e7d32", "#1565c0", "#6d4c41", "#8e24aa", "#9e9e9e"], ["domy", "bloki", "przemysł, magazyny", "usługi", "inne"]) + `<small class="terr-unit">Widoczne po przybliżeniu. Punkt to środek działki z wniosku.</small>` },
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
        (r1.lud > 30 ? `<div class="terr-ages" title="Struktura wieku w promieniu 1 km">${r1.wiek.map((v, i) => `<span><i style="height:${Math.max(2, v / mx * 34)}px"></i><small>${ages[i]}</small></span>`).join("")}</div>` : "")));
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
  let seq = 0;
  async function loadInto(place, el) {
    if (!place || !el) return;
    const my = ++seq; el.innerHTML = `<p class="muted small">Wczytuję dane o terenie…</p>`;
    const q = `?lon=${place.lon}&lat=${place.lat}`;
    const [t, l] = await Promise.all([app.api("/api/teren" + q).catch(() => null), app.api("/api/ludnosc" + q).catch(() => null)]);
    if (my !== seq || !el.isConnected) return;
    el.innerHTML = render(t, l);
  }
  window.PLOTS_TERRAIN = { loadInto };
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
