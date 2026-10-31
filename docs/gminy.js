/* global GminyModel */
(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const app = window.PLOTS, model = window.GminyModel, esc = app.esc;
  const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const categories = ["Przegląd", "Ludność", "Finanse i firmy", "Warunki życia", "Infrastruktura", "Edukacja i kultura", "Środowisko", "Źródła"];
  const dialog = $("#gminaDialog");
  let data = null, loading = null, selected = null, category = "Przegląd", pendingParcel = null, selectedYear = null;
  const categoryTone = name => ({"Ludność":"blue","Finanse i firmy":"purple","Warunki życia":"orange","Infrastruktura":"cyan","Edukacja i kultura":"pink","Środowisko":"green"}[name] || "blue");
  async function loadGus(g, force) {
    await window.GusClient.enrich(g, force);
    if(selected?.k===g.k){drawCard();if(dialog.open)renderDetails();}
  }
  function load() {
    if (data) return Promise.resolve(data);
    if (!loading) loading = fetch("data/gminy.json", { signal: AbortSignal.timeout(15000) }).then((r) => {
      if (!r.ok) throw new Error("Nie udało się pobrać danych gmin");
      return r.json();
    }).then((value) => {
      if (value.schemaVersion !== 1 || !Array.isArray(value.gminy)) throw new Error("Nieobsługiwany format danych gmin");
      data = value;
      return data;
    }).catch((error) => { loading = null; throw error; });
    return loading;
  }
  function region(g) {
    const woj = data.wojewodztwa.find((w) => w.k === g.k.slice(0, 2));
    const powiat = data.powiaty.find((p) => p.k === g.k.slice(0, 4));
    return [woj?.n, powiat ? "powiat " + powiat.n : null].filter(Boolean).join(" · ");
  }
  function recentIds() { const ids = app.store.get("gminyRecent", []); return Array.isArray(ids) ? ids.filter((id) => typeof id === "string").slice(0, 5) : []; }
  function resultList(gminy) {
    return gminy.map((g) => `<li><button type="button" data-gmina="${esc(g.k)}">${esc(g.n)}<small>${esc(g.typ || "gmina")} · ${esc(region(g))} · ${esc(g.k)}</small></button></li>`).join("");
  }
  function chooser() {
    $("#gminaCard").innerHTML = `<div class="gmina-head"><div><h2>Poznaj gminę.</h2><div class="gmina-type">Ludność, finanse i warunki życia</div></div></div><input id="gminaSearch" class="gmina-find" type="search" placeholder="Nazwa gminy lub TERYT" aria-label="Znajdź gminę"/><ul id="gminaResults" class="gmina-results"></ul><p class="muted small" id="gminaSearchHint">${data.gminy.length.toLocaleString("pl-PL")} gmin · źródła i lata przy wskaźnikach</p>`;
    const recent = recentIds().map((id) => data.gminy.find((g) => g.k === id)).filter(Boolean);
    $("#gminaResults").innerHTML = resultList(recent);
    $("#gminaSearch").addEventListener("input", (e) => {
      const found = model.search(data.gminy, e.target.value, 8);
      $("#gminaResults").innerHTML = resultList(found);
      $("#gminaSearchHint").textContent = e.target.value.trim().length < 2 ? "Wpisz co najmniej 2 znaki" : found.length ? "Wybierz właściwy typ gminy i powiat" : "Nie znaleziono gminy";
    });
  }
  function drawCard() {
    if (!selected) { chooser(); return; }
    selected._selectedYear = null;
    const m = model.metrics(selected), pop = m.find((x) => x.key === "ludnosc"), area = m.find((x) => x.key === "powierzchnia");
    $("#gminaCard").innerHTML = `<button type="button" class="gmina-back" data-choose-gmina>${icon("back")}Zmień gminę</button><div class="gmina-head"><div><h2>${esc(selected.n)}</h2><div class="gmina-type">${esc(selected.typ || "Gmina")}</div></div><div class="place-icon">${icon("town")}</div></div><p class="muted small">${esc(region(selected))}</p><div class="gmina-stats"><div class="gmina-stat"><strong>${esc(model.formatValue(pop, false))}</strong><small>mieszkańców${pop.year ? " · " + pop.year : ""}</small></div><div class="gmina-stat"><strong>${esc(model.formatValue(area, false))}</strong><small>km²${area.year ? " · " + area.year : " · rok niepodany"}</small></div></div><button type="button" class="primary" data-gmina-details>Dane gminy ${icon("arrow")}</button><div class="gmina-source"><span>TERYT ${esc(selected.k)}</span><span>GUS BDL</span></div>`;
  }
  async function select(id, fly) {
    try {
      await load(); const g = data.gminy.find((item) => item.k === id);
      if (!g) { app.toast("Brak profilu tej gminy w bieżącym zestawie"); return; }
      selected = g; category = "Przegląd";
      selectedYear = null;
      await window.GusClient.seed(selected).catch(()=>{});
      app.store.set("gmina", g.k); app.store.set("gminyRecent", [g.k, ...recentIds().filter((k) => k !== g.k)].slice(0, 5));
      drawCard(); app.showGmina();
      if (fly) {
        if (Number.isFinite(g.lon) && Number.isFinite(g.lat)) app.map.flyTo({ center: [g.lon, g.lat], zoom: 11, padding: app.padding() });
        else app.toast("Profil otwarty. Ten zbiór nie zawiera położenia gminy.");
      }
      if (dialog.open) renderDetails();
      loadGus(g, false).catch(error=>console.warn(error.message));
    } catch (error) { failure(error); }
  }
  function rows(items) {
    return `<div class="metric-list">${items.map((m) => `<div class="metric-row tone-${categoryTone(m.category)}"><div><i class="metric-dot" aria-hidden="true"></i>${esc(m.label)}</div><div>${esc(model.formatValue(m))}<small>${m.year ? esc(m.year) + " · " : "Rok niepodany · "}${esc(m.source)}</small></div></div>`).join("")}</div>`;
  }
  function renderDetails() {
    if (!selected) return;
    selected._selectedYear = selectedYear;
    $("#dataCategories").innerHTML = categories.map((c) => `<button type="button" data-category="${esc(c)}" aria-current="${c === category}">${esc(c)}</button>`).join("");
    const m = model.metrics(selected);
    let body;
    if (category === "Przegląd") {
      const headline = ["ludnosc", "powierzchnia", "firmy_na_1000", "urodzenia_1000", "mieszkanie_m2_os", "odpady_kg"].map((key) => m.find((x) => x.key === key)).filter(Boolean);
      body = `<div class="metrics colorful-metrics">${headline.map((item) => `<div class="metric tone-${categoryTone(item.category)}"><div class="metric-label">${esc(item.label)}${item.unit !== "os." ? " · " + esc(item.unit) : ""}</div><div class="metric-value">${esc(model.formatValue(item, false))}</div><small>${item.year || "Rok niepodany"} · ${esc(item.source)}</small></div>`).join("")}</div><h2>Warto wiedzieć</h2>` + rows(m.filter((x) => ["przyrost_naturalny", "gestosc_ludnosci", "pit_na_mieszk", "mieszkania_1000", "przedszkola_dzieci", "czytelnicy_1000"].includes(x.key)));
    } else if (category === "Źródła") {
      body = `<h2>Dane i ich aktualność</h2><div class="source-description">Zestaw bazowy: ${esc(data.baseBuilt)}. Dane uzupełniające pobrano: ${esc(data.cardsFetched?.slice(0, 10))}. Daty pobrania nie są rokiem obserwacji. Każdy wskaźnik pokazuje własny rok; brak roku w źródle jest oznaczony wprost.</div><div class="metric-list"><div class="metric-row"><div>Identyfikator jednostki</div><div>${esc(selected.k)}<small>${esc(selected.typ)}</small></div></div><div class="metric-row"><div>Zestaw źródłowy</div><div><a href="https://bdl.stat.gov.pl/" target="_blank" rel="noopener noreferrer">GUS BDL i dane referencyjne</a></div></div><div class="metric-row"><div>Oficjalne statystyki</div><div><a href="https://bdl.stat.gov.pl/" target="_blank" rel="noopener noreferrer">GUS BDL</a></div></div><div class="metric-row"><div>Usługi i otoczenie</div><div><a href="https://xoogklastry.github.io/jakdaleko/" target="_blank" rel="noopener noreferrer">Jakdaleko ${icon("arrow")}</a><small>Punkty usług, ceny RCN i odległości dostępne w panelu warstw</small></div></div></div><h2>Źródła wskaźników</h2>${rows(m)}<p class="source-description">Powierzchnia pochodzi w pierwszej kolejności z karty GUS z podanym rokiem. Starsza wartość z bazy jest używana tylko przy braku tej karty. Brak danych nie jest zerem. Zestaw zawiera również dane opisowe z Wikidata.</p>`;
    } else body = `<h2>${esc(category)}</h2>` + rows(m.filter((x) => x.category === category));
    $("#gminaDetails").innerHTML = `<header class="data-heading"><div><div class="eyebrow">${esc(selected.typ)} · ${esc(region(selected))}</div><h1 id="gminaDialogTitle">${esc(selected.n)}</h1><p>TERYT ${esc(selected.k)} · ${esc(category)}</p></div><button type="button" class="map-button" data-gmina-map>Pokaż na mapie ${icon("arrow")}</button></header><div class="data-tools"><label>Rok <select id="dataYear" aria-label="Rok danych"><option value="">Najnowsze dostępne</option>${window.GusClient.years().map(y=>`<option value="${y}" ${selectedYear===y?"selected":""}>${y}</option>`).join("")}</select></label><button type="button" data-refresh-gus>Odśwież z GUS</button></div><p class="gus-status" role="status">${esc(selected._gusStatus || "Pobieranie wskaźników GUS…")}</p>${body}`;
    $("#gminaDetails").scrollTop = 0;
  }
  function failure(error) {
    console.warn("Municipality data:", error.message);
    $("#gminaCard").innerHTML = `<div class="inline-error">Dane gmin są chwilowo niedostępne.<br><button type="button" class="retry" data-gmina-retry>Spróbuj ponownie</button></div>`;
  }
  async function initialize() {
    try {
      await load();
      await window.GusClient.ready().catch(()=>{});
      const params = new URLSearchParams(location.search), initial = params.get("gmina") || app.store.get("gmina", null);
      if (pendingParcel) { const id = pendingParcel; pendingParcel = null; selected = data.gminy.find((g) => g.k === id) || null; drawCard(); }
      else if (initial && data.gminy.some((g) => g.k === initial)) { selected = data.gminy.find((g) => g.k === initial); drawCard(); if (params.has("gmina")) app.showGmina(); }
      else chooser();
      if(selected){await window.GusClient.seed(selected).catch(()=>{});drawCard();loadGus(selected,false).catch(()=>{});}
    } catch (error) { failure(error); }
  }
  window.PLOTS_GMINY = {
    select,
    current: () => selected?.k || null,
    async search(query) { await load(); return model.search(data.gminy, query).map((g) => ({ kind: "gmina", data: g, title: g.n, sub: `${g.typ || "Gmina"} · ${region(g)} · TERYT ${g.k}` })); }
  };
  $("#gminaCard").addEventListener("click", (e) => {
    const button = e.target.closest("button"); if (!button) return;
    if (button.dataset.gmina) select(button.dataset.gmina, true);
    if (button.hasAttribute("data-choose-gmina")) chooser();
    if (button.hasAttribute("data-gmina-details")) { renderDetails(); dialog.showModal(); }
    if (button.hasAttribute("data-gmina-retry")) initialize();
  });
  $("#dataCategories").addEventListener("click", (e) => { const b = e.target.closest("[data-category]"); if (b) { category = b.dataset.category; renderDetails(); } });
  $("#closeGmina").onclick = () => dialog.close();
  $("#gminaDetails").addEventListener("click", (e) => { if (e.target.closest("[data-gmina-map]")) { dialog.close(); select(selected.k, true); } });
  $("#gminaDetails").addEventListener("click", async e=>{const b=e.target.closest("[data-refresh-gus]");if(b){b.disabled=true;b.textContent="Pobieram…";try{await loadGus(selected,true);}finally{if(b.isConnected){b.disabled=false;b.textContent="Odśwież z GUS";}}}});
  $("#gminaDetails").addEventListener("change",e=>{if(e.target.id==="dataYear"){selectedYear=e.target.value?Number(e.target.value):null;renderDetails();}});
  document.addEventListener("plots:parcel", (e) => {
    const id = model.parcelTeryt(e.detail.id_dzialki); if (!id) return;
    // Update the context without switching away from the parcel the user selected.
    if (!data) { pendingParcel = id; return; }
    const g = data.gminy.find((item) => item.k === id);
    selected = g || null; selectedYear=null; if (selected) { app.store.set("gmina", selected.k); loadGus(selected,false).catch(()=>{}); } drawCard();
  });
  initialize();
})();
