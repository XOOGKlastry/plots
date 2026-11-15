/* Podziały na mapie Polski: czy wskaźnik „widać” zaborami, podziałem na miasta i wsie, miastami wojewódzkimi (obecnymi i dawnymi) albo małymi miastami.
   Dane: data/zabory.json (gmina -> zabór wg granic OpenHistoricalMap; generator mapgen/zabory/zabory.py), dawne-woj.js (siedziby województw),
   typ gminy i ludność z karty gminy.
   Miary na rangach: dla podziału na kilka grup epsilon² Kruskala-Wallisa (jaka część różnic między gminami przypada na różnice między grupami),
   dla jednej grupy (np. 18 miast wojewódzkich) prawdopodobieństwo, że gmina z grupy ma wyższą wartość niż gmina spoza niej (AUC). */
(function () {
  "use strict";
  const app = window.PLOTS, map = app.map, esc = app.esc, S = window.StatsModel;
  const $ = s => document.querySelector(s);
  const icon = (n, c = "") => `<svg class="ic ${c}" aria-hidden="true"><use href="icons/phosphor.svg#${n}"/></svg>`;
  const NAME = { ros: "rosyjski", pru: "pruski", aus: "austriacki" };
  const COLOR = { ros: "#c92a2a", pru: "#1c4fa1", aus: "#e8a317" };
  const MULTI = [0.15, 0.06], BIN = [0.7, 0.5]; // strong / weak: epsilon², |2·AUC − 1|
  const DW = window.DawneWoj || { dawne: {}, obecne: [] };
  let data = null, last = null, ranking = null, sel = null, overlay = null, rankFactor = null, sets = null;
  const load = () => data || (data = fetch("data/zabory.json").then(r => r.ok ? r.json() : null).catch(() => null));

  const TYP = { "gmina miejska": "m", "gmina miejsko-wiejska": "mw", "gmina wiejska": "w" };
  function groups() {
    if (sets) return sets;
    const g = window.StatsMap.gminy() || [], typ = {}, pop = {}, male = new Set();
    for (const x of g) { typ[x.k] = TYP[x.typ]; pop[x.k] = x.ludnosc; if (TYP[x.typ] === "m" && x.ludnosc > 0 && x.ludnosc < 20000) male.add(x.k); }
    sets = { typ, pop, male, woj: new Set(DW.obecne), dawne: new Set(Object.keys(DW.dawne)), ref: {} };
    // Cities are compared with gminy of similar size, otherwise every count (libraries, parcel lockers) just shows population.
    const range = set => { const p = [...set].map(k => pop[k]).filter(v => v > 0); return [Math.min(...p) * 0.8, Math.max(...p) * 1.25]; };
    const pick = (set, [lo, hi], ok = () => true) => new Set(g.filter(x => !set.has(x.k) && x.ludnosc >= lo && x.ludnosc <= hi && ok(x)).map(x => x.k));
    const rw = range(sets.woj), rd = range(sets.dawne), rm = range(male);
    sets.ref.woj = pick(sets.woj, [rw[0], Infinity]); sets.lo = { woj: rw[0] };
    sets.ref.dawne = pick(new Set([...sets.dawne, ...sets.woj]), rd, x => TYP[x.typ] !== "w"); sets.lo.dawne = rd;
    sets.ref.male = pick(male, rm); sets.lo.male = rm;
    return sets;
  }
  const FACTORS = [
    { id: "zab", name: "Zabory", verdict: "Widać zabory", kind: "multi", of: (k, Z) => Z[k]?.[0],
      rows: [["ros", "Rosyjski", COLOR.ros], ["aus", "Austriacki", COLOR.aus], ["pru1", "Pruski, w II RP", COLOR.pru], ["pru0", "Pruski, Niemcy do 1945", "#6d8fd0"]],
      sub: (k, Z) => { const z = Z[k]; return z && (z[0] === "pru" ? "pru" + z[2] : z[0]); } },
    { id: "typ", name: "Miasta i wsie", verdict: "Widać podział na miasta i wsie", kind: "multi", of: k => sets.typ[k],
      rows: [["m", "Gminy miejskie", "#5f3dc4"], ["mw", "Miejsko-wiejskie", "#1098ad"], ["w", "Wiejskie", "#5c940d"]] },
    { id: "woj", name: "Miasta wojewódzkie", verdict: "Widać tylko miasta wojewódzkie", kind: "bin", set: () => sets.woj, label: "18 siedzib województw",
      refLabel: () => `inne gminy od ${tys(sets.lo.woj)} mieszk.` },
    { id: "dawne", name: "Byłe miasta wojewódzkie", verdict: "Widać byłe miasta wojewódzkie", kind: "bin", set: () => sets.dawne, label: "31 dawnych stolic (1975–1998)",
      refLabel: () => `inne miasta ${tys(sets.lo.dawne[0])}–${tys(sets.lo.dawne[1])} mieszk.` },
    { id: "male", name: "Małe miasta", verdict: "Widać tylko małe miasta", kind: "bin", set: () => sets.male, label: "gminy miejskie do 20 tys. mieszkańców",
      refLabel: () => `inne gminy do ${tys(sets.lo.male[1])} mieszk.` }
  ];

  const tys = v => v >= 1e4 ? `${Math.round(v / 1e3)} tys.` : Math.round(v).toLocaleString("pl-PL");
  /* Spearman correlation of the indicator with population: above SIZE the city comparisons only repeat "big towns have more". */
  const SIZE = 0.75;
  function sizeDriven(R) {
    const P = R.map(([k], i) => [i, sets.pop[k]]).filter(x => x[1] > 0).sort((a, b) => a[1] - b[1]);
    const n = P.length; if (n < 100) return false;
    let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
    P.forEach(([i], j) => { const x = R[i][1], y = j + 1; sx += x; sy += y; sxy += x * y; sxx += x * x; syy += y * y; });
    const r = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
    return r > SIZE;
  }
  /* Ranks of all gminy with a value: [[k, rank]], ties get the mean rank. */
  function ranked(values) {
    const rows = [];
    for (const [k, o] of values) if (Number.isFinite(o.value)) rows.push([k, o.value]);
    rows.sort((a, b) => a[1] - b[1]);
    const n = rows.length, out = new Array(n);
    for (let i = 0; i < n;) { let j = i; while (j + 1 < n && rows[j + 1][1] === rows[i][1]) j++; for (let t = i; t <= j; t++) out[t] = [rows[t][0], (i + j) / 2 + 1]; i = j + 1; }
    return out; // ranks are monotone in the value, so they also order the city comparisons
  }
  /* Strength of one factor: {e, norm, level, auc?}. */
  function measure(f, R, Z, size) {
    if (f.kind === "multi") {
      const sum = {}, cnt = {}; let n = 0;
      for (const [k, r] of R) { const gr = f.of(k, Z); if (!gr) continue; sum[gr] = (sum[gr] || 0) + r; cnt[gr] = (cnt[gr] || 0) + 1; n++; }
      if (n < 100 || Object.keys(cnt).length < 2) return null;
      // ranks restricted to gminy in a group; R covers nearly all of them, so the mean rank is used as is
      let h = 0; const all = Object.values(sum).reduce((a, b) => a + b, 0) / n;
      for (const gr in sum) h += cnt[gr] * (sum[gr] / cnt[gr] - all) ** 2;
      h *= 12 / (n * (n + 1));
      const e = Math.max(0, Math.min(1, h / (n - 1)));
      return { e, norm: e / MULTI[0], level: e >= MULTI[0] ? "strong" : e >= MULTI[1] ? "weak" : "none" };
    }
    if (size) return { e: 0, norm: 0, level: "size" };
    const set = f.set(), ref = sets.ref[f.id], rr = [];
    for (const [k, v] of R) if (set.has(k)) rr.push([v, 1]); else if (ref.has(k)) rr.push([v, 0]);
    rr.sort((a, b) => a[0] - b[0]);
    let r1 = 0, n1 = 0;
    for (let i = 0; i < rr.length;) { let j = i; while (j + 1 < rr.length && rr[j + 1][0] === rr[i][0]) j++; for (let t = i; t <= j; t++) if (rr[t][1]) { r1 += (i + j) / 2 + 1; n1++; } i = j + 1; }
    const n0 = rr.length - n1;
    if (n1 < 8 || n0 < 12) return null;
    const auc = (r1 - n1 * (n1 + 1) / 2) / (n1 * n0), e = Math.abs(2 * auc - 1);
    return { e, auc, norm: e / BIN[0], level: e >= BIN[0] ? "strong" : e >= BIN[1] ? "weak" : "none" };
  }
  const say = (f, m) => m.level === "size" ? "zależy od wielkości gminy" : f.kind === "multi" ? `${Math.round(m.e * 100)}% różnic` : m.auc >= 0.5 ? `wyżej niż ${Math.round(m.auc * 100)}% podobnych gmin` : `niżej niż ${Math.round((1 - m.auc) * 100)}% podobnych gmin`;
  function medians(values, f, Z) {
    const g = {};
    const add = (key, v) => (g[key] || (g[key] = [])).push(v);
    for (const [k, o] of values) {
      if (!Number.isFinite(o.value)) continue;
      if (f.kind === "bin") { if (f.set().has(k)) add("in", o.value); else if (sets.ref[f.id].has(k)) add("out", o.value); }
      else { const key = f.sub ? f.sub(k, Z) : f.of(k, Z); if (key) add(key, o.value); }
    }
    const med = a => { a.sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    return Object.fromEntries(Object.entries(g).map(([k, a]) => [k, { m: med(a), n: a.length }]));
  }

  /* --- map overlays: partition lines, or an outline of the chosen group of gminy --- */
  function zabLayers(d) {
    if (!map.getSource("zabory-lines")) {
      map.addSource("zabory-lines", { type: "geojson", data: d.granice, attribution: "Granice 1914: OpenHistoricalMap" });
      const pos = { ros: [21.2, 52.0], pru: [16.9, 52.9], aus: [21.0, 49.9] };
      map.addSource("zabory-labels", { type: "geojson", data: { type: "FeatureCollection", features: Object.entries(pos).map(([z, c]) => ({ type: "Feature", properties: { t: "Zabór " + NAME[z] }, geometry: { type: "Point", coordinates: c } })) } });
    }
    const font = map.getStyle().layers.find(l => l.type === "symbol" && l.layout?.["text-font"])?.layout["text-font"] || ["Noto Sans Regular"];
    if (!map.getLayer("zabory-case")) map.addLayer({ id: "zabory-case", type: "line", source: "zabory-lines", filter: ["==", ["get", "t"], "1914"], paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 4.5, 9, 8], "line-opacity": 0.9 } });
    if (!map.getLayer("zabory-1939")) map.addLayer({ id: "zabory-1939", type: "line", source: "zabory-lines", filter: ["==", ["get", "t"], "1939"], paint: { "line-color": "#111318", "line-opacity": 0.75, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.3, 9, 2.2], "line-dasharray": [2, 1.6] } });
    if (!map.getLayer("zabory-line")) map.addLayer({ id: "zabory-line", type: "line", source: "zabory-lines", filter: ["==", ["get", "t"], "1914"], paint: { "line-color": "#111318", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 2.2, 9, 4] } });
    if (!map.getLayer("zabory-label")) map.addLayer({ id: "zabory-label", type: "symbol", source: "zabory-labels", layout: { "text-field": ["get", "t"], "text-font": font, "text-size": ["interpolate", ["linear"], ["zoom"], 5, 13, 8, 18], "text-letter-spacing": 0.08, "text-transform": "uppercase", "text-allow-overlap": true }, paint: { "text-color": "#111318", "text-halo-color": "#ffffff", "text-halo-width": 2.2 } });
  }
  function groupLayer(keys) {
    if (!map.getSource("stats-gminy")) return;
    const filter = ["in", ["get", "k"], ["literal", keys]];
    if (!map.getLayer("podzial-case")) {
      map.addLayer({ id: "podzial-case", type: "line", source: "stats-gminy", filter, paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3.4, 9, 6] } });
      map.addLayer({ id: "podzial-line", type: "line", source: "stats-gminy", filter, paint: { "line-color": "#111318", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.6, 9, 3] } });
    }
    map.setFilter("podzial-case", filter); map.setFilter("podzial-line", filter);
  }
  function hideAll() {
    for (const id of ["zabory-case", "zabory-1939", "zabory-line", "zabory-label", "podzial-case", "podzial-line"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
  }
  async function setOverlay(id) {
    overlay = id; hideAll(); if (!id) return;
    if (id === "zab") {
      const d = await load(); if (!d) { app.toast("Dane zaborów są chwilowo niedostępne"); return; }
      zabLayers(d); for (const l of ["zabory-case", "zabory-1939", "zabory-line", "zabory-label"]) map.setLayoutProperty(l, "visibility", "visible");
      return;
    }
    const f = FACTORS.find(x => x.id === id);
    const keys = f.kind === "bin" ? [...f.set()] : Object.keys(sets.typ).filter(k => sets.typ[k] === "m");
    groupLayer(keys); for (const l of ["podzial-case", "podzial-line"]) map.setLayoutProperty(l, "visibility", "visible");
  }

  /* --- panel card --- */
  function selLine(k, Z) {
    if (!k) return "";
    const g = window.StatsMap.gminy().find(x => x.k === k); if (!g) return "";
    const z = Z[k], bits = [];
    if (z) bits.push(`zabór ${NAME[z[0]]}${z[0] === "pru" ? (z[2] ? ", w II RP" : ", w Niemczech do 1945") : ""}${z[1] < 90 ? ` (granica przecinała gminę, ${z[1]}% powierzchni)` : ""}`);
    if (sets.woj.has(k)) bits.push("miasto wojewódzkie");
    if (DW.dawne[k]) bits.push(`kiedyś stolica województwa ${DW.dawne[k][0]}`);
    if (sets.male.has(k)) bits.push("małe miasto");
    return `<p class="zab-sel">${esc(g.n)}: ${esc(bits.join(", ") || g.typ || "")}.</p>`;
  }
  async function render(detail) {
    last = detail;
    const box = $("#statsZabory"); if (!box) return;
    if (detail.def.cat) { box.innerHTML = ""; if (overlay) setOverlay(null); return; }
    const d = await load(); if (!d || last !== detail) { if (!d) box.innerHTML = ""; return; }
    groups();
    const Z = d.gminy, R = ranked(detail.values), def = detail.def;
    const size = sizeDriven(R), res = FACTORS.map(f => ({ f, m: measure(f, R, Z, size) })).filter(x => x.m);
    const best = res.filter(x => x.m.level === "strong").sort((a, b) => b.m.norm - a.m.norm)[0];
    const verdict = !res.length ? "Za mało gmin z danymi, żeby to ocenić." : best
      ? `<b>${esc(best.f.verdict)}</b>: ${best.f.kind === "multi" ? `przypada na nie ${Math.round(best.m.e * 100)}% różnic między gminami` : `${best.m.auc >= 0.5 ? "mają wyższe wartości" : "mają niższe wartości"} niż ${Math.round((best.m.auc >= 0.5 ? best.m.auc : 1 - best.m.auc) * 100)}% gmin podobnej wielkości`}.`
      : "Żaden z podziałów nie odróżnia tu wyraźnie gmin.";
    const bar = x => `<em><s style="width:${Math.min(100, x.m.norm * 100).toFixed(0)}%"></s></em>`;
    const lvl = { strong: "wyraźnie", weak: "słabo", none: "prawie wcale", size: "nie oceniam" };
    const row = x => {
      const open = sel === x.f.id;
      return `<li class="zab-f is-${x.m.level}${open ? " is-open" : ""}"><button type="button" data-zab-f="${x.f.id}" aria-expanded="${open}"${x.m.level === "size" ? " disabled" : ""} class="${best === x && overlay !== x.f.id ? "is-suggested" : ""}"><span>${esc(x.f.name)}<small>${lvl[x.m.level]} · ${esc(say(x.f, x.m))}</small></span>${bar(x)}<i>${overlay === x.f.id ? "Ukryj" : "Pokaż"}</i></button>${open ? detailHtml(x, detail, Z) : ""}</li>`;
    };
    box.innerHTML = `<div class="zab-head${best ? " is-strong" : ""}">${icon(best?.f.id === "zab" || !best ? "zabory" : "buildings", "zab-ic")}<div><b>Co widać na tej mapie?</b><p>${verdict}</p></div></div>
      <ol class="zab-fs">${res.map(row).join("")}</ol>${selLine(detail.selectedId, Z)}
      <button type="button" class="zab-more" data-zab-rank>${icon("chart-bar")}Gdzie najbardziej widać te podziały?</button><div id="zabRank"></div>
      <p class="zab-src">Pasek: siła podziału (pełny = wyraźnie). Dla zaborów i typów gmin to część różnic między gminami, którą wyjaśnia podział; dla miast to, jak często miasto z grupy ma wyższą (albo niższą) wartość niż gmina podobnej wielkości (wskaźniki zależne głównie od liczby mieszkańców pomijam). Zabory wg granic z 1914 r. (<a href="https://www.openhistoricalmap.org/" target="_blank" rel="noopener noreferrer">OpenHistoricalMap</a>), linia przerywana: granica polsko-niemiecka 1922–1939. Dawne stolice: podział z 1975 r.</p>`;
    if (ranking) drawRank();
  }
  function detailHtml(x, detail, Z) {
    const M = medians(detail.values, x.f, Z), def = detail.def;
    const rows = x.f.kind === "bin" ? [["in", x.f.label[0].toUpperCase() + x.f.label.slice(1), "#111318"], ["out", x.f.refLabel()[0].toUpperCase() + x.f.refLabel().slice(1), "#adb5bd"]] : x.f.rows;
    const vals = rows.map(r => M[r[0]]?.m).filter(Number.isFinite), lo = Math.min(0, ...vals), hi = Math.max(...vals, 1e-9);
    const li = ([key, label, color]) => { const v = M[key]; if (!v?.n) return ""; const w = Math.max(2, ((v.m - lo) / (hi - lo || 1)) * 100);
      return `<li><span><i style="background:${color}"></i>${esc(label)}<small>${v.n.toLocaleString("pl-PL")} gmin</small></span><em><s style="width:${w.toFixed(1)}%;background:${color}"></s></em><b>${esc(S.format(v.m, def.digits))}</b></li>`; };
    return `<ol class="zab-med" aria-label="Mediana wskaźnika w grupach">${rows.map(li).join("")}</ol>`;
  }

  /* All indicators ranked by each factor; computed once, on demand. */
  async function buildRank() {
    const d = await load(); if (!d) return;
    groups();
    const out = [], list = window.StatsMap.defs().filter(x => !x.cat);
    for (let i = 0; i < list.length; i++) {
      const R = ranked(window.StatsMap.series(list[i])), size = sizeDriven(R);
      out.push([list[i], Object.fromEntries(FACTORS.map(f => [f.id, measure(f, R, d.gminy, size)]))]);
      if (i % 30 === 29) await new Promise(r => setTimeout(r));
    }
    ranking = out;
  }
  function drawRank() {
    const el = $("#zabRank"); if (!el || !ranking) return;
    const fid = rankFactor || sel || "zab", f = FACTORS.find(x => x.id === fid);
    const list = ranking.filter(r => r[1][fid] && r[1][fid].level !== "size").sort((a, b) => b[1][fid].norm - a[1][fid].norm);
    const strong = list.filter(r => r[1][fid].level === "strong").length;
    el.innerHTML = `<div class="zab-chips">${FACTORS.map(x => `<button type="button" data-zab-rf="${x.id}" aria-pressed="${x.id === fid}">${esc(x.name)}</button>`).join("")}</div>
      <p class="zab-src">${f.verdict}: ${strong} z ${list.length} wskaźników. Kliknij, aby zobaczyć mapę.</p>
      <ol class="zab-rank">${list.slice(0, 15).map(([def, m]) => `<li><button type="button" data-zab-show="${esc(def.key)}" data-zab-sf="${fid}"><span>${esc(def.label)}<small>${esc(def.category)}</small></span><b>${esc(say(f, m[fid]))}</b></button></li>`).join("")}</ol>`;
  }

  document.addEventListener("stats:render", e => render(e.detail));
  document.addEventListener("stats:close", () => { overlay = null; hideAll(); });
  document.addEventListener("click", async e => {
    const fb = e.target.closest("[data-zab-f]");
    if (fb) { const id = fb.dataset.zabF; const off = sel === id && overlay === id; sel = off ? null : id; await setOverlay(off ? null : id); if (last) render(last); return; }
    const rf = e.target.closest("[data-zab-rf]"); if (rf) { rankFactor = rf.dataset.zabRf; drawRank(); return; }
    if (e.target.closest("[data-zab-rank]")) {
      const el = $("#zabRank"); if (!ranking) { el.innerHTML = `<p class="zab-src">Liczę dla wszystkich wskaźników…</p>`; await buildRank(); }
      drawRank(); return;
    }
    const b = e.target.closest("[data-zab-show]");
    if (b) { sel = b.dataset.zabSf; await setOverlay(sel); window.StatsMap.open(b.dataset.zabShow, { keepView: true }); }
  });
  window.Zabory = { toggle: v => setOverlay(v === false ? null : "zab"), measure };
})();
