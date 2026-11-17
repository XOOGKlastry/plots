/* Place card extras: "Co jest blisko" (nearest shop, school, stop, pharmacy… straight-line distance, tap shows the link on the map)
   and the "Raport PDF działki" button. Hooks the planning loader like terrain.js, so it runs for parcels and addresses. */
(function () {
  "use strict";
  const app = window.PLOTS, map = app && app.map, esc = app && app.esc, svg = n => window.Icons.svg(n);
  if (!app || !map) return;
  const ROWS = [
    { label: "Sklep spożywczy", ids: ["zabka", "biedronka", "lidl", "dino", "netto", "kaufland", "stokrotka"] },
    { label: "Szkoła podstawowa", ids: ["szkola"] },
    { label: "Przedszkole", ids: ["przedszkole"] },
    { label: "Przychodnia POZ", ids: ["poz"] },
    { label: "Apteka", ids: ["apteka"] },
    { label: "Przystanek", ids: ["przystanek"] },
    { label: "Stacja kolejowa", ids: ["przystanek_kolejowy"] },
    { label: "Automat paczkowy", ids: ["any_locker"] },
    { label: "Poczta lub punkt pocztowy", ids: ["poczta"] },
    { label: "Plac zabaw", ids: ["plac_zabaw"] },
  ];
  const fmt = m => m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} km`;
  const walk = m => { const min = Math.round(m * 1.25 / 80); return min < 1 ? "" : min > 60 ? "" : `ok. ${min} min pieszo`; };
  let rev = 0, here = null, found = [];

  function linkLayer() {
    if (map.getSource("near-link")) return map.getSource("near-link");
    app.registerOverlaySource?.("near-link");
    map.addSource("near-link", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "near-link-line", type: "line", source: "near-link", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#0a84ff", "line-width": 3, "line-dasharray": [1.5, 1.5] } });
    map.addLayer({ id: "near-link-pt", type: "symbol", source: "near-link", filter: ["==", ["geometry-type"], "Point"], layout: { "icon-image": ["concat", "poi-", ["get", "network"]], "icon-size": 1.1, "icon-allow-overlap": true, "text-field": ["get", "d"], "text-size": 13, "text-offset": [0, 1.6], "text-allow-overlap": true, "text-font": ["Noto Sans Bold"] }, paint: { "text-color": "#0a4fa8", "text-halo-color": "#fff", "text-halo-width": 2 } });
    return map.getSource("near-link");
  }
  window.PlaceNear = { clear: () => clearLink() };
  function clearLink() { const s = map.getSource("near-link"); if (s) s.setData({ type: "FeatureCollection", features: [] }); }
  document.addEventListener("plots:selection", clearLink);

  function showLink(i) {
    const f = found[i]; if (!f || !here) return;
    try {
      linkLayer().setData({ type: "FeatureCollection", features: [
        { type: "Feature", geometry: { type: "LineString", coordinates: [[here.lon, here.lat], [f.p.lon, f.p.lat]] }, properties: {} },
        { type: "Feature", geometry: { type: "Point", coordinates: [f.p.lon, f.p.lat] }, properties: { network: f.network.id, d: fmt(f.d) } }] });
    } catch (e) { console.warn(e); }
    app.frame([Math.min(here.lon, f.p.lon), Math.min(here.lat, f.p.lat), Math.max(here.lon, f.p.lon), Math.max(here.lat, f.p.lat)], 17);
    document.querySelectorAll("#placeNear .near-row").forEach((r, j) => r.classList.toggle("on", j === i));
  }

  async function fill(place, box) {
    const id = ++rev; here = { lon: +place.lon, lat: +place.lat }; found = [];
    const S = window.PLOTS_SURROUNDINGS;
    if (!S?.nearest) { box.innerHTML = `<p class="muted small">Dane o usługach są niedostępne.</p>`; return; }
    box.innerHTML = `<div class="ios-card near-card">${ROWS.map(r => `<div class="ios-row near-row near-wait"><span class="ios-ic"><span class="ios-spin"></span></span><span class="ios-tx"><b>${esc(r.label)}</b><small>Szukam…</small></span></div>`).join("")}</div>`;
    let cfg; try { cfg = await S.ready(); } catch (e) { box.innerHTML = `<p class="muted small">Nie udało się wczytać katalogu usług.</p>`; return; }
    const res = await Promise.all(ROWS.map(async r => {
      const ids = r.ids.filter(x => cfg.networks.some(n => n.id === x));
      const hits = await S.nearest(here.lon, here.lat, ids).catch(() => []);
      const best = hits.filter(Boolean).sort((a, b) => a.d - b.d)[0];
      if (best) best.name = await S.nameFor({ network: best.network.id, tile: best.p.tile, index: best.p.index }).catch(() => best.network.label);
      return { r, best };
    }));
    if (id !== rev || !box.isConnected) return;
    found = res.map(x => x.best);
    const src = [...new Set(res.filter(x => x.best).map(x => x.best.network.source).filter(Boolean))];
    box.innerHTML = `<div class="ios-card near-card">${res.map(({ r, best }, i) => best
      ? `<button type="button" class="ios-row near-row" data-near="${i}"><span class="ios-ic"><img class="ios-badge" src="${esc(window.PoiIcons?.url?.(best.network.id) || "")}" alt=""></span><span class="ios-tx"><b>${esc(r.label)}</b><small>${esc(best.name && best.name !== best.network.label ? best.name : best.network.label)}</small></span><span class="near-d"><b>${fmt(best.d)}</b><small>${walk(best.d)}</small></span>${svg("caret-right").replace('class="ic ph-icon ', 'class="ic ph-icon ios-chev ')}</button>`
      : `<div class="ios-row near-row near-none"><span class="ios-ic"></span><span class="ios-tx"><b>${esc(r.label)}</b><small>Brak w promieniu ok. 25 km</small></span></div>`).join("")}</div>
      <p class="source-note muted near-hint">Odległość w linii prostej, czas pieszo szacunkowy. Stuknij wiersz, aby zobaczyć obiekt na mapie. Dokładne czasy dojścia i dojazdu policzy moduł odległości.</p><p class="source-note muted">Źródła: ${esc(src.join("; "))}.</p>`;
  }

  function attach(place, sec) {
    const card = document.getElementById("card"); if (!card || !place || !Number.isFinite(+place.lon)) return;
    let box = document.getElementById("placeNear");
    if (!box) {
      const after = document.getElementById("placeTerrain")?.closest("details") || sec;
      after.insertAdjacentHTML("afterend", `<details class="place-section near-section" open><summary>${svg("storefront")}Co jest blisko</summary><div id="placeNear"></div></details>`);
      box = document.getElementById("placeNear");
    }
    if (!card.querySelector("[data-place-report]")) {
      const btn = `<button type="button" class="place-distance-action place-report-action" data-place-report>${svg("file-text")}Raport PDF działki${svg("caret-right")}</button>`;
      const firstAction = card.querySelector(".place-distance-action");
      if (firstAction) firstAction.insertAdjacentHTML("beforebegin", btn); else card.insertAdjacentHTML("beforeend", btn);
    }
    fill(place, box);
  }

  document.getElementById("card")?.addEventListener("click", e => {
    const r = e.target.closest("[data-near]"); if (r) { showLink(+r.dataset.near); return; }
    if (e.target.closest("[data-place-report]")) window.PlaceReport?.open();
  });

  const P = window.PLOTS_PLANNING;
  if (P && P.loadInto) {
    const orig = P.loadInto;
    P.loadInto = function (place, el) {
      const r = orig.apply(this, arguments);
      try { const sec = el && el.closest("details"); if (sec) attach(place, sec); } catch (e) { console.warn(e); }
      return r;
    };
  }
})();
