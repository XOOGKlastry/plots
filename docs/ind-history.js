/* Indicator over the years in the gmina card: the gmina's series (all years in data/hist) against the median of all gminy
   or against a second gmina chosen by the user, with a CSV download of the series. */
(function () {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (v, d) => Number.isFinite(v) ? v.toLocaleString("pl-PL", { maximumFractionDigits: Math.max(0, Number(d) || 0), minimumFractionDigits: 0 }) : "–";
  const medians = new Map();
  let current = {}, other = null;

  function median(key, s) {
    if (medians.has(key) && medians.get(key).n === s.years.length) return medians.get(key).m;
    const m = s.values.map(col => { const a = col.filter(Number.isFinite).sort((x, y) => x - y); return a.length >= 50 ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null; });
    medians.set(key, { n: s.years.length, m });
    return m;
  }

  /* Whether an indicator has more than one year (so the button makes sense). */
  function available(key) {
    const s = window.GusClient?.series?.(key);
    return !!s && (s.histYears ? s.histYears[2] > 1 : s.years.length > 1);
  }

  function chart(def, k) {
    const s = window.GusClient.series(def.key); if (!s) return "";
    const i = s.index.get(k); if (i === undefined) return `<p class="muted small">Brak danych dla tej gminy.</p>`;
    const i2 = other ? s.index.get(other.k) : undefined;
    const med = median(def.key, s), level5 = def.level === 5;
    const pts = s.years.map((y, j) => ({ y, v: s.values[j][i], m: med[j], o: i2 === undefined ? null : s.values[j][i2] }))
      .filter(p => Number.isFinite(p.v) || Number.isFinite(p.m)).sort((a, b) => a.y - b.y);
    const own = pts.filter(p => Number.isFinite(p.v));
    if (own.length < 2) return `<p class="muted small">Ta gmina ma dane tylko z ${own.length ? own[0].y + " r." : "żadnego roku"}.</p>`;
    const showMed = !def.descriptive && !other;
    const oth = pts.filter(p => Number.isFinite(p.o)).map(p => ({ y: p.y, v: p.o }));
    const vals = own.map(p => p.v).concat(showMed ? pts.map(p => p.m).filter(Number.isFinite) : [], oth.map(p => p.v));
    let lo = Math.min(...vals), hi = Math.max(...vals); if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const W = 320, H = 132, L = 4, R = 4, T = 16, B = 18, y0 = pts[0].y, y1 = pts.at(-1).y;
    const X = y => L + (y1 === y0 ? 0 : (y - y0) / (y1 - y0) * (W - L - R)), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    const path = arr => arr.map((p, n) => `${n ? "L" : "M"}${X(p.y).toFixed(1)},${Y(p.v ?? p.m).toFixed(1)}`).join("");
    const medPts = pts.filter(p => Number.isFinite(p.m)).map(p => ({ y: p.y, v: p.m }));
    const first = own[0], last = own.at(-1), d = def.digits ?? 1;
    const ch = last.v - first.v, rel = first.v ? ch / Math.abs(first.v) * 100 : null;
    const chText = def.unit === "%" ? `${ch >= 0 ? "+" : ""}${fmt(ch, d)} pkt proc.` : `${ch >= 0 ? "+" : ""}${fmt(ch, d)}${def.unit ? " " + esc(def.unit) : ""}${rel !== null && Number.isFinite(rel) ? ` (${rel >= 0 ? "+" : ""}${fmt(rel, 1)}%)` : ""}`;
    const ticks = [y0, Math.round((y0 + y1) / 2), y1].filter((y, n, a) => a.indexOf(y) === n);
    // value axis: 3-4 round gridlines inside the plot, labelled at the left edge
    const raw = (hi - lo) / 3, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(f => f >= raw) || raw;
    const gd = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + (Math.abs(step / mag - 2.5) < 1e-9 ? 1 : 0));
    const grid = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) grid.push(+v.toFixed(10));
    // minimum and maximum of the gmina's own series, labelled at their year (labels drawn last, with a white halo)
    const mx = own.reduce((a, p) => p.v > a.v ? p : a), mn = own.reduce((a, p) => p.v < a.v ? p : a);
    const anchor = y => X(y) < 60 ? "start" : X(y) > W - 60 ? "end" : "middle";
    const marks = [], busy = []; // left-edge label positions, so gridline labels do not overlap them
    const lab = (p, up, txt, cls) => {
      const ty = up ? Y(p.v) - 7 : Y(p.v) + 13;
      if (anchor(p.y) === "start") busy.push(ty);
      return `<text x="${X(p.y).toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor(p.y)}" class="ih-lab ${cls}">${txt}</text>`;
    };
    if (mx.v !== mn.v) {
      marks.push(lab(mx, true, `max ${fmt(mx.v, d)} (${mx.y})`, "ih-max"));
      marks.push(lab(mn, false, `min ${fmt(mn.v, d)} (${mn.y})`, "ih-min"));
    }
    if (last !== mx && last !== mn) marks.push(lab(last, last.v >= own.at(-2).v, fmt(last.v, d), "ih-val"));
    return `<svg viewBox="0 0 ${W} ${H}" class="ih-svg" role="img" aria-label="${esc(def.label)} w latach ${y0}–${y1}, od ${fmt(mn.v, d)} (${mn.y}) do ${fmt(mx.v, d)} (${mx.y})">
      ${grid.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="ih-grid"/>`).join("")}
      <line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="ih-axis"/>
      ${ticks.map(y => `<text x="${X(y)}" y="${H - 4}" text-anchor="${y === y0 ? "start" : y === y1 ? "end" : "middle"}">${y}</text>`).join("")}
      ${showMed && medPts.length > 1 ? `<path d="${path(medPts)}" class="ih-med"/>` : ""}
      ${oth.length > 1 ? `<path d="${path(oth)}" class="ih-oth"/>` : ""}
      <path d="${path(own)}" class="ih-own"/>
      ${own.map(p => `<circle cx="${X(p.y).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${p === mx || p === mn ? 3.4 : 2.6}" class="ih-dot${p === mx || p === mn ? " ih-ext" : ""}"><title>${p.y}: ${fmt(p.v, d)} ${esc(def.unit || "")}</title></circle>`).join("")}
      ${grid.filter(v => !busy.some(b => Math.abs(b - (Y(v) - 2.5)) < 11)).map(v => `<text x="${L + 1}" y="${(Y(v) - 2.5).toFixed(1)}" class="ih-lab ih-gl">${fmt(v, gd)}</text>`).join("")}
      ${marks.join("")}
    </svg>
    <p class="ih-note"><span><i class="ih-k-own"></i>${esc(current.n || "gmina")}</span>${showMed ? `<span><i class="ih-k-med"></i>mediana gmin w Polsce</span>` : ""}${other ? `<span><i class="ih-k-oth"></i>${esc(other.n)}${oth.length ? "" : " (brak danych)"}</span>` : ""}<span>${first.y}–${last.y}: <b>${chText}</b></span></p>
    ${level5 ? `<p class="muted small">Dane powiatu przypisane gminie.</p>` : ""}
    <div class="ih-tools"><label class="ih-cmp"><span>Porównaj z gminą</span><input type="search" data-ih-q placeholder="${other ? esc(other.n) : "wpisz nazwę gminy"}" autocomplete="off"></label>${other ? `<button type="button" class="ih-link" data-ih-clear>Bez porównania</button>` : ""}<button type="button" class="ih-link" data-ih-csv>Pobierz CSV</button></div>
    <div class="ih-found" data-ih-found></div>`;
  }

  function csv(def, k) {
    const s = window.GusClient.series(def.key), i = s.index.get(k), i2 = other ? s.index.get(other.k) : undefined, med = median(def.key, s);
    const q = x => `"${String(x).replace(/"/g, '""')}"`, n = x => Number.isFinite(x) ? String(x).replace(".", ",") : "";
    const head = ["rok", current.n || k, ...(other ? [other.n] : []), "mediana gmin w Polsce"].map(q).join(";");
    const rows = s.years.map((y, j) => ({ y, j })).sort((a, b) => a.y - b.y)
      .map(({ y, j }) => [y, n(s.values[j][i]), ...(other ? [n(i2 === undefined ? null : s.values[j][i2])] : []), n(med[j])].join(";"));
    const text = "﻿" + [`${q(def.label)};${q(def.unit || "")};${q("Źródło: " + (def.source || "GUS BDL"))}`, head, ...rows].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = `${def.key}_${(current.n || k).replace(/[^\p{L}\d]+/gu, "_")}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function draw(box, def, k) { box.innerHTML = chart(def, k); }
  function wire(box, def, k) {
    let t = 0;
    box.addEventListener("input", e => {
      const inp = e.target.closest("[data-ih-q]"); if (!inp) return;
      clearTimeout(t); t = setTimeout(async () => {
        const found = box.querySelector("[data-ih-found]");
        const r = inp.value.trim().length < 2 ? [] : await window.PLOTS_GMINY.search(inp.value);
        found.innerHTML = r.filter(x => x.data.k !== k).slice(0, 5).map(x => `<button type="button" data-ih-pick="${esc(x.data.k)}" data-n="${esc(x.data.n)}"><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></button>`).join("");
      }, 200);
    });
    box.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.ihPick) { other = { k: b.dataset.ihPick, n: b.dataset.n }; draw(box, def, k); }
      else if (b.hasAttribute("data-ih-clear")) { other = null; draw(box, def, k); }
      else if (b.hasAttribute("data-ih-csv")) csv(def, k);
    });
  }

  async function toggle(btn, def, k, name) {
    const card = btn.closest("article"); if (!card) return;
    let box = card.querySelector(".ind-hist");
    if (box) { box.remove(); btn.setAttribute("aria-expanded", "false"); return; }
    if (current.k !== k) other = null; // the comparison gmina stays for other indicators of the same gmina
    current = { k, n: name };
    box = document.createElement("div"); box.className = "ind-hist"; box.innerHTML = `<p class="muted small">Wczytuję dane z wielu lat…</p>`;
    card.appendChild(box); btn.setAttribute("aria-expanded", "true"); wire(box, def, k);
    await window.GusClient.history(def.key);
    if (box.isConnected) draw(box, def, k);
  }

  window.IndHistory = { available, toggle, chart };
})();
