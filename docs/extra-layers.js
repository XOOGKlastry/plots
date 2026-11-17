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

  const LAYERS = [
    { id: "gios", box: "airLayers", label: "Stacje pomiarowe GIOŚ", desc: "Pomiary 2025 na tle norm, link do bieżących danych", kw: "stacje pomiarowe gioś monitoring powietrza pomiary indeks jakości powietrza smog",
      icon: ["broadcast", "#34a383"], url: "data/gios/stacje.json", toGeo: stationsGeo,
      layers: s => [{ id: "x-gios", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "st"], 3, ST_COL[3], 2, ST_COL[2], 1, ST_COL[1], ST_COL[0]], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 7, 14, 9], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
        { id: "x-gios-lbl", type: "symbol", source: s, minzoom: 10, layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#1f5d4c", "text-halo-color": "#fff", "text-halo-width": 1.5 } }],
      legend: () => legendRow([[ST_COL[1], "normy dotrzymane"], [ST_COL[2], "powyżej norm od 2030 r."], [ST_COL[3], "przekroczona norma"], [ST_COL[0], "bez rocznej serii"]]) + note("Kolor według średnich rocznych 2025 z pomiarów stacji. Źródło: GIOŚ, Państwowy Monitoring Środowiska (lista stacji z API PJP, statystyki roczne z Banku danych pomiarowych)."),
      card: (p, d) => ({ title: p.n, body: stationBody(p, d?.rok || 2025), src: "GIOŚ, Państwowy Monitoring Środowiska: lista stacji (API PJP), statystyki roczne 2025 (Bank danych pomiarowych), ocena roczna 2025 (modelowanie)" }) },
  ];
  const TITLES = { transportLayers: "Drogi i kolej", limitLayers: "Lotnictwo, wojsko, przesył" };
  window.ExtraLayers = { LAYERS, legendRow, note, row, link, fmt };

  /* ---------- engine ---------- */
  const cache = {};
  const load = L => cache[L.id] || (cache[L.id] = fetch(L.url).then(r => { if (!r.ok) throw Error(r.status); return r.json(); }).catch(e => { delete cache[L.id]; throw e; }));
  const raw = {};
  const firstSymbol = () => map.getStyle().layers.find(l => l.type === "symbol")?.id;
  const added = new Set();
  async function apply(L, on) {
    const leg = document.getElementById("x-leg-" + L.id);
    if (leg) { leg.hidden = !on; if (on) leg.innerHTML = L.legend(); }
    if (on && !added.has(L.id)) {
      let d; try { d = await load(L); } catch (e) { app.toast("Nie udało się wczytać warstwy"); return; }
      raw[L.id] = d;
      const src = "x-" + L.id;
      try {
        if (!map.getSource(src)) { map.addSource(src, { type: "geojson", data: L.toGeo ? L.toGeo(d) : d, attribution: L.attr || "" }); app.registerOverlaySource?.(src); }
        for (const spec of L.layers(src)) if (!map.getLayer(spec.id)) map.addLayer(spec, spec.type === "fill" || spec.type === "line" ? firstSymbol() : undefined);
        added.add(L.id);
      } catch (e) { console.warn(e); return; }
    }
    if (!added.has(L.id)) return;
    for (const spec of L.layers("x-" + L.id)) if (map.getLayer(spec.id)) map.setLayoutProperty(spec.id, "visibility", on ? "visible" : "none");
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
    const c = L.card(f.properties || {}, raw[L.id], f); if (!c) return false;
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
      const ids = L.layers("x-" + L.id).filter(s => s.type !== "symbol" && (s.type !== "fill" || L.fillClick) && !s.noClick).map(s => s.id).filter(vis);
      if (!ids.length) continue;
      const hits = map.queryRenderedFeatures(L.fillClick ? e.point : box, { layers: ids });
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
