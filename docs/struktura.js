/* Struktura gminy: pokrycie terenu BDOT10k jednej gminy w 3D (bryły do obracania), karta z tortem i przełącznikami klas,
   drogi od razu narysowane, numery dróg krajowych, wojewódzkich i autostrad. Tryb wyłączny: zamyka Polskę, Wykresy i inne moduły,
   a przejście do innego trybu zamyka strukturę.
   Dane: /api/struktura/<teryt> (server/public_api.py), liczone raz na gminę i trzymane na dysku serwera. */
(function () {
  "use strict";
  const app = window.PLOTS; if (!app) return;
  const map = app.map, esc = app.esc, ns = "http://www.w3.org/2000/svg";
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // klucz, nazwa, kolor, wysokość bryły (m, przed skalowaniem do wielkości gminy), symbol, krótka nazwa na mapę
  const C = [
    ["las", "Lasy", "#5b9a6e", 140, "tree", "Las"], ["krz", "Roślinność krzewiasta i zadrzewienia", "#94c4a3", 60, "plant", "Zadrzewienia"], ["traw", "Roślinność trawiasta", "#c6de9f", 10, "leaf", "Łąki"],
    ["orne", "Uprawy na gruntach", "#ead8a2", 16, "sun", "Uprawy"], ["dzial", "Ogródki działkowe", "#cdbf82", 22, "shovel", "Działki"], ["cm", "Cmentarze", "#8fa39a", 26, "church", "Cmentarz"],
    ["zjed", "Zabudowa mieszkaniowa jednorodzinna", "#e3ad90", 90, "house", "Domy"], ["zwiel", "Zabudowa mieszkaniowa wielorodzinna", "#c97c64", 220, "buildings", "Bloki"],
    ["zusl", "Zabudowa usługowo-handlowa", "#bb8db3", 160, "storefront", "Usługi"], ["zprz", "Zabudowa przemysłowa", "#9b8faa", 180, "factory", "Przemysł"], ["zpoz", "Pozostała zabudowa", "#c2bdb6", 70, "bank", "Zabudowa"],
    ["niez", "Tereny niezabudowane i nieużytki", "#ddd3c1", 5, "mountains", "Nieużytki"], ["woda", "Wody", "#86b8e0", 2, "waves", "Woda"]];
  // klasy dróg BDOT10k: autostrady i ekspresowe, główne, zbiorcze, lokalne, wewnętrzne
  const R = [[[0, 1, 2], "Autostrady i ekspresowe", "#e5484d", 5.5], [[3], "Drogi główne", "#f08c3a", 4], [[4], "Drogi zbiorcze", "#f2c94c", 3],
    [[5, 6], "Drogi lokalne i dojazdowe", "#ffffff", 2], [[7], "Drogi wewnętrzne", "#f4f1ea", 1.1]];
  let data = null, on = {}, saved = [], sheet = null, roadsOn = true, view = 0, scale = 1, is3d = true, orbit = 0;
  const fmt = (v, d = 1) => Number(v).toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
  const ic = n => `<svg class="ic" viewBox="0 0 256 256" aria-hidden="true"><use href="icons/phosphor.svg#${n}"/></svg>`;

  const css = document.createElement("style");
  css.textContent = `
.st-sheet{position:fixed;z-index:60;left:50%;bottom:0;width:min(420px,100vw);transform:translate(-50%,110%);background:rgba(255,255,255,.92);-webkit-backdrop-filter:saturate(180%) blur(22px);backdrop-filter:saturate(180%) blur(22px);border-radius:28px 28px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.14);padding:8px 16px calc(14px + env(safe-area-inset-bottom));font-family:-apple-system,"SF Pro Text",system-ui,sans-serif;color:#1c1c1e;transition:transform .6s cubic-bezier(.2,1.15,.3,1);max-height:78vh;overflow:auto;overscroll-behavior:contain}
@media(min-width:900px){.st-sheet{left:auto;right:16px;bottom:16px;top:16px;max-height:none;border-radius:28px;transform:translateX(120%)}}
.st-sheet.in{transform:translate(-50%,0)}@media(min-width:900px){.st-sheet.in{transform:none}}
.st-grab{width:38px;height:5px;border-radius:3px;background:#c7c7cc;margin:0 auto 8px}
.st-hd{display:flex;align-items:center;gap:10px}.st-hd h2{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0;line-height:1.15}
.st-sub{font-size:13px;color:#48484a;margin-top:2px}
.st-x{margin-left:auto;flex:none;border:0;border-radius:999px;background:#007aff;color:#fff;font:600 13px -apple-system,system-ui,sans-serif;padding:7px 13px;cursor:pointer}
.st-x:active{transform:scale(.95)}
.st-big{font-size:30px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin:8px 0 0}
.st-seg{display:flex;background:#e9e9ee;border-radius:10px;padding:2px;margin:10px 0;position:relative}
.st-seg b{flex:1;text-align:center;font-size:13px;font-weight:600;padding:6px 0;z-index:1;cursor:pointer}
.st-seg i{position:absolute;top:2px;bottom:2px;width:calc(50% - 2px);left:2px;background:#fff;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,.1);transition:left .45s cubic-bezier(.2,1.3,.3,1)}
.st-row{display:flex;align-items:center;gap:12px;padding:8px 2px;border-bottom:.5px solid #e5e5ea;font-size:15px}.st-row:last-child{border:0}
.st-dot{width:30px;height:30px;border-radius:9px;flex:none;display:grid;place-items:center}.st-dot .ic{width:18px;height:18px;color:#fff;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25))}
.st-row .v{margin-left:auto;color:#48484a;font-size:13px;font-variant-numeric:tabular-nums;text-align:right}
.st-tg{width:51px;height:31px;border-radius:16px;background:#34c759;position:relative;transition:background .25s;cursor:pointer;flex:none;border:0;padding:0}
.st-tg:after{content:"";position:absolute;top:2px;left:22px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 3px 8px rgba(0,0,0,.15);transition:left .4s cubic-bezier(.2,1.4,.3,1)}
.st-tg.off{background:#e9e9ea}.st-tg.off:after{left:2px}
.st-sl{transition:transform .5s cubic-bezier(.2,1.4,.3,1);cursor:pointer}
.st-pie{display:block;width:100%;height:auto;touch-action:none;cursor:grab}.st-pie:active{cursor:grabbing}.pie3d-sl{cursor:pointer}
.st-pie text{font-family:-apple-system,"SF Pro Text",system-ui,sans-serif;pointer-events:none}
.st-leg{display:grid;grid-template-columns:1fr;gap:6px 10px;margin:6px 0 2px}
.st-leg span{display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:600;line-height:1.15;cursor:pointer}
.st-leg span.off{opacity:.4}
.st-leg i{width:24px;height:24px;border-radius:7px;flex:none;display:grid;place-items:center}.st-leg i .ic{width:15px;height:15px;color:#fff}
.st-leg b{margin-left:auto;font-variant-numeric:tabular-nums;color:#1c1c1e}
.st-btns{display:flex;gap:6px;margin-top:10px}.st-btn{flex:1;border:0;border-radius:12px;padding:8px 6px;font:600 13px -apple-system,system-ui,sans-serif;cursor:pointer;background:#007aff;color:#fff;display:flex;align-items:center;justify-content:center;gap:5px}
.st-btn .ic{width:16px;height:16px}.st-btn:active{transform:scale(.96)}
.st-btn.alt{background:#e8f1ff;color:#007aff}
.st-cap{text-align:center;font-size:13.5px;font-weight:600;color:#1c1c1e;min-height:18px}
.st-in{animation:stIn .7s cubic-bezier(.2,1,.3,1) both}@keyframes stIn{from{opacity:0;transform:translateY(10px);filter:blur(8px)}}
.st-dust{position:fixed;z-index:55;pointer-events:none;width:8px;height:8px;border-radius:50%;background:rgba(210,210,215,.95);animation:stDust .8s ease-out forwards}
@keyframes stDust{to{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
.st-load{text-align:center;padding:26px 0;color:#48484a;font-size:14px}
.st-spin{width:26px;height:26px;border:3px solid #e5e5ea;border-top-color:#007aff;border-radius:50%;margin:0 auto 10px;animation:stSp .8s linear infinite}@keyframes stSp{to{transform:rotate(360deg)}}
.st-exit{position:fixed;z-index:61;top:calc(14px + env(safe-area-inset-top));left:16px;border:0;border-radius:999px;background:#007aff;color:#fff;font:600 13px -apple-system,system-ui,sans-serif;padding:8px 14px 8px 10px;display:flex;align-items:center;gap:6px;box-shadow:0 6px 18px rgba(0,122,255,.35);cursor:pointer}
.st-exit .ic{width:16px;height:16px;transform:rotate(180deg)}
@media(max-width:899px){.st-sheet{max-height:52vh}.st-big{font-size:24px;margin-top:4px}.st-hd h2{font-size:19px}.st-seg{margin:6px 0}.st-exit{top:auto;bottom:calc(52vh + 12px)}}
body.struct-open #panel,body.struct-open .side-mods,body.struct-open #layerPanel,body.struct-open #layersFab,body.struct-open .layer-fab,body.struct-open .fabs,body.struct-open #collapse,body.struct-open #search,
body.struct-open .urz-pin,body.struct-open .urz-panel,body.struct-open .urz-view,body.struct-open .ext-chip,body.struct-open .bm-toggle,body.struct-open .maplibregl-popup,body.struct-open .distance-fab{display:none!important}`;
  document.head.append(css);

  const scaled = h => h * scale * 1.6;
  function layersFor() {
    const L = [{ id: "st-mask", type: "fill", source: "st-mask", paint: { "fill-color": "#eef0f4", "fill-opacity": 0, "fill-opacity-transition": { duration: 700 } } }];
    for (const [k, , col] of C) L.push({ id: "st-" + k, type: "fill", source: "st-pt", filter: ["==", ["get", "k"], k],
      paint: { "fill-color": col, "fill-opacity": 0, "fill-translate": [0, -14],
        "fill-opacity-transition": { duration: calm ? 0 : 550 }, "fill-translate-transition": { duration: calm ? 0 : 650 } } });
    // drogi: jasna obwódka i kolorowy środek, szerokość rośnie z przybliżeniem
    const width = (w, m) => ["interpolate", ["exponential", 1.4], ["zoom"], 8, w * .45 * m, 12, w * 1.1 * m, 16, w * 3 * m];
    const order = R.map((_, i) => i).reverse();
    for (const i of order) { const [rs, , , w] = R[i]; L.push({ id: "st-rc" + i, type: "line", source: "st-dr", filter: ["in", ["get", "r"], ["literal", rs]], layout: { "line-cap": "round", "line-join": "round", "line-sort-key": -i },
      paint: { "line-color": i >= 3 ? "#9a9aa0" : "#ffffff", "line-width": width(w, i >= 3 ? 1.5 : 1.75), "line-opacity": 0, "line-opacity-transition": { duration: calm ? 0 : 600 } } }); }
    for (const i of order) { const [rs, , col, w] = R[i]; L.push({ id: "st-r" + i, type: "line", source: "st-dr", filter: ["in", ["get", "r"], ["literal", rs]], layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": col, "line-width": width(w, 1), "line-opacity": 0, "line-opacity-transition": { duration: calm ? 0 : 600 } } }); }
    L.push({ id: "st-b", type: "line", source: "st-b", paint: { "line-color": "#ff3b30", "line-width": 2.5, "line-opacity": 0, "line-opacity-transition": { duration: 600 } } });
    // numery dróg: A1, A2… (autostrady), 1–2 cyfry (krajowe), 3 cyfry (wojewódzkie); tylko w granicach gminy, rzadko
    L.push({ id: "st-ref", type: "symbol", source: "st-refl",
      layout: { "symbol-placement": "line-center", "text-allow-overlap": true, "icon-allow-overlap": true, "text-field": ["get", "ref"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-rotation-alignment": "viewport",
        "icon-image": ["get", "sh"], "icon-text-fit": "both", "icon-text-fit-padding": [3, 7, 3, 7], "icon-rotation-alignment": "viewport", "symbol-sort-key": ["get", "o"], "text-padding": 4 },
      paint: { "text-color": ["get", "tc"], "text-opacity": 0, "icon-opacity": 0, "text-opacity-transition": { duration: 500 }, "icon-opacity-transition": { duration: 500 } } });
    // podpisy klas na mapie: nazwa i udział przy największych płatach
    L.push({ id: "st-lab", type: "symbol", source: "st-lab", layout: { "text-field": ["format", ["get", "n"], { "font-scale": 1 }, "\n", {}, ["get", "p"], { "font-scale": .82 }],
      "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 9, 12, 14, 16], "text-padding": 6, "symbol-sort-key": ["get", "o"], "text-max-width": 11 },
      paint: { "text-color": ["get", "d"], "text-halo-color": "rgba(255,255,255,.95)", "text-halo-width": 2.2, "text-opacity": 0, "text-opacity-transition": { duration: 600 } } });
    return L;
  }
  function shields() {
    const mk = (id, bg, border) => { if (map.hasImage(id)) return; const c = document.createElement("canvas"), s = 2; c.width = c.height = 24 * s; const g = c.getContext("2d");
      g.fillStyle = border; g.beginPath(); g.roundRect(0, 0, 24 * s, 24 * s, 6 * s); g.fill(); g.fillStyle = bg; g.beginPath(); g.roundRect(1.5 * s, 1.5 * s, 21 * s, 21 * s, 5 * s); g.fill();
      map.addImage(id, g.getImageData(0, 0, 24 * s, 24 * s), { pixelRatio: s, stretchX: [[8 * s, 16 * s]], stretchY: [[8 * s, 16 * s]], content: [5 * s, 5 * s, 19 * s, 19 * s] }); };
    mk("st-sh-a", "#c62828", "#ffffff"); mk("st-sh-k", "#d84315", "#ffffff"); mk("st-sh-w", "#ffd23f", "#1c1c1e");
  }
  /* Punkty podpisów: środek dwóch największych płatów każdej klasy. */
  function labels() {
    const tot = Object.values(data.ha).reduce((a, b) => a + b, 0) || 1, out = [];
    for (const [k, name, col] of C) {
      if (!data.ha[k] || data.ha[k] / tot < .01) continue;
      const fs = data.pt.features.filter(f => f.properties.k === k).map(f => { const ring = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates.map(p => p[0]).sort((a, b) => b.length - a.length)[0];
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, sx = 0, sy = 0; for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); sx += x; sy += y; }
        return { a: (x1 - x0) * (y1 - y0), c: [sx / ring.length, sy / ring.length] }; }).sort((a, b) => b.a - a.a).slice(0, 2);
      fs.forEach((f, i) => out.push({ type: "Feature", geometry: { type: "Point", coordinates: f.c }, properties: { n: name, p: fmt(data.ha[k] / tot * 100, 0) + "%", d: shade(col), o: -data.ha[k] + i * 1e9 } }));
    }
    return { type: "FeatureCollection", features: out };
  }
  /* Numery dróg z mapy podkładowej (OpenStreetMap): A1, A2… autostrady, 1–2 cyfry drogi krajowe, 3 cyfry wojewódzkie.
     Tylko odcinki w granicach gminy, najwyżej 3 odcinki na numer, żeby etykiet było niewiele. */
  function inside(pt) { const b = data?.b; if (!b) return false; const polys = b.type === "Polygon" ? [b.coordinates] : b.coordinates;
    const inR = (p, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
    return polys.some(poly => inR(pt, poly[0]) && !poly.slice(1).some(h => inR(pt, h))); }
  function refs() {
    if (!data || !map.getSource("st-refl") || !map.getSource("openmaptiles")) return;
    const by = new Map();
    for (const f of map.querySourceFeatures("openmaptiles", { sourceLayer: "transportation_name" })) {
      const p = f.properties, ref = String(p.ref || "").split(";")[0].trim(), nets = [1, 2, 3, 4].map(i => p["route_" + i + "_network"] || ""), cls = String(p.class || "");
      const kind = /^A\d{1,2}$/.test(ref) ? "a" : /^\d{1,2}$/.test(ref) && (nets.includes("pl:national") || /^(trunk|primary)/.test(cls)) ? "k" : /^\d{3}$/.test(ref) && (nets.includes("pl:regional") || /^(secondary|primary)/.test(cls)) ? "w" : null;
      if (!kind) continue;
      const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [];
      for (const ln of lines) { const keep = ln.filter(inside); if (keep.length < 2) continue;
        let len = 0; for (let i = 1; i < keep.length; i++) len += Math.hypot(keep[i][0] - keep[i - 1][0], keep[i][1] - keep[i - 1][1]);
        (by.get(ref) || by.set(ref, { kind, parts: [] }).get(ref)).parts.push({ c: keep, len }); }
    }
    const feats = [];
    for (const [ref, { kind, parts }] of by) parts.sort((a, b) => b.len - a.len).slice(0, 3).forEach(pt => feats.push({ type: "Feature", geometry: { type: "LineString", coordinates: pt.c },
      properties: { ref, sh: "st-sh-" + kind, tc: kind === "w" ? "#1c1c1e" : "#ffffff", o: kind === "a" ? 0 : kind === "k" ? 1 : 2 } }));
    map.getSource("st-refl").setData({ type: "FeatureCollection", features: feats });
  }
  function shade(hex) { const n = parseInt(hex.slice(1), 16), f = .45; return `rgb(${Math.round((n >> 16) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`; }
  function addMap() {
    const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], b = data.b, rings = b.type === "Polygon" ? [b.coordinates[0]] : b.coordinates.map(p => p[0]);
    const src = { "st-pt": data.pt, "st-dr": data.dr, "st-b": { type: "Feature", geometry: b, properties: {} }, "st-mask": { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [world, ...rings] } }, "st-lab": labels(), "st-refl": { type: "FeatureCollection", features: [] } };
    for (const [id, d] of Object.entries(src)) { if (map.getSource(id)) map.getSource(id).setData(d); else { map.addSource(id, { type: "geojson", data: d, tolerance: .8, maxzoom: 12, buffer: 16 }); app.registerOverlaySource?.(id); } }
    shields();
    for (const l of layersFor()) { if (map.getLayer(l.id)) continue; try { map.addLayer(l); } catch (e) { console.warn("Struktura:", l.id, e.message); } }
    map.off("idle", refs); map.on("idle", refs);
  }
  function removeMap() {
    for (const l of layersFor()) if (map.getLayer(l.id)) map.removeLayer(l.id);
    map.off("idle", refs);
    for (const id of ["st-pt", "st-dr", "st-b", "st-mask", "st-lab", "st-refl"]) if (map.getSource(id)) map.removeSource(id);
  }
  function rise(k, delay = 0) { setTimeout(() => { if (!map.getLayer("st-" + k)) return; const c = C.find(x => x[0] === k);
    void c; map.setPaintProperty("st-" + k, "fill-opacity", on[k] ? .9 : 0); map.setPaintProperty("st-" + k, "fill-translate", on[k] ? [0, 0] : [0, -14]); }, calm ? 0 : delay); }
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
  function setK(k, v) { on[k] = v; if (!v) puff(k); rise(k); navigator.vibrate?.(8); render(); }
  function roads(show, stagger = true) {
    roadsOn = show;
    R.forEach((_, i) => setTimeout(() => { for (const id of ["st-rc" + i, "st-r" + i]) if (map.getLayer(id)) map.setPaintProperty(id, "line-opacity", show ? 1 : 0); },
      calm || !stagger ? 0 : show ? 300 + i * 260 : (R.length - i) * 60));
    for (const [id, p] of [["st-ref", "text-opacity"], ["st-ref", "icon-opacity"]]) if (map.getLayer(id)) map.setPaintProperty(id, p, show ? 1 : 0);
    render();
  }
  function count(el, to) {
    const from = parseFloat(el.dataset.v || 0), t0 = performance.now(); el.dataset.v = to;
    const f = t => { const q = calm ? 1 : Math.min(1, (t - t0) / 650), e = 1 - Math.pow(1 - q, 3); el.textContent = fmt((from + (to - from) * e) / 100, 1) + " km²"; if (q < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }
  /* Tort 3D do obracania (wspólny z Wykresami): przeciągnij w bok, aby obrócić, w górę i w dół, aby pochylić. */
  let pieCtl = null;
  function pie() {
    const S = sheet.querySelector(".st-pie"); if (!S || !window.DashCharts) return;
    const items = C.map(c => ({ key: c[0], label: c[1], value: on[c[0]] ? data.ha[c[0]] || 0 : 0, color: c[2], icon: c[4] }));
    if (pieCtl && S.isConnected && S.dataset.ok) pieCtl.update(items);
    else { S.dataset.ok = "1"; const cap = sheet.querySelector(".st-cap");
      pieCtl = window.DashCharts.pie3d(S, items, { onPick: k => setK(k, false), onHover: (it, p) => { cap.textContent = it ? `${it.label} · ${fmt(p, 1)}%` : "Przeciągnij, aby obrócić tort. Stuknij kawałek, by go wyjąć."; } }); }
    const all = Object.values(data.ha).reduce((x, y) => x + y, 0) || 1;
    sheet.querySelector(".st-leg").innerHTML = C.filter(c => data.ha[c[0]]).sort((x, y) => data.ha[y[0]] - data.ha[x[0]]).map(c =>
      `<span class="${on[c[0]] ? "" : "off"}" data-leg="${c[0]}" title="${esc(c[1])}"><i style="background:${c[2]}">${ic(c[4])}</i>${esc(c[1])}<b>${fmt(data.ha[c[0]] / all * 100, 1)}%</b></span>`).join("");
    sheet.querySelectorAll("[data-leg]").forEach(s => s.onclick = () => setK(s.dataset.leg, !on[s.dataset.leg]));
  }
  function render() {
    if (!sheet || !data) return;
    const tot = C.reduce((a, c) => a + (on[c[0]] ? data.ha[c[0]] || 0 : 0), 0), all = Object.values(data.ha).reduce((a, b) => a + b, 0) || 1;
    count(sheet.querySelector(".st-big"), tot);
    sheet.querySelector(".st-list").innerHTML = C.filter(c => data.ha[c[0]]).map(c => `<div class="st-row"><span class="st-dot" style="background:${c[2]}">${ic(c[4])}</span><span>${c[1]}</span><span class="v">${data.ha[c[0]] < 100 ? fmt(data.ha[c[0]], 1) + " ha" : fmt(data.ha[c[0]] / 100, 1) + " km²"}<br>${fmt(data.ha[c[0]] / all * 100, 1)}%</span><button type="button" class="st-tg ${on[c[0]] ? "" : "off"}" data-k="${c[0]}" aria-label="${esc(c[1])}" aria-pressed="${!!on[c[0]]}"></button></div>`).join("") +
      `<div class="st-row" style="margin-top:6px"><span class="st-dot" style="background:#f08c3a">${ic("navigation-arrow")}</span><span>Drogi (${fmt(Object.values(data.km || {}).reduce((a, b) => a + b, 0), 0)} km)</span><span class="v"></span><button type="button" class="st-tg ${roadsOn ? "" : "off"}" data-road aria-label="Drogi"></button></div>`;
    sheet.querySelectorAll(".st-tg[data-k]").forEach(b => b.onclick = () => setK(b.dataset.k, !on[b.dataset.k]));
    sheet.querySelector("[data-road]").onclick = () => roads(!roadsOn);
    sheet.querySelector("[data-roads]").innerHTML = `${ic("navigation-arrow")}${roadsOn ? "Bez dróg" : "Drogi"}`;
    pie();
  }
  function shell(name) {
    sheet?.remove(); sheet = document.createElement("section"); sheet.className = "st-sheet"; sheet.setAttribute("aria-label", "Struktura gminy");
    sheet.innerHTML = `<div class="st-grab"></div><div class="st-hd"><div><h2 class="st-in">${esc(name)}</h2><div class="st-sub st-in" style="animation-delay:.08s">Struktura terenu · pokrycie BDOT10k</div></div><button type="button" class="st-x" aria-label="Zakończ strukturę">Zakończ</button></div>
      <div class="st-body"><div class="st-load"><div class="st-spin"></div>Liczę strukturę gminy…</div></div>`;
    document.body.append(sheet); sheet.querySelector(".st-x").onclick = () => close();
    document.querySelector(".st-exit")?.remove();
    const ex = document.createElement("button"); ex.type = "button"; ex.className = "st-exit"; ex.innerHTML = `${ic("arrow-right")}Wróć do mapy`; ex.onclick = () => close(); document.body.append(ex);
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add("in")));
  }
  function body() {
    sheet.querySelector(".st-body").innerHTML = `<div class="st-big st-in" style="animation-delay:.12s">0 km²</div>
      <div class="st-seg"><i></i><b data-s="0">Wykres</b><b data-s="1">Lista</b></div>
      <div class="st-v0"><svg class="st-pie" viewBox="0 0 360 210" role="img" aria-label="Udział klas pokrycia terenu"></svg><div class="st-cap">Przeciągnij, aby obrócić tort. Stuknij kawałek, by go wyjąć.</div><div class="st-leg"></div></div>
      <div class="st-v1" hidden><div class="st-list"></div></div>
      <div class="st-btns"><button type="button" class="st-btn alt" data-roads></button><button type="button" class="st-btn alt" data-all>Wszystkie klasy</button></div>
      <p class="st-sub" style="margin:6px 2px 0">Źródło: Główny Urząd Geodezji i Kartografii, BDOT10k i PRG. Numery dróg: OpenStreetMap.</p>`;
    sheet.querySelectorAll(".st-seg b").forEach(b => b.onclick = () => { view = +b.dataset.s; sheet.querySelector(".st-seg i").style.left = view ? "50%" : "2px"; sheet.querySelector(".st-v0").hidden = !!view; sheet.querySelector(".st-v1").hidden = !view; });
    sheet.querySelector("[data-roads]").onclick = () => roads(!roadsOn);
    sheet.querySelector("[data-all]").onclick = () => { C.forEach(([k], i) => { if (!on[k]) setTimeout(() => setK(k, true), i * 70); }); };
    render();
  }
  async function open() {
    const t = window.PLOTS_GMINY?.current(); if (!t) { app.toast("Najpierw wybierz gminę"); return; }
    if (document.body.classList.contains("struct-open")) close(true);
    // tryb wyłączny: zamyka Polskę, Wykresy i moduły odległości
    window.StatsMap?.isOpen?.() && window.StatsMap.close();
    if (window.Dashboard?.isOpen?.()) await window.Dashboard.close();
    window.DistanceModule?.isOpen?.() && window.DistanceModule.close();
    saved = [...document.querySelectorAll("#layerPanel .layer-entry input[type=checkbox]:checked")].map(i => i.id).filter(id => id && id !== "lyrAdr");
    document.getElementById("layersOff")?.click(); app.closeLayers?.();
    document.body.classList.add("struct-open"); window.UIHistory?.open("struktura", () => close(true));
    const g = (await window.PLOTS_GMINY.all?.())?.find(x => x.k === t); shell(g?.n || "Gmina");
    try {
      const r = await fetch(app.base + "/api/struktura/" + t + "?v=3", { signal: AbortSignal.timeout(130000) }); if (!r.ok) throw Error(r.status);
      data = await r.json(); if (!document.body.classList.contains("struct-open")) return;
    } catch (e) { if (sheet) sheet.querySelector(".st-body").innerHTML = `<div class="st-load">Serwer nie odpowiada. Spróbuj za chwilę.</div>`; return; }
    on = Object.fromEntries(C.map(c => [c[0], !!data.ha?.[c[0]]])); roadsOn = true; is3d = true;
    const [w, s, e, n] = data.bbox; scale = Math.max(.5, Math.min(4, Math.hypot((e - w) * 68, (n - s) * 111) / 18));
    if (!map.style?._loaded) await new Promise(r => { const f = () => { if (map.style?._loaded) { map.off("styledata", f); r(); } }; map.on("styledata", f); f(); });
    if (!document.body.classList.contains("struct-open")) return;
    addMap();
    if (map.isMoving()) await new Promise(r => { map.once("moveend", r); setTimeout(r, 2500); });
    const cam = map.cameraForBounds([[w, s], [e, n]], { padding: app.isMobile() ? { top: 70, bottom: innerHeight * .52, left: 20, right: 20 } : { top: 60, bottom: 60, left: 60, right: 470 } });
    if (cam) map.easeTo({ ...cam, zoom: cam.zoom - (calm ? 0 : .05), pitch: 0, bearing: 0, duration: calm ? 0 : 1200 });
    map.setPaintProperty("st-mask", "fill-opacity", .86); map.setPaintProperty("st-b", "line-opacity", 1);
    C.forEach(([k], i) => rise(k, 500 + i * 120));
    setTimeout(() => { roads(true); if (map.getLayer("st-lab")) map.setPaintProperty("st-lab", "text-opacity", 1); }, calm ? 0 : 900);
    body();
  }
  function close(silent) {
    if (!document.body.classList.contains("struct-open")) return;
    pieCtl = null; document.querySelector(".st-exit")?.remove();
    document.body.classList.remove("struct-open"); sheet?.classList.remove("in"); const s = sheet; sheet = null; setTimeout(() => s?.remove(), 600);
    removeMap(); data = null; map.easeTo({ pitch: 0, bearing: 0, duration: calm ? 0 : 900 });
    for (const id of saved) { const i = document.getElementById(id); if (i && !i.checked) { i.checked = true; i.dispatchEvent(new Event("change", { bubbles: true })); } }
    saved = []; if (!silent) window.UIHistory?.dismiss?.("struktura");
  }
  document.addEventListener("click", e => { if (e.target.closest("[data-open-struktura]")) open(); else if (e.target.closest(".mode-switch [data-mode-go]") && document.body.classList.contains("struct-open")) close(); });
  addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("struct-open")) close(); });
  // inny tryb (Polska, Wykresy) albo inny moduł zamyka strukturę
  window.PlotsState?.on(({ changed, state }) => { if (changed.includes("tryb") && state.tryb !== "mapa") close(); });
  document.addEventListener("stats:open", () => close());
  window.Struktura = { open, close, isOpen: () => document.body.classList.contains("struct-open") };
})();
