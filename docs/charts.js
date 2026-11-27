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

  window.DashCharts = { bars, ladder, histogram };
})();
