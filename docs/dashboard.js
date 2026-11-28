/* Dashboard gminy (etap 1, test): kafle z wartością i miejscem w rankingu oraz tabela rankingowa dla wybranego wskaźnika.
   Włączony dla wszystkich; ?dash=0 w adresie wyłącza. Link do widoku: ?tryb=dash&gmina=…&stat=…&rok=…
   Przełącznik trybów Mapa | Statystyki | Dashboard korzysta ze wspólnego stanu PlotsState, więc gmina, wskaźnik i rok
   przechodzą między trybami bez utraty. */
(function () {
  "use strict";
  const KEY = "plots.dash", params = new URLSearchParams(location.search);
  const enabled = params.get("dash") !== "0"; // dla wszystkich; ?dash=0 wyłącza na jedno wejście
  const app = window.PLOTS, P = window.PlotsState, store = window.IndicatorStore, S = window.StatsModel;
  if (!enabled || !app || !P || !store) return;

  const esc = app.esc, icon = (n, x = "") => window.Icons?.svg(n, x) || "";
  const fmt = (v, d) => v == null || !Number.isFinite(v) ? "brak" : S.format(v, d);
  const pl = n => Number(n).toLocaleString("pl-PL");
  let active = false, defs = [], scope = "polska", busy = null, funTab = "ind";

  /* --- przełącznik trybów --- */
  const sw = document.createElement("nav");
  sw.className = "mode-switch"; sw.setAttribute("aria-label", "Tryb aplikacji");
  const NAMES = { mapa: "Mapa", statystyki: "Polska", dashboard: "Wykresy", ciekawostki: "Ciekawostki" };
  sw.innerHTML = [["mapa", "map-trifold"], ["statystyki", "poland"], ["dashboard", "chart-bar"], ["ciekawostki", "sparkle"]].map(([m, i]) => [m, i, NAMES[m]])
    .map(([m, i, t]) => `<button type="button" data-mode-go="${m}" aria-pressed="false">${icon(i)}<span>${t}</span></button>`).join("");
  document.body.append(sw);
  function syncSwitch() { const t = P.get("tryb"); sw.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.modeGo === t)); }
  document.addEventListener("click", e => { const b = e.target.closest("[data-mode-go]"); if (b) go(b.dataset.modeGo); });
  // Telefon i zwinięty panel: wejście do dashboardu obok przycisku „Polska” w module po prawej.
  document.querySelector(".side-mods [data-open-stats]")?.insertAdjacentHTML("afterend", `<button type="button" data-mode-go="dashboard">${icon("chart-bar")}<span>${NAMES.dashboard}</span></button>`);
  // Karta gminy na mapie i panel Polska: przycisk prosto do wykresów gminy.
  document.querySelector("#panel .quick-actions")?.insertAdjacentHTML("beforeend", `<button type="button" data-mode-go="dashboard"><span>${icon("chart-bar")}</span>${NAMES.dashboard}</button>`);
  document.getElementById("statsSelected")?.insertAdjacentHTML("afterend", `<button type="button" class="stats-to-dash" data-mode-go="dashboard">${icon("chart-bar")}<span><b>Wykresy i tabela gmin</b><small>porównanie z sąsiadami, powiatem i Polską</small></span>${icon("caret-right")}</button>`);
  // Miejsce kliknięcia: od niego rozchodzi się animacja wejścia do wykresów i do niego wraca przy wyjściu.
  let tapX = innerWidth / 2, tapY = 40;
  addEventListener("pointerdown", e => { tapX = e.clientX; tapY = e.clientY; }, true);
  addEventListener("keydown", e => {
    if (e.target.closest?.("input,select,textarea,[contenteditable]") || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = { 1: "mapa", 2: "statystyki", 3: "dashboard" }[e.key]; if (m) go(m);
    else if (e.key === "Escape" && active) { if (!$("#dashPick").hidden) openPick(false); else go("mapa"); }
  });

  /* --- panel dashboardu --- */
  const panel = document.createElement("section");
  panel.id = "dashPanel"; panel.className = "dash"; panel.hidden = true; panel.setAttribute("aria-label", "Dashboard gminy");
  panel.innerHTML = `<header class="dash-head">
      <label class="dash-field dash-gmina"><svg class="ic" aria-hidden="true"><use href="#i-town"/></svg><input id="dashGmina" list="dashGminy" placeholder="Wpisz nazwę gminy" autocomplete="off" aria-label="Gmina"/><datalist id="dashGminy"></datalist></label>
      <button type="button" id="dashIndBtn" class="dash-field dash-ind" aria-haspopup="dialog" aria-controls="dashPick"></button>
      <label class="dash-field dash-year">Rok <select id="dashYear" aria-label="Rok danych"></select></label>
      <button type="button" class="icbtn dash-x" data-dash-close aria-label="Wróć do mapy">${icon("x")}</button>
    </header>
    <div class="dash-body">
      <div id="dashTitle" class="dash-title"></div>
      <div class="dash-tabs" role="tablist" aria-label="Widok"><button type="button" data-dtab="ind" aria-pressed="true">${icon("chart-bar")}<span>Wskaźnik</span></button><button type="button" data-dtab="fun" aria-pressed="false">${icon("sparkle")}<span>Ciekawostki</span></button></div>
      <div id="dashFun" class="dfun"></div>
      <div class="dash-jump"><button type="button" data-jump="map">${icon("map-trifold")}<span>Pokaż na mapie</span></button><button type="button" data-jump="pl">${icon("poland")}<span>Ten wskaźnik na mapie Polski</span></button></div>
      <div id="dashKpi" class="dash-kpi" aria-live="polite"></div>
      <div class="dash-grid">
        <section class="dash-card"><header><h2>Na tle sąsiadów</h2></header><div id="dashNb"></div></section>
        <section class="dash-card"><header><h2>Gmina, powiat, województwo, Polska</h2></header><div id="dashLadder"></div></section>
        <section class="dash-card dash-wide"><header><h2>Zmiany w czasie</h2><div class="stats-seg" id="dashTrendMode" role="group" aria-label="Co pokazać w czasie"><button type="button" data-trend="v">Wartość</button><button type="button" data-trend="r">Miejsce w Polsce</button><button type="button" data-trend="i">Indeks, pierwszy rok = 100</button></div></header><div id="dashTrendKpi" class="dash-trend-kpi"></div><div id="dashTrend"></div></section>
        <section class="dash-card"><header><h2>Gminy podobne</h2><small class="muted">ten sam rodzaj gminy, najbliższa liczba ludności</small></header><div id="dashSim"></div></section>
      </div>
      <section class="dash-card dash-rank-card"><header><h2>Tabela gmin</h2><div class="stats-seg" id="dashScope" role="group" aria-label="Zakres tabeli"><button type="button" data-scope="polska">Polska</button><button type="button" data-scope="woj">Województwo</button><button type="button" data-scope="pow">Powiat</button></div></header>
        <div class="dtbl-tools"><label class="dtbl-q">${icon("magnifying-glass")}<input id="dashTblQ" type="search" placeholder="Szukaj gminy, powiatu lub województwa" aria-label="Szukaj w tabeli"/></label>
          <div class="stats-seg" id="dashDir" role="group" aria-label="Kolejność"><button type="button" data-dir="desc">${icon("trend-down")}Od max</button><button type="button" data-dir="asc">${icon("trend-up")}Od min</button></div>
          <button type="button" class="dtbl-me" data-tbl-me>${icon("crosshair")}Moja gmina</button></div>
        <div id="dashRank"></div></section>
      <p id="dashSource" class="muted source-note"></p>
    </div>
    <div id="dashPick" class="dpick" role="dialog" aria-modal="true" aria-label="Wybierz wskaźnik" hidden><div class="dpick-sheet">
      <header><div><small>Dashboard</small><h2>Wybierz wskaźnik</h2></div><button type="button" class="dpick-x" data-pick-close aria-label="Zamknij">${icon("x")}</button></header>
      <label class="dtbl-q dpick-q">${icon("magnifying-glass")}<input id="dashPickQ" type="search" placeholder="Szukaj, np. gaz, lasy, bezrobocie" aria-label="Szukaj wskaźnika"/></label>
      <div id="dashPickCats" class="dpick-cats" role="tablist" aria-label="Kategorie"></div>
      <div id="dashPickList" class="dpick-list"></div>
    </div></div>`;
  document.body.append(panel);
  const $ = s => panel.querySelector(s);

  function transition(fn, dir = "in") {
    const root = document.documentElement;
    root.style.setProperty("--vt-x", tapX + "px"); root.style.setProperty("--vt-y", tapY + "px"); root.dataset.vt = dir;
    if (document.startViewTransition && window.Motion?.on?.() !== false) return document.startViewTransition(fn).finished.catch(() => {}).finally(() => { delete root.dataset.vt; });
    fn(); return Promise.resolve();
  }

  async function go(mode) {
    if (busy) await busy;
    const from = P.get("tryb"); if (mode === from && (!VIEWS[mode] || active)) return;
    busy = (async () => {
      if (VIEWS[mode]) return open(VIEWS[mode]);
      if (active) await transition(() => hide(), "out");
      if (mode === "statystyki") window.StatsMap?.open(P.get("wskaznik") || undefined, { year: P.get("rok") });
      else { if (window.StatsMap?.isOpen()) window.StatsMap.close(); P.set({ tryb: "mapa" }, "dashboard"); }
    })().finally(() => { busy = null; syncSwitch(); });
    return busy;
  }

  const VIEWS = { dashboard: "ind", ciekawostki: "fun" };
  async function open(view = "ind") {
    if (window.DistanceModule?.isOpen()) window.DistanceModule.close();
    try { await Promise.all([window.StatsMap.ready(), store.load()]); } catch (e) { app.toast("Dane gmin są chwilowo niedostępne"); return; }
    defs = window.StatsMap.defs().filter(d => !d.cat);
    if (!defs.length) return;
    if (!P.get("gmina")) P.set({ gmina: window.PLOTS_GMINY?.current() || null }, "dashboard");
    if (!defs.some(d => d.key === P.get("wskaznik"))) P.set({ wskaznik: (defs.find(d => d.key === "gaz_proc") || defs[0]).key, rok: null }, "dashboard");
    fillPickers();
    await transition(() => {
      if (window.StatsMap.isOpen()) window.StatsMap.close();
      app.closeLayers?.();
      panel.hidden = false; document.body.classList.add("dash-open"); active = true;
      P.set({ tryb: view === "fun" ? "ciekawostki" : "dashboard" }, "dashboard");
      setTab(view); render();
    });
    window.UIHistory?.open("dash", () => { if (active) { hide(); P.set({ tryb: "mapa" }, "dashboard"); syncSwitch(); } });
    window.Track?.(view === "fun" ? "ciekawostki" : "dashboard", { wskaznik: P.get("wskaznik") });
    if (!P.get("gmina")) $("#dashGmina").focus();
  }
  function hide() {
    active = false; panel.hidden = true; document.body.classList.remove("dash-open");
    syncUrl(); window.UIHistory?.dismiss("dash");
  }

  function fillPickers() {
    $("#dashGminy").innerHTML = store.gminy().map(g => `<option value="${esc(g.n)} (${esc(store.powiat(g.k) || g.typ || "")})" data-k="${esc(g.k)}"></option>`).join("");
  }

  function render() {
    if (!active) return;
    const def = defs.find(d => d.key === P.get("wskaznik")) || defs[0], year = P.get("rok"), k = P.get("gmina");
    // pełna historia wskaźnika z GUS dociągana w tle, jak w panelu Polska
    const G = window.GusClient; if (G?.needsHistory?.(def.key)) G.history(def.key).then(ok => { if (ok && active && P.get("wskaznik") === def.key) { store.invalidate(def.key); render(); } }).catch(() => {});
    const all = store.values(def, null), e = store.values(def, year), g = k ? store.gmina(k) : null;
    const IC = window.IndicatorIcons?.of(def) || {};
    panel.style.setProperty("--cat", IC.color || "#2f6bff");
    $("#dashIndBtn").innerHTML = `<span class="dsq" style="--c:${IC.color || "#2f6bff"}">${icon(IC.icon || "chart-bar")}</span><span class="dash-ind-t"><small>${esc(def.category)} · ${esc(IC.group || "")}</small><b>${esc(def.label)}</b></span>${icon("caret-down")}`;
    $("#dashYear").innerHTML = `<option value="">Najnowszy</option>` + all.years.map(y => `<option value="${y}" ${year === y ? "selected" : ""}>${y}</option>`).join("");
    if (document.activeElement !== $("#dashGmina")) $("#dashGmina").value = g ? `${g.n} (${store.powiat(g.k) || g.typ || ""})` : "";
    const I = window.IndicatorIcons?.of(def) || {};
    $("#dashTitle").innerHTML = `<small style="--cat:${I.color || "#6b7280"}">${icon(I.icon || "chart-bar")}${esc(def.category)}</small><h1>${g ? esc(g.n) : "Wybierz gminę"}</h1><p>${esc(def.label)}${def.unit ? `, ${esc(def.unit)}` : ""}${g ? ` · ${esc(g.typ || "")}, powiat ${esc(store.powiat(k))}, woj. ${esc(store.wojewodztwo(k))}` : ""}</p>`;
    $("#dashKpi").innerHTML = g ? kpi(def, k, year) : `<p class="muted">Wpisz nazwę gminy w polu u góry albo wybierz ją na mapie, aby zobaczyć jej wartość i miejsce w rankingu.</p>`;
    $("#dashScope").querySelectorAll("button").forEach(b => { b.setAttribute("aria-pressed", b.dataset.scope === scope); b.disabled = !g && b.dataset.scope !== "polska"; });
    tbl.limit = 50; renderTable();
    charts(def, k, year, e);
    const years = [...new Set([...e.values.values()].map(o => o.year).filter(Boolean))].sort((a, b) => a - b);
    $("#dashSource").textContent = `Źródło: ${store.source(def)}${years.length ? `, ${years.length > 1 ? years[0] + "–" + years.at(-1) : years[0]}` : ""}. ${pl(e.values.size)} gmin z danymi. Powiat, województwo i Polska to mediana wartości gmin.${def.level === 5 ? " Dane powiatów przypisane gminom." : ""}`;
    if (window.Motion?.on?.()) $("#dashKpi").querySelectorAll("[data-count]").forEach(el => window.Motion.countUp(el));
    syncUrl();
  }

  function kpi(def, k, year) {
    const p = store.position(def, k, year);
    if (!p) return `<p class="muted">Brak danych dla tej gminy${year ? ` w ${year} r.` : ""}.</p>`;
    const L = store.levels(def, k, year), woj = store.rankIn(def, k, k.slice(0, 2), year), pow = store.rankIn(def, k, k.slice(0, 4), year), d = def.digits;
    const diff = ref => { if (!Number.isFinite(ref)) return ""; const x = p.value - ref; const better = def.lowerBetter ? x < 0 : x > 0; return x === 0 ? `<small>równo z medianą</small>` : `<small class="${def.descriptive ? "" : better ? "up" : "down"}">${x > 0 ? "+" : "−"}${esc(fmt(Math.abs(x), d))} od mediany</small>`; };
    const tile = (label, value, sub = "", attr = "") => `<div class="dash-tile"><span>${label}</span><b ${attr}>${value}</b>${sub}</div>`;
    return tile(`Wartość${p.year ? ` (${p.year})` : ""}`, `${esc(fmt(p.value, d))}<i>${esc(def.unit || "")}</i>`, "", "data-count") +
      tile("Miejsce w Polsce", `${pl(p.rank)}.<i>z ${pl(p.n)}</i>`, `<small>${p.percentile}. percentyl</small>`) +
      tile(`Miejsce w województwie`, woj ? `${pl(woj.rank)}.<i>z ${pl(woj.n)}</i>` : "brak", pow && pow.n > 1 ? `<small>w powiecie ${pl(pow.rank)}. z ${pl(pow.n)}</small>` : "") +
      (L.powiat.n < 2 ? "" : tile(`Mediana powiatu`, `${esc(fmt(L.powiat.value, d))}<i>${esc(def.unit || "")}</i>`, diff(L.powiat.value))) +
      tile(`Mediana województwa`, `${esc(fmt(L.wojewodztwo.value, d))}<i>${esc(def.unit || "")}</i>`, diff(L.wojewodztwo.value)) +
      tile(`Mediana Polski`, `${esc(fmt(L.polska.value, d))}<i>${esc(def.unit || "")}</i>`, diff(L.polska.value));
  }

  /* Etap 2: porównania. Sąsiedzi dochodzą asynchronicznie (topologia granic), reszta liczy się od razu. */
  let drawn = 0;
  function charts(def, k, year, e) {
    const C = window.DashCharts, f = v => fmt(v, def.digits) + (def.unit === "%" ? " %" : ""), id = ++drawn;
    const box = ["#dashNb", "#dashLadder", "#dashTrend", "#dashSim"].map(s => $(s));
    if (!C || !k || !e.values.has(k)) { box.forEach(b => { b.innerHTML = `<p class="muted small">${k ? "Brak danych dla tej gminy." : "Wybierz gminę."}</p>`; }); return; }
    const L = store.levels(def, k, year), g = store.gmina(k), own = e.values.get(k).value;
    const row = kk => { const o = e.values.get(kk), x = store.gmina(kk); return o && x ? { k: kk, label: x.n, sub: kk === k ? "wybrana gmina" : store.powiat(kk) === x.n ? x.typ : "powiat " + store.powiat(kk), value: o.value, sel: kk === k } : null; };
    const order = (a, b) => def.lowerBetter ? a.value - b.value : b.value - a.value;
    $("#dashLadder").innerHTML = C.ladder([
      { label: g.n, sub: "gmina", value: own, sel: true },
      ...(L.powiat.n > 1 ? [{ label: "Powiat " + L.powiat.name, sub: `mediana ${L.powiat.n} gmin`, value: L.powiat.value }] : []),
      { label: "Woj. " + L.wojewodztwo.name, sub: `mediana ${L.wojewodztwo.n} gmin`, value: L.wojewodztwo.value },
      { label: "Polska", sub: `mediana ${L.polska.n.toLocaleString("pl-PL")} gmin`, value: L.polska.value }
    ], { format: f });
    $("#dashSim").innerHTML = C.bars([k, ...store.similar(k)].map(row).filter(Boolean).sort(order), { format: f, ref: { value: L.polska.value, label: "Mediana Polski" } });
    trend(def, k);
    $("#dashNb").innerHTML = `<p class="muted small">Wczytuję granice gmin…</p>`;
    store.neighbours().then(map => {
      if (id !== drawn) return;
      const nbs = [...(map.get(k) || [])];
      $("#dashNb").innerHTML = C.bars([k, ...nbs].map(row).filter(Boolean).sort(order), { format: f, ref: { value: L.polska.value, label: "Mediana Polski" } });
    }).catch(() => { if (id === drawn) $("#dashNb").innerHTML = `<p class="muted small">Granice gmin są chwilowo niedostępne.</p>`; });
  }

  /* Pełna tabela gmin: zakres, szukajka, sortowanie po kolumnach (od max albo od min), dokładanie wierszy. */
  const tbl = { col: "value", dir: "desc", q: "", limit: 50 };
  const norm = x => window.GminyModel?.normalize?.(x) ?? String(x).toLowerCase();
  function renderTable() {
    const def = defs.find(d => d.key === P.get("wskaznik")) || defs[0], k = P.get("gmina"), e = store.values(def, P.get("rok"));
    const pre = scope === "woj" && k ? k.slice(0, 2) : scope === "pow" && k ? k.slice(0, 4) : "";
    const best = [...e.values].filter(([kk]) => kk.startsWith(pre)).sort((a, b) => def.lowerBetter ? a[1].value - b[1].value : b[1].value - a[1].value);
    const needle = norm(tbl.q.trim());
    let rows = best.map(([kk, o], i) => { const g = store.gmina(kk); return { k: kk, n: g?.n || kk, typ: g?.typ || "", pow: store.powiat(kk), woj: store.wojewodztwo(kk), value: o.value, rank: i + 1 }; });
    if (needle) rows = rows.filter(r => norm(`${r.n} ${r.pow} ${r.woj}`).includes(needle));
    const sgn = tbl.dir === "asc" ? 1 : -1, col = tbl.col;
    rows.sort((a, b) => col === "value" ? sgn * (a.value - b.value) : col === "rank" ? -sgn * (a.rank - b.rank) : sgn * String(a[col]).localeCompare(String(b[col]), "pl"));
    const vals = best.map(r => r[1].value), lo = Math.min(0, ...vals), span = (Math.max(0, ...vals) - lo) || 1;
    const shown = rows.slice(0, tbl.limit);
    const th = (c, t, cls = "") => `<th class="${cls}" aria-sort="${tbl.col === c ? (tbl.dir === "asc" ? "ascending" : "descending") : "none"}"><button type="button" data-sort="${c}">${t}${tbl.col === c ? icon("caret-down", tbl.dir === "asc" ? "flip" : "") : ""}</button></th>`;
    $("#dashDir").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", tbl.col === "value" && b.dataset.dir === tbl.dir));
    $("#dashRank").innerHTML = `<p class="muted small">${esc(pre ? (scope === "woj" ? "Województwo " + store.wojewodztwo(k) : "Powiat " + store.powiat(k)) : "Cała Polska")}: ${pl(rows.length)} z ${pl(best.length)} gmin${needle ? " pasuje do wyszukiwania" : ""}. Miejsce liczone ${def.lowerBetter ? "od najniższej" : "od najwyższej"} wartości.</p>
      <div class="dtbl-wrap"><table class="dtbl"><thead><tr>${th("rank", "#", "num")}${th("n", "Gmina")}${th("pow", "Powiat", "wide")}${th("woj", "Województwo", "wide")}${th("value", "Wartość", "val")}</tr></thead><tbody>
      ${shown.map((r, i) => `<tr class="${r.k === k ? "sel" : ""}" style="--i:${Math.min(i, 20)}" data-dash-gmina="${esc(r.k)}" tabindex="0"><td class="num">${pl(r.rank)}</td><td><b>${esc(r.n)}</b><small>${esc(r.typ)}</small></td><td class="wide">${esc(r.pow)}</td><td class="wide">${esc(r.woj)}</td><td class="val"><div><i class="dtbl-bar"><i style="left:${((Math.min(0, r.value) - lo) / span * 100).toFixed(1)}%;width:${Math.max(0.8, Math.abs(r.value) / span * 100).toFixed(1)}%"></i></i><b>${esc(fmt(r.value, def.digits))}</b></div></td></tr>`).join("") || `<tr><td colspan="5" class="muted">Brak gmin dla tego wyszukiwania.</td></tr>`}
      </tbody></table></div>
      ${rows.length > tbl.limit ? `<div class="dtbl-more"><button type="button" data-tbl-more="100">Pokaż kolejne 100</button><button type="button" data-tbl-more="all">Pokaż wszystkie (${pl(rows.length)})</button></div>` : ""}`;
  }

  /* Menu wskaźników: kategorie jako kolorowe kafle z symbolami, lista z ikonami, szukajka, animowane wejście. */
  const ORDER = ["Przegląd", "Ludność", "Migracje", "Dojazdy", "Rodziny", "Finanse i firmy", "Warunki życia", "Handel", "Paczki", "Transport", "Zdrowie i służby", "Szkoły i rekreacja", "Turystyka", "Energia i ciepło", "Infrastruktura", "Planowanie", "Edukacja i kultura", "Środowisko", "Wybory"];
  let pickCat = "";
  function openPick(show = true) {
    const box = $("#dashPick");
    if (!show) { box.classList.remove("on"); setTimeout(() => { if (!box.classList.contains("on")) box.hidden = true; }, 280); $("#dashIndBtn").focus(); return; }
    const cur = defs.find(d => d.key === P.get("wskaznik")); pickCat = cur?.category || "";
    $("#dashPickQ").value = ""; pickList(); box.hidden = false; requestAnimationFrame(() => box.classList.add("on"));
    if (!app.isMobile()) setTimeout(() => $("#dashPickQ").focus(), 80);
    requestAnimationFrame(() => $("#dashPickCats [aria-selected=true]")?.scrollIntoView({ inline: "center", block: "nearest" }));
  }
  function pickList() {
    const I = window.IndicatorIcons, needle = norm($("#dashPickQ").value.trim());
    const cats = I.group(defs, ORDER);
    $("#dashPickCats").innerHTML = cats.map((c, i) => `<button type="button" role="tab" data-pick-cat="${esc(c.category)}" aria-selected="${!needle && c.category === pickCat}" style="--c:${c.color};--i:${i}"><span class="dsq">${icon(c.icon)}</span><b>${esc(c.category)}</b><small>${c.groups.reduce((n, g) => n + g.items.length, 0)}</small></button>`).join("");
    const match = d => !needle || norm(`${d.label} ${d.category} ${I.of(d).group} ${d.unit || ""}`).includes(needle);
    const list = I.group(defs.filter(d => match(d) && (needle || d.category === pickCat)), ORDER);
    let n = 0; const cur = P.get("wskaznik");
    $("#dashPickList").innerHTML = list.map(c => `${needle ? `<h3 style="--c:${c.color}">${icon(c.icon)}${esc(c.category)}</h3>` : ""}${c.groups.map(g => `<h4>${esc(g.label)}</h4><div class="dpick-grid">${g.items.map(d => `<button type="button" data-pick="${esc(d.key)}" aria-current="${d.key === cur}" style="--c:${c.color};--i:${Math.min(n++, 24)}"><span class="dsq">${I.html(d)}</span><span><b>${esc(d.label)}</b><small>${esc(d.unit || "")}${d.level === 5 ? " · dane powiatu" : ""}</small></span>${d.key === cur ? icon("check-circle") : ""}</button>`).join("")}</div>`).join("")}`).join("") || `<p class="muted small">Brak pasujących wskaźników.</p>`;
  }
  $("#dashPickQ").addEventListener("input", pickList);
  $("#dashPick").addEventListener("click", e => {
    if (e.target === e.currentTarget) return openPick(false);
    const b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-pick-close")) openPick(false);
    else if (b.dataset.pickCat) { pickCat = b.dataset.pickCat; $("#dashPickQ").value = ""; pickList(); $("#dashPickList").scrollTop = 0; }
    else if (b.dataset.pick) { P.set({ wskaznik: b.dataset.pick, rok: null }, "dashboard"); openPick(false); }
  });

  /* Zmiany w czasie: gmina na tle mediany powiatu, województwa i Polski w każdym roku z danymi. */
  let trendMode = "v";
  function trend(def, k) {
    const C = window.DashCharts, box = $("#dashTrend"), kpi = $("#dashTrendKpi");
    $("#dashTrendMode").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.trend === trendMode));
    const years = store.values(def, null).years.slice().sort((a, b) => a - b);
    if (years.length < 2) { kpi.innerHTML = ""; box.innerHTML = `<div class="dash-empty">${icon("clock")}<p><b>Ten wskaźnik ma dane tylko z ${years[0] || "jednego"} roku.</b><br>Wybierz wskaźnik z danymi wieloletnimi, na przykład ludność, dochody, bezrobocie albo gaz, aby zobaczyć zmiany.</p></div>`; return; }
    const g = store.gmina(k), f = v => fmt(v, def.digits), rows = years.map(y => { const p = store.position(def, k, y), L = store.levels(def, k, y); return { y, v: p?.value, r: p?.rank, n: p?.n, pow: L.powiat, woj: L.wojewodztwo, pl: L.polska.value }; }).filter(x => Number.isFinite(x.v) || Number.isFinite(x.pl));
    const first = rows.find(x => Number.isFinite(x.v)), last = [...rows].reverse().find(x => Number.isFinite(x.v));
    if (first && last && first !== last) {
      const d = last.v - first.v, rel = first.v ? d / Math.abs(first.v) * 100 : null, good = def.lowerBetter ? d < 0 : d > 0, dr = (first.r || 0) - (last.r || 0);
      kpi.innerHTML = `<div><span>${first.y}</span><b>${esc(f(first.v))}</b></div><div class="arrow">${icon("arrow-right")}</div><div><span>${last.y}</span><b>${esc(f(last.v))}</b></div>
        <div class="chg ${def.descriptive ? "" : good ? "up" : "down"}"><span>Zmiana</span><b>${d > 0 ? "+" : d < 0 ? "−" : ""}${esc(f(Math.abs(d)))}${def.unit === "%" ? " p.p." : ""}</b>${rel != null && def.unit !== "%" ? `<small>${rel > 0 ? "+" : "−"}${fmt(Math.abs(rel), 1)}%</small>` : ""}</div>
        <div class="chg ${dr > 0 ? "up" : dr < 0 ? "down" : ""}"><span>Miejsce w Polsce</span><b>${pl(first.r)}. → ${pl(last.r)}.</b><small>${dr > 0 ? "awans o " + pl(dr) : dr < 0 ? "spadek o " + pl(-dr) : "bez zmian"}</small></div>`;
    } else kpi.innerHTML = "";
    const COL = { g: getComputedStyle(panel).getPropertyValue("--cat").trim() || "#0a84ff", pow: "#5e5ce6", woj: "#ff9f0a", pl: "#34c759" };
    const L0 = rows[0], name = { pow: L0?.pow?.n > 1 ? "Powiat" : null, woj: "Województwo", pl: "Polska" };
    if (trendMode === "r") {
      box.innerHTML = C.lines([{ label: g?.n || "Gmina", color: COL.g, sel: true, points: rows.map(x => ({ x: x.y, y: x.r })) }], { format: v => pl(Math.round(v)) + ".", invert: true, width: box.clientWidth }) + `<p class="ch-note">Miejsce wśród wszystkich gmin z danymi; wyżej na wykresie znaczy lepiej.</p>`;
      return;
    }
    const idx = trendMode === "i", base = {};
    const series = [["g", g?.n || "Gmina", x => x.v, true], ["pow", name.pow, x => x.pow?.value], ["woj", name.woj, x => x.woj?.value], ["pl", name.pl, x => x.pl]].filter(s => s[1])
      .map(([id, label, get, sel]) => ({ id, label, color: COL[id], sel: !!sel, dash: !sel, points: rows.map(x => ({ x: x.y, y: get(x) })) }));
    if (idx) for (const s of series) { const b = s.points.find(p => Number.isFinite(p.y) && p.y)?.y; s.points = s.points.map(p => ({ x: p.x, y: b && Number.isFinite(p.y) ? p.y / b * 100 : null })); base[s.id] = b; }
    box.innerHTML = C.lines(series, { format: idx ? v => fmt(v, 0) : f, unit: idx ? "" : def.unit, width: box.clientWidth }) + `<p class="ch-note">Linia ciągła: ${esc(g?.n || "gmina")}. Przerywane: mediana gmin powiatu, województwa i Polski w danym roku.${idx ? " Indeks: wartość z pierwszego roku = 100." : ""}</p>`;
  }

  /* Szybkie przejścia: gmina na mapie, wskaźnik na mapie Polski, struktura terenu 3D na mapie. */
  async function jump(where) {
    const k = P.get("gmina");
    if (where === "pl") return go("statystyki");
    if (!k) return app.toast("Najpierw wybierz gminę");
    await go("mapa");
    if (where === "map") window.PLOTS_GMINY?.select(k, true);
    else { await window.PLOTS_GMINY?.setContext(k).catch(() => {}); window.Struktura?.open(); }
  }

  function syncUrl() {
    try {
      const url = new URL(location.href);
      if (active) { url.searchParams.set("tryb", funTab === "fun" ? "ciekawostki" : "dash"); for (const [p, v] of [["gmina", P.get("gmina")], ["stat", P.get("wskaznik")], ["rok", P.get("rok")]]) v ? url.searchParams.set(p, v) : url.searchParams.delete(p); }
      else if (/^(dash|ciekawostki)$/.test(url.searchParams.get("tryb") || "")) { url.searchParams.delete("tryb"); if (!window.StatsMap?.isOpen()) { url.searchParams.delete("stat"); url.searchParams.delete("rok"); } }
      history.replaceState(history.state, "", url);
    } catch { /* adres to tylko wygoda */ }
  }

  function pickGmina(k) {
    if (!k) return;
    P.set({ gmina: k }, "dashboard");
    window.PLOTS_GMINY?.setContext(k).catch(() => {});
  }
  $("#dashGmina").addEventListener("change", e => {
    const v = e.target.value.trim(), opt = [...$("#dashGminy").options].find(o => o.value === v);
    const k = opt?.dataset.k || store.gminy().find(g => g.n.toLowerCase() === v.toLowerCase())?.k;
    if (k) pickGmina(k); else app.toast("Wybierz gminę z listy podpowiedzi");
  });
  $("#dashIndBtn").addEventListener("click", () => openPick(true));
  $("#dashTblQ").addEventListener("input", e => { tbl.q = e.target.value; tbl.limit = 50; renderTable(); });
  $("#dashYear").addEventListener("change", e => P.set({ rok: e.target.value ? Number(e.target.value) : null }, "dashboard"));
  panel.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-dash-close")) go("mapa");
    else if (b.dataset.scope && !b.disabled) { scope = b.dataset.scope; tbl.limit = 50; render(); }
    else if (b.dataset.dir) { tbl.col = "value"; tbl.dir = b.dataset.dir; renderTable(); }
    else if (b.dataset.sort) { const c = b.dataset.sort; tbl.dir = tbl.col === c ? (tbl.dir === "asc" ? "desc" : "asc") : c === "value" || c === "rank" ? "desc" : "asc"; tbl.col = c; renderTable(); }
    else if (b.dataset.tblMore) { tbl.limit = b.dataset.tblMore === "all" ? Infinity : tbl.limit + 100; renderTable(); }
    else if (b.hasAttribute("data-tbl-me")) showMine();
    else if (b.dataset.jump) jump(b.dataset.jump);
    else if (b.dataset.trend) { trendMode = b.dataset.trend; const def = defs.find(d => d.key === P.get("wskaznik")) || defs[0]; if (P.get("gmina")) trend(def, P.get("gmina")); }
    else if (b.dataset.dashGmina) pickGmina(b.dataset.dashGmina);
  });
  // Wiersz tabeli: klik lub Enter wybiera gminę.
  $("#dashRank").addEventListener("click", e => { const tr = e.target.closest("tr[data-dash-gmina]"); if (tr && !e.target.closest("button")) pickGmina(tr.dataset.dashGmina); });
  $("#dashRank").addEventListener("keydown", e => { const tr = e.target.closest("tr[data-dash-gmina]"); if (tr && e.key === "Enter") pickGmina(tr.dataset.dashGmina); });
  /* „Moja gmina”: czyści szukajkę, dokłada wiersze do wybranej gminy i przewija do niej. */
  function showMine() {
    const k = P.get("gmina"); if (!k) return app.toast("Najpierw wybierz gminę");
    tbl.q = ""; $("#dashTblQ").value = ""; tbl.limit = Infinity; renderTable();
    const tr = $(`#dashRank tr[data-dash-gmina="${k}"]`); if (tr) { tr.scrollIntoView({ block: "center", behavior: window.Motion?.on?.() ? "smooth" : "auto" }); tr.classList.add("flash"); setTimeout(() => tr.classList.remove("flash"), 1400); }
    else app.toast("Ta gmina nie ma danych w tym zakresie");
  }
  P.on(({ changed }) => { syncSwitch(); if (active && changed.some(c => c === "gmina" || c === "wskaznik" || c === "rok")) render(); });
  // Cofnięcie historii przywraca stary adres; poza dashboardem usuwamy z niego tryb=dash.
  addEventListener("popstate", () => setTimeout(() => { if (!active) syncUrl(); }, 0));
  syncSwitch();
  if (/^(dash|ciekawostki)$/.test(params.get("tryb") || "")) { const start = () => go(params.get("tryb") === "ciekawostki" ? "ciekawostki" : "dashboard"); if (app.map?._loaded) start(); else app.map?.once("load", start); }
  // przycisk „Na wykresie” w kartach wskaźników gminy
  document.addEventListener("click", e => { const b = e.target.closest("[data-stat-chart]"); if (!b) return;
    const dlg = document.getElementById("gminaDialog"); if (dlg?.open) dlg.close();
    P.set({ wskaznik: b.dataset.statChart, rok: null, ...(b.dataset.k ? { gmina: b.dataset.k } : {}) }, "gmina"); go("dashboard"); });
  /* Ciekawostki: kolorowe karty z rekordami wybranej gminy (wysokości, budynki, lasy, przyroda). Dane: data/ciekawostki.json. */
  let funData = null;
  const SP = { SO: "sosna", DB: "dąb", BK: "buk", JD: "jodła", "ŚW": "świerk", OL: "olsza", BRZ: "brzoza", JS: "jesion", GB: "grab", MD: "modrzew", JW: "jawor", LP: "lipa", AK: "akacja", JKL: "klon" };
  const nf = (v, d = 0) => Number(v).toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
  function place(key, k, desc = true) {
    const all = Object.entries(funData.g).map(([kk, o]) => [kk, o[key]]).filter(x => Number.isFinite(x[1]));
    all.sort((a, b) => desc ? b[1] - a[1] : a[1] - b[1]); const i = all.findIndex(x => x[0] === k);
    return i < 0 ? "" : `${nf(i + 1)}. z ${nf(all.length)} w Polsce`;
  }
  function bar(parts) {
    const ps = parts.filter(p => p[1] >= .5), t = ps.reduce((a, p) => a + p[1], 0) || 1;
    return `<div class="dfun-bar">${ps.map(p => `<i style="flex:${p[1]};background:${p[2]}" title="${esc(p[0])}: ${nf(p[1] / t * 100, 1)}%"></i>`).join("")}</div>
      <div class="dfun-leg">${ps.map(p => `<span><i style="background:${p[2]}"></i>${esc(p[0])} <b>${nf(p[1] / t * 100)}%</b></span>`).join("")}</div>`;
  }
  function ring(pct) {
    const r = 34, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pct || 0));
    return `<svg class="dfun-ring" viewBox="0 0 84 84"><circle cx="42" cy="42" r="${r}" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="10"/><circle cx="42" cy="42" r="${r}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 42 42)"/><text x="42" y="48" text-anchor="middle">${nf(v)}%</text></svg>`;
  }
  const card = (cls, ic, title, body, pin = "") => `<article class="dfun-card ${cls}"><header><span class="dfun-ic">${icon(ic)}</span><h3>${title}</h3>${pin ? `<button type="button" class="dfun-pin" data-fun-pin="${pin}" title="Pokaż na mapie">${icon("map-pin")}</button>` : ""}</header>${body}</article>`;
  /* Rekordy Polski: listy z warstw ciekawostek (data/rekordy-polski.json), kolorowe sekcje, klik w pozycję prowadzi na mapę. */
  let funSub = "pl", recData = null;
  const MEDAL = ["#ffd60a", "#d1d1d6", "#ff9f0a"];
  async function fun(k) {
    const box = $("#dashFun"); if (!box) return;
    const sw = `<div class="dfun-sub" role="group" aria-label="Rodzaj ciekawostek"><button type="button" data-fsub="pl" aria-pressed="${funSub === "pl"}">${icon("poland")}Rekordy Polski</button><button type="button" data-fsub="g" aria-pressed="${funSub === "g"}">${icon("map-pin")}Twoja gmina</button></div>`;
    if (funSub === "g") { box.innerHTML = sw + `<div id="dashFunG"></div>`; return funGmina(k, box.querySelector("#dashFunG")); }
    if (!recData) {
      box.innerHTML = sw + `<p class="muted">Wczytuję rekordy…</p>`;
      recData = await fetch("data/rekordy-polski.json").then(r => r.json()).catch(() => null);
      if (!recData) { box.innerHTML = sw + `<p class="muted">Rekordy są chwilowo niedostępne.</p>`; return; }
    }
    const nav = `<nav class="drec-nav">${recData.sections.map(x => `<a href="#drec-${x.id}" style="--a:${x.color[0]};--b:${x.color[1]}">${icon(x.icon)}${esc(x.title)}</a>`).join("")}</nav>`;
    const list = (l, c) => {
      const nums = l.rows.map(r => parseFloat(String(r[1]).replace(/\s/g, "").replace(",", "."))), max = Math.max(...nums.filter(Number.isFinite).map(Math.abs), 0) || 1, barred = nums.every(Number.isFinite) && !/: 1|kondygnacji|^-/.test(l.rows[0]?.[1] || "") && !/Najkrót|Najmniej|Najniż|poszarpane/.test(l.title);
      return `<section class="drec-list"><h4>${esc(l.title)}</h4>${l.note ? `<p class="drec-note">${esc(l.note)}</p>` : ""}<ol>${l.rows.map((r, i) => `<li${r[3] ? ` data-rec-pin="${r[3].join(",")}" tabindex="0" title="Pokaż na mapie"` : ""}>
        <span class="drec-n" style="background:${MEDAL[i] || c[0] + "22"};color:${i < 3 ? "#1c1c1e" : c[0]}">${i + 1}</span>
        <span class="drec-t"><b>${esc(r[0])}</b><small>${esc(r[2] || "")}</small>${barred ? `<i class="drec-bar"><i style="width:${(Math.abs(nums[i]) / max * 100).toFixed(1)}%;background:linear-gradient(90deg,${c[0]},${c[1]})"></i></i>` : ""}</span>
        ${r[1] ? `<span class="drec-v" style="color:${c[0]}">${esc(r[1])}</span>` : ""}${r[3] ? `<span class="drec-pin">${icon("map-pin")}</span>` : ""}</li>`).join("")}</ol></section>`;
    };
    box.innerHTML = sw + nav + recData.sections.map(x => `<article class="drec-sec" id="drec-${x.id}"><header style="background:linear-gradient(135deg,${x.color[0]},${x.color[1]})"><span class="dfun-ic">${icon(x.icon)}</span><h3>${esc(x.title)}</h3></header>
      <div class="drec-lists">${x.lists.map(l => list(l, x.color)).join("")}</div></article>`).join("") + `<p class="muted source-note">Źródła: ${esc(recData.zrodla)}.</p>`;
  }
  async function funGmina(k, box) {
    if (!box) return;
    if (!k) { box.innerHTML = `<p class="muted">Wybierz gminę u góry.</p>`; return; }
    if (!funData) {
      box.innerHTML = `<p class="muted">Wczytuję ciekawostki…</p>`;
      funData = await fetch("data/ciekawostki.json").then(r => r.json()).catch(() => null);
      if (!funData) { box.innerHTML = `<p class="muted">Ciekawostki są chwilowo niedostępne.</p>`; return; }
    }
    const o = funData.g[k]; if (!o) { box.innerHTML = `<p class="muted">Brak ciekawostek dla tej gminy.</p>`; return; }
    const out = [];
    if (Number.isFinite(o.hmax)) out.push(card("dfun-peak", "mountains", "Najwyżej i najniżej", `<div class="dfun-big">${nf(o.hmax, 1)}<small> m n.p.m.</small></div><p>najwyższy punkt gminy, ${place("hmax", k)}</p>
      <div class="dfun-pair"><span>${icon("caret-down")}najniżej <b>${nf(o.hmin, 1)} m</b></span><span>różnica <b>${nf(o.hmax - o.hmin)} m</b></span></div>`, (o.cmax || []).join(",")));
    if (o.mx) out.push(card("dfun-bigb", "buildings", "Największy budynek", `<div class="dfun-big">${nf(o.mx)}<small> m²</small></div><p>${esc(o.mxf || "budynek")}, ${place("mx", k)}</p>
      <div class="dfun-pair"><span>${icon("soccer-ball")}to około <b>${nf(o.mx / 7140, 1)}</b> boiska piłkarskiego</span></div>`));
    if (o.b) out.push(card("dfun-homes", "house", "Domy i bloki", `<div class="dfun-big">${nf(o.b)}<small> budynków</small></div><p>${place("b", k)}, w tym mieszkalnych ${nf(o.m)}</p>
      ${bar([["domy jednorodzinne", o.jd, "#ffd60a"], ["budynki wielorodzinne", o.wr, "#64d2ff"], ["pozostałe mieszkalne", Math.max(0, (o.m || 0) - (o.jd || 0) - (o.wr || 0)), "#ffffff"]])}
      ${o.sk ? `<p class="dfun-note">Średnio ${nf(o.sk, 2)} kondygnacji na budynek, ${place("sk", k)}</p>` : ""}`));
    if (Number.isFinite(o.la)) out.push(card("dfun-forest", "tree", "Lasy państwowe", `<div class="dfun-big">${nf(o.la)}<small> lat</small></div><p>średni wiek drzewostanów, ${place("la", k)}</p>
      ${bar([["sosna", o.lso, "#ffd60a"], ["dąb", o.ldb, "#a2845e"], ["buk", o.lbk, "#ff9f0a"], ["inne", Math.max(0, 100 - (o.lso || 0) - (o.ldb || 0) - (o.lbk || 0)), "#64d2ff"]])}
      <p class="dfun-note">Najczęściej rośnie <b>${esc(SP[o.ls] || o.ls || "brak danych")}</b>. Drzewostany ponad 100 lat: <b>${nf(o.l100 || 0, 1)}%</b>. Lasy państwowe: ${nf(o.lh || 0)} ha.</p>`));
    if (Number.isFinite(o.o)) out.push(card("dfun-nature", "shield-check", "Przyroda pod ochroną", `<div class="dfun-row">${ring(o.o)}<p>powierzchni gminy w formach ochrony przyrody, ${place("o", k)}</p></div>
      ${[["Natura 2000", o.n2, "#64d2ff"], ["Park krajobrazowy", o.pk, "#30d158"], ["Obszar chronionego krajobrazu", o.ok, "#ffd60a"]].map(([n, v, c]) => `<div class="dfun-meter"><span>${n}</span><i><i style="width:${Math.min(100, v || 0)}%;background:${c}"></i></i><b>${nf(v || 0, 1)}%</b></div>`).join("")}`));
    box.innerHTML = `<div class="dfun-grid">${out.join("")}</div><p class="muted source-note">Źródła: ${esc(funData.zrodla)}. Miejsca liczone wśród wszystkich gmin z danymi.</p>`;
  }
  function setTab(t) { funTab = t; panel.classList.toggle("fun", t === "fun"); panel.querySelectorAll("[data-dtab]").forEach(b => b.setAttribute("aria-pressed", b.dataset.dtab === t)); if (t === "fun") fun(P.get("gmina")); }
  panel.addEventListener("click", e => {
    const t = e.target.closest("[data-dtab]"); if (t) return setTab(t.dataset.dtab);
    const fs = e.target.closest("[data-fsub]"); if (fs) { funSub = fs.dataset.fsub; return fun(P.get("gmina")); }
    const rp = e.target.closest("[data-rec-pin]"); if (rp) { const [x, y] = rp.dataset.recPin.split(",").map(Number); Promise.resolve(go("mapa")).then(() => window.PLOTS?.map?.flyTo({ center: [x, y], zoom: 15 })); return; }
    const nv = e.target.closest(".drec-nav a"); if (nv) { e.preventDefault(); panel.querySelector(nv.getAttribute("href"))?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const pin = e.target.closest("[data-fun-pin]");
    if (pin) { const [x, y] = pin.dataset.funPin.split(",").map(Number); Promise.resolve(go("mapa")).then(() => window.PLOTS?.map?.flyTo({ center: [x, y], zoom: 14 })); }
  });
  P.on(({ changed }) => { if (active && funTab === "fun" && funSub === "g" && changed.includes("gmina")) fun(P.get("gmina")); });
  window.Dashboard = { fun: () => go("ciekawostki"), open: () => go("dashboard"), close: () => go("mapa"), isOpen: () => active, go };
})();
