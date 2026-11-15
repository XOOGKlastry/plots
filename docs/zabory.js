/* Zabory na mapie Polski: dawne granice z 1914 r. i analiza, czy wskaźnik „widać zaborami”.
   Dane: data/zabory.json (gmina -> zabór wg granic OpenHistoricalMap; generator mapgen/zabory/zabory.py).
   Miara: epsilon² Kruskala-Wallisa na rangach, czyli jaka część różnic między gminami przypada na różnice między zaborami. */
(function () {
  "use strict";
  const app = window.PLOTS, map = app.map, esc = app.esc, S = window.StatsModel;
  const $ = s => document.querySelector(s);
  const icon = (n, c = "") => `<svg class="ic ${c}" aria-hidden="true"><use href="icons/phosphor.svg#${n}"/></svg>`;
  const NAME = { ros: "rosyjski", pru: "pruski", aus: "austriacki" };
  const COLOR = { ros: "#c92a2a", pru: "#1c4fa1", aus: "#e8a317" };
  const STRONG = 0.15, WEAK = 0.06;
  let data = null, on = false, last = null, ranking = null;
  const load = () => data || (data = fetch("data/zabory.json").then(r => r.ok ? r.json() : null).catch(() => null));

  /* Share of the differences between gminy explained by the partition (rank-based, 0..1). */
  function effect(values, Z) {
    const rows = [];
    for (const [k, o] of values) { const z = Z[k]; if (z && Number.isFinite(o.value)) rows.push([o.value, z[0]]); }
    const n = rows.length; if (n < 100) return null;
    rows.sort((a, b) => a[0] - b[0]);
    const rank = new Float64Array(n);
    for (let i = 0; i < n;) { let j = i; while (j + 1 < n && rows[j + 1][0] === rows[i][0]) j++; for (let t = i; t <= j; t++) rank[t] = (i + j) / 2 + 1; i = j + 1; }
    const sum = {}, cnt = {};
    rows.forEach((r, i) => { sum[r[1]] = (sum[r[1]] || 0) + rank[i]; cnt[r[1]] = (cnt[r[1]] || 0) + 1; });
    let h = 0; const mid = (n + 1) / 2;
    for (const z in sum) h += cnt[z] * (sum[z] / cnt[z] - mid) ** 2;
    h *= 12 / (n * (n + 1));
    return Math.max(0, Math.min(1, h / (n - 1)));
  }
  function medians(values, Z) {
    const g = { ros: [], aus: [], pru1: [], pru0: [] };
    for (const [k, o] of values) { const z = Z[k]; if (!z || !Number.isFinite(o.value)) continue; g[z[0] === "pru" ? "pru" + z[2] : z[0]].push(o.value); }
    const med = a => { if (!a.length) return null; a.sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    return Object.fromEntries(Object.entries(g).map(([k, a]) => [k, { m: med(a), n: a.length }]));
  }

  function layers(d) {
    if (!map.getSource("zabory-lines")) {
      map.addSource("zabory-lines", { type: "geojson", data: d.granice, attribution: "Granice 1914: OpenHistoricalMap" });
      const lp = (() => { const out = { type: "FeatureCollection", features: [] };
        for (const f of d.obszary.features) { // label at the middle of the largest part
          const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
          const big = polys.map(p => p[0]).sort((a, b) => b.length - a.length)[0];
          const xs = big.map(c => c[0]).sort((a, b) => a - b), ys = big.map(c => c[1]).sort((a, b) => a - b);
          const pos = { ros: [21.2, 52.0], pru: [16.9, 52.9], aus: [21.0, 49.9] }[f.properties.z] || [xs[xs.length >> 1], ys[ys.length >> 1]];
          out.features.push({ type: "Feature", properties: { t: "Zabór " + NAME[f.properties.z] }, geometry: { type: "Point", coordinates: pos } });
        } return out; })();
      map.addSource("zabory-labels", { type: "geojson", data: lp });
    }
    const font = map.getStyle().layers.find(l => l.type === "symbol" && l.layout?.["text-font"])?.layout["text-font"] || ["Noto Sans Regular"];
    if (!map.getLayer("zabory-case")) map.addLayer({ id: "zabory-case", type: "line", source: "zabory-lines", filter: ["==", ["get", "t"], "1914"], paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 4.5, 9, 8], "line-opacity": 0.9 } });
    if (!map.getLayer("zabory-1939")) map.addLayer({ id: "zabory-1939", type: "line", source: "zabory-lines", filter: ["==", ["get", "t"], "1939"], paint: { "line-color": "#111318", "line-opacity": 0.75, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.3, 9, 2.2], "line-dasharray": [2, 1.6] } });
    if (!map.getLayer("zabory-line")) map.addLayer({ id: "zabory-line", type: "line", source: "zabory-lines", filter: ["==", ["get", "t"], "1914"], paint: { "line-color": "#111318", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 2.2, 9, 4] } });
    if (!map.getLayer("zabory-label")) map.addLayer({ id: "zabory-label", type: "symbol", source: "zabory-labels", layout: { "text-field": ["get", "t"], "text-font": font, "text-size": ["interpolate", ["linear"], ["zoom"], 5, 13, 8, 18], "text-letter-spacing": 0.08, "text-transform": "uppercase", "text-allow-overlap": true }, paint: { "text-color": "#111318", "text-halo-color": "#ffffff", "text-halo-width": 2.2 } });
  }
  function show(v) {
    on = v;
    for (const id of ["zabory-case", "zabory-1939", "zabory-line", "zabory-label"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
  }
  async function toggle(v = !on) {
    const d = await load(); if (!d) { app.toast("Dane zaborów są chwilowo niedostępne"); return; }
    if (v) layers(d);
    show(v); if (last) render(last);
  }

  async function render(detail) {
    last = detail;
    const box = $("#statsZabory"); if (!box) return;
    const d = await load(); if (!d || last !== detail) { box.innerHTML = ""; return; }
    const Z = d.gminy, e = effect(detail.values, Z), M = medians(detail.values, Z), def = detail.def;
    const pct = e == null ? null : Math.round(e * 100);
    const level = e == null ? "" : e >= STRONG ? "strong" : e >= WEAK ? "weak" : "none";
    const verdict = e == null ? "Za mało gmin z danymi, żeby to ocenić." : level === "strong" ? `Widać zabory: przypada na nie <b>${pct}%</b> różnic między gminami.` : level === "weak" ? `Zabory widać słabo: <b>${pct}%</b> różnic między gminami.` : `Tu zabory prawie nie mają znaczenia (${pct}% różnic).`;
    const vals = Object.values(M).map(x => x.m).filter(Number.isFinite), lo = Math.min(0, ...vals), hi = Math.max(...vals, 1e-9);
    const row = (key, label, color) => { const x = M[key]; if (!x?.n) return ""; const w = Math.max(2, ((x.m - lo) / (hi - lo || 1)) * 100);
      return `<li><span><i style="background:${color}"></i>${label}<small>${x.n.toLocaleString("pl-PL")} gmin</small></span><em><s style="width:${w.toFixed(1)}%;background:${color}"></s></em><b>${esc(S.format(x.m, def.digits))}</b></li>`; };
    const sel = detail.selectedId && Z[detail.selectedId];
    const selName = sel ? (window.StatsMap.gminy().find(g => g.k === detail.selectedId)?.n || "") : "";
    box.innerHTML = `<div class="zab-head${level === "strong" ? " is-strong" : ""}">${icon("zabory", "zab-ic")}<div><b>Zabory</b><p>${verdict}</p></div>
        <button type="button" class="zab-btn${level === "strong" && !on ? " is-suggested" : ""}" data-zab-toggle aria-pressed="${on}">${on ? "Ukryj zabory" : "Pokaż zabory"}</button></div>
      <ol class="zab-med" aria-label="Mediana wskaźnika w zaborach">${row("ros", "Rosyjski", COLOR.ros)}${row("aus", "Austriacki", COLOR.aus)}${row("pru1", "Pruski, w II RP", COLOR.pru)}${row("pru0", "Pruski, Niemcy do 1945", "#6d8fd0")}</ol>
      ${sel ? `<p class="zab-sel">${esc(selName)}: zabór ${NAME[sel[0]]}${sel[0] === "pru" ? (sel[2] ? ", w II RP" : ", w Niemczech do 1945") : ""}${sel[1] < 90 ? ` (granica przecinała gminę, ${sel[1]}% powierzchni)` : ""}.</p>` : ""}
      <button type="button" class="zab-more" data-zab-rank>${icon("chart-bar")}Gdzie najbardziej widać zabory?</button><div id="zabRank"></div>
      <p class="zab-src">Mediana wartości gmin w każdym zaborze. Przypisanie wg granic z 1914 r. (<a href="https://www.openhistoricalmap.org/" target="_blank" rel="noopener noreferrer">OpenHistoricalMap</a>), gmina tam, gdzie leży większość jej powierzchni. Linia przerywana: granica polsko-niemiecka 1922–1939.</p>`;
    if (ranking) drawRank();
  }

  /* All indicators ranked by how strongly the partition shows; computed once, on demand. */
  async function buildRank() {
    const d = await load(); if (!d) return;
    const out = [];
    const list = window.StatsMap.defs();
    for (let i = 0; i < list.length; i++) {
      const def = list[i], e = effect(window.StatsMap.series(def), d.gminy);
      if (e != null) out.push([def, e]);
      if (i % 40 === 39) await new Promise(r => setTimeout(r));
    }
    ranking = out.sort((a, b) => b[1] - a[1]);
  }
  function drawRank() {
    const el = $("#zabRank"); if (!el || !ranking) return;
    const top = ranking.filter(x => x[1] >= STRONG);
    el.innerHTML = `<p class="zab-src">${top.length} z ${ranking.length} wskaźników wyraźnie pokazuje zabory (co najmniej ${Math.round(STRONG * 100)}% różnic). Kliknij, aby zobaczyć mapę.</p><ol class="zab-rank">${ranking.slice(0, 15).map(([def, e]) => `<li><button type="button" data-zab-show="${esc(def.key)}"><span>${esc(def.label)}<small>${esc(def.category)}</small></span><b>${Math.round(e * 100)}%</b></button></li>`).join("")}</ol>`;
  }

  document.addEventListener("stats:render", e => render(e.detail));
  document.addEventListener("stats:close", () => show(false));
  document.addEventListener("click", async e => {
    if (e.target.closest("[data-zab-toggle]")) { toggle(); return; }
    if (e.target.closest("[data-zab-rank]")) {
      const el = $("#zabRank"); if (!ranking) { el.innerHTML = `<p class="zab-src">Liczę dla wszystkich wskaźników…</p>`; await buildRank(); }
      drawRank(); return;
    }
    const b = e.target.closest("[data-zab-show]");
    if (b) { if (!on) await toggle(true); window.StatsMap.open(b.dataset.zabShow, { keepView: true }); }
  });
  window.Zabory = { toggle, effect };
})();
