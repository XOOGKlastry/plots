/* Mapa statystyk: kartogram gmin całej Polski dla dowolnego wskaźnika z karty gminy. */
(function () {
  "use strict";
  const app = window.PLOTS, map = app.map, esc = app.esc, S = window.StatsModel, model = window.GminyModel, icon = window.Icons.svg;
  const $ = s => document.querySelector(s);
  const POLAND = [[14.07, 48.99], [24.15, 54.84]];
  const panel = $("#statsPanel");
  let geo = null, gminy = null, loading = null, active = false, defs = [], hoverId = null, selectedId = null, popup = null;
  const state = { key: null, year: null, mode: "value", method: "quantile", palette: null, reverse: false };
  let current = null; // {def, values: Map(k -> value), years:[], scheme}

  function load() {
    if (!loading) loading = (async () => {
      const [topology, list] = await Promise.all([
        fetch("data/municipalities.topojson").then(r => { if (!r.ok) throw Error("Granice gmin niedostępne"); return r.json(); }),
        window.PLOTS_GMINY.all(),
        window.GusClient.ready().catch(() => {}),
        window.GusClient.energy().catch(() => {})
      ]);
      gminy = list;
      geo = { type: "FeatureCollection", features: window.MunicipalityModel.decode(topology).map(f => ({ type: "Feature", properties: { k: f.id }, geometry: { type: "MultiPolygon", coordinates: f.polygons } })) };
      const names = new Map(gminy.map(g => [g.k, g]));
      geo.features.forEach(f => { const g = names.get(f.properties.k); f.properties.n = g ? g.n : f.properties.k; });
      defs = model.definitions.map(d => ({ d, n: gminy.reduce((n, g) => n + (Number.isFinite(model.metric(g, d).value) ? 1 : 0), 0) })).filter(x => x.n >= 50).map(x => x.d);
    })().catch(e => { loading = null; throw e; });
    return loading;
  }

  function firstSymbol() { return map.getStyle().layers.find(l => l.type === "symbol")?.id; }
  function ensureLayers() {
    if (!map.getSource("stats-gminy")) {
      map.addSource("stats-gminy", { type: "geojson", data: geo, promoteId: "k", attribution: "GUS BDL · © GUGiK PRG" });
      app.registerOverlaySource("stats-gminy");
    }
    const before = firstSymbol();
    if (!map.getLayer("stats-fill")) map.addLayer({ id: "stats-fill", type: "fill", source: "stats-gminy", paint: { "fill-color": ["coalesce", ["feature-state", "c"], S.NODATA], "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.98, 0.88] } }, before);
    if (!map.getLayer("stats-line")) map.addLayer({ id: "stats-line", type: "line", source: "stats-gminy", paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.15, 8, 0.6, 11, 1.2], "line-opacity": 0.75 } }, before);
    if (!map.getLayer("stats-focus")) map.addLayer({ id: "stats-focus", type: "line", source: "stats-gminy", paint: { "line-color": "#111318", "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 2.6, ["boolean", ["feature-state", "hover"], false], 1.6, 0] } });
  }
  function setVisible(on) {
    for (const id of ["stats-fill", "stats-line", "stats-focus"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  }

  function series(def) {
    const values = new Map(), years = new Set();
    for (const g of gminy) {
      const m = model.metric(state.year && state.mode === "value" ? { ...g, _selectedYear: state.year } : g, def);
      (m.history || []).forEach(h => years.add(h.year));
      if (m.year) years.add(m.year);
      let v = m.value;
      if (state.mode === "change") {
        const base = state.year ? model.metric({ ...g, _selectedYear: state.year }, def) : m;
        const prev = base.history?.find(h => h.year === base.year - 1 && Number.isFinite(h.value));
        v = Number.isFinite(base.value) && prev ? base.value - prev.value : null;
      }
      if (Number.isFinite(v)) values.set(g.k, { value: v, year: m.year });
    }
    return { values, years: [...years].sort((a, b) => b - a) };
  }

  function paint() {
    if (!active || !current || !map.getSource("stats-gminy")) return;
    map.removeFeatureState({ source: "stats-gminy" });
    for (const [k, o] of current.values) map.setFeatureState({ source: "stats-gminy", id: k }, { c: S.colorOf(o.value, current.scheme) });
    if (selectedId) map.setFeatureState({ source: "stats-gminy", id: selectedId }, { sel: true });
  }

  function compute() {
    const def = defs.find(d => d.key === state.key) || defs[0];
    if (!def) return;
    state.key = def.key;
    const { values, years } = series(def);
    const raw = [...values.values()].map(o => o.value);
    const signed = state.mode === "change" || /saldo|przyrost/.test(def.key);
    const palette = state.palette || (signed ? "kontrast" : S.categoryPalette[def.category] || "viridis");
    const scheme = S.classify(raw, { method: state.method, palette, reverse: state.reverse, diverging: signed });
    const usedYears = [...new Set([...values.values()].map(o => o.year).filter(Boolean))].sort((a, b) => a - b);
    current = { def, values, years, usedYears, scheme, palette, raw };
  }

  function rankList(sorted) {
    return sorted.map(([k, o]) => { const g = gminy.find(x => x.k === k); return `<li><button type="button" data-stats-gmina="${esc(k)}"><span>${esc(g?.n || k)}<small>${esc(g?.typ || "")}</small></span><b>${esc(S.format(o.value, current.def.digits))}</b></button></li>`; }).join("");
  }
  function selectedHtml() {
    if (!selectedId) return `<p class="muted small">Kliknij gminę na mapie, aby zobaczyć jej wartość i miejsce w rankingu.</p>`;
    const g = gminy.find(x => x.k === selectedId), o = current.values.get(selectedId);
    if (!o) return `<div class="stats-selected"><strong>${esc(g?.n || selectedId)}</strong><span>Brak danych</span></div>`;
    const lower = current.def.lowerBetter, sorted = [...current.values.values()].map(v => v.value).sort((a, b) => lower ? a - b : b - a);
    const rank = sorted.findIndex(v => v === o.value) + 1;
    return `<div class="stats-selected"><div><strong>${esc(g?.n || selectedId)}</strong><small>${esc(g?.typ || "")}${o.year ? " · " + o.year : ""}</small></div><div><b>${esc(S.format(o.value, current.def.digits))}</b> <small>${esc(unit())}</small><small>${rank.toLocaleString("pl-PL")}. miejsce z ${sorted.length.toLocaleString("pl-PL")}</small></div></div>`;
  }
  function unit() { return state.mode === "change" ? (current.def.unit === "%" ? "p.p. r/r" : (current.def.unit || "") + " r/r") : current.def.unit || ""; }

  function render() {
    if (!current) return;
    const { def, scheme } = current;
    const items = S.legend(scheme, current.raw, def.digits);
    const hist = S.histogram(current.raw), peak = Math.max(1, ...hist.map(b => b.count));
    const sorted = [...current.values.entries()].sort((a, b) => b[1].value - a[1].value);
    const yrs = current.usedYears, yearText = !yrs.length ? "" : yrs.length === 1 ? String(yrs[0]) : `${yrs[0]}–${yrs[yrs.length - 1]}`;
    const missing = gminy.length - current.values.size;
    $("#statsCurrent").innerHTML = `<small style="--cat:${window.IndicatorIcons.of(def).color}">${icon(window.IndicatorIcons.of(def).icon)}${esc(def.category)} · ${esc(window.IndicatorIcons.of(def).group)}</small><strong>${esc(def.label)}</strong><span>${esc(unit())}${yearText ? " · " + yearText : ""}</span>${icon("caret-down", "stats-caret")}`;
    $("#statsYear").innerHTML = `<option value="">Najnowszy</option>` + current.years.slice(0, 6).map(y => `<option value="${y}" ${state.year === y ? "selected" : ""}>${y}</option>`).join("");
    $("#statsMode").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === state.mode));
    $("#statsMethod").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.method === state.method));
    const grad = p => `linear-gradient(90deg,${(state.reverse ? p.colors.slice().reverse() : p.colors).join(",")})`;
    $("#statsPalettes").innerHTML = `<button type="button" data-palette="auto" aria-pressed="${!state.palette}"><i style="background:${grad(S.palettes[current.palette])}"></i><span>Automatycznie<small>dobrana do tematu</small></span></button>` + Object.entries(S.palettes).map(([id, p]) => `<button type="button" data-palette="${id}" aria-pressed="${!!state.palette && id === current.palette}"><i style="background:${grad(p)}"></i><span>${esc(p.label)}${p.diverging ? "<small>dla wartości ±</small>" : ""}</span></button>`).join("");
    $("#statsReverse").checked = state.reverse;
    $("#statsLegend").innerHTML = `<div class="stats-bar">${items.map(i => `<i style="background:${i.color}"></i>`).join("")}</div><div class="stats-bar-axis"><span>${esc(S.format(scheme.min, def.digits))}</span><span>${esc(unit())}</span><span>${esc(S.format(scheme.max, def.digits))}</span></div><ol>${items.map(i => `<li><i style="background:${i.color}"></i><span>${esc(i.label)}</span><small>${i.count.toLocaleString("pl-PL")}</small></li>`).join("")}${missing ? `<li class="nodata"><i></i><span>Brak danych</span><small>${missing.toLocaleString("pl-PL")}</small></li>` : ""}</ol>`;
    $("#statsHist").innerHTML = hist.length ? `<svg viewBox="0 0 ${hist.length * 10} 46" preserveAspectRatio="none" aria-hidden="true">${hist.map((b, i) => { const h = Math.max(1, (b.count / peak) * 44); return `<rect x="${i * 10 + 1}" y="${46 - h}" width="8" height="${h}" rx="1.5" fill="${S.colorOf((b.from + b.to) / 2, scheme)}"/>`; }).join("")}</svg><div class="stats-hist-axis"><span>${esc(S.format(hist[0].from, def.digits))}</span><span>rozkład gmin</span><span>${esc(S.format(hist.at(-1).to, def.digits))}</span></div>` : "";
    $("#statsSelected").innerHTML = selectedHtml();
    $("#statsTop").innerHTML = rankList(sorted.slice(0, 5));
    $("#statsBottom").innerHTML = rankList(sorted.slice(-5).reverse());
    $("#statsSource").textContent = `${def.level === 5 ? "Dane powiatów przypisane gminom. " : ""}Źródło: ${def.source || "GUS BDL"}. ${current.values.size.toLocaleString("pl-PL")} gmin z danymi${state.year ? "" : "; każda gmina pokazuje najnowszy dostępny rok"}. Podział: ${state.method === "equal" ? "równe przedziały" : scheme.diverging ? "kwantyle osobno poniżej i powyżej zera" : "kwantyle (podobna liczba gmin w klasie)"}.`;
    syncUrl();
  }

  const ORDER = ["Ludność", "Finanse i firmy", "Warunki życia", "Energia i ciepło", "Infrastruktura", "Planowanie", "Edukacja i kultura", "Środowisko", "Przegląd"];
  let pickCat = "";
  function pickerList(q) {
    const I = window.IndicatorIcons, needle = model.normalize(q || "");
    const all = I.group(defs, ORDER);
    $("#statsCats").innerHTML = `<button type="button" role="tab" data-pick-cat="" aria-selected="${!pickCat}">${icon("squares-four")}<span>Wszystkie</span></button>` + all.map(c => `<button type="button" role="tab" data-pick-cat="${esc(c.category)}" aria-selected="${pickCat === c.category}" style="--cat:${c.color}">${icon(c.icon)}<span>${esc(c.category)}</span></button>`).join("");
    const chip = $("#statsCats [aria-selected=true]"), bar = $("#statsCats"); if (chip) requestAnimationFrame(() => { bar.scrollLeft += chip.getBoundingClientRect().left - bar.getBoundingClientRect().left - 40; });
    const match = d => !needle || model.normalize(d.label + " " + d.category + " " + I.of(d).group + " " + (d.unit || "")).includes(needle);
    const cats = I.group(defs.filter(d => match(d) && (needle || !pickCat || d.category === pickCat)), ORDER);
    $("#statsList").innerHTML = cats.map(c => `<h3 style="--cat:${c.color}">${icon(c.icon)}${esc(c.category)}</h3>${c.groups.map(g => `${c.groups.length > 1 ? `<h4>${esc(g.label)}</h4>` : ""}<ul>${g.items.map(d => `<li><button type="button" data-stat="${esc(d.key)}" aria-current="${d.key === state.key}"><span class="stats-ico" style="--cat:${c.color}">${icon(I.of(d).icon)}</span><span>${esc(d.label)}<small>${esc(d.unit || "")}${d.level === 5 ? " · dane powiatu" : ""}</small></span></button></li>`).join("")}</ul>`).join("")}`).join("") || `<p class="muted small">Brak pasujących wskaźników.</p>`;
  }
  function togglePicker(open) {
    const picker = $("#statsPicker"), show = open ?? picker.hidden;
    picker.hidden = !show; $("#statsCurrent").setAttribute("aria-expanded", show);
    if (show) { pickCat = current?.def?.category || ""; pickerList($("#statsSearch").value); if (!app.isMobile()) $("#statsSearch").focus(); else { sheet(true); panel.scrollTop = 0; } }
  }
  function update() { compute(); render(); paint(); }
  /* Phone: the panel is a bottom sheet with a compact state (indicator, colour bar, chosen gmina) and an expanded one. */
  function sheet(expanded) {
    const on = !!expanded;
    document.body.classList.toggle("stats-mini", !on);
    const h = $("#statsHandle"); h.setAttribute("aria-expanded", on); h.setAttribute("aria-label", on ? "Zwiń panel" : "Rozwiń panel");
    if (!on) { panel.scrollTop = 0; if (!$("#statsPicker").hidden) togglePicker(false); }
  }

  function syncUrl() {
    try {
      const url = new URL(location.href);
      if (active && state.key) { url.searchParams.set("stat", state.key); state.year ? url.searchParams.set("rok", state.year) : url.searchParams.delete("rok"); }
      else { url.searchParams.delete("stat"); url.searchParams.delete("rok"); }
      history.replaceState(history.state, "", url);
    } catch { /* URL is a convenience only. */ }
  }

  async function open(key, options = {}) {
    // Map, distances and the national view are separate modes: opening this one ends the distance module.
    if (window.DistanceModule?.isOpen()) window.DistanceModule.close();
    panel.hidden = false; app.closeLayers(); document.body.classList.add("stats-open");
    $("#statsCurrent").innerHTML = `<strong>Wczytuję dane gmin…</strong>`;
    try { await load(); } catch (e) { $("#statsCurrent").innerHTML = `<strong>Dane są chwilowo niedostępne</strong>`; app.toast(e.message); return; }
    if (!defs.length) { app.toast("Brak wskaźników do pokazania"); return; }
    ensureLayers();
    if (key) { state.key = key; state.palette = null; }
    if (!state.key) state.key = (defs.find(d => d.key === "gaz_proc") || defs[0]).key;
    if (options.year) state.year = options.year;
    const wasActive = active; active = true; setVisible(true);
    selectedId = window.PLOTS_GMINY.current();
    update();
    if (!wasActive) { window.UIHistory?.open("stats", () => close()); if (!options.keepView) map.fitBounds(POLAND, { padding: app.isMobile() ? { top: 84, bottom: 236, left: 10, right: 10 } : { top: 40, bottom: 40, left: document.body.classList.contains("collapsed") ? 40 : 400, right: 410 }, duration: 900 }); }
    if (app.isMobile()) { app.snap("hidden"); sheet(false); document.querySelectorAll(".maplibregl-compact-show").forEach(el => el.classList.remove("maplibregl-compact-show")); }
    if (!key && !options.keepView) togglePicker(true);
  }
  function close() {
    active = false; panel.hidden = true; document.body.classList.remove("stats-open", "stats-mini"); setVisible(false); popup?.remove(); togglePicker(false); syncUrl();
    window.UIHistory?.dismiss("stats");
    if (app.isMobile()) app.snap("peek");
  }

  // --- map interaction ---
  function hover(id) {
    if (hoverId === id) return;
    if (hoverId) map.setFeatureState({ source: "stats-gminy", id: hoverId }, { hover: false });
    hoverId = id;
    if (id) map.setFeatureState({ source: "stats-gminy", id }, { hover: true });
  }
  map.on("mousemove", "stats-fill", e => {
    if (!active || app.isMobile()) return;
    const f = e.features?.[0]; if (!f) return;
    hover(f.id); map.getCanvas().style.cursor = "pointer";
    const o = current.values.get(f.id);
    popup = popup || new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "stats-popup", offset: 12 });
    popup.setLngLat(e.lngLat).setHTML(`<strong>${esc(f.properties.n)}</strong><span>${o ? `<b>${esc(S.format(o.value, current.def.digits))}</b> ${esc(unit())}${o.year ? " · " + o.year : ""}` : "Brak danych"}</span>`).addTo(map);
  });
  map.on("mouseleave", "stats-fill", () => { hover(null); map.getCanvas().style.cursor = ""; popup?.remove(); });
  map.on("click", "stats-fill", e => {
    if (!active) return;
    const id = e.features?.[0]?.id; if (!id) return;
    choose(id);
  });
  function choose(id) {
    if (selectedId) map.setFeatureState({ source: "stats-gminy", id: selectedId }, { sel: false });
    selectedId = id; map.setFeatureState({ source: "stats-gminy", id }, { sel: true });
    $("#statsSelected").innerHTML = selectedHtml();
    window.PLOTS_GMINY.setContext(id).catch(() => {});
  }
  // Basemap switches rebuild the style; feature colours have to be applied again.
  let repaint = 0;
  map.on("styledata", () => { if (!active) return; clearTimeout(repaint); repaint = setTimeout(() => { if (map.getSource("stats-gminy")) { ensureLayers(); paint(); } }, 150); });
  document.addEventListener("plots:gmina", e => { if (active && e.detail?.id && e.detail.id !== selectedId && map.getSource("stats-gminy")) { if (selectedId) map.setFeatureState({ source: "stats-gminy", id: selectedId }, { sel: false }); selectedId = e.detail.id; map.setFeatureState({ source: "stats-gminy", id: selectedId }, { sel: true }); $("#statsSelected").innerHTML = selectedHtml(); } });

  // --- panel events ---
  panel.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || Date.now() - swiped < 400) return;
    if (b.hasAttribute("data-close-stats")) close();
    else if (b.id === "statsCurrent") togglePicker();
    else if (b.dataset.stat) { state.key = b.dataset.stat; state.palette = null; state.year = null; togglePicker(false); update(); if (app.isMobile()) sheet(false); }
    else if (b.id === "statsHandle") sheet(document.body.classList.contains("stats-mini"));
    else if (b.dataset.mode) { state.mode = b.dataset.mode; state.palette = null; update(); }
    else if (b.dataset.method) { state.method = b.dataset.method; update(); }
    else if (b.dataset.palette) { state.palette = b.dataset.palette === "auto" ? null : b.dataset.palette; update(); }
    else if (b.hasAttribute("data-pick-cat")) { pickCat = b.dataset.pickCat; pickerList($("#statsSearch").value); }
    else if (b.dataset.statsGmina) { const id = b.dataset.statsGmina, f = geo.features.find(x => x.properties.k === id); choose(id); if (f) { const pts = f.geometry.coordinates.flat(2); const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: app.isMobile() ? { top: 90, bottom: 250, left: 30, right: 30 } : 80, maxZoom: 10, duration: 800 }); if (app.isMobile()) sheet(false); } }
  });
  let swipeY = null, swiped = 0;
  panel.addEventListener("pointerdown", e => { if (app.isMobile() && (document.body.classList.contains("stats-mini") || e.target.closest("#statsHandle,.section-head"))) swipeY = e.clientY; });
  window.addEventListener("pointerup", e => {
    if (swipeY === null) return; const dy = e.clientY - swipeY; swipeY = null;
    if (Math.abs(dy) > 25) { sheet(dy < 0); swiped = Date.now(); }
  });
  $("#statsReverse").addEventListener("change", e => { state.reverse = e.target.checked; update(); });
  $("#statsYear").addEventListener("change", e => { state.year = e.target.value ? Number(e.target.value) : null; update(); });
  $("#statsSearch").addEventListener("input", e => pickerList(e.target.value));
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-open-stats],[data-stat-map]"); if (!b) return;
    if (b.dataset.statMap) { const dlg = $("#gminaDialog"); if (dlg?.open) dlg.close(); open(b.dataset.statMap); } else open();
  });

  const params = new URLSearchParams(location.search);
  if (params.get("stat")) { const go = () => open(params.get("stat"), { year: Number(params.get("rok")) || null }); if (map.loaded()) go(); else map.once("load", go); }
  window.StatsMap = { open, close, isOpen: () => active };
})();
