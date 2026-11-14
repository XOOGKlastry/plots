/* Komunikacja publiczna: mapa czasu dojazdu z wybranego punktu o wybranej godzinie.
   Rozkłady (GTFS: autobusy, tramwaje, trolejbusy, pociągi) są wcześniej zamienione na zwarte pliki dla regionu i typu dnia.
   Liczenie odbywa się w przeglądarce algorytmem skanowania połączeń (CSA) z przesiadkami i dojściem pieszo;
   wynik to siatka pól 200 m z najwcześniejszym czasem dotarcia. Osobny moduł „Komunikacja publiczna”; korzysta z powłoki modułu Odległości (panel, punkt analizy, stuknięcia w mapę). */
(function () {
  "use strict";
  const app = window.PLOTS, map = app.map, esc = app.esc;
  const BASE = (window.PLOTS_CONFIG && window.PLOTS_CONFIG.transitUrl) || "data/transit/";
  const WALK = 1.3, DETOUR = 1.25, TRANSFER_M = 400, CHANGE_S = 60, EGRESS_S = 1200, CELL = 200, INF = 0x7fffffff;
  const POI_BASE = "https://xoogklastry.github.io/jakdaleko/";
  const R = 6378137, RAD = Math.PI / 180;
  const PALETTE = ["#1a9641", "#73c264", "#c4e687", "#fee08b", "#fdae61", "#f46d43", "#d53e4f", "#9e0142", "#5e4fa2"];
  const DAY_KEYS = ["rob", "sob", "nie"], DAY_LABEL = { rob: "Roboczy", sob: "Sobota", nie: "Niedziela" };
  const POI = [["szkola", "szkół podstawowych"], ["szkola_srednia", "szkół średnich"], ["uczelnia", "uczelni"], ["poz", "przychodni"], ["szpital", "szpitali"], ["apteka", "aptek"], ["biblioteka", "bibliotek"], ["kino", "kin"], ["galeria", "centrów handlowych"]];
  const fmt = n => Math.round(n).toLocaleString("pl-PL");
  const hhmm = s => { const m = Math.round(s / 60); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); };
  const state = { active: false, day: DAY_KEYS[[2, 0, 0, 0, 0, 0, 1][new Date().getDay()]], time: 0, limit: 3600, origin: null, region: null, fitted: null };
  { const d = new Date(), m = d.getHours() * 60 + Math.ceil(d.getMinutes() / 5) * 5; state.time = (m >= 240 && m <= 1380 ? m : 450) * 60; }

  /* ---------- data ---------- */
  async function gunzip(response) {
    if (!("DecompressionStream" in window)) throw Error("Ta przeglądarka nie obsługuje rozpakowywania danych");
    return new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  }
  let indexPromise = null;
  const loadIndex = () => indexPromise || (indexPromise = fetch(BASE + "index.json", { cache: "no-cache" }).then(r => { if (!r.ok) throw Error("HTTP " + r.status); return r.json(); }).catch(e => { indexPromise = null; throw e; }));
  const nets = new Map();
  function loadNet(region, day) {
    const key = region.id + "-" + day;
    if (!nets.has(key)) nets.set(key, fetch(BASE + region.days[day].file + "?v=" + encodeURIComponent(region.days[day].date), { cache: "force-cache" })
      .then(r => { if (!r.ok) throw Error("HTTP " + r.status); return gunzip(r); }).then(parseNet).catch(e => { nets.delete(key); throw e; }));
    return nets.get(key);
  }
  function parseNet(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x31525450) throw Error("Nieznany format rozkładu");
    const hl = dv.getUint32(4, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
    let o = 8 + hl; const take = (T, n) => { const a = new T(buf, o, n); o += n * T.BYTES_PER_ELEMENT; return a; };
    const lon = take(Int32Array, h.nStops), lat = take(Int32Array, h.nStops), t0 = take(Int32Array, h.nTrips), start = take(Uint32Array, h.nTrips + 1);
    const tripRoute = take(Uint16Array, h.nTrips), sidx = take(Uint16Array, h.nTimes), run = take(Uint16Array, h.nTimes), dwell = take(Uint16Array, h.nTimes), flags = take(Uint8Array, h.nTimes);
    // Planar coordinates: Web Mercator scaled by cos(lat0), so distances near the region are close to metres and the grid maps exactly onto the map.
    let sum = 0; for (let i = 0; i < h.nStops; i++) sum += lat[i]; const lat0 = sum / h.nStops / 1e6, k = Math.cos(lat0 * RAD);
    const X = new Float64Array(h.nStops), Y = new Float64Array(h.nStops);
    for (let i = 0; i < h.nStops; i++) { X[i] = R * lon[i] / 1e6 * RAD * k; Y[i] = R * Math.log(Math.tan(Math.PI / 4 + lat[i] / 2e6 * RAD)) * k; }
    // Connections (stop i -> stop i+1 of every trip), sorted by departure.
    const nC = h.nTimes - h.nTrips, dep = new Int32Array(nC), arr = new Int32Array(nC), from = new Uint16Array(nC), to = new Uint16Array(nC), trip = new Uint32Array(nC), fl = new Uint8Array(nC);
    const stopRoutes = Array.from({ length: h.nStops }, () => null);
    let c = 0;
    for (let t = 0; t < h.nTrips; t++) {
      let time = t0[t] - run[start[t]], prevDep = 0;
      for (let i = start[t]; i < start[t + 1]; i++) {
        const a = time + run[i], d = a + dwell[i];
        if (i > start[t]) { dep[c] = prevDep; arr[c] = a; from[c] = sidx[i - 1]; to[c] = sidx[i]; trip[c] = t; fl[c] = (flags[i - 1] & 1) | (flags[i] & 2); c++; }
        const s = sidx[i]; (stopRoutes[s] || (stopRoutes[s] = new Set())).add(tripRoute[t]);
        prevDep = d; time = d;
      }
    }
    const order = new Uint32Array(nC); for (let i = 0; i < nC; i++) order[i] = i;
    order.sort((a, b) => dep[a] - dep[b]);
    const pick = (src, T) => { const out = new T(nC); for (let i = 0; i < nC; i++) out[i] = src[order[i]]; return out; };
    const net = { h, k, lat0, X, Y, nC, dep: pick(dep, Int32Array), arr: pick(arr, Int32Array), from: pick(from, Uint16Array), to: pick(to, Uint16Array), trip: pick(trip, Uint32Array), fl: pick(fl, Uint8Array), stopRoutes };
    // Stops hashed into 400 m boxes: walking transfers and "stops near a point".
    const hash = new Map(), hk = i => Math.floor(X[i] / TRANSFER_M) * 100003 + Math.floor(Y[i] / TRANSFER_M);
    for (let i = 0; i < h.nStops; i++) { const key = hk(i); (hash.get(key) || hash.set(key, []).get(key)).push(i); }
    net.hash = hash;
    const nbStart = new Uint32Array(h.nStops + 1), nb = [], nbSec = [];
    for (let i = 0; i < h.nStops; i++) {
      const cx = Math.floor(X[i] / TRANSFER_M), cy = Math.floor(Y[i] / TRANSFER_M);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of hash.get((cx + dx) * 100003 + cy + dy) || []) {
        if (j === i) continue; const d = Math.hypot(X[j] - X[i], Y[j] - Y[i]);
        if (d <= TRANSFER_M) { nb.push(j); nbSec.push(Math.round(d * DETOUR / WALK)); }
      }
      nbStart[i + 1] = nb.length;
    }
    net.nbStart = nbStart; net.nb = Uint16Array.from(nb); net.nbSec = Uint16Array.from(nbSec);
    return net;
  }
  const project = (net, lon, lat) => [R * lon * RAD * net.k, R * Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2)) * net.k];
  const unproject = (net, x, y) => [x / net.k / R / RAD, (2 * Math.atan(Math.exp(y / net.k / R)) - Math.PI / 2) / RAD];

  /* ---------- connection scan ---------- */
  /* Earliest arrival at every stop when leaving the origin at t0 (seconds from midnight), no later than t0 + limit. */
  function scan(net, ox, oy, t0, limit) {
    const n = net.h.nStops, tEnd = t0 + limit, arrive = new Int32Array(n).fill(INF), ready = new Int32Array(n).fill(INF), onTrip = new Uint8Array(net.h.nTrips);
    const { X, Y, dep, arr, from, to, trip, fl, nbStart, nb, nbSec } = net;
    for (let i = 0; i < n; i++) { const t = t0 + Math.hypot(X[i] - ox, Y[i] - oy) * DETOUR / WALK; if (t <= tEnd) arrive[i] = ready[i] = Math.round(t); }
    let lo = 0, hi = net.nC; while (lo < hi) { const m = (lo + hi) >> 1; if (dep[m] < t0) lo = m + 1; else hi = m; }
    for (let c = lo; c < net.nC; c++) {
      const d = dep[c]; if (d > tEnd) break;
      const tr = trip[c];
      if (!onTrip[tr]) { if (ready[from[c]] > d || (fl[c] & 1)) continue; onTrip[tr] = 1; }
      const a = arr[c], s = to[c];
      if (a > tEnd || (fl[c] & 2) || a >= arrive[s]) continue;
      arrive[s] = a; if (a + CHANGE_S < ready[s]) ready[s] = a + CHANGE_S;
      for (let j = nbStart[s]; j < nbStart[s + 1]; j++) { const w = a + nbSec[j], q = nb[j]; if (w < arrive[q]) arrive[q] = w; if (w < ready[q]) ready[q] = w; }
    }
    return arrive;
  }
  /* Grid of 200 m cells with the travel time in seconds (65535 = out of reach). */
  function raster(net, ox, oy, t0, limit, arrive) {
    const walkR = s => s * WALK / DETOUR, stops = [];
    let x0 = ox - walkR(limit), x1 = ox + walkR(limit), y0 = oy - walkR(limit), y1 = oy + walkR(limit);
    for (let i = 0; i < arrive.length; i++) {
      if (arrive[i] === INF) continue; const left = Math.min(EGRESS_S, t0 + limit - arrive[i]), r = walkR(left); stops.push(i);
      if (net.X[i] - r < x0) x0 = net.X[i] - r; if (net.X[i] + r > x1) x1 = net.X[i] + r; if (net.Y[i] - r < y0) y0 = net.Y[i] - r; if (net.Y[i] + r > y1) y1 = net.Y[i] + r;
    }
    const gx = Math.floor(x0 / CELL), gy = Math.floor(y0 / CELL), W = Math.floor(x1 / CELL) - gx + 1, H = Math.floor(y1 / CELL) - gy + 1, T = new Uint16Array(W * H).fill(65535);
    const stamp = (px, py, base, budget) => {
      const r = walkR(budget), cx0 = Math.max(0, Math.floor((px - r) / CELL) - gx), cx1 = Math.min(W - 1, Math.floor((px + r) / CELL) - gx), cy0 = Math.max(0, Math.floor((py - r) / CELL) - gy), cy1 = Math.min(H - 1, Math.floor((py + r) / CELL) - gy);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const t = base + Math.hypot((cx + gx + .5) * CELL - px, (cy + gy + .5) * CELL - py) * DETOUR / WALK;
        if (t <= base + budget && t < T[cy * W + cx]) T[cy * W + cx] = t;
      }
    };
    stamp(ox, oy, 0, limit);
    for (const i of stops) stamp(net.X[i], net.Y[i], arrive[i] - t0, Math.min(EGRESS_S, t0 + limit - arrive[i]));
    return { gx, gy, W, H, T };
  }
  const bandOf = limit => limit <= 1800 ? 300 : limit <= 3600 ? 600 : 900;
  function bandColors(limit) { const n = Math.ceil(limit / bandOf(limit)); return Array.from({ length: n }, (_, i) => PALETTE[Math.round(i * (PALETTE.length - 1) / Math.max(1, n - 1))]); }

  /* ---------- map layer ---------- */
  const SRC = "transit-reach";
  let lastImage = null;
  function draw(net, g, limit) {
    const band = bandOf(limit), cols = bandColors(limit).map(c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
    const cv = document.createElement("canvas"); cv.width = g.W; cv.height = g.H;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(g.W, g.H), d = img.data;
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
      const t = g.T[y * g.W + x]; if (t === 65535) continue;
      const c = cols[Math.min(cols.length - 1, Math.floor(t / band))], o = ((g.H - 1 - y) * g.W + x) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const [w, s] = unproject(net, g.gx * CELL, g.gy * CELL), [e, n] = unproject(net, (g.gx + g.W) * CELL, (g.gy + g.H) * CELL);
    lastImage = { url: cv.toDataURL(), coordinates: [[w, n], [e, n], [e, s], [w, s]] };
    show();
    return [[w, s], [e, n]];
  }
  function show() {
    if (!lastImage || !state.active) return;
    const src = map.getSource(SRC);
    if (src) src.updateImage(lastImage);
    else {
      map.addSource(SRC, { type: "image", ...lastImage });
      map.addLayer({ id: SRC, type: "raster", source: SRC, paint: { "raster-opacity": .58, "raster-resampling": "nearest", "raster-fade-duration": 0 } }, map.getStyle().layers.find(l => l.type === "symbol")?.id);
    }
    if (map.getLayer(SRC)) map.setLayoutProperty(SRC, "visibility", "visible");
  }
  function hide() { if (map.getLayer(SRC)) map.setLayoutProperty(SRC, "visibility", "none"); }
  map.on("styledata", () => { if (state.active && lastImage && !map.getSource(SRC)) setTimeout(() => { if (!map.getSource(SRC)) show(); }, 150); });

  /* ---------- what is inside the reach ---------- */
  const popCache = new Map();
  function loadPop(region) {
    if (!popCache.has(region.id)) popCache.set(region.id, fetch(BASE + region.id + "-lud.bin.gz", { cache: "force-cache" }).then(r => { if (!r.ok) throw Error(r.status); return gunzip(r); }).then(buf => {
      const n = new DataView(buf).getUint32(4, true); return { n, lon: new Int32Array(buf, 8, n), lat: new Int32Array(buf, 8 + 4 * n, n), pop: new Uint16Array(buf, 8 + 8 * n, n) };
    }).catch(() => null));
    return popCache.get(region.id);
  }
  const timeAt = (net, g, lon, lat) => { const [x, y] = project(net, lon, lat), cx = Math.floor(x / CELL) - g.gx, cy = Math.floor(y / CELL) - g.gy; return cx < 0 || cy < 0 || cx >= g.W || cy >= g.H ? 65535 : g.T[cy * g.W + cx]; };
  function popByBand(net, g, pop, limit) {
    const band = bandOf(limit), out = new Float64Array(Math.ceil(limit / band));
    if (!pop) return null;
    if (!pop.xy || pop.net !== net) { pop.net = net; pop.xy = new Float64Array(pop.n * 2); for (let i = 0; i < pop.n; i++) { const p = project(net, pop.lon[i] / 1e6, pop.lat[i] / 1e6); pop.xy[2 * i] = p[0]; pop.xy[2 * i + 1] = p[1]; } }
    for (let i = 0; i < pop.n; i++) {
      const cx = Math.floor(pop.xy[2 * i] / CELL) - g.gx, cy = Math.floor(pop.xy[2 * i + 1] / CELL) - g.gy; if (cx < 0 || cy < 0 || cx >= g.W || cy >= g.H) continue;
      const t = g.T[cy * g.W + cx]; if (t !== 65535) out[Math.min(out.length - 1, Math.floor(t / band))] += pop.pop[i];
    }
    return out;
  }
  let sur = null; const poiCache = new Map();
  async function poiPoints(id, box) {
    sur = sur || await fetch("data/surroundings.json").then(r => r.json());
    const net = sur.networks.find(n => n.id === id), model = window.SurroundingsModel; if (!net || !model) return [];
    const bin = path => { if (!poiCache.has(path)) poiCache.set(path, fetch(POI_BASE + path).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)); return poiCache.get(path); };
    if (!net.ptiles) { const b = await bin(`poi/${id}/all.bin`); return b ? model.parsePoi(b) : []; }
    const out = [];
    for (let x = Math.floor((box[0][0] - sur.origin[0]) / sur.tile); x <= Math.floor((box[1][0] - sur.origin[0]) / sur.tile); x++)
      for (let y = Math.floor((box[0][1] - sur.origin[1]) / sur.tile); y <= Math.floor((box[1][1] - sur.origin[1]) / sur.tile); y++) {
        const e = net.ptiles[x + "_" + y]; if (!e) continue; const b = await bin(`poi/${id}/t/${x}_${y}.bin`); if (b) out.push(...model.parsePoi(b, e[1]));
      }
    return out;
  }

  /* ---------- panel ---------- */
  let box = null, seq = 0, current = null;
  function build() {
    if (box) return box;
    const body = document.querySelector("#distancePanel .distance-body"); if (!body) return null;
    box = document.createElement("div"); box.id = "transitBox"; box.hidden = true;
    box.innerHTML = `<div class="stats-seg tr-days" role="group" aria-label="Typ dnia">${DAY_KEYS.map(k => `<button type="button" data-tr-day="${k}" aria-pressed="${k === state.day}">${DAY_LABEL[k]}</button>`).join("")}</div>
      <div class="walking-slider tr-time"><label for="trTime"><span>Wyjazd o godzinie</span><output id="trTimeValue" for="trTime">${hhmm(state.time)}</output></label><input id="trTime" type="range" min="240" max="1410" step="5" value="${state.time / 60}" aria-label="Godzina wyjazdu"><div class="slider-ticks"><span>4:00</span><span>12:00</span><span>23:30</span></div></div>
      <div class="stats-seg tr-limits" role="group" aria-label="Limit czasu">${[30, 45, 60, 90].map(m => `<button type="button" data-tr-limit="${m}" aria-pressed="${m * 60 === state.limit}">${m} min</button>`).join("")}</div>
      <p id="trStatus" class="source-note" role="status">Wskaż punkt startu na mapie.</p>
      <div id="trResult"></div>
      <details class="distance-source"><summary>Źródło i sposób liczenia</summary><div id="trSources"></div><p>Najwcześniejszy przyjazd według rozkładu jazdy na typowy dzień, z przesiadkami. Dojście pieszo 4,7 km/h w linii prostej z poprawką 25% na krętość, przesiadka pieszo do 400 m, od przystanku do celu do 20 minut. Siatka pól 200 m. To rozkład, nie pozycje na żywo: opóźnień nie ma. Liczone w Twojej przeglądarce.</p></details>`;
    body.append(box);
    box.addEventListener("click", e => {
      const d = e.target.closest("[data-tr-day]"), l = e.target.closest("[data-tr-limit]"), h = e.target.closest("[data-tr-hour]");
      if (d) { state.day = d.dataset.trDay; box.querySelectorAll("[data-tr-day]").forEach(b => b.setAttribute("aria-pressed", String(b === d))); run(); }
      if (l) { state.limit = +l.dataset.trLimit * 60; state.fitted = null; box.querySelectorAll("[data-tr-limit]").forEach(b => b.setAttribute("aria-pressed", String(b === l))); run(); }
      if (h) { setTime(+h.dataset.trHour * 3600); run(); }
    });
    box.querySelector("#trTime").addEventListener("input", e => { setTime(+e.target.value * 60); run(true); });
    return box;
  }
  function setTime(s) { state.time = s; const r = box.querySelector("#trTime"); r.value = s / 60; box.querySelector("#trTimeValue").textContent = hhmm(s); }
  const status = t => { const el = document.getElementById("trStatus"); if (el) { el.textContent = t; el.hidden = !t; } };
  async function run(quick) {
    if (!state.active || !build()) return;
    const my = ++seq, origin = window.DistanceModule?.getOrigin();
    state.origin = origin;
    if (!origin) { status("Wskaż punkt startu na mapie albo wyszukaj adres."); document.getElementById("trResult").innerHTML = ""; hide(); return; }
    let index; try { index = await loadIndex(); } catch { status("Nie udało się wczytać rozkładów. Spróbuj ponownie."); return; }
    const region = index.regions.find(r => origin.lon >= r.bbox[0] && origin.lon <= r.bbox[2] && origin.lat >= r.bbox[1] && origin.lat <= r.bbox[3]);
    if (!region) { status(`Rozkłady są na razie dostępne dla: ${index.regions.map(r => r.name).join(", ")}. Wskaż punkt w tym regionie.`); document.getElementById("trResult").innerHTML = ""; hide(); return; }
    document.getElementById("trSources").innerHTML = `<p>Rozkłady jazdy: ${region.sources.map(s => esc(s.name)).join("; ")}. Opracowanie plików GTFS: mkuran.pl. Stan na ${esc(index.built.slice(0, 10))}, dzień ${esc(region.days[state.day].date.replace(/(\d{4})(\d\d)(\d\d)/, "$3.$2.$1"))}. Mieszkańcy: GUS, Narodowy Spis Powszechny 2021.</p>`;
    if (!nets.has(region.id + "-" + state.day)) status("Wczytuję rozkłady…");
    let net; try { net = await loadNet(region, state.day); } catch (e) { if (my === seq) status("Nie udało się wczytać rozkładu: " + e.message); return; }
    if (my !== seq) return;
    const t = performance.now(), [ox, oy] = project(net, origin.lon, origin.lat);
    const arrive = scan(net, ox, oy, state.time, state.limit), g = raster(net, ox, oy, state.time, state.limit, arrive);
    const bounds = draw(net, g, state.limit), ms = Math.round(performance.now() - t);
    current = { net, g, region, origin, bounds };
    status("");
    const key = origin.lon + "," + origin.lat + "," + state.limit;
    if (state.fitted !== key) { state.fitted = key; const mobile = app.isMobile?.(); map.fitBounds(bounds, { padding: mobile ? { top: 90, left: 20, right: 20, bottom: Math.min(innerHeight * .62, (document.getElementById("distancePanel")?.offsetHeight || 300)) + 20 } : { top: 60, bottom: 60, right: 60, left: 400 }, duration: window.Motion?.on() ? 600 : 0, maxZoom: 13 }); }
    const pop = await loadPop(region); if (my !== seq) return;
    renderResult(net, g, region, origin, arrive, pop, ms);
    if (!quick) { countPoi(my, net, g, bounds); dayChart(my, net, ox, oy, pop); }
  }
  function renderResult(net, g, region, origin, arrive, pop, ms) {
    const band = bandOf(state.limit), cols = bandColors(state.limit), area = new Float64Array(cols.length), people = popByBand(net, g, pop, state.limit);
    for (let i = 0; i < g.T.length; i++) if (g.T[i] !== 65535) area[Math.min(cols.length - 1, Math.floor(g.T[i] / band))] += CELL * CELL / 1e6;
    let a = 0, p = 0; const rows = cols.map((c, i) => { a += area[i]; if (people) p += people[i]; const m = Math.min(state.limit, (i + 1) * band) / 60; return `<tr><td><i style="background:${c}"></i>do ${m} min</td><td>${a < 10 ? a.toFixed(1).replace(".", ",") : fmt(a)} km²</td>${people ? `<td>${fmt(p)}</td>` : ""}</tr>`; }).join("");
    // Nearest stops with their lines.
    const [ox, oy] = project(net, origin.lon, origin.lat), near = [];
    for (let i = 0; i < net.h.nStops; i++) { const d = Math.hypot(net.X[i] - ox, net.Y[i] - oy); if (d <= 800 && net.stopRoutes[i]) near.push([d, i]); }
    near.sort((x, y) => x[0] - y[0]);
    const seen = new Set(), stops = [];
    for (const [d, i] of near) { const nm = net.h.names[i]; if (seen.has(nm)) { const s = stops.find(x => x.nm === nm); net.stopRoutes[i].forEach(r => s.routes.add(r)); continue; } seen.add(nm); stops.push({ nm, d, routes: new Set(net.stopRoutes[i]) }); if (stops.length >= 3) break; }
    const kind = t => t === 0 ? "tram" : t === 2 ? "train" : t === 11 ? "bus" : "bus";
    const lineChips = set => { const all = [...set].map(r => net.h.routes[r]).sort((x, y) => x[1] - y[1] || String(x[0]).localeCompare(String(y[0]), "pl", { numeric: true })); return all.slice(0, 10).map(r => `<span class="tr-line t${r[1]}">${esc(r[0])}</span>`).join("") + (all.length > 10 ? `<span class="tr-line more">+${all.length - 10}</span>` : ""); };
    const stopsHTML = stops.length ? `<h4>Najbliższe przystanki</h4><ul class="tr-stops">${stops.map(s => `<li>${window.Icons.svg(kind(Math.min(...[...s.routes].map(r => net.h.routes[r][1]))))}<div><b>${esc(s.nm)}</b><small>${Math.max(1, Math.round(s.d * DETOUR / WALK / 60))} min pieszo · ${fmt(s.d * DETOUR)} m</small><div class="tr-lines">${lineChips(s.routes)}</div></div></li>`).join("")}</ul>` : `<p class="source-note">W promieniu 800 m nie ma przystanku z kursami tego dnia.</p>`;
    document.getElementById("trResult").innerHTML = `<p class="tr-head">Wyjazd o <b>${hhmm(state.time)}</b>, ${DAY_LABEL[state.day].toLowerCase()}${people ? `: w ${state.limit / 60} min dojedziesz do <b>${fmt(p)}</b> mieszkańców` : ""}.</p>
      <table class="tr-table"><thead><tr><th>Czas dojazdu</th><th>Obszar</th>${people ? "<th>Mieszkańcy</th>" : ""}</tr></thead><tbody>${rows}</tbody></table>
      <div id="trPoi" class="tr-poi"></div><div id="trDay"></div>${stopsHTML}<small class="tr-ms">obliczono w ${ms} ms</small>`;
  }
  async function countPoi(my, net, g, bounds) {
    const out = [];
    for (const [id, label] of POI) {
      let pts = []; try { pts = await poiPoints(id, bounds); } catch { /* optional */ }
      if (my !== seq) return;
      const n = pts.filter(p => timeAt(net, g, p.lon, p.lat) !== 65535).length;
      if (n) out.push(`<span class="tr-chip">${window.PoiIcons?.has(id) ? `<img src="${window.PoiIcons.url(id)}" alt="">` : ""}<b>${fmt(n)}</b> ${label}</span>`);
    }
    const el = document.getElementById("trPoi"); if (el && my === seq) el.innerHTML = out.length ? `<h4>W zasięgu ${state.limit / 60} min</h4>${out.join("")}` : "";
  }
  /* Reach through the day: residents (or area) within the limit when leaving at each full hour. */
  function dayChart(my, net, ox, oy, pop) {
    const hours = []; for (let h = 4; h <= 23; h++) hours.push(h);
    const vals = [], step = i => {
      if (my !== seq) return;
      if (i < hours.length) {
        const t0 = hours[i] * 3600, g = raster(net, ox, oy, t0, state.limit, scan(net, ox, oy, t0, state.limit));
        let v = 0; if (pop) { const b = popByBand(net, g, pop, state.limit); for (const x of b) v += x; } else for (let j = 0; j < g.T.length; j++) if (g.T[j] !== 65535) v += CELL * CELL / 1e6;
        vals.push(v); setTimeout(() => step(i + 1), 0); return;
      }
      const mx = Math.max(...vals, 1), el = document.getElementById("trDay"); if (!el) return;
      const best = hours[vals.indexOf(Math.max(...vals))], worst = hours[vals.indexOf(Math.min(...vals))];
      el.innerHTML = `<h4>Zasięg w ciągu dnia (${state.limit / 60} min)</h4><div class="tr-bars">${hours.map((h, j) => `<button type="button" data-tr-hour="${h}" class="${Math.floor(state.time / 3600) === h ? "on" : ""}" aria-label="${h}:00, ${fmt(vals[j])} ${pop ? "mieszkańców" : "km²"}"><i style="height:${Math.max(2, vals[j] / mx * 100).toFixed(1)}%"></i><small>${h % 4 === 0 ? h : ""}</small></button>`).join("")}</div>
        <p class="source-note">${pop ? "Mieszkańcy" : "Obszar"} w zasięgu przy wyjeździe o pełnej godzinie. Najlepiej o ${best}:00 (${fmt(Math.max(...vals))}), najsłabiej o ${worst}:00 (${fmt(Math.min(...vals))}). Stuknij słupek, aby ustawić godzinę.</p>`;
    };
    step(0);
  }

  /* ---------- wiring ---------- */
  function setActive(on) {
    state.active = !!on;
    if (build()) box.hidden = !on;
    // The service markers of the other distance modes would only clutter the reach map.
    for (const id of ["near-poi-points", "distance-building-points"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "none" : "visible");
    if (on) run(); else { seq++; hide(); }
  }
  document.addEventListener("plots:origin", () => { if (state.active) { state.fitted = null; run(); } });
  document.addEventListener("plots:mode", e => { if (e.detail !== "distance") { if (state.active) { state.active = false; seq++; hide(); } } });
  // Away from the parcel zoom a tap sets the starting point directly, so the whole reach can stay in view.
  map.on("click", e => { if (state.active && document.body.classList.contains("distance-mode") && map.getZoom() < 13) window.DistanceModule?.setOrigin({ lon: e.lngLat.lng, lat: e.lngLat.lat }); });
  window.Transit = { setActive, isActive: () => state.active, _test: { parseNet, scan, raster, project } };
})();
