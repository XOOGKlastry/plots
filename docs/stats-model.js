/* Choropleth rules shared by the browser and node:test: palettes, class breaks, number formatting. */
(function (root) {
  "use strict";
  // Sequential palettes run from low to high values. Sources: CARTOColors and matplotlib (viridis, magma).
  const palettes = {
    zachod: { label: "Zachód słońca", colors: ["#fcde9c", "#faa476", "#f0746e", "#e34f6f", "#dc3977", "#b9257a", "#7c1d6f"] },
    viridis: { label: "Viridis", colors: ["#fde725", "#a0da39", "#4ac16d", "#1fa187", "#277f8e", "#365c8d", "#46327e"] },
    ocean: { label: "Ocean", colors: ["#f7feae", "#b7e6a5", "#7ccba2", "#46aea0", "#089099", "#00718b", "#045275"] },
    las: { label: "Las", colors: ["#d3f2a3", "#97e196", "#6cc08b", "#4c9b82", "#217a79", "#105965", "#074050"] },
    lawenda: { label: "Lawenda", colors: ["#f3e0f7", "#e4c7f1", "#d1afe8", "#b998dd", "#9f82ce", "#826dba", "#63589f"] },
    brzoskwinia: { label: "Brzoskwinia", colors: ["#fef6b5", "#ffdd9a", "#ffc285", "#ffa679", "#fa8a76", "#f16d7a", "#e15383"] },
    magma: { label: "Magma", colors: ["#fcfdbf", "#feb078", "#f1605d", "#b73779", "#721f81", "#2c115f", "#000004"] },
    kontrast: { label: "Kontrast (±)", diverging: true, colors: ["#009392", "#39b185", "#9ccb86", "#e9e29c", "#eeb479", "#e88471", "#cf597e"] }
  };
  const categoryPalette = { "Ludność": "lawenda", "Finanse i firmy": "viridis", "Warunki życia": "ocean", "Energia i ciepło": "zachod", "Infrastruktura": "ocean", "Planowanie": "brzoskwinia", "Edukacja i kultura": "lawenda", "Środowisko": "las", "Przegląd": "viridis" };
  const NODATA = "#d9dae0";

  function quantiles(sorted, n) {
    const out = [];
    for (let i = 1; i < n; i++) out.push(sorted[Math.min(sorted.length - 1, Math.floor((i * sorted.length) / n))]);
    return out;
  }
  function unique(list) { return list.filter((v, i) => i === 0 || v !== list[i - 1]); }

  /* values: array of numbers (non-finite ignored). Returns {breaks, colors, diverging}.
     A value v belongs to class i = number of breaks <= v. */
  function classify(values, options = {}) {
    const n = options.classes || 7, method = options.method || "quantile";
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    const palette = palettes[options.palette] || palettes.viridis;
    let colors = palette.colors.slice();
    if (options.reverse) colors.reverse();
    if (!sorted.length) return { breaks: [], colors: [], diverging: false, min: null, max: null, count: 0 };
    const min = sorted[0], max = sorted[sorted.length - 1];
    const diverging = !!options.diverging && min < 0 && max > 0;
    let breaks;
    if (diverging) {
      // Separate quantiles below and above zero keep zero as a visible class boundary.
      const neg = sorted.filter(v => v < 0), pos = sorted.filter(v => v > 0), zeros = sorted.length - neg.length - pos.length;
      const negBreaks = unique(quantiles(neg, 3)).filter(b => b < 0), posBreaks = unique(quantiles(pos, 3)).filter(b => b > pos[0]);
      // Exact zeros (no change) get their own neutral class between the negative and positive ones.
      breaks = [...negBreaks, 0, ...(zeros ? [pos[0]] : []), ...posBreaks];
      const base = (options.palette && palettes[options.palette]?.diverging ? colors : (options.reverse ? palettes.kontrast.colors.slice().reverse() : palettes.kontrast.colors));
      const below = negBreaks.length + 1, above = posBreaks.length + 1;
      colors = [...base.slice(3 - below, 3), ...(zeros ? [base[3]] : []), ...base.slice(4, 4 + above)];
      return { breaks, colors, diverging, min, max, count: sorted.length, zeroClass: zeros ? below : -1 };
    } else if (method === "equal" && max > min) {
      breaks = Array.from({ length: n - 1 }, (_, i) => min + ((max - min) * (i + 1)) / n);
    } else {
      breaks = unique(quantiles(sorted, n));
      if (breaks[0] === min && breaks.length > 1) breaks = breaks.slice(1);
    }
    if (!diverging) {
      const k = breaks.length + 1;
      colors = Array.from({ length: k }, (_, i) => colors[k === 1 ? colors.length - 1 : Math.round((i * (colors.length - 1)) / (k - 1))]);
    }
    return { breaks, colors, diverging, min, max, count: sorted.length };
  }
  function classOf(value, breaks) {
    if (!Number.isFinite(value)) return -1;
    let i = 0;
    while (i < breaks.length && value >= breaks[i]) i++;
    return i;
  }
  function colorOf(value, scheme) { const i = classOf(value, scheme.breaks); return i < 0 ? NODATA : scheme.colors[i]; }

  function format(value, digits = 1) {
    if (!Number.isFinite(value)) return "—";
    const abs = Math.abs(value), opts = n => ({ maximumFractionDigits: n });
    if (abs >= 1e6) return (value / 1e6).toLocaleString("pl-PL", opts(1)) + " mln";
    if (abs >= 1e5) return (value / 1e3).toLocaleString("pl-PL", opts(0)) + " tys.";
    if (abs >= 1e4) return (value / 1e3).toLocaleString("pl-PL", opts(1)) + " tys.";
    return value.toLocaleString("pl-PL", opts(abs >= 100 ? 0 : digits));
  }
  function legend(scheme, values, digits) {
    const counts = new Array(scheme.colors.length).fill(0);
    for (const v of values) { const i = classOf(v, scheme.breaks); if (i >= 0) counts[i]++; }
    return scheme.colors.map((color, i) => {
      const lo = i === 0 ? scheme.min : scheme.breaks[i - 1], hi = i === scheme.colors.length - 1 ? scheme.max : scheme.breaks[i];
      return { color, from: lo, to: hi, count: counts[i], label: i === scheme.zeroClass ? "0 (bez zmiany)" : `${format(lo, digits)} – ${format(hi, digits)}` };
    });
  }
  function histogram(values, bins = 28) {
    const v = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!v.length) return [];
    // Clip the tails (1%-99%) so a few extreme towns do not flatten the picture.
    const lo = v[Math.floor(v.length * 0.01)], hi = v[Math.ceil(v.length * 0.99) - 1];
    if (hi <= lo) return [{ from: lo, to: hi, count: v.length }];
    const step = (hi - lo) / bins, out = Array.from({ length: bins }, (_, i) => ({ from: lo + i * step, to: lo + (i + 1) * step, count: 0 }));
    for (const x of v) out[Math.max(0, Math.min(bins - 1, Math.floor((x - lo) / step)))].count++;
    return out;
  }
  const api = { palettes, categoryPalette, NODATA, classify, classOf, colorOf, format, legend, histogram };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.StatsModel = api;
})(typeof window !== "undefined" ? window : globalThis);
