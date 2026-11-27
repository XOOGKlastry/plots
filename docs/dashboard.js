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
  let active = false, defs = [], scope = "polska", busy = null;

  /* --- przełącznik trybów --- */
  const sw = document.createElement("nav");
  sw.className = "mode-switch"; sw.setAttribute("aria-label", "Tryb aplikacji");
  sw.innerHTML = [["mapa", "map-trifold", "Mapa"], ["statystyki", "poland", "Statystyki"], ["dashboard", "chart-bar", "Dashboard"]]
    .map(([m, i, t]) => `<button type="button" data-mode-go="${m}" aria-pressed="false">${icon(i)}<span>${t}</span></button>`).join("");
  document.body.append(sw);
  function syncSwitch() { const t = P.get("tryb"); sw.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.modeGo === t)); }
  document.addEventListener("click", e => { const b = e.target.closest("[data-mode-go]"); if (b) go(b.dataset.modeGo); });
  // Telefon i zwinięty panel: wejście do dashboardu obok przycisku „Polska” w module po prawej.
  document.querySelector(".side-mods [data-open-stats]")?.insertAdjacentHTML("afterend", `<button type="button" data-mode-go="dashboard">${icon("chart-bar")}<span>Dashboard</span></button>`);
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
      <div id="dashKpi" class="dash-kpi" aria-live="polite"></div>
      <div class="dash-grid">
        <section class="dash-card"><header><h2>Na tle sąsiadów</h2></header><div id="dashNb"></div></section>
        <section class="dash-card"><header><h2>Gmina, powiat, województwo, Polska</h2></header><div id="dashLadder"></div></section>
        <section class="dash-card"><header><h2>Rozkład wszystkich gmin</h2></header><div id="dashHist"></div></section>
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

  function transition(fn) {
    if (document.startViewTransition && window.Motion?.on?.() !== false) return document.startViewTransition(fn).finished.catch(() => {});
    fn(); return Promise.resolve();
  }

  async function go(mode) {
    if (busy) await busy;
    const from = P.get("tryb"); if (mode === from && (mode !== "dashboard" || active)) return;
    busy = (async () => {
      if (mode === "dashboard") return open();
      if (active) await transition(() => hide());
      if (mode === "statystyki") window.StatsMap?.open(P.get("wskaznik") || undefined, { year: P.get("rok") });
      else { if (window.StatsMap?.isOpen()) window.StatsMap.close(); P.set({ tryb: "mapa" }, "dashboard"); }
    })().finally(() => { busy = null; syncSwitch(); });
    return busy;
  }

  async function open() {
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
      P.set({ tryb: "dashboard" }, "dashboard");
      render();
    });
    window.UIHistory?.open("dash", () => { if (active) { hide(); P.set({ tryb: "mapa" }, "dashboard"); syncSwitch(); } });
    window.Track?.("dashboard", { wskaznik: P.get("wskaznik") });
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
    const box = ["#dashNb", "#dashLadder", "#dashHist", "#dashSim"].map(s => $(s));
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
    const hist = nbs => { $("#dashHist").innerHTML = C.histogram(e.sorted, { format: f, mark: { value: own, label: g.n }, marks: (nbs || []).map(x => e.values.get(x)?.value) }) + `<p class="ch-note">Słupek z gminą wyróżniony; kreski pod osią to sąsiedzi. Pominięto 1% skrajnych wartości.</p>`; };
    hist(null); $("#dashNb").innerHTML = `<p class="muted small">Wczytuję granice gmin…</p>`;
    store.neighbours().then(map => {
      if (id !== drawn) return;
      const nbs = [...(map.get(k) || [])];
      $("#dashNb").innerHTML = C.bars([k, ...nbs].map(row).filter(Boolean).sort(order), { format: f, ref: { value: L.polska.value, label: "Mediana Polski" } });
      hist(nbs);
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

  function syncUrl() {
    try {
      const url = new URL(location.href);
      if (active) { url.searchParams.set("tryb", "dash"); for (const [p, v] of [["gmina", P.get("gmina")], ["stat", P.get("wskaznik")], ["rok", P.get("rok")]]) v ? url.searchParams.set(p, v) : url.searchParams.delete(p); }
      else if (url.searchParams.get("tryb") === "dash") { url.searchParams.delete("tryb"); if (!window.StatsMap?.isOpen()) { url.searchParams.delete("stat"); url.searchParams.delete("rok"); } }
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
  if (params.get("tryb") === "dash") { const start = () => go("dashboard"); if (app.map?._loaded) start(); else app.map?.once("load", start); }
  window.Dashboard = { open: () => go("dashboard"), close: () => go("mapa"), isOpen: () => active, go };
})();
