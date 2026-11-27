/* Proste wykresy SVG dla dashboardu: słupki poziome, drabinka szczebli (punkty na jednej osi) i histogram rozkładu.
   Bez bibliotek; każdy wykres zwraca HTML, a kliknięcia obsługuje dashboard przez atrybut data-dash-gmina. */
(function () {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ACC = "var(--cat, var(--acc))", GREY = "#9aa3b2", REF = "#14161a";

  function scale(values, withZero = true) {
    let lo = Math.min(...values), hi = Math.max(...values);
    if (withZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.04; if (lo < 0) lo -= pad; hi += pad;
    return { lo, hi, x: v => (v - lo) / (hi - lo) * 100 };
  }

  /* rows: [{k, label, sub, value, sel}], ref: {value, label} rysowane jako pionowa linia. */
  function bars(rows, { format, ref = null } = {}) {
    if (!rows.length) return `<p class="muted small">Brak danych.</p>`;
    const s = scale([...rows.map(r => r.value), ...(ref && Number.isFinite(ref.value) ? [ref.value] : [])]);
    const refX = ref && Number.isFinite(ref.value) ? s.x(ref.value) : null;
    return `<ol class="ch-bars">${rows.map(r => {
      const a = s.x(Math.min(0, r.value)), b = s.x(Math.max(0, r.value));
      return `<li class="${r.sel ? "sel" : ""}"><button type="button" data-dash-gmina="${esc(r.k)}"><span>${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</span><i class="ch-track">${refX != null ? `<u style="left:${refX.toFixed(1)}%"></u>` : ""}<i style="left:${a.toFixed(1)}%;width:${Math.max(0.6, b - a).toFixed(1)}%"></i></i><b>${esc(format(r.value))}</b></button></li>`;
    }).join("")}</ol>${refX != null ? `<p class="ch-note"><u></u>${esc(ref.label)}: ${esc(format(ref.value))}</p>` : ""}`;
  }

  /* Drabinka: gmina, powiat, województwo, Polska jako punkty na wspólnej osi. */
  function ladder(points, { format }) {
    const ok = points.filter(p => Number.isFinite(p.value));
    if (!ok.length) return `<p class="muted small">Brak danych.</p>`;
    const s = scale(ok.map(p => p.value), false);
    const ticks = [s.lo, (s.lo + s.hi) / 2, s.hi];
    return `<div class="ch-ladder">${ok.map(p => `<div class="ch-step${p.sel ? " sel" : ""}"><span>${esc(p.label)}${p.sub ? `<small>${esc(p.sub)}</small>` : ""}</span><i class="ch-axis"><i style="left:${s.x(p.value).toFixed(1)}%"></i></i><b>${esc(format(p.value))}</b></div>`).join("")}
      <div class="ch-step ch-ticks"><span></span><i class="ch-axis-t">${ticks.map((t, i) => `<em style="left:${i * 50}%">${esc(format(t))}</em>`).join("")}</i><b></b></div></div>`;
  }

  /* Histogram wszystkich gmin; wybrana gmina jako linia z podpisem, sąsiedzi jako krótkie znaczniki. */
  function histogram(sorted, { format, mark = null, marks = [], bins = 40 }) {
    if (sorted.length < 2) return `<p class="muted small">Za mało danych.</p>`;
    // Obcięcie 1% skrajnych wartości, żeby pojedyncze gminy nie spłaszczyły rozkładu.
    const lo = sorted[Math.floor(sorted.length * 0.01)], hi = sorted[Math.ceil(sorted.length * 0.99) - 1];
    const w = (hi - lo) / bins || 1, count = new Array(bins).fill(0);
    for (const v of sorted) count[Math.max(0, Math.min(bins - 1, Math.floor((v - lo) / w)))]++;
    const peak = Math.max(...count), W = 400, H = 120, bw = W / bins, X = v => Math.max(0, Math.min(W, (v - lo) / (hi - lo || 1) * W));
    const mx = mark && Number.isFinite(mark.value) ? X(mark.value) : null;
    return `<svg class="ch-hist" viewBox="0 0 ${W} ${H + 4}" preserveAspectRatio="none" role="img" aria-label="Rozkład wartości wszystkich gmin">
      ${count.map((c, i) => { const h = c / peak * (H - 14); const inBin = mx != null && mx >= i * bw && mx < (i + 1) * bw; return `<rect x="${(i * bw + 0.6).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw - 1.2).toFixed(1)}" height="${Math.max(0.5, h).toFixed(1)}" rx="1.5" fill="${inBin ? ACC : GREY}" opacity="${inBin ? 1 : 0.55}"/>`; }).join("")}
      ${marks.filter(m => Number.isFinite(m)).map(m => `<line x1="${X(m).toFixed(1)}" x2="${X(m).toFixed(1)}" y1="${H}" y2="${H + 4}" stroke="${REF}" stroke-width="1.2"/>`).join("")}
      ${mx != null ? `<line x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="0" y2="${H}" stroke="${ACC}" stroke-width="2" vector-effect="non-scaling-stroke"/>` : ""}
    </svg><div class="ch-hist-axis"><span>${esc(format(lo))}</span>${mx != null ? `<b style="left:${(mx / W * 100).toFixed(1)}%">${esc(mark.label)}</b>` : ""}<span>${esc(format(hi))}</span></div>`;
  }

  /* Wykres liniowy w czasie, rysowany w pikselach kontenera (stałe, małe napisy). Legenda nad wykresem zamiast podpisów na liniach.
     series [{label, color, points:[{x, y}], sel, dash}]. */
  function lines(series, { format, invert = false, height = 240, unit = "", width = 640 } = {}) {
    const all = series.flatMap(s => s.points).filter(p => Number.isFinite(p.y));
    if (!all.length) return `<p class="muted small">Brak danych.</p>`;
    const W = Math.max(280, Math.round(width)), H = height, L = 58, Rr = 14, T = 12, B = 24;
    const xs = [...new Set(all.map(p => p.x))].sort((a, b) => a - b);
    let lo = Math.min(...all.map(p => p.y)), hi = Math.max(...all.map(p => p.y)); if (lo === hi) { lo -= 1; hi += 1; }
    const nonneg = lo >= 0, pad = (hi - lo) * .08; lo -= pad; hi += pad; if (nonneg && !invert && lo < (hi - lo) * .6) lo = 0;
    const X = x => xs.length === 1 ? (L + W - Rr) / 2 : L + (x - xs[0]) / (xs.at(-1) - xs[0]) * (W - L - Rr);
    const Y = y => invert ? T + (y - lo) / (hi - lo) * (H - T - B) : H - B - (y - lo) / (hi - lo) * (H - T - B);
    const ticks = [0, .25, .5, .75, 1].map(t => lo + (hi - lo) * t), step = Math.max(1, Math.ceil(xs.length / Math.max(3, Math.floor(W / 70))));
    const legend = `<div class="ch-legend">${series.filter(s => s.points.some(p => Number.isFinite(p.y))).map(s => { const last = s.points.filter(p => Number.isFinite(p.y)).at(-1);
      return `<span class="${s.sel ? "sel" : ""}"><i style="--c:${s.color}" class="${s.dash ? "dash" : ""}"></i>${esc(s.label)}<b>${esc(format(last.y))}</b></span>`; }).join("")}</div>`;
    return legend + `<svg class="ch-lines" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Zmiany w czasie">
      ${ticks.map(t => `<line x1="${L}" x2="${W - Rr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" class="ch-grid"/><text x="${L - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end" class="ch-tick">${esc(format(t))}</text>`).join("")}
      ${xs.map((x, i) => i % step && i !== xs.length - 1 ? "" : `<text x="${X(x).toFixed(1)}" y="${H - 5}" text-anchor="middle" class="ch-tick">${x}</text>`).join("")}
      ${series.map(s => { const ps = s.points.filter(q => Number.isFinite(q.y)); if (!ps.length) return ""; const d = ps.map((q, i) => `${i ? "L" : "M"}${X(q.x).toFixed(1)} ${Y(q.y).toFixed(1)}`).join("");
        const area = s.sel && ps.length > 1 && !invert ? `<path d="${d}L${X(ps.at(-1).x).toFixed(1)} ${H - B}L${X(ps[0].x).toFixed(1)} ${H - B}Z" fill="${s.color}" opacity=".09"/>` : "";
        const end = ps.at(-1);
        return `${area}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.sel ? 2.6 : 1.6}" ${s.dash ? 'stroke-dasharray="4 4" opacity=".85"' : 'pathLength="1" class="ch-line"'} stroke-linecap="round" stroke-linejoin="round"/>
          ${s.sel ? ps.map(q => `<circle cx="${X(q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="7" fill="transparent" class="ch-hit"><title>${esc(s.label)}, ${q.x}: ${esc(format(q.y))}${unit ? " " + esc(unit) : ""}</title></circle>`).join("") : ""}
          <circle cx="${X(end.x).toFixed(1)}" cy="${Y(end.y).toFixed(1)}" r="${s.sel ? 4 : 3}" fill="${s.color}" stroke="#fff" stroke-width="1.5"/>`; }).join("")}
    </svg>`;
  }

  /* Tort 3D do obracania: przeciągnij w bok, aby obrócić, w górę i w dół, aby zmienić nachylenie.
     items [{key, label, value, color, icon}]; opts {onPick(key), onHover(item, pct)}. Zwraca {update(items)}. */
  function pie3d(svg, items, opts = {}) {
    const NS = "http://www.w3.org/2000/svg", calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const st = { rot: -Math.PI / 2 - (calm ? 0 : 1.4), tilt: .46, items, hover: null };
    const W = 360, H = 230, cx = 180, cy = 100, rx = 158;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.classList.add("pie3d");
    const dark = hex => { const n = parseInt(hex.slice(1), 16), f = .72; return `rgb(${Math.round((n >> 16) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`; };
    const deep = hex => { const n = parseInt(hex.slice(1), 16), f = .42; return `rgb(${Math.round((n >> 16) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`; };
    function draw() {
      const ry = rx * st.tilt, h = 10 + 26 * st.tilt, vis = st.items.filter(i => i.value > 0), T = vis.reduce((a, i) => a + i.value, 0) || 1;
      const P = (t, dy = 0, k = 1) => `${(cx + Math.cos(t) * rx * k).toFixed(1)} ${(cy + Math.sin(t) * ry * k + dy).toFixed(1)}`;
      let a = st.rot; const parts = vis.map(i => { const sw = i.value / T * 2 * Math.PI, o = { i, a0: a, a1: a + sw, pct: i.value / T * 100 }; a += sw; return o; });
      const sides = [];
      for (const o of parts) for (let k = -2; k <= 2; k++) { const u = o.a0 + k * 2 * Math.PI, v = o.a1 + k * 2 * Math.PI, s0 = Math.max(u, 0), s1 = Math.min(v, Math.PI); if (s1 > s0) sides.push({ o, s0, s1 }); }
      sides.sort((p, q) => Math.abs((q.s0 + q.s1) / 2 - Math.PI / 2) - Math.abs((p.s0 + p.s1) / 2 - Math.PI / 2));
      let out = `<defs><radialGradient id="pie3dShade" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
        <ellipse cx="${cx}" cy="${cy + h + 10}" rx="${rx * .92}" ry="${ry * .5 + 6}" fill="#000" opacity=".08"/>`;
      out += sides.map(({ o, s0, s1 }) => `<path d="M${P(s0)}A${rx} ${ry} 0 0 1 ${P(s1)}L${P(s1, h)}A${rx} ${ry} 0 0 0 ${P(s0, h)}Z" fill="${dark(o.i.color)}"/>`).join("");
      out += parts.map(o => { const m = (o.a0 + o.a1) / 2, lift = st.hover === o.i.key ? 10 : 0, dx = Math.cos(m) * lift, dy = Math.sin(m) * lift * st.tilt - lift * .4;
        const big = o.a1 - o.a0 > Math.PI ? 1 : 0, face = parts.length === 1 ? `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${o.i.color}"/>` : `<path d="M${cx} ${cy}L${P(o.a0)}A${rx} ${ry} 0 ${big} 1 ${P(o.a1)}Z" fill="${o.i.color}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>`;
        const [lx, ly] = P(m, 0, .64).split(" ").map(Number), show = o.pct >= 6, ico = o.pct >= 12 ? 26 : 20;
        const label = show ? `<circle cx="${lx}" cy="${ly - 7}" r="${ico / 2 + 3}" fill="#fff" opacity=".92"/><use href="icons/phosphor.svg#${o.i.icon}" x="${lx - ico / 2 + 2}" y="${ly - 7 - ico / 2 + 2}" width="${ico - 4}" height="${ico - 4}" fill="${deep(o.i.color)}"/>
          <text x="${lx}" y="${ly + ico / 2 + 8}" text-anchor="middle" font-size="${o.pct >= 12 ? 15 : 13}" font-weight="800" fill="#1c1c1e" stroke="#fff" stroke-width="3.5" paint-order="stroke">${Math.round(o.pct)}%</text>` : "";
        return `<g class="pie3d-sl" data-k="${esc(o.i.key)}" transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)})"><title>${esc(o.i.label)}: ${o.pct.toFixed(1).replace(".", ",")}%</title>${face}${label}</g>`; }).join("");
      out += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#pie3dShade)" pointer-events="none"/>`;
      svg.innerHTML = out;
    }
    // obrót przeciąganiem i bezwładność
    let drag = null, vel = 0, raf = 0, moved = 0;
    const spin = () => { if (Math.abs(vel) < .0004) return; st.rot += vel; vel *= .94; draw(); raf = requestAnimationFrame(spin); };
    svg.addEventListener("pointerdown", e => { cancelAnimationFrame(raf); drag = { x: e.clientX, y: e.clientY, rot: st.rot, tilt: st.tilt, t: performance.now() }; moved = 0; svg.setPointerCapture(e.pointerId); });
    svg.addEventListener("pointermove", e => {
      if (!drag) { const g = e.target.closest?.(".pie3d-sl"), k = g?.dataset.k || null; if (k !== st.hover) { st.hover = k; draw(); const it = st.items.find(i => i.key === k); opts.onHover?.(it || null, it ? it.value / st.items.reduce((s, i) => s + (i.value > 0 ? i.value : 0), 0) * 100 : 0); } return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      const r = svg.getBoundingClientRect(), k = W / r.width, nr = drag.rot + dx * k / rx * .9;
      vel = nr - st.rot; st.rot = nr; st.tilt = Math.max(.16, Math.min(.9, drag.tilt - dy * .004)); draw();
    });
    const up = e => { if (!drag) return; drag = null; if (moved < 6) { const g = e.target.closest?.(".pie3d-sl"); if (g) opts.onPick?.(g.dataset.k); } else if (!calm) spin(); };
    svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", () => { drag = null; });
    svg.addEventListener("pointerleave", () => { if (!drag && st.hover) { st.hover = null; draw(); opts.onHover?.(null, 0); } });
    draw();
    // wejście: tort dokręca się do pozycji startowej
    if (!calm) { const t0 = performance.now(), from = st.rot, to = -Math.PI / 2; const f = t => { const q = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - q, 3); st.rot = from + (to - from) * e; draw(); if (q < 1 && !drag) raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); }
    return { update(items2) { st.items = items2; draw(); } };
  }

  window.DashCharts = { bars, ladder, histogram, lines, pie3d };
})();
