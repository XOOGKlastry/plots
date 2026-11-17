/* Wiatr, słońce i jakość powietrza.
   Map: every layer is an 8-bit value image (data/zasoby/v, EPSG:3857). After each map move the visible window is coloured in the
   browser (scale fitted to the view, or the national scale; air quality by legal limits) and contour lines with labels are drawn
   from the same values (d3-contour). Card: "Wiatr i słońce" and "Jakość powietrza" read the 0.01° value grid (data/zasoby/t).
   Built by mapgen/nowe/oze_zasoby.py. Sources: Global Wind Atlas 3 (DTU, World Bank), Global Solar Atlas 2 (Solargis, World Bank),
   GIOŚ annual air quality assessment 2025 (modelling). */
(function () {
  "use strict";
  const app = window.PLOTS, map = app && app.map, esc = app && app.esc, svg = n => window.Icons.svg(n);
  if (!app || !map) return;
  const DIR = "data/zasoby/", R = 6378137;
  const GROUPS = [
    { id: "wind", box: "resourceLayers", label: "Prędkość wiatru", desc: "Średnia roczna na wybranej wysokości", opts: { "10 m": "w10", "50 m": "w50", "100 m": "w100", "200 m": "w200" }, def: "100 m", icon: ["wind", "#2c72b0"], kw: "wiatr wietrzność prędkość wiatru wysokość gwa turbiny poziomice izotachy" },
    { id: "power", box: "resourceLayers", label: "Gęstość mocy wiatru", desc: "Energia niesiona przez wiatr, W/m²", opts: { "100 m": "p100", "200 m": "p200" }, def: "100 m", icon: ["gauge", "#6f45a2"], kw: "moc wiatru gęstość mocy energia wiatru" },
    { id: "pvout", box: "resourceLayers", label: "Produkcja z fotowoltaiki", desc: "kWh z 1 kWp rocznie (PVOUT)", opts: { "": "pvout" }, def: "", icon: ["solar-panel", "#ec8261"], kw: "pv fotowoltaika pvout produkcja energia słońce panele" },
    { id: "ghi", box: "resourceLayers", label: "Nasłonecznienie", desc: "Promieniowanie na powierzchnię poziomą (GHI)", opts: { "": "ghi" }, def: "", icon: ["sun", "#f09c66"], kw: "nasłonecznienie promieniowanie ghi słońce" },
    { id: "temp", box: "resourceLayers", label: "Temperatura powietrza", desc: "Średnia roczna", opts: { "": "temp" }, def: "", icon: ["thermometer-hot", "#d1493d"], kw: "temperatura klimat ciepło" },
    { id: "air", box: "airLayers", label: "Jakość powietrza", desc: "Stężenia z modelowania GIOŚ na tle norm", opts: { "PM2,5": "pm25", "PM10": "pm10", "B(a)P": "bap", "NO₂": "no2", "O₃": "o3_dni", "Arsen": "arsen" }, def: "PM2,5", icon: ["cloud", "#e5513d"], kw: "powietrze smog pył pm10 pm2.5 pm25 benzo(a)piren bap no2 dwutlenek azotu ozon arsen gioś zanieczyszczenie" },
  ];
  /* Indicator of the "Polska" map for each layer (docs/data/wskazniki-inne.json). */
  const STAT = { w10: "wiatr_10m", w50: "wiatr_50m", w100: "wiatr_100m", w200: "wiatr_200m", p100: "wiatr_moc_100m", p200: "wiatr_moc_200m", pvout: "pvout", ghi: "ghi", temp: "temp_sr",
    pm25: "pow_pm25", pm10: "pow_pm10", bap: "pow_bap", no2: "pow_no2", o3_dni: "pow_o3_dni", arsen: "pow_arsen" };
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
  async function values(lon, lat) {
    const m = await meta(); const [W, S, E, N] = m.bounds;
    if (lon < W || lon >= E || lat < S || lat >= N) return null;
    const tx = Math.floor(lon), ty = Math.floor(lat), buf = await tile(tx, ty); if (!buf) return null;
    const n = m.n, st = m.step, fx = Math.min(n - 1, Math.max(0, (lon - tx) / st - 0.5)), fy = Math.min(n - 1, Math.max(0, (lat - ty) / st - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(n - 1, x0 + 1), y1 = Math.min(n - 1, y0 + 1), dx = fx - x0, dy = fy - y0;
    const out = {};
    m.layers.forEach((L, k) => {
      const o = k * n * n;
      if (L.src === "gios") { const v = decode(L, buf[o + Math.round(fy) * n + Math.round(fx)]); out[L.id] = v; return; } // cells, no blending
      const pts = [[x0, y0, (1 - dx) * (1 - dy)], [x1, y0, dx * (1 - dy)], [x0, y1, (1 - dx) * dy], [x1, y1, dx * dy]];
      let s = 0, w = 0; for (const [x, y, ww] of pts) { const v = decode(L, buf[o + y * n + x]); if (v != null && ww > 0) { s += v * ww; w += ww; } }
      out[L.id] = w > 0.01 ? s / w : null;
    });
    return Object.values(out).some(v => v != null) ? out : null;
  }
  const share = (L, v) => { let i = 0; while (i < 100 && L.pct[i + 1] <= v) i++; return i; };
  const nf = (v, d = 1) => (+v).toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
  const ni = v => Math.round(v).toLocaleString("pl-PL");
  const digits = L => L.unit === "m/s" || L.unit === "°C" || L.unit === "µg/m³" ? 1 : L.unit === "ng/m³" ? 2 : 0;
  const fmtV = (L, v) => (digits(L) ? nf(v, digits(L)) : ni(v)) + (L.unit === "°" ? "°" : " " + L.unit);
  window.PlotsResources = { values, meta };

  /* ---------- value images ---------- */
  const imgs = new Map();
  function valueImage(L) {
    if (!imgs.has(L.id)) imgs.set(L.id, (async () => {
      const blob = await fetch(DIR + L.v).then(r => { if (!r.ok) throw Error(); return r.blob(); });
      const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
      const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
      const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data, q = new Uint8Array(c.width * c.height);
      for (let i = 0; i < q.length; i++) q[i] = d[i * 4];
      return { q, w: c.width, h: c.height };
    })().catch(e => { imgs.delete(L.id); throw e; }));
    while (imgs.size > 3) imgs.delete(imgs.keys().next().value);
    return imgs.get(L.id);
  }
  let d3P = null;
  const script = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
  const d3 = () => d3P || (d3P = script("https://unpkg.com/d3-array@3.2.4/dist/d3-array.min.js").then(() => script("https://unpkg.com/d3-contour@4.0.2/dist/d3-contour.min.js")).then(() => window.d3).catch(e => { d3P = null; throw e; }));

  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  function ramp(pal, t) { t = Math.min(1, Math.max(0, t)) * (pal.length - 1); const i = Math.min(pal.length - 2, Math.floor(t)), f = t - i, a = hex(pal[i]), b = hex(pal[i + 1]); return a.map((x, j) => Math.round(x + (b[j] - x) * f)); }
  function classColor(L, v) { let i = 0; while (i < L.breaks.length && v >= L.breaks[i]) i++; return hex(L.pal[Math.min(i, L.pal.length - 1)]); }
  const tr = (L, v) => L.enc[0] === "sqrt" ? Math.sqrt(Math.max(0, v)) : v;
  function niceStep(span, n) { const raw = span / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }

  /* ---------- state ---------- */
  const state = Object.assign({ on: null, h: {}, scale: "view", iso: true }, (() => { const s = app.store.get("zas.state", null); return s && typeof s === "object" ? s : {}; })());
  const save = () => app.store.set("zas.state", state);
  const optOf = g => state.h[g.id] ?? g.def;
  const layerId = g => g.opts[optOf(g)] || Object.values(g.opts)[0];
  const merc = { x: lon => lon * Math.PI / 180 * R, y: lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * R, lon: x => x / R * 180 / Math.PI, lat: y => (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI };
  const firstSymbol = () => map.getStyle().layers.find(l => l.type === "symbol" && !l.id.startsWith("zas-"))?.id;
  let rev = 0, lastUrl = null, view = null;

  function ensureLayers() {
    if (!map.getSource("zas-img")) {
      map.addSource("zas-img", { type: "image", url: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==", coordinates: [[14, 55], [24.2, 55], [24.2, 49], [14, 49]] });
      map.addSource("zas-iso", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      ["zas-img", "zas-iso"].forEach(s => app.registerOverlaySource?.(s));
    }
    const before = firstSymbol();
    for (const g of GROUPS) {
      const lid = "zas-" + g.id + "-r";
      if (!map.getLayer(lid)) map.addLayer({ id: lid, type: "raster", source: "zas-img", layout: { visibility: "none" }, paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.88, 10, 0.78, 13, 0.55, 16, 0.32], "raster-resampling": "linear", "raster-fade-duration": 0 } }, before);
    }
    if (!map.getLayer("zas-iso-l")) map.addLayer({ id: "zas-iso-l", type: "line", source: "zas-iso", layout: { "line-join": "round", visibility: "none" }, paint: { "line-color": ["coalesce", ["get", "c"], "#1d1d1f"], "line-opacity": ["case", ["get", "major"], 0.6, 0.38], "line-width": ["case", ["get", "major"], 1.3, 0.8] } }, before);
    if (!map.getLayer("zas-iso-t")) map.addLayer({ id: "zas-iso-t", type: "symbol", source: "zas-iso", layout: { visibility: "none", "symbol-placement": "line", "symbol-spacing": 260, "text-field": ["get", "t"], "text-size": 11, "text-font": ["Noto Sans Bold"], "text-max-angle": 30, "text-padding": 4 }, paint: { "text-color": "#1d1d1f", "text-halo-color": "rgba(255,255,255,.92)", "text-halo-width": 1.6 } });
  }
  function setVisible(gid) {
    for (const g of GROUPS) { const l = "zas-" + g.id + "-r"; if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", g.id === gid ? "visible" : "none"); }
    for (const l of ["zas-iso-l", "zas-iso-t"]) if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", gid && state.iso ? "visible" : "none");
  }

  /* Colour the visible window and draw its contours. */
  async function render() {
    const g = GROUPS.find(x => x.id === state.on); if (!g) return;
    const id = ++rev, m = await meta(), L = m.layers.find(x => x.id === layerId(g)); if (!L) return;
    ensureLayers(); setVisible(g.id);
    let V; try { V = await valueImage(L); } catch (e) { app.toast("Nie udało się wczytać warstwy"); return; }
    if (id !== rev) return;
    const [X0, Y0, X1, Y1] = m.merc, { q, w, h } = V, b = map.getBounds();
    const fx = x => (x - X0) / (X1 - X0) * w, fy = y => (Y1 - y) / (Y1 - Y0) * h;
    let px0 = fx(merc.x(b.getWest())), px1 = fx(merc.x(b.getEast())), py0 = fy(merc.y(Math.min(85, b.getNorth()))), py1 = fy(merc.y(Math.max(-85, b.getSouth())));
    const mx_ = (px1 - px0) * 0.15, my_ = (py1 - py0) * 0.15;
    px0 = Math.max(0, Math.floor(px0 - mx_)); px1 = Math.min(w, Math.ceil(px1 + mx_)); py0 = Math.max(0, Math.floor(py0 - my_)); py1 = Math.min(h, Math.ceil(py1 + my_));
    if (px1 - px0 < 2 || py1 - py0 < 2) { view = null; map.getSource("zas-iso")?.setData({ type: "FeatureCollection", features: [] }); setVisible(null); legendUpdate(g, L, null); return; }
    const ww = px1 - px0, wh = py1 - py0, s = Math.max(1, Math.ceil(Math.max(ww, wh) / 1400)), ow = Math.ceil(ww / s), oh = Math.ceil(wh / s);
    const dec = new Float32Array(256); for (let i = 0; i < 256; i++) dec[i] = i === 255 ? NaN : decode(L, i);
    // colour domain
    let lo = L.lo, hi = L.hi;
    if (!L.breaks && state.scale === "view") {
      const hist = new Uint32Array(256); let n = 0;
      for (let y = 0; y < oh; y += 2) { const row = Math.min(h - 1, py0 + y * s) * w; for (let x = 0; x < ow; x += 2) { const v = q[row + Math.min(w - 1, px0 + x * s)]; if (v !== 255) { hist[v]++; n++; } } }
      if (n > 40) {
        const at = p => { let c = 0; for (let i = 0; i < 255; i++) { c += hist[i]; if (c >= p * n) return dec[i]; } return dec[254]; };
        lo = at(0.02); hi = at(0.98);
        const span = L.minspan || 0; if (hi - lo < span) { const c = (hi + lo) / 2; lo = c - span / 2; hi = c + span / 2; }
      }
    }
    const lut = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 255; i++) {
      const v = dec[i], c = L.breaks ? classColor(L, v) : ramp(L.pal, (tr(L, v) - tr(L, lo)) / Math.max(1e-9, tr(L, hi) - tr(L, lo)));
      lut.set([c[0], c[1], c[2], 255], i * 4);
    }
    const cv = document.createElement("canvas"); cv.width = ow; cv.height = oh;
    const ctx = cv.getContext("2d"), im = ctx.createImageData(ow, oh), D = im.data;
    for (let y = 0; y < oh; y++) { const row = Math.min(h - 1, py0 + y * s) * w; for (let x = 0; x < ow; x++) { const k = q[row + Math.min(w - 1, px0 + x * s)] * 4, o = (y * ow + x) * 4; D[o] = lut[k]; D[o + 1] = lut[k + 1]; D[o + 2] = lut[k + 2]; D[o + 3] = lut[k + 3]; } }
    ctx.putImageData(im, 0, 0);
    const ex = px0 + ow * s, ey = py0 + oh * s, X = px => merc.lon(X0 + px / w * (X1 - X0)), Y = py => merc.lat(Y1 - py / h * (Y1 - Y0));
    const coords = [[X(px0), Y(py0)], [X(ex), Y(py0)], [X(ex), Y(ey)], [X(px0), Y(ey)]];
    const blob = await new Promise(r => cv.toBlob(r, "image/png")); if (id !== rev || !blob) return;
    const url = URL.createObjectURL(blob);
    map.getSource("zas-img").updateImage({ url, coordinates: coords });
    if (lastUrl) { const old = lastUrl; setTimeout(() => URL.revokeObjectURL(old), 4000); } lastUrl = url;
    view = { L, lo, hi, V, px0, py0, ww, wh, m };
    legendUpdate(g, L, view);
    if (state.iso) contours(id, L, lo, hi, V, px0, py0, ww, wh, dec, X, Y); else map.getSource("zas-iso").setData({ type: "FeatureCollection", features: [] });
  }

  function sampler(V, dec) {
    const { q, w, h } = V;
    return (x, y) => { // bilinear at image pixel coords (centres at +0.5); NaN next to missing data
      const fx = Math.min(w - 1.001, Math.max(0, x - 0.5)), fy = Math.min(h - 1.001, Math.max(0, y - 0.5)), x0 = fx | 0, y0 = fy | 0, dx = fx - x0, dy = fy - y0;
      const a = dec[q[y0 * w + x0]], b = dec[q[y0 * w + x0 + 1]], c = dec[q[(y0 + 1) * w + x0]], d = dec[q[(y0 + 1) * w + x0 + 1]];
      return a * (1 - dx) * (1 - dy) + b * dx * (1 - dy) + c * (1 - dx) * dy + d * dx * dy;
    };
  }
  async function contours(id, L, lo, hi, V, px0, py0, ww, wh, dec, X, Y) {
    let D3; try { D3 = await d3(); } catch (e) { return; } if (id !== rev) return;
    const at = sampler(V, dec), big = 230, cw = Math.max(8, Math.round(ww >= wh ? big : big * ww / wh)), ch = Math.max(8, Math.round(wh >= ww ? big : big * wh / ww));
    let a = new Float64Array(cw * ch); const ok = new Uint8Array(cw * ch);
    const air = !!L.breaks;
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) { const v = at(px0 + (i + 0.5) * ww / cw, py0 + (j + 0.5) * wh / ch); const k = j * cw + i; if (Number.isFinite(v)) { a[k] = tr(L, v); ok[k] = 1; } else a[k] = NaN; }
    if (!air) for (let pass = 0; pass < 2; pass++) { // light 3x3 blur so lines follow the field, not pixel noise
      const b = new Float64Array(a.length);
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) { let s = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const x = i + di, y = j + dj; if (x < 0 || y < 0 || x >= cw || y >= ch) continue; const v = a[y * cw + x]; if (Number.isFinite(v)) { s += v; n++; } } b[j * cw + i] = ok[j * cw + i] && n ? s / n : NaN; }
      a = b;
    }
    let vmin = Infinity, vmax = -Infinity; for (let k = 0; k < a.length; k++) if (ok[k]) { if (a[k] < vmin) vmin = a[k]; if (a[k] > vmax) vmax = a[k]; }
    if (!Number.isFinite(vmin)) { map.getSource("zas-iso").setData({ type: "FeatureCollection", features: [] }); return; }
    const fill = vmin - 1e6; for (let k = 0; k < a.length; k++) if (!ok[k]) a[k] = fill;
    let th, step = 0;
    if (air) th = L.breaks.map(v => tr(L, v));
    else {
      step = niceStep(hi - lo, 7);
      th = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) th.push(tr(L, +v.toFixed(6)));
    }
    th = th.filter(t => t > vmin && t < vmax);
    const polys = D3.contours().size([cw, ch]).thresholds(th)(a);
    const valid = (x, y) => { if (x <= 0.02 || y <= 0.02 || x >= cw - 0.02 || y >= ch - 0.02) return false; const i = Math.min(cw - 1, Math.max(0, Math.floor(x - 0.5))), j = Math.min(ch - 1, Math.max(0, Math.floor(y - 0.5))); return ok[j * cw + i] && ok[j * cw + Math.min(cw - 1, i + 1)] && ok[Math.min(ch - 1, j + 1) * cw + i] && ok[Math.min(ch - 1, j + 1) * cw + Math.min(cw - 1, i + 1)]; };
    const toLL = ([x, y]) => [X(px0 + x * ww / cw), Y(py0 + y * wh / ch)];
    const dg = air ? digits(L) : step < 0.1 ? 2 : step < 1 ? 1 : 0;
    const feats = [];
    polys.forEach((p, n) => {
      const raw = L.enc[0] === "sqrt" ? p.value ** 2 : p.value, lab = air ? `${nf(raw, raw % 1 ? 2 : 0)}` : (dg ? nf(raw, dg) : ni(raw));
      const major = air ? true : Math.abs(Math.round(raw / (step * 2)) * step * 2 - raw) < step * 0.01;
      for (const poly of p.coordinates) for (const ring of poly) {
        let run = [];
        const flush = () => { if (run.length > 2) feats.push({ type: "Feature", geometry: { type: "LineString", coordinates: run.map(toLL) }, properties: { t: lab, major } }); run = []; };
        for (const pt of ring) { if (valid(pt[0], pt[1])) run.push(pt); else flush(); }
        flush();
      }
    });
    if (id === rev) map.getSource("zas-iso").setData({ type: "FeatureCollection", features: feats });
  }
  let timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(render, 120); };
  map.on("moveend", () => { if (state.on) schedule(); });

  /* ---------- panel ---------- */
  const unitShort = L => L.unit.replace(" rocznie", "");
  function legendHtml(g, L) {
    const keys = Object.keys(g.opts);
    const seg = keys.length > 1 ? `<div class="ios-segc${keys.length > 4 ? " many" : ""}" role="tablist">${keys.map(k => `<button type="button" role="tab" aria-selected="${k === optOf(g)}" data-zas-h="${esc(k)}">${esc(k)}</button>`).join("")}</div>` : "";
    const scale = L.breaks ? "" : `<div class="zas-opts"><div class="ios-segc small" role="tablist" aria-label="Skala kolorów"><button type="button" data-zas-scale="view" aria-selected="${state.scale === "view"}">Skala tego widoku</button><button type="button" data-zas-scale="pl" aria-selected="${state.scale === "pl"}">Skala Polski</button></div></div>`;
    const iso = `<button type="button" class="zas-iso" data-zas-iso aria-pressed="${state.iso}"><i></i>Poziomice z opisem${L.breaks ? " (granice klas)" : ""}</button>`;
    const key = L.breaks ? `<div class="zas-classes">${L.pal.map((c, i) => `<span><i style="background:${c}"></i>${i === 0 ? "poniżej " + nf(L.breaks[0], L.breaks[0] % 1 ? 2 : 0) : i === L.breaks.length ? nf(L.breaks[i - 1], L.breaks[i - 1] % 1 ? 2 : 0) + " i więcej" : nf(L.breaks[i - 1], L.breaks[i - 1] % 1 ? 2 : 0) + "–" + nf(L.breaks[i], L.breaks[i] % 1 ? 2 : 0)}</span>`).join("")}</div><p class="zas-norms">${esc(L.name)}, ${esc(L.unit)}. ${L.norms.map(([v, t]) => `${nf(v, v % 1 ? 1 : 0)} ${esc(t)}`).join(" · ")}</p>`
      : `<div class="zas-ramp" style="background:linear-gradient(90deg,${L.pal.join(",")})"></div><div class="zas-ticks" data-zas-ticks><span></span><span></span><span></span></div>`;
    const stat = STAT[L.id] ? `<button type="button" class="zas-pl" data-zas-stat="${esc(STAT[L.id])}">${svg("map-trifold")}Porównaj gminy na mapie Polski</button>` : "";
    return seg + scale + key + `<p class="zas-read" data-zas-read>…</p>` + iso + stat;
  }
  function legendUpdate(g, L, v) {
    const box = document.getElementById("zas-leg-" + g.id); if (!box || box.hidden) return;
    if (box.dataset.layer !== L.id) { box.dataset.layer = L.id; box.innerHTML = legendHtml(g, L); }
    const t = box.querySelector("[data-zas-ticks]");
    if (t && v) { const lab = x => digits(L) ? nf(x, digits(L)) : ni(x), mid = L.enc[0] === "sqrt" ? ((Math.sqrt(v.lo) + Math.sqrt(v.hi)) / 2) ** 2 : (v.lo + v.hi) / 2; t.innerHTML = `<span>${lab(v.lo)}</span><span>${lab(mid)}</span><span>${lab(v.hi)} ${esc(unitShort(L))}</span>`; }
    const r = box.querySelector("[data-zas-read]");
    if (r) {
      if (!v) { r.textContent = "Ten widok jest poza zasięgiem danych (Polska)."; return; }
      const c = map.getCenter(), at = sampler(v.V, new Float32Array(256).map((_, i) => i === 255 ? NaN : decode(L, i)));
      const [X0, Y0, X1, Y1] = v.m.merc, x = (merc.x(c.lng) - X0) / (X1 - X0) * v.V.w, y = (Y1 - merc.y(c.lat)) / (Y1 - Y0) * v.V.h, val = at(x, y);
      r.textContent = Number.isFinite(val) ? `W środku mapy: ${fmtV(L, val)} · więcej niż na ${share(L, val)}% powierzchni Polski` : "W środku mapy: brak danych";
    }
  }
  function mountPanels() {
    const boxes = {};
    for (const g of GROUPS) (boxes[g.box] = boxes[g.box] || []).push(g);
    for (const [boxId, gs] of Object.entries(boxes)) {
      const el = document.getElementById(boxId); if (!el) continue;
      const air = boxId === "airLayers";
      el.innerHTML = `<h3>${air ? "Jakość powietrza" : "Wiatr i słońce"}</h3>` + gs.map(g => `<div class="layer-entry" data-keywords="${esc(g.kw)}"><label class="sw"><input type="checkbox" id="zas-${g.id}"/><span></span><div>${esc(g.label)}<small>${esc(g.desc)}</small></div></label><div class="zas-leg" id="zas-leg-${g.id}" hidden></div></div>`).join("") +
        `<p class="source-note muted">${air ? "Źródło: GIOŚ, roczna ocena jakości powietrza 2025, wyniki modelowania stężeń (siatka ok. 1,5 km). Normy: rozporządzenie w sprawie poziomów substancji w powietrzu i dyrektywa UE 2024/2881 (od 2030 r.), zalecenia WHO 2021." : "Źródła: Global Wind Atlas 3 (DTU, Bank Światowy), Global Solar Atlas 2 (Solargis, Bank Światowy). Wartości modelowe, średnie wieloletnie."} Naraz widać jedną warstwę z tej i sąsiedniej grupy.</p>`;
      el.addEventListener("click", e => {
        const g = GROUPS.find(x => e.target.closest("#zas-leg-" + x.id)); if (!g) return;
        const h = e.target.closest("[data-zas-h]"), sc = e.target.closest("[data-zas-scale]"), st = e.target.closest("[data-zas-stat]");
        if (h) { state.h[g.id] = h.dataset.zasH; save(); document.getElementById("zas-leg-" + g.id).dataset.layer = ""; render(); }
        if (sc) { state.scale = sc.dataset.zasScale; save(); document.getElementById("zas-leg-" + g.id).dataset.layer = ""; render(); }
        if (st) window.StatsMap?.open(st.dataset.zasStat);
        if (e.target.closest("[data-zas-iso]")) { state.iso = !state.iso; save(); document.getElementById("zas-leg-" + g.id).dataset.layer = ""; setVisible(state.on); render(); }
      });
    }
    for (const g of GROUPS) {
      const cb = document.getElementById("zas-" + g.id); if (!cb) continue;
      cb.checked = state.on === g.id;
      cb.onchange = () => {
        const box = document.getElementById("zas-leg-" + g.id);
        if (cb.checked) {
          for (const o of GROUPS) if (o !== g) { const x = document.getElementById("zas-" + o.id); if (x?.checked) { x.checked = false; document.getElementById("zas-leg-" + o.id).hidden = true; x.dispatchEvent(new Event("change", { bubbles: true })); } }
          state.on = g.id; box.hidden = false; box.dataset.layer = ""; render();
        } else { if (state.on === g.id) { state.on = null; setVisible(null); } box.hidden = true; }
        save();
      };
      if (cb.checked) document.getElementById("zas-leg-" + g.id).hidden = false;
    }
  }
  mountPanels();
  const start = () => { if (state.on) render(); document.getElementById("resourceLayers")?.dispatchEvent(new Event("change", { bubbles: true })); };
  if (map.isStyleLoaded()) start(); else map.once("load", start);
  map.on("styledata", () => { if (state.on && !map.getLayer("zas-" + state.on + "-r")) schedule(); });

  /* ---------- place card ---------- */
  let crev = 0;
  async function fill(place, box, airBox) {
    const id = ++crev;
    box.innerHTML = `<p class="muted small">Wczytuję dane o wietrze i słońcu…</p>`; if (airBox) airBox.innerHTML = `<p class="muted small">Wczytuję dane o powietrzu…</p>`;
    let m, v; try { m = await meta(); v = await values(+place.lon, +place.lat); } catch (e) { v = null; }
    if (id !== crev || !box.isConnected) return;
    if (!v) { box.innerHTML = `<p class="muted small">Brak danych dla tego miejsca (dane obejmują Polskę).</p>`; if (airBox) airBox.innerHTML = ""; return; }
    const L = Object.fromEntries(m.layers.map(x => [x.id, x]));
    const hs = [["10 m", "w10"], ["50 m", "w50"], ["100 m", "w100"], ["200 m", "w200"]].filter(([, k]) => v[k] != null);
    const top = Math.max(10, ...hs.map(([, k]) => v[k]));
    const badge = (k, more) => v[k] != null ? `<span class="zas-badge">${more} niż na ${share(L[k], v[k])}% powierzchni Polski</span>` : "";
    const wind = hs.length ? `<div class="zas-block"><div class="zas-head"><span class="zas-ic" style="--c:#2c72b0">${svg("wind")}</span><div><b>Wiatr według wysokości</b><small>średnia roczna prędkość</small></div><button type="button" class="zas-map" data-zas-show="wind">${svg("map-trifold")}Mapa</button></div>
      <div class="zas-prof">${hs.map(([h, k]) => `<div class="zas-bar${k === "w100" ? " hub" : ""}"><span>${h}</span><i><s style="width:${Math.round(v[k] / top * 100)}%"></s></i><b>${nf(v[k])} m/s</b></div>`).join("")}</div>
      ${badge("w100", "Na 100 m wieje mocniej")}${v.p100 != null ? `<div class="zas-chips"><span><b>${ni(v.p100)} W/m²</b> gęstość mocy na 100 m</span>${v.p200 != null ? `<span><b>${ni(v.p200)} W/m²</b> na 200 m</span>` : ""}</div>` : ""}</div>` : "";
    const sun = v.pvout != null ? `<div class="zas-block"><div class="zas-head"><span class="zas-ic" style="--c:#ec8261">${svg("solar-panel")}</span><div><b>Słońce i fotowoltaika</b><small>średnio w roku</small></div><button type="button" class="zas-map" data-zas-show="pvout">${svg("map-trifold")}Mapa</button></div>
      <p class="zas-big"><b>${ni(v.pvout)}</b> kWh z 1 kWp rocznie</p>${badge("pvout", "Więcej")}
      <div class="zas-chips"><span><b>ok. ${nf(v.pvout * 10 / 1000)} MWh</b> rocznie z instalacji 10 kWp</span><span><b>ok. ${ni(v.pvout)} MWh</b> rocznie z farmy 1 MW</span>${v.opta != null ? `<span><b>${Math.round(v.opta)}°</b> optymalne nachylenie paneli</span>` : ""}${v.ghi != null ? `<span><b>${ni(v.ghi)} kWh/m²</b> nasłonecznienie</span>` : ""}${v.temp != null ? `<span><b>${nf(v.temp)} °C</b> średnia temperatura</span>` : ""}</div></div>` : "";
    box.innerHTML = wind + sun + `<p class="source-note muted">Źródła: ${esc(m.zrodla.gwa)}; ${esc(m.zrodla.gsa)}. Wartości modelowe, średnie wieloletnie. Nie zastępują pomiarów wietrzności ani symulacji uzysku konkretnej instalacji.</p>`;
    if (airBox) { airBox.innerHTML = airHtml(m, L, v); window.GiosNear?.(place, airBox); }
  }
  function airStatus(Lx, val) {
    const N = Lx.norms || [], cur = N.find(([, t]) => /obecna norma|^poziom docelowy$/.test(t)), eu = N.find(([, t]) => /2030/.test(t)), who = N.find(([, t]) => /WHO/.test(t));
    if (cur && val > cur[0]) return ["bad", "przekroczenie normy"];
    if (eu && val > eu[0]) return ["warn", "powyżej normy od 2030 r."];
    if (who && val > who[0]) return ["mid", "w normie, powyżej zalecenia WHO"];
    return ["ok", "w normie"];
  }
  function airHtml(m, L, v) {
    const rows = ["pm25", "pm10", "pm10_36", "bap", "no2", "o3_dni", "arsen"].filter(k => L[k] && v[k] != null);
    if (!rows.length) return `<p class="muted small">Brak danych GIOŚ dla tego miejsca.</p>`;
    const worst = rows.map(k => airStatus(L[k], v[k])[0]);
    const head = worst.includes("bad") ? ["bad", "Przekroczona norma co najmniej jednego zanieczyszczenia"] : worst.includes("warn") ? ["warn", "W normie, ale nie spełni norm UE od 2030 r."] : ["ok", "Wszystkie normy dotrzymane"];
    return `<div class="zas-block"><div class="zas-head"><span class="zas-ic" style="--c:${head[0] === "bad" ? "#e5513d" : head[0] === "warn" ? "#f59e3e" : "#34a383"}">${svg("cloud")}</span><div><b>${esc(head[1])}</b><small>modelowane stężenia, ocena GIOŚ 2025</small></div><button type="button" class="zas-map" data-zas-show="air">${svg("map-trifold")}Mapa</button></div>
      <div class="aq-list">${rows.map(k => { const Lx = L[k], val = v[k], [cls, txt] = airStatus(Lx, val), maxN = Math.max(...Lx.norms.map(n => n[0])) * 1.3, scale = Math.max(maxN, val * 1.05);
        return `<div class="aq-row"><div class="aq-top"><span>${esc(Lx.name)}</span><b>${fmtV(Lx, val)}</b></div><div class="aq-bar"><s class="aq-${cls}" style="width:${Math.min(100, val / scale * 100).toFixed(1)}%"></s>${Lx.norms.map(([n, t]) => `<em style="left:${(n / scale * 100).toFixed(1)}%" title="${esc(t)}"></em>`).join("")}</div><small><b class="aq-${cls}-t">${esc(txt)}</b> · ${Lx.norms.map(([n, t]) => `${nf(n, n % 1 ? 1 : 0)} ${esc(t)}`).join(", ")}</small></div>`; }).join("")}</div>
      ${v.pm25 != null ? `<span class="zas-badge">PM2,5: wyżej niż na ${share(L.pm25, v.pm25)}% powierzchni Polski</span>` : ""}</div>
      <p class="source-note muted">Źródło: ${esc(m.zrodla.gios)}. Normy: obecne poziomy dopuszczalne i docelowe, dyrektywa UE 2024/2881 (od 2030 r.), zalecenia WHO 2021. Model pokazuje tło, nie zastępuje pomiarów przy konkretnej ulicy.</p>`;
  }
  document.getElementById("card")?.addEventListener("click", e => {
    const b = e.target.closest("[data-zas-show]"); if (!b) return;
    const cb = document.getElementById("zas-" + b.dataset.zasShow); if (!cb) return;
    if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }
    const pl = app.currentPlace?.(); if (pl) map.easeTo({ center: [+pl.lon, +pl.lat], zoom: Math.min(map.getZoom(), 11), duration: 700 });
    app.toast("Włączono warstwę: " + (GROUPS.find(g => g.id === b.dataset.zasShow)?.label || ""));
  });
  const P = window.PLOTS_PLANNING;
  if (P && P.loadInto) {
    const orig = P.loadInto;
    P.loadInto = function (place, el) {
      const r = orig.apply(this, arguments);
      try {
        const sec = el && el.closest("details");
        if (sec && place && Number.isFinite(+place.lon)) {
          let box = document.getElementById("placeRes"), airBox = document.getElementById("placeAir");
          if (!box) { (document.getElementById("placeNear")?.closest("details") || document.getElementById("placeTerrain")?.closest("details") || sec).insertAdjacentHTML("afterend", `<details class="place-section zas-section" open><summary>${svg("wind")}Wiatr i słońce</summary><div id="placeRes"></div></details><details class="place-section zas-section" open><summary>${svg("cloud")}Jakość powietrza</summary><div id="placeAir"></div></details>`); box = document.getElementById("placeRes"); airBox = document.getElementById("placeAir"); }
          fill(place, box, airBox);
        }
      } catch (e) { console.warn(e); }
      return r;
    };
  }
})();
