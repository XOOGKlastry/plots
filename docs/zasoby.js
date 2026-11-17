/* Wiatr i słońce: map layers (wind speed at 10/50/100/200 m, wind power density, PVOUT, GHI, air temperature) drawn from
   pre-rendered images, and a "Wiatr i słońce" section on the place card read from a 0.01° value grid (data/zasoby, built by
   mapgen/nowe/oze_zasoby.py). Sources: Global Wind Atlas 3 (DTU, World Bank), Global Solar Atlas 2 (Solargis, World Bank). */
(function () {
  "use strict";
  const app = window.PLOTS, map = app && app.map, esc = app && app.esc, svg = n => window.Icons.svg(n);
  const panel = document.getElementById("resourceLayers");
  if (!app || !map) return;
  const DIR = "data/zasoby/";
  const GROUPS = [
    { id: "wind", label: "Prędkość wiatru", desc: "Średnia roczna na wybranej wysokości", layers: { "10 m": "w10", "50 m": "w50", "100 m": "w100", "200 m": "w200" }, def: "100 m", icon: ["wind", "#2c72b0"], kw: "wiatr wietrzność prędkość wiatru wysokość gwa turbiny" },
    { id: "power", label: "Gęstość mocy wiatru", desc: "Energia niesiona przez wiatr, W/m²", layers: { "100 m": "p100", "200 m": "p200" }, def: "100 m", icon: ["gauge", "#6f45a2"], kw: "moc wiatru gęstość mocy energia wiatru" },
    { id: "pvout", label: "Produkcja z fotowoltaiki", desc: "kWh z 1 kWp rocznie (PVOUT)", layers: { "": "pvout" }, def: "", icon: ["solar-panel", "#ec8261"], kw: "pv fotowoltaika pvout produkcja energia słońce panele" },
    { id: "ghi", label: "Nasłonecznienie", desc: "Promieniowanie na powierzchnię poziomą (GHI)", layers: { "": "ghi" }, def: "", icon: ["sun", "#f09c66"], kw: "nasłonecznienie promieniowanie ghi słońce" },
    { id: "temp", label: "Temperatura powietrza", desc: "Średnia roczna", layers: { "": "temp" }, def: "", icon: ["thermometer-hot", "#d1493d"], kw: "temperatura klimat ciepło" },
  ];
  window.LayerLook = Object.assign(window.LayerLook || {}, Object.fromEntries(GROUPS.map(g => ["zas-" + g.id, g.icon])));

  /* ---------- data ---------- */
  let metaP = null; const tiles = new Map();
  const meta = () => metaP || (metaP = fetch(DIR + "meta.json").then(r => { if (!r.ok) throw Error(); return r.json(); }).catch(e => { metaP = null; throw e; }));
  function tile(tx, ty) {
    const k = tx + "_" + ty;
    if (!tiles.has(k)) tiles.set(k, fetch(DIR + "t/" + k + ".bin").then(r => r.ok ? r.arrayBuffer() : null).then(b => b && new Uint8Array(b)).catch(() => { tiles.delete(k); return null; }));
    return tiles.get(k);
  }
  const decode = (L, q) => q === 255 ? null : L.enc[0] === "lin" ? L.enc[1] + L.enc[2] * q : (q / L.enc[1]) ** 2;
  /* Bilinear value of every layer at (lon,lat); null where there is no data (outside Poland). */
  async function values(lon, lat) {
    const m = await meta(); const [W, S, E, N] = m.bounds;
    if (lon < W || lon >= E || lat < S || lat >= N) return null;
    const tx = Math.floor(lon), ty = Math.floor(lat), buf = await tile(tx, ty); if (!buf) return null;
    const n = m.n, st = m.step, fx = Math.min(n - 1, Math.max(0, (lon - tx) / st - 0.5)), fy = Math.min(n - 1, Math.max(0, (lat - ty) / st - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(n - 1, x0 + 1), y1 = Math.min(n - 1, y0 + 1), dx = fx - x0, dy = fy - y0;
    const out = {};
    m.layers.forEach((L, k) => {
      const o = k * n * n, pts = [[x0, y0, (1 - dx) * (1 - dy)], [x1, y0, dx * (1 - dy)], [x0, y1, (1 - dx) * dy], [x1, y1, dx * dy]];
      let s = 0, w = 0; for (const [x, y, ww] of pts) { const v = decode(L, buf[o + y * n + x]); if (v != null && ww > 0) { s += v * ww; w += ww; } }
      out[L.id] = w > 0.01 ? s / w : null;
    });
    return Object.values(out).some(v => v != null) ? out : null;
  }
  const share = (L, v) => { let i = 0; while (i < 100 && L.pct[i + 1] <= v) i++; return i; }; // % of land in Poland with a lower value
  const nf = (v, d = 1) => (+v).toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
  const ni = v => Math.round(v).toLocaleString("pl-PL");
  const fmtV = (L, v) => L.unit === "m/s" ? `${nf(v)} m/s` : L.unit === "°C" ? `${nf(v)} °C` : L.unit === "°" ? `${Math.round(v)}°` : `${ni(v)} ${L.unit}`;
  window.PlotsResources = { values, meta };

  /* ---------- map layers ---------- */
  const firstSymbol = () => map.getStyle().layers.find(l => l.type === "symbol")?.id;
  const state = { on: app.store.get("zas.on", null), h: Object.assign({ wind: "100 m", power: "100 m" }, app.store.get("zas.h", {})) };
  const layerOf = g => g.layers[state.h[g.id] ?? g.def] || Object.values(g.layers)[0];
  async function show(g) {
    const m = await meta(); const L = m.layers.find(x => x.id === layerOf(g)); if (!L) return;
    const src = "zas-" + g.id + "-src", lid = "zas-" + g.id + "-r", url = DIR + "img/" + L.id + ".webp";
    if (!map.getSource(src)) { map.addSource(src, { type: "image", url, coordinates: m.img }); app.registerOverlaySource?.(src); }
    else if (map.getSource(src).url !== url) map.getSource(src).updateImage({ url, coordinates: m.img });
    if (!map.getLayer(lid)) map.addLayer({ id: lid, type: "raster", source: src, paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.88, 10, 0.75, 13, 0.5, 16, 0.28], "raster-resampling": "linear", "raster-fade-duration": 150 } }, firstSymbol());
    map.setLayoutProperty(lid, "visibility", "visible");
    legend(g, L); readout();
  }
  function hide(g) { const lid = "zas-" + g.id + "-r"; if (map.getLayer(lid)) map.setLayoutProperty(lid, "visibility", "none"); const box = document.getElementById("zas-leg-" + g.id); if (box) box.hidden = true; }
  function legend(g, L) {
    const box = document.getElementById("zas-leg-" + g.id); if (!box) return;
    const keys = Object.keys(g.layers);
    const lab = v => L.unit === "m/s" ? nf(v) : L.unit === "°C" ? nf(v) : ni(v);
    const mid = L.enc[0] === "sqrt" ? ((Math.sqrt(L.lo) + Math.sqrt(L.hi)) / 2) ** 2 : (L.lo + L.hi) / 2;
    box.hidden = false;
    box.innerHTML = (keys.length > 1 ? `<div class="ios-segc" role="tablist" aria-label="Wysokość nad gruntem">${keys.map(k => `<button type="button" role="tab" aria-selected="${k === (state.h[g.id] ?? g.def)}" data-zas-h="${esc(k)}">${esc(k)}</button>`).join("")}</div>` : "") +
      `<div class="zas-ramp" style="background:linear-gradient(90deg,${L.pal.join(",")})"></div><div class="zas-ticks"><span>${lab(L.lo)}</span><span>${lab(mid)}</span><span>${lab(L.hi)} ${esc(L.unit)}</span></div>` +
      `<p class="zas-read" data-zas-read>W środku mapy: …</p>`;
  }
  async function readout() {
    const g = GROUPS.find(x => x.id === state.on); if (!g) return;
    const el = document.querySelector(`#zas-leg-${g.id} [data-zas-read]`); if (!el) return;
    const c = map.getCenter(), v = await values(c.lng, c.lat).catch(() => null), m = await meta(), L = m.layers.find(x => x.id === layerOf(g));
    el.textContent = v && v[L.id] != null ? `W środku mapy: ${fmtV(L, v[L.id])} · więcej niż na ${share(L, v[L.id])}% powierzchni Polski` : "W środku mapy: brak danych (poza Polską)";
  }
  map.on("moveend", () => { if (state.on) readout(); });

  if (panel) {
    panel.innerHTML = `<h3>Wiatr i słońce</h3>` + GROUPS.map(g => `<div class="layer-entry" data-keywords="${esc(g.kw)}"><label class="sw"><input type="checkbox" id="zas-${g.id}"/><span></span><div>${esc(g.label)}<small>${esc(g.desc)}</small></div></label><div class="zas-leg" id="zas-leg-${g.id}" hidden></div></div>`).join("") +
      `<p class="source-note muted">Źródła: Global Wind Atlas 3 (DTU, Bank Światowy), Global Solar Atlas 2 (Solargis, Bank Światowy). Wartości modelowe, średnie wieloletnie. Naraz widać jedną z tych warstw.</p>`;
    panel.addEventListener("click", e => {
      const b = e.target.closest("[data-zas-h]"); if (!b) return;
      const g = GROUPS.find(x => b.closest("#zas-leg-" + x.id)); if (!g) return;
      state.h[g.id] = b.dataset.zasH; app.store.set("zas.h", state.h); show(g);
    });
    const init = () => {
      for (const g of GROUPS) {
        const cb = document.getElementById("zas-" + g.id);
        cb.checked = state.on === g.id;
        cb.onchange = () => {
          if (cb.checked) {
            for (const o of GROUPS) if (o !== g) { const x = document.getElementById("zas-" + o.id); if (x.checked) { x.checked = false; hide(o); } }
            state.on = g.id; show(g).catch(() => app.toast("Nie udało się wczytać warstwy"));
          } else { if (state.on === g.id) state.on = null; hide(g); }
          app.store.set("zas.on", state.on);
        };
        if (cb.checked) show(g).catch(() => {});
      }
      panel.dispatchEvent(new Event("change", { bubbles: true }));
    };
    if (map.isStyleLoaded()) init(); else map.once("load", init);
    map.on("styledata", () => { const g = GROUPS.find(x => x.id === state.on); if (g && !map.getLayer("zas-" + g.id + "-r")) show(g).catch(() => {}); });
  }

  /* ---------- place card section ---------- */
  let rev = 0;
  async function fill(place, box) {
    const id = ++rev;
    box.innerHTML = `<p class="muted small">Wczytuję dane o wietrze i słońcu…</p>`;
    let m, v; try { m = await meta(); v = await values(+place.lon, +place.lat); } catch (e) { v = null; }
    if (id !== rev || !box.isConnected) return;
    if (!v) { box.innerHTML = `<p class="muted small">Brak danych dla tego miejsca (dane obejmują Polskę).</p>`; return; }
    const L = Object.fromEntries(m.layers.map(x => [x.id, x]));
    const hs = [["10 m", "w10"], ["50 m", "w50"], ["100 m", "w100"], ["200 m", "w200"]].filter(([, k]) => v[k] != null);
    const top = Math.max(10, ...hs.map(([, k]) => v[k]));
    const badge = (k, more = "więcej") => v[k] != null ? `<span class="zas-badge">${more} niż na ${share(L[k], v[k])}% powierzchni Polski</span>` : "";
    const wind = hs.length ? `<div class="zas-block"><div class="zas-head"><span class="zas-ic" style="--c:#2c72b0">${svg("wind")}</span><div><b>Wiatr według wysokości</b><small>średnia roczna prędkość</small></div><button type="button" class="zas-map" data-zas-show="wind">${svg("map-trifold")}Mapa</button></div>
      <div class="zas-prof">${hs.map(([h, k]) => `<div class="zas-bar${k === "w100" ? " hub" : ""}"><span>${h}</span><i><s style="width:${Math.round(v[k] / top * 100)}%"></s></i><b>${nf(v[k])} m/s</b></div>`).join("")}</div>
      ${badge("w100", "Na 100 m wieje mocniej")}${v.p100 != null ? `<div class="zas-chips"><span><b>${ni(v.p100)} W/m²</b> gęstość mocy na 100 m</span>${v.p200 != null ? `<span><b>${ni(v.p200)} W/m²</b> na 200 m</span>` : ""}</div>` : ""}</div>` : "";
    const sun = v.pvout != null ? `<div class="zas-block"><div class="zas-head"><span class="zas-ic" style="--c:#ec8261">${svg("solar-panel")}</span><div><b>Słońce i fotowoltaika</b><small>średnio w roku</small></div><button type="button" class="zas-map" data-zas-show="pvout">${svg("map-trifold")}Mapa</button></div>
      <p class="zas-big"><b>${ni(v.pvout)}</b> kWh z 1 kWp rocznie</p>${badge("pvout", "Więcej")}
      <div class="zas-chips"><span><b>ok. ${nf(v.pvout * 10 / 1000)} MWh</b> rocznie z instalacji 10 kWp</span><span><b>ok. ${ni(v.pvout)} MWh</b> rocznie z farmy 1 MW</span>${v.opta != null ? `<span><b>${Math.round(v.opta)}°</b> optymalne nachylenie paneli</span>` : ""}${v.ghi != null ? `<span><b>${ni(v.ghi)} kWh/m²</b> nasłonecznienie</span>` : ""}${v.temp != null ? `<span><b>${nf(v.temp)} °C</b> średnia temperatura</span>` : ""}</div></div>` : "";
    box.innerHTML = wind + sun + `<p class="source-note muted">Źródła: ${esc(m.zrodla.gwa)}; ${esc(m.zrodla.gsa)}. Wartości modelowe, średnie wieloletnie. Nie zastępują pomiarów wietrzności ani symulacji uzysku konkretnej instalacji.</p>`;
  }
  document.getElementById("card")?.addEventListener("click", e => {
    const b = e.target.closest("[data-zas-show]"); if (!b) return;
    const cb = document.getElementById("zas-" + b.dataset.zasShow); if (!cb) return;
    if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }
    const pl = app.currentPlace?.(); if (pl) map.easeTo({ center: [+pl.lon, +pl.lat], zoom: Math.min(map.getZoom(), 11), duration: 700 });
    app.toast("Włączono warstwę: " + b.closest(".zas-block").querySelector(".zas-head b").textContent);
  });
  const P = window.PLOTS_PLANNING;
  if (P && P.loadInto) {
    const orig = P.loadInto;
    P.loadInto = function (place, el) {
      const r = orig.apply(this, arguments);
      try {
        const sec = el && el.closest("details");
        if (sec && place && Number.isFinite(+place.lon)) {
          let box = document.getElementById("placeRes");
          if (!box) { (document.getElementById("placeNear")?.closest("details") || document.getElementById("placeTerrain")?.closest("details") || sec).insertAdjacentHTML("afterend", `<details class="place-section zas-section" open><summary>${svg("wind")}Wiatr i słońce</summary><div id="placeRes"></div></details>`); box = document.getElementById("placeRes"); }
          fill(place, box);
        }
      } catch (e) { console.warn(e); }
      return r;
    };
  }
})();
