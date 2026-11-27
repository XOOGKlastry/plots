/* Struktura gminy: pokrycie terenu BDOT10k jednej gminy w 3D, karta z tortem i przełącznikami klas, drogi rysowane od najważniejszych.
   Dane: /api/struktura/<teryt> (server/public_api.py), liczone raz na gminę i trzymane na dysku serwera. */
(function () {
  "use strict";
  const app = window.PLOTS; if (!app) return;
  const map = app.map, esc = app.esc, ns = "http://www.w3.org/2000/svg";
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = [
    ["las", "Lasy", "#5b9a6e", 1], ["krz", "Roślinność krzewiasta i zadrzewienia", "#94c4a3", 1], ["traw", "Roślinność trawiasta", "#c6de9f", 1],
    ["orne", "Uprawy na gruntach", "#ead8a2", 1], ["dzial", "Ogródki działkowe", "#cdbf82", 1], ["cm", "Cmentarze", "#8fa39a", 1],
    ["zjed", "Zabudowa mieszkaniowa jednorodzinna", "#e3ad90", 1], ["zwiel", "Zabudowa mieszkaniowa wielorodzinna", "#c97c64", 1],
    ["zusl", "Zabudowa usługowo-handlowa", "#bb8db3", 1], ["zprz", "Zabudowa przemysłowa", "#9b8faa", 1], ["zpoz", "Pozostała zabudowa", "#c2bdb6", 1],
    ["niez", "Tereny niezabudowane i nieużytki", "#ddd3c1", 1], ["woda", "Wody", "#86b8e0", 1]];
  const R = [[[0, 1, 2], "Autostrady i ekspresowe", "#d9485f", 5], [[3], "Drogi główne", "#e0864a", 3.6], [[4], "Drogi zbiorcze", "#d9b44a", 2.6],
    [[5, 6], "Drogi lokalne i dojazdowe", "#6e6e73", 1.6], [[7], "Drogi wewnętrzne", "#a8a8ad", .8]];
  let data = null, on = {}, saved = [], sheet = null, roadsOn = false, flat = false, view = 0;
  const fmt = (v, d = 1) => Number(v).toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
  const H = k => C.find(c => c[0] === k)[3] * (flat ? .08 : 1);

  const css = document.createElement("style");
  css.textContent = `
.st-sheet{position:fixed;z-index:60;left:50%;bottom:0;width:min(400px,100vw);transform:translate(-50%,110%);background:rgba(255,255,255,.9);-webkit-backdrop-filter:saturate(180%) blur(22px);backdrop-filter:saturate(180%) blur(22px);border-radius:28px 28px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.14);padding:8px 16px calc(14px + env(safe-area-inset-bottom));font-family:-apple-system,"SF Pro Text",system-ui,sans-serif;color:#1c1c1e;transition:transform .6s cubic-bezier(.2,1.15,.3,1);max-height:72vh;overflow:auto;overscroll-behavior:contain}
@media(min-width:900px){.st-sheet{left:auto;right:16px;bottom:16px;border-radius:28px;transform:translateY(120%)}}
.st-sheet.in{transform:translate(-50%,0)}@media(min-width:900px){.st-sheet.in{transform:none}}
.st-grab{width:38px;height:5px;border-radius:3px;background:#c7c7cc;margin:0 auto 8px}
.st-hd{display:flex;align-items:flex-start;gap:10px}.st-hd h2{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0;line-height:1.15}
.st-sub{font-size:13px;color:#8e8e93;margin-top:2px}.st-x{margin-left:auto;width:32px;height:32px;border-radius:50%;border:0;background:#e9e9ee;color:#3c3c43;font-size:17px;cursor:pointer;flex:none}
.st-big{font-size:30px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin:8px 0 0}
.st-seg{display:flex;background:#e9e9ee;border-radius:10px;padding:2px;margin:10px 0;position:relative}
.st-seg b{flex:1;text-align:center;font-size:13px;font-weight:600;padding:7px 0;z-index:1;cursor:pointer}
.st-seg i{position:absolute;top:2px;bottom:2px;width:calc(50% - 2px);left:2px;background:#fff;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,.1);transition:left .45s cubic-bezier(.2,1.3,.3,1)}
.st-row{display:flex;align-items:center;gap:12px;padding:9px 2px;border-bottom:.5px solid #e5e5ea;font-size:15px}.st-row:last-child{border:0}
.st-dot{width:28px;height:28px;border-radius:8px;flex:none}.st-row .v{margin-left:auto;color:#8e8e93;font-size:13px;font-variant-numeric:tabular-nums;text-align:right}
.st-tg{width:51px;height:31px;border-radius:16px;background:#34c759;position:relative;transition:background .25s;cursor:pointer;flex:none;border:0;padding:0}
.st-tg:after{content:"";position:absolute;top:2px;left:22px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 3px 8px rgba(0,0,0,.15);transition:left .4s cubic-bezier(.2,1.4,.3,1)}
.st-tg.off{background:#e9e9ea}.st-tg.off:after{left:2px}
.st-sl{transition:transform .5s cubic-bezier(.2,1.4,.3,1);cursor:pointer}
.st-btns{display:flex;gap:8px;margin-top:10px}.st-btn{flex:1;border:0;border-radius:14px;padding:11px;font-size:15px;font-weight:600;cursor:pointer;background:#e9e9ee;color:#007aff}.st-btn.pri{background:#007aff;color:#fff}
.st-cap{text-align:center;font-size:13px;color:#8e8e93;min-height:18px}
.st-in{animation:stIn .7s cubic-bezier(.2,1,.3,1) both}@keyframes stIn{from{opacity:0;transform:translateY(10px);filter:blur(8px)}}
.st-dust{position:fixed;z-index:55;pointer-events:none;width:8px;height:8px;border-radius:50%;background:rgba(210,210,215,.95);animation:stDust .8s ease-out forwards}
@keyframes stDust{to{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
.st-load{text-align:center;padding:26px 0;color:#8e8e93;font-size:14px}
.st-spin{width:26px;height:26px;border:3px solid #e5e5ea;border-top-color:#007aff;border-radius:50%;margin:0 auto 10px;animation:stSp .8s linear infinite}@keyframes stSp{to{transform:rotate(360deg)}}
@media(max-width:899px){.st-sheet{max-height:48vh}.st-pie{max-height:130px}.st-big{font-size:24px;margin-top:4px}.st-hd h2{font-size:19px}.st-seg{margin:6px 0}.st-btn{padding:9px}}
body.struct-open #panel,body.struct-open .side-mods,body.struct-open #layerPanel{display:none!important}`;
  document.head.append(css);

  function layersFor() {
    const L = [{ id: "st-mask", type: "fill", source: "st-mask", paint: { "fill-color": "#f2f2f7", "fill-opacity": 0, "fill-opacity-transition": { duration: 700 } } }];
    for (const [k, , col] of C) L.push({ id: "st-" + k, type: "fill", source: "st-pt", filter: ["==", ["get", "k"], k],
      paint: { "fill-color": col, "fill-opacity": 0, "fill-translate": [0, -14],
        "fill-opacity-transition": { duration: calm ? 0 : 550 }, "fill-translate-transition": { duration: calm ? 0 : 650 } } });
    R.forEach(([rs, , col, w], i) => L.push({ id: "st-r" + i, type: "line", source: "st-dr", filter: ["in", ["get", "r"], ["literal", rs]], layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": col, "line-width": 0, "line-opacity": 0, "line-width-transition": { duration: calm ? 0 : 700 }, "line-opacity-transition": { duration: calm ? 0 : 500 } } }));
    L.push({ id: "st-b", type: "line", source: "st-b", paint: { "line-color": "#ff3b30", "line-width": 2.5, "line-opacity": 0, "line-opacity-transition": { duration: 600 } } });
    return L;
  }
  function addMap() {
    const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], b = data.b, rings = b.type === "Polygon" ? [b.coordinates[0]] : b.coordinates.map(p => p[0]);
    const src = { "st-pt": data.pt, "st-dr": data.dr, "st-b": { type: "Feature", geometry: b, properties: {} }, "st-mask": { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [world, ...rings] } } };
    for (const [id, d] of Object.entries(src)) { if (map.getSource(id)) map.getSource(id).setData(d); else { map.addSource(id, { type: "geojson", data: d, tolerance: .8, maxzoom: 12, buffer: 16 }); app.registerOverlaySource?.(id); } }
    for (const l of layersFor()) if (!map.getLayer(l.id)) map.addLayer(l);
  }
  function removeMap() {
    for (const l of layersFor()) if (map.getLayer(l.id)) map.removeLayer(l.id);
    for (const id of ["st-pt", "st-dr", "st-b", "st-mask"]) if (map.getSource(id)) map.removeSource(id);
  }
  function rise(k, delay = 0) { setTimeout(() => { if (!map.getLayer("st-" + k)) return;
    map.setPaintProperty("st-" + k, "fill-opacity", on[k] ? (flat ? .55 : .92) : 0); map.setPaintProperty("st-" + k, "fill-translate", on[k] ? [0, 0] : [0, -14]); }, calm ? 0 : delay); }
  function puff(k) {
    if (calm || !data) return;
    const f = data.pt.features.filter(x => x.properties.k === k), step = Math.max(1, Math.floor(f.length / 24)), W = innerWidth, Hh = innerHeight;
    for (let i = 0; i < f.length; i += step) {
      const g = f[i].geometry, c = (g.type === "Polygon" ? g.coordinates[0][0] : g.coordinates[0][0][0]), p = map.project(c);
      if (p.x < 0 || p.y < 0 || p.x > W || p.y > Hh) continue;
      for (let j = 0; j < 2; j++) { const d = document.createElement("i"); d.className = "st-dust";
        d.style.left = p.x + "px"; d.style.top = p.y + "px"; d.style.setProperty("--dx", (Math.random() - .5) * 46 + "px"); d.style.setProperty("--dy", -14 - Math.random() * 34 + "px");
        d.style.animationDelay = Math.random() * 120 + "ms"; document.body.append(d); setTimeout(() => d.remove(), 1000); }
    }
  }
  function setK(k, v) {
    on[k] = v; if (!v) puff(k);
    rise(k); navigator.vibrate?.(8); render();
  }
  function roads(show) {
    roadsOn = show; flat = show;
    C.forEach(([k], i) => rise(k, show ? i * 40 : i * 90));
    R.forEach(([, , , w], i) => setTimeout(() => { if (!map.getLayer("st-r" + i)) return;
      map.setPaintProperty("st-r" + i, "line-opacity", show ? 1 : 0); map.setPaintProperty("st-r" + i, "line-width", show ? ["interpolate", ["linear"], ["zoom"], 9, w * .6, 14, w * 1.6] : 0); }, calm ? 0 : show ? 350 + i * 520 : (R.length - i) * 80));
    render();
  }
  function count(el, to) {
    const from = parseFloat(el.dataset.v || 0), t0 = performance.now(); el.dataset.v = to;
    const f = t => { const q = calm ? 1 : Math.min(1, (t - t0) / 650), e = 1 - Math.pow(1 - q, 3); el.textContent = fmt((from + (to - from) * e) / 100, 1) + " km²"; if (q < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }
  function pie() {
    const S = sheet.querySelector(".st-pie"); if (!S) return; S.innerHTML = "";
    const cx = 160, cy = 72, rx = 128, ry = 58, h = 20, vis = C.filter(c => on[c[0]] && data.ha[c[0]]), T = vis.reduce((a, c) => a + data.ha[c[0]], 0) || 1;
    const pt = (t, dy = 0) => [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry + dy]; let a = -Math.PI / 2;
    const parts = vis.map(c => { const sw = data.ha[c[0]] / T * 2 * Math.PI, o = { c, a0: a, a1: a + sw }; a += sw; return o; });
    const sides = [];
    for (const o of parts) for (const [u, v] of [[o.a0, o.a1], [o.a0 - 2 * Math.PI, o.a1 - 2 * Math.PI], [o.a0 + 2 * Math.PI, o.a1 + 2 * Math.PI]]) { const s0 = Math.max(u, 0), s1 = Math.min(v, Math.PI); if (s1 > s0) sides.push([o, s0, s1]); }
    for (const o of parts) {
      const m = (o.a0 + o.a1) / 2, g = document.createElementNS(ns, "g"), A = pt(o.a0), B = pt(o.a1), big = o.a1 - o.a0 > Math.PI ? 1 : 0;
      g.setAttribute("class", "st-sl");
      g.innerHTML = sides.filter(s => s[0] === o).map(([, s0, s1]) => `<path d="M${pt(s0)}A${rx} ${ry} 0 0 1 ${pt(s1)}L${pt(s1, h)}A${rx} ${ry} 0 0 0 ${pt(s0, h)}Z" fill="${o.c[2]}" style="filter:brightness(.78)"/>`).join("") +
        (parts.length === 1 ? `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${o.c[2]}"/>` : `<path d="M${cx} ${cy}L${A}A${rx} ${ry} 0 ${big} 1 ${B}Z" fill="${o.c[2]}" stroke="#fff" stroke-width="1.5"/>`);
      const cap = sheet.querySelector(".st-cap"), pct = Math.round(data.ha[o.c[0]] / T * 1000) / 10;
      g.onpointerenter = () => { g.style.transform = `translate(${Math.cos(m) * 13}px,${Math.sin(m) * 8 - 5}px)`; cap.textContent = `${o.c[1]} · ${fmt(pct, 1)}%`; };
      g.onpointerleave = () => { g.style.transform = ""; };
      g.onclick = () => { g.style.transform = `translate(${Math.cos(m) * 60}px,${Math.sin(m) * 40 + 40}px) scale(.3)`; g.style.opacity = "0"; setTimeout(() => setK(o.c[0], false), calm ? 0 : 260); };
      S.append(g);
    }
    C.filter(c => !on[c[0]] && data.ha[c[0]]).forEach((c, i) => { const t = document.createElementNS(ns, "g"); t.style.cursor = "pointer"; t.setAttribute("class", "st-in");
      t.innerHTML = `<title>Wróć: ${esc(c[1])}</title><circle cx="${22 + i * 36}" cy="172" r="14" fill="${c[2]}"/><text x="${22 + i * 36}" y="177.5" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">+</text>`;
      t.onclick = () => setK(c[0], true); S.append(t); });
  }
  function render() {
    if (!sheet || !data) return;
    const tot = C.reduce((a, c) => a + (on[c[0]] ? data.ha[c[0]] || 0 : 0), 0);
    count(sheet.querySelector(".st-big"), tot);
    sheet.querySelector(".st-list").innerHTML = C.filter(c => data.ha[c[0]]).map(c => `<div class="st-row"><span class="st-dot" style="background:${c[2]}"></span><span>${c[1]}</span><span class="v">${data.ha[c[0]] < 100 ? fmt(data.ha[c[0]], 1) + " ha" : fmt(data.ha[c[0]] / 100, 1) + " km²"}<br>${fmt(data.ha[c[0]] / Object.values(data.ha).reduce((a, b) => a + b, 0) * 100, 1)}%</span><button type="button" class="st-tg ${on[c[0]] ? "" : "off"}" data-k="${c[0]}" aria-label="${esc(c[1])}" aria-pressed="${!!on[c[0]]}"></button></div>`).join("") +
      `<div class="st-row" style="margin-top:6px"><span class="st-dot" style="background:#ff9500"></span><span>Drogi (${fmt(Object.values(data.km || {}).reduce((a, b) => a + b, 0), 0)} km)</span><span class="v"></span><button type="button" class="st-tg ${roadsOn ? "" : "off"}" data-road aria-label="Drogi"></button></div>`;
    sheet.querySelectorAll(".st-tg[data-k]").forEach(b => b.onclick = () => setK(b.dataset.k, !on[b.dataset.k]));
    sheet.querySelector("[data-road]").onclick = () => roads(!roadsOn);
    sheet.querySelector("[data-roads]").textContent = roadsOn ? "Ukryj drogi" : "Narysuj drogi";
    pie();
  }
  function shell(name) {
    sheet?.remove(); sheet = document.createElement("section"); sheet.className = "st-sheet"; sheet.setAttribute("aria-label", "Struktura gminy");
    sheet.innerHTML = `<div class="st-grab"></div><div class="st-hd"><div><h2 class="st-in">${esc(name)}</h2><div class="st-sub st-in" style="animation-delay:.08s">Pokrycie terenu · BDOT10k</div></div><button type="button" class="st-x" aria-label="Zamknij">✕</button></div>
      <div class="st-body"><div class="st-load"><div class="st-spin"></div>Liczę strukturę gminy…</div></div>`;
    document.body.append(sheet); sheet.querySelector(".st-x").onclick = () => close();
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add("in")));
  }
  function body() {
    sheet.querySelector(".st-body").innerHTML = `<div class="st-big st-in" style="animation-delay:.12s">0 km²</div>
      <div class="st-seg"><i></i><b data-s="0">Wykres</b><b data-s="1">Lista</b></div>
      <div class="st-v0"><svg class="st-pie" viewBox="0 0 320 190" width="100%" role="img" aria-label="Udział klas pokrycia terenu"></svg><div class="st-cap">Stuknij kawałek, by go wyjąć</div></div>
      <div class="st-v1" hidden><div class="st-list"></div></div>
      <div class="st-btns"><button type="button" class="st-btn pri" data-roads>Narysuj drogi</button><button type="button" class="st-btn" data-all>Wszystko</button></div>
      <p class="st-sub" style="margin:10px 2px 0">Źródło: GUGiK, BDOT10k. Granice: PRG.</p>`;
    sheet.querySelectorAll(".st-seg b").forEach(b => b.onclick = () => { view = +b.dataset.s; sheet.querySelector(".st-seg i").style.left = view ? "50%" : "2px"; sheet.querySelector(".st-v0").hidden = !!view; sheet.querySelector(".st-v1").hidden = !view; });
    sheet.querySelector("[data-roads]").onclick = () => roads(!roadsOn);
    sheet.querySelector("[data-all]").onclick = () => { C.forEach(([k], i) => { if (!on[k]) setTimeout(() => setK(k, true), i * 70); }); };
    render();
  }
  async function open() {
    const t = window.PLOTS_GMINY?.current(); if (!t) { app.toast("Najpierw wybierz gminę"); return; }
    if (document.body.classList.contains("struct-open")) close(true);
    window.StatsMap?.isOpen?.() && window.StatsMap.close();
    saved = [...document.querySelectorAll("#layerPanel .layer-entry input[type=checkbox]:checked")].map(i => i.id).filter(id => id && id !== "lyrAdr");
    document.getElementById("layersOff")?.click(); app.closeLayers?.();
    document.body.classList.add("struct-open"); window.UIHistory?.open("struktura", () => close(true));
    const g = (await window.PLOTS_GMINY.all?.())?.find(x => x.k === t); shell(g?.n || "Gmina");
    try {
      const r = await fetch(app.base + "/api/struktura/" + t + "?v=3", { signal: AbortSignal.timeout(130000) }); if (!r.ok) throw Error(r.status);
      data = await r.json(); if (!document.body.classList.contains("struct-open")) return;
    } catch (e) { sheet.querySelector(".st-body").innerHTML = `<div class="st-load">Serwer nie odpowiada. Spróbuj za chwilę.</div>`; return; }
    on = Object.fromEntries(C.map(c => [c[0], !!data.ha?.[c[0]]])); roadsOn = flat = false;
    addMap(); const [w, s, e, n] = data.bbox;
    if (map.isMoving()) await new Promise(r => { map.once("moveend", r); setTimeout(r, 2500); });
    const cam = map.cameraForBounds([[w, s], [e, n]], { padding: app.isMobile() ? { top: 90, bottom: innerHeight * .5, left: 20, right: 20 } : { top: 50, bottom: 50, left: 50, right: 440 } });
    if (cam) map.easeTo({ ...cam, zoom: cam.zoom + (calm ? 0 : .25), pitch: 0, bearing: 0, duration: calm ? 0 : 1200 });
    map.setPaintProperty("st-mask", "fill-opacity", .86); map.setPaintProperty("st-b", "line-opacity", 1);
    C.forEach(([k], i) => rise(k, 500 + i * 140));
    body();
  }
  function close(silent) {
    if (!document.body.classList.contains("struct-open")) return;
    document.body.classList.remove("struct-open"); sheet?.classList.remove("in"); const s = sheet; sheet = null; setTimeout(() => s?.remove(), 600);
    removeMap(); data = null; map.easeTo({ pitch: 0, bearing: 0, duration: calm ? 0 : 900 });
    for (const id of saved) { const i = document.getElementById(id); if (i && !i.checked) { i.checked = true; i.dispatchEvent(new Event("change", { bubbles: true })); } }
    saved = []; if (!silent) window.UIHistory?.dismiss?.("struktura");
  }
  document.addEventListener("click", e => { if (e.target.closest("[data-open-struktura]")) open(); });
  window.Struktura = { open, close };
})();
