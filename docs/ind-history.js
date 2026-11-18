/* Indicator over the years in the gmina card: the gmina's series (all years in data/hist) against the median of all gminy. */
(function () {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (v, d) => Number.isFinite(v) ? v.toLocaleString("pl-PL", { maximumFractionDigits: Math.max(0, Number(d) || 0), minimumFractionDigits: 0 }) : "–";
  const medians = new Map();

  function median(key, s) {
    if (medians.has(key) && medians.get(key).n === s.years.length) return medians.get(key).m;
    const m = s.values.map(col => { const a = col.filter(Number.isFinite).sort((x, y) => x - y); return a.length >= 50 ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null; });
    medians.set(key, { n: s.years.length, m });
    return m;
  }

  /* Whether an indicator has more than one year for the national view (so the button makes sense). */
  function available(key) {
    const s = window.GusClient?.series?.(key);
    return !!s && (s.histYears ? s.histYears[2] > 1 : s.years.length > 1);
  }

  function chart(def, k) {
    const s = window.GusClient.series(def.key); if (!s) return "";
    const i = s.index.get(k); if (i === undefined) return `<p class="muted small">Brak danych dla tej gminy.</p>`;
    const med = median(def.key, s), level5 = def.level === 5;
    const pts = s.years.map((y, j) => ({ y, v: s.values[j][i], m: med[j] })).filter(p => Number.isFinite(p.v) || Number.isFinite(p.m)).sort((a, b) => a.y - b.y);
    const own = pts.filter(p => Number.isFinite(p.v));
    if (own.length < 2) return `<p class="muted small">Ta gmina ma dane tylko z ${own.length ? own[0].y + " r." : "żadnego roku"}.</p>`;
    const showMed = !def.descriptive;
    const vals = own.map(p => p.v).concat(showMed ? pts.map(p => p.m).filter(Number.isFinite) : []);
    let lo = Math.min(...vals), hi = Math.max(...vals); if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const W = 320, H = 120, L = 6, R = 6, T = 10, B = 18, y0 = pts[0].y, y1 = pts.at(-1).y;
    const X = y => L + (y1 === y0 ? 0 : (y - y0) / (y1 - y0) * (W - L - R)), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    const path = arr => arr.map((p, n) => `${n ? "L" : "M"}${X(p.y).toFixed(1)},${Y(p.v ?? p.m).toFixed(1)}`).join("");
    const medPts = pts.filter(p => Number.isFinite(p.m)).map(p => ({ y: p.y, v: p.m }));
    const first = own[0], last = own.at(-1), d = def.digits ?? 1;
    const ch = last.v - first.v, rel = first.v ? ch / Math.abs(first.v) * 100 : null;
    const chText = def.unit === "%" ? `${ch >= 0 ? "+" : ""}${fmt(ch, d)} pkt proc.` : `${ch >= 0 ? "+" : ""}${fmt(ch, d)}${def.unit ? " " + esc(def.unit) : ""}${rel !== null && Number.isFinite(rel) ? ` (${rel >= 0 ? "+" : ""}${fmt(rel, 1)}%)` : ""}`;
    const ticks = [y0, Math.round((y0 + y1) / 2), y1].filter((y, n, a) => a.indexOf(y) === n);
    return `<svg viewBox="0 0 ${W} ${H}" class="ih-svg" role="img" aria-label="${esc(def.label)} w latach ${y0}–${y1}">
      <line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="ih-axis"/>
      ${ticks.map(y => `<text x="${X(y)}" y="${H - 4}" text-anchor="${y === y0 ? "start" : y === y1 ? "end" : "middle"}">${y}</text>`).join("")}
      ${showMed && medPts.length > 1 ? `<path d="${path(medPts)}" class="ih-med"/>` : ""}
      <path d="${path(own)}" class="ih-own"/>
      ${own.map(p => `<circle cx="${X(p.y).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="2.6" class="ih-dot"><title>${p.y}: ${fmt(p.v, d)} ${esc(def.unit || "")}</title></circle>`).join("")}
      <text x="${X(last.y) - 4}" y="${Math.max(10, Y(last.v) - 6)}" text-anchor="end" class="ih-val">${fmt(last.v, d)}</text>
    </svg>
    <p class="ih-note"><span><i class="ih-k-own"></i>gmina</span>${showMed ? `<span><i class="ih-k-med"></i>mediana gmin w Polsce</span>` : ""}<span>${first.y}–${last.y}: <b>${chText}</b></span></p>
    ${level5 ? `<p class="muted small">Dane powiatu przypisane gminie.</p>` : ""}`;
  }

  async function toggle(btn, def, k) {
    const card = btn.closest("article"); if (!card) return;
    let box = card.querySelector(".ind-hist");
    if (box) { box.remove(); btn.setAttribute("aria-expanded", "false"); return; }
    box = document.createElement("div"); box.className = "ind-hist"; box.innerHTML = `<p class="muted small">Wczytuję dane z wielu lat…</p>`;
    card.appendChild(box); btn.setAttribute("aria-expanded", "true");
    await window.GusClient.history(def.key);
    if (box.isConnected) box.innerHTML = chart(def, k);
  }

  window.IndHistory = { available, toggle, chart };
})();
