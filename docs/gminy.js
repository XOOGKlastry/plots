/* global GminyModel */
(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const app = window.PLOTS, model = window.GminyModel, esc = app.esc;
  const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const categories = ["Przegląd", "Ludność", "Finanse i firmy", "Warunki życia", "Usługi", "Energia i ciepło", "Infrastruktura", "Planowanie", "Edukacja i kultura", "Środowisko", "Źródła"];
  const dialog = $("#gminaDialog");
  let contextRevision=0;
  let indQuery = "", data = null, loading = null, selected = null, category = "Przegląd", pendingParcel = null, selectedYear = null;
  const categoryIcons={...Object.fromEntries(Object.entries(window.IndicatorIcons?.categories||{}).map(([k,v])=>[k,v.icon])),'Źródła':'file-text'};
  const categoryTone = name => ({"Ludność":"blue","Finanse i firmy":"purple","Warunki życia":"orange","Usługi":"pink","Infrastruktura":"cyan","Energia i ciepło":"orange","Planowanie":"purple","Edukacja i kultura":"pink","Środowisko":"green"}[name] || "blue");
  async function loadGus(g, force) {
    await window.GusClient.enrich(g, force);
    if(selected?.k===g.k){drawCard();if(dialog.open)renderDetails({keep:true});}
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
    return gminy.map((g) => `<li><button type="button" data-gmina="${esc(g.k)}">${esc(g.n)}${popTag(g)}<small>${esc(g.typ || "gmina")} · ${esc(region(g))} · ${esc(g.k)}</small></button></li>`).join("");
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
    $("#gminaCard").innerHTML = `<button type="button" class="gmina-back" data-choose-gmina>${icon("back")}Zmień gminę</button><div class="gmina-head"><div><h2>${esc(selected.n)}${popTag(selected)}</h2><div class="gmina-type">${esc(selected.typ || "Gmina")}</div></div>${window.MunicipalityCrests.render(selected)}</div><p class="muted small">${esc(region(selected))}</p><div class="gmina-stats"><div class="gmina-stat"><strong>${esc(model.formatValue(pop, false))}</strong><small>mieszkańców${pop.year ? " · " + pop.year : ""}</small></div><div class="gmina-stat"><strong>${esc(model.formatValue(area, false))}</strong><small>km²${area.year ? " · " + area.year : " · rok niepodany"}</small></div></div><button type="button" class="primary" data-gmina-details>Dane gminy ${icon("arrow")}</button><div class="gmina-source"><span>TERYT ${esc(selected.k)}</span><span>GUS BDL</span></div><p class="boundary-key"><i></i>Granica gminy${selected.k.endsWith('3')?'<span><i></i>Obszar miasta</span>':''}</p>`;
    document.dispatchEvent(new CustomEvent("plots:gmina",{detail:{id:selected.k}}));
  }
  async function select(id, fly) {
    if(window.DistanceModule?.isOpen()){window.DistanceModule.close({history:false});window.UIHistory?.open("gmina",()=>app.clearPlace(),true);}
    const context=++contextRevision;document.dispatchEvent(new Event("plots:manual-gmina"));
    try {
      await load();if(context!==contextRevision)return; const g = data.gminy.find((item) => item.k === id);
      if (!g) { app.toast("Brak profilu tej gminy w bieżącym zestawie"); return; }
      selected = g;app.setCurrentPlace(null); category = "Przegląd";
      selectedYear = null;
      await window.GusClient.seed(g).catch(()=>{});if(context!==contextRevision)return;
      app.store.set("gmina", g.k); app.store.set("gminyRecent", [g.k, ...recentIds().filter((k) => k !== g.k)].slice(0, 5));
      drawCard(); app.showGmina();
      if(fly){const shown=await window.MunicipalBoundaries?.select(g.k,true);if(context!==contextRevision)return;if(!shown&&Number.isFinite(g.lon)&&Number.isFinite(g.lat))app.framePoint(g.lon,g.lat,11);}

      if (dialog.open) renderDetails();
      loadGus(g, false).catch(error=>console.warn(error.message));
    } catch (error) { failure(error); }
  }
  function assessment(item) {
    const definition=model.definitions.find(d=>d.key===item.key);
    const peers=data.gminy.map(g=>model.metric({...g,_selectedYear:item.year},definition));
    const result=window.IndicatorModel.rank(item,peers),trend=window.IndicatorModel.trend(item);
    return {...result,trend};
  }
  function metricCard(item) {
    const a=assessment(item);
    return `<article class="indicator-card score-${a.tone}"><header><span class="metric-caption">${Icons.svg(window.IndicatorIcons?window.IndicatorIcons.of(item).icon:(categoryIcons[item.category]||'buildings'),'metric-symbol')}<span>${esc(item.label)}</span></span><span class="score-pill">${Icons.svg(a.tone==='good'?'check-circle':a.tone==='bad'?'warning-circle':'minus-circle')} ${esc(a.label)}</span></header><div class="indicator-value">${esc(model.formatValue(item,false))}<small>${esc(item.unit)}</small></div><div class="indicator-context"><span>${a.rank?`Pozycja <b>${a.rank.toLocaleString('pl-PL')}</b> / ${a.n.toLocaleString('pl-PL')}`:'Pozycja —'}</span><span>${a.trend.direction?Icons.svg(a.trend.direction==='up'?'trend-up':a.trend.direction==='down'?'trend-down':'minus'):""}${esc(a.trend.text)}</span></div><footer><span>${item.year?item.year+' · ':''}${esc(item.source)}</span>${window.StatsMap&&Number.isFinite(item.value)?`<button type="button" class="stat-map-link" data-stat-map="${esc(item.key)}">${Icons.svg('map-trifold')}Na tle kraju</button>`:''}</footer></article>`;
  }
  function rows(items) {return `<div class="indicator-grid">${items.map(metricCard).join('')}</div>`;}
  // keep: background refresh (e.g. GUS data arriving) keeps the scroll position and the expanded Wikipedia text.
  function renderDetails(opts = {}) {
    if (!selected) return;
    const box = $("#gminaDetails"), keepTop = opts.keep ? box.scrollTop : 0, wikiOpen = opts.keep && !!box.querySelector(".wiki-card.open");
    selected._selectedYear = selectedYear;
    $("#dataCategories").innerHTML = categories.map((c) => `<button type="button" data-category="${esc(c)}" aria-current="${c === category}">${Icons.svg(categoryIcons[c])}<span>${esc(c)}</span></button>`).join("");
    const m = model.metrics(selected);
    let body;
    if (category === "Przegląd") {
      const groups=[{label:'Ludność i demografia',icon:'users',keys:['ludnosc','przyrost_naturalny']},{label:'Finanse i przedsiębiorczość',icon:'trend-up',keys:['firmy_na_1000','pit_na_mieszk']},{label:'Mieszkanie i infrastruktura',icon:'house-line',keys:['mieszkanie_m2_os','kanalizacja_proc']},{label:'Energia i planowanie',icon:'lightning',keys:['gaz_proc','mpzp_proc']}];
      body=`${indicatorSearchHtml()}<section class="overview-hero"><div class="overview-facts">${keyTiles(selected)}<dl id="gminaQuick" class="quick-facts"></dl></div>${window.GminaWiki?GminaWiki.minimapHtml(selected.n):""}</section><div id="gminaNeighbors"></div><div id="gminaWiki" class="wiki-slot"><p class="muted small">Wczytuję opis gminy z Wikipedii…</p></div><div id="gminaGallery"></div><div id="gminaHighlights"></div>`;
    } else if (category === "Źródła") {
      body = `<h2>Dane i ich aktualność</h2><div class="source-description">Zestaw bazowy: ${esc(data.baseBuilt)}. Dane uzupełniające pobrano: ${esc(data.cardsFetched?.slice(0, 10))}. Daty pobrania nie są rokiem obserwacji.${window.GusClient.energyInfo()?` Wskaźniki energii, ciepła, planowania i środowiska: ${window.GusClient.energyInfo().count} zmiennych GUS BDL pobranych ${esc(String(window.GusClient.energyInfo().retrievedAt||"").slice(0,10))}. Wartości oznaczone „dane powiatu” dotyczą całego powiatu. Użytkowanie gruntów GUS publikował do 2014 r.`:""} Każdy wskaźnik pokazuje własny rok; brak roku w źródle jest oznaczony wprost.</div><div class="metric-list"><div class="metric-row"><div>Identyfikator jednostki</div><div>${esc(selected.k)}<small>${esc(selected.typ)}</small></div></div><div class="metric-row"><div>Zestaw źródłowy</div><div><a href="https://bdl.stat.gov.pl/" target="_blank" rel="noopener noreferrer">GUS BDL i dane referencyjne</a></div></div><div class="metric-row"><div>Oficjalne statystyki</div><div><a href="https://bdl.stat.gov.pl/" target="_blank" rel="noopener noreferrer">GUS BDL</a></div></div><div class="metric-row"><div>Usługi i otoczenie</div><div><a href="https://xoogklastry.github.io/jakdaleko/" target="_blank" rel="noopener noreferrer">Jakdaleko ${icon("arrow")}</a><small>Obiekty i ceny RCN w warstwach; dojścia piesze w karcie adresu</small></div></div></div><h2>Źródła wskaźników</h2>${rows(m)}<p class="source-description">Powierzchnia pochodzi w pierwszej kolejności z karty GUS z podanym rokiem. Starsza wartość z bazy jest używana tylko przy braku tej karty. Brak danych nie jest zerem. Zestaw zawiera również dane opisowe z Wikidata.</p>`;
    } else {
      const items=m.filter((x)=>x.category===category),grouped=window.IndicatorIcons?window.IndicatorIcons.group(items)[0]?.groups||[]:[{label:category,items}];
      // Subgroups (e.g. Gaz / Ciepło / Prąd) keep long categories readable; a single group needs no extra heading.
      body=grouped.length>1?grouped.map(g=>`<section class="metric-section"><h2>${Icons.svg(window.IndicatorIcons.of(g.items[0]).icon)}${esc(g.label)}</h2>${rows(g.items)}</section>`).join(''):`<h2>${esc(category)}</h2>`+rows(items);
    }
    $("#gminaDetails").innerHTML = `<header class="data-heading"><div><div class="eyebrow">${esc(selected.typ)} · ${esc(region(selected))}</div><div class="municipality-title">${window.MunicipalityCrests.render(selected)}<h1 id="gminaDialogTitle">${esc(selected.n)}${popTag(selected)}</h1></div><p>TERYT ${esc(selected.k)} · ${esc(category)}</p></div><button type="button" class="map-button" data-gmina-map>Pokaż na mapie ${icon("arrow")}</button></header>${category==="Przegląd"?"":`<div class="data-tools"><label>Rok <select id="dataYear" aria-label="Rok danych"><option value="">Najnowsze dostępne</option>${window.GusClient.years().map(y=>`<option value="${y}" ${selectedYear===y?"selected":""}>${y}</option>`).join("")}</select></label><button type="button" data-refresh-gus>Odśwież z GUS</button></div><p class="gus-status" role="status">${esc(selected._gusStatus || "Pobieranie wskaźników GUS…")}</p><details class="score-method"><summary>Jak czytać oceny i pozycje?</summary><p>Zielony: najlepsze 20%, szary: środkowe 60%, czerwony: najsłabsze 20%. Pozycja dotyczy gmin z dostępnym tym samym wskaźnikiem i rocznikiem. Remisy przekraczające próg pozostają szare. Dla bezrobocia, zgonów, obciążenia demograficznego i odpadów niższa wartość jest oceniana wyżej. Wielkości opisowe, np. ludność i powierzchnia, mają pozycję według wielkości, ale pozostają szare. Brak rocznika lub dostatecznego pokrycia oznacza brak oceny. Trend pokazuje zmianę względem poprzedniego roku, a nie zmianę pozycji.</p></details>`}${body}`;
    if (category === "Przegląd") { fillCompendium(selected, wikiOpen, keepTop); if (indQuery) { $("#indSearch").value = indQuery; runIndicatorSearch(indQuery); } }
    $("#gminaDetails").scrollTop = keepTop;const active=$("#dataCategories [aria-current=true]");if(active&&app.isMobile())$("#dataCategories").scrollTo({left:Math.max(0,active.offsetLeft-20),behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"instant":"smooth"});
  }
  function changeCategory(value){if(!categories.includes(value)||value===category)return;category=value;renderDetails();const content=$('#gminaDetails');content.classList.remove('category-arrive');void content.offsetWidth;content.classList.add('category-arrive');}
  let swipe=null;
  const content=$('#gminaDetails');
  content.addEventListener('touchstart',e=>{if(!app.isMobile()||e.touches.length!==1||e.target.closest('input,select,textarea,button,a,summary')){swipe=null;return;}const t=e.touches[0];swipe=t.clientX>24&&t.clientX<innerWidth-24?{x:t.clientX,y:t.clientY,at:Date.now(),horizontal:false}:null;},{passive:true});
  content.addEventListener('touchmove',e=>{if(!swipe)return;if(e.touches.length!==1){swipe=null;return;}const t=e.touches[0],dx=t.clientX-swipe.x,dy=t.clientY-swipe.y;if(!swipe.horizontal&&Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){swipe=null;return;}if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.5){swipe.horizontal=true;if(e.cancelable)e.preventDefault();}},{passive:false});
  content.addEventListener('touchend',e=>{if(!swipe)return;const start=swipe;swipe=null;const t=e.changedTouches[0];if(!t)return;const dx=t.clientX-start.x,dy=t.clientY-start.y;if(Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.5||Date.now()-start.at>1000)return;const next=categories[categories.indexOf(category)+(dx<0?1:-1)];if(next)changeCategory(next);},{passive:true});
  content.addEventListener('touchcancel',()=>swipe=null,{passive:true});
  $('#dataCategories').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const next=categories[categories.indexOf(category)+(e.key==='ArrowRight'?1:-1)];if(next){changeCategory(next);$('#dataCategories [aria-current=true]').focus();}});
  // Compendium: Wikipedia section and national highlights, filled after the overview renders.
  const hlCache=new Map();
  /* Overview: key numbers with national position, neighbours as buttons. */
  const rankCache=new Map();
  function nationalRank(def,value){
    if(!Number.isFinite(value))return null;
    if(!rankCache.has(def.key))rankCache.set(def.key,data.gminy.map(x=>model.metric(x,def).value).filter(Number.isFinite));
    const all=rankCache.get(def.key),low=def.lowerBetter||window.IndicatorModel?.lower.includes(def.key);
    return {rank:all.filter(v=>low?v<value:v>value).length+1,n:all.length,low};
  }
  // Light pictograms for the key tiles: mannequins (people, density, migration, unemployed with a bindle), area, coins.
  const MAN=`<circle cx="12" cy="4.6" r="2.4" fill="currentColor" stroke="none"/><path d="M12 8.8v6M8.4 13 12 9.8l3.6 3.2M12 14.8l-2.6 5.6M12 14.8l2.6 5.6"/>`;
  const PAWN=(x,y)=>`<circle cx="${x}" cy="${y}" r="1.5"/><path d="M${x-2.4} ${y+4.6}a2.4 2.4 0 0 1 4.8 0z"/>`;
  const KT_ICON={
    ludnosc:`<g opacity=".45" transform="translate(6.2 1.6) scale(.82)">${MAN}</g><g transform="translate(-3 0)">${MAN}</g>`,
    powierzchnia:`<rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke-dasharray="3.2 2.4"/><path d="M8.5 15.5l7-7M12 8.5h3.5V12M12 15.5H8.5V12"/>`,
    gestosc_ludnosci:`<rect x="3" y="3" width="18" height="18" rx="3.5"/><g fill="currentColor" stroke="none">${PAWN(8,6.6)}${PAWN(16,6.6)}${PAWN(12,9.4)}${PAWN(8,13.4)}${PAWN(16,13.4)}</g>`,
    dochod_na_mieszk:`<ellipse cx="10" cy="17" rx="6" ry="2.4"/><path d="M4 17v-3.2c0-1.3 2.7-2.4 6-2.4s6 1.1 6 2.4V17"/><ellipse cx="14" cy="7" rx="6" ry="2.4"/><path d="M8 7v3.4c0 .9 1.3 1.7 3.2 2.1M20 7v3.4c0 1.1-1.8 2-4.3 2.3"/>`,
    bezrobocie_proc:`<circle cx="9.2" cy="4.6" r="2.4" fill="currentColor" stroke="none"/><path d="M9.2 8.8 8.6 14.6M8.6 14.6l-2.8 5.8M8.6 14.6l3 2.2.8 3.6M9 10.4l3 -1.4M6.2 12.2 18.4 4.6"/><circle cx="19" cy="7.4" r="2.9" fill="currentColor" fill-opacity=".25"/>`,
    saldo_migracji:`<g transform="translate(-4 0)">${MAN}</g><path d="M14 8h7M18.6 5.6 21 8l-2.4 2.4M21 15.5h-7M16.4 13.1 14 15.5l2.4 2.4"/>`
  };
  const KEY_TILES=[["ludnosc","Mieszkańcy","#0a84ff","#e6f1ff"],["powierzchnia","Powierzchnia","#28a060","#e4f5ea"],["gestosc_ludnosci","Gęstość zaludnienia","#8e5bd6","#f1eafb"],["dochod_na_mieszk","Dochody budżetu na mieszkańca","#c08400","#fff3d4"],["bezrobocie_proc","Bezrobocie","#e1601a","#fdeee4"],["saldo_migracji","Saldo migracji","#0f97b0","#e1f4f7"]];
  function keyTiles(g){
    return `<div class="key-tiles">${KEY_TILES.map(([key,title,c,b])=>{
      const def=model.definitions.find(d=>d.key===key);if(!def)return"";
      const item=model.metric(g,def);if(!Number.isFinite(item.value))return"";
      const r=nationalRank(def,item.value),tr=window.IndicatorModel?.trend(item),desc=["ludnosc","powierzchnia","gestosc_ludnosci"].includes(key);
      const pos=r?`${r.rank.toLocaleString("pl-PL")}. z ${r.n.toLocaleString("pl-PL")}`:"",how=r?(desc?"pozycja według wielkości":r.low?"pozycja od najniższej wartości":"pozycja od najwyższej wartości"):"";
      const trend=key==="ludnosc"&&tr?.direction?`<span class="kt-trend kt-${tr.direction}">${esc(tr.text)}</span>`:"";
      return `<div class="key-tile" style="--kc:${c};--kb:${b}"><span class="kt-head"><svg class="kt-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${KT_ICON[key]||""}</svg><span class="kt-label">${esc(title)}</span></span><strong>${esc(model.formatValue(item,false))}<small>${esc(item.unit||"")}</small></strong><span class="kt-sub" title="${esc(how)}">${pos?`<b>${esc(pos)}</b> w kraju`:""}${item.year?" · "+esc(String(item.year)):""}</span>${trend}</div>`;
    }).join("")}</div>`;
  }
  // Indicator finder on the overview: every indicator of the gmina, matched by name, unit or category (diacritics ignored).
  const norm=s=>String(s??"").toLocaleLowerCase("pl-PL").replace(/ł/g,"l").normalize("NFD").replace(/[̀-ͯ]/g,"");
  function indicatorSearchHtml(){return `<div class="ind-search">${Icons.svg("magnifying-glass")}<input id="indSearch" type="search" autocomplete="off" placeholder="Szukaj wskaźnika, np. bezrobocie, PIT" aria-label="Szukaj wskaźnika"/></div><div id="indResults" class="ind-results"></div>`;}
  function runIndicatorSearch(q){
    const box=$("#indResults");if(!box||!selected)return;
    const words=norm(q).split(/\s+/).filter(Boolean);if(!words.length){box.innerHTML="";return;}
    const found=model.metrics(selected).filter(x=>{const hay=norm(`${x.label} ${x.category} ${x.unit||""} ${x.key}`);return words.every(w=>hay.includes(w));});
    const shown=found.filter(x=>Number.isFinite(x.value)).concat(found.filter(x=>!Number.isFinite(x.value))).slice(0,12);
    box.innerHTML=found.length?`<p class="muted small">${found.length===1?"1 wskaźnik":found.length+" wskaźników"}${found.length>shown.length?`, pokazuję ${shown.length}. Dopisz więcej słów, aby zawęzić`:""}</p>${rows(shown)}`:`<p class="muted small">Brak wskaźnika pasującego do „${esc(q)}”.</p>`;
  }
  async function fillNeighbours(g){
    const el=$("#gminaNeighbors");if(!el||!window.GminaWiki)return;
    const ks=await window.GminaWiki.neighbours(g.k);if(selected!==g||!el.isConnected)return;
    const list=ks.map(k=>data.gminy.find(x=>x.k===k)).filter(Boolean).sort((a,b)=>a.n.localeCompare(b.n,"pl"));
    el.innerHTML=list.length?`<section class="metric-section"><h2>${Icons.svg("map-trifold")}Sąsiednie gminy <span class="muted small">${list.length}</span></h2><div class="neighbor-list">${list.map(x=>`<button type="button" class="neighbor" data-neighbor="${esc(x.k)}">${esc(x.n)}${popTag(x)}<small>${esc(x.typ||"gmina")}${x.k.slice(0,4)!==g.k.slice(0,4)?" · "+esc(region(x)):""}</small></button>`).join("")}</div></section>`:"";
    return Object.fromEntries(list.map(x=>[x.k,x.n]));
  }
  function fillCompendium(g, wikiOpen = false, keepTop = 0){
    const W=window.GminaWiki;if(!W)return;
    fillNeighbours(g).then(names=>{if(selected===g)W.minimap($("#gminaMinimap"),g.k,{...names,[g.k]:g.n});}).catch(()=>{});
    W.loadPhotos(g.k).then(photos=>{const el=$("#gminaGallery");if(!el||selected!==g)return;el.innerHTML=W.galleryHtml(photos,g.n);el.onclick=e=>{const b=e.target.closest("[data-photo]");if(b)W.openPhoto(photos,Number(b.dataset.photo),g.n);};}).catch(()=>{});
    W.load(g.k).then(w=>{const el=$("#gminaWiki");if(!el||selected!==g)return;el.innerHTML=W.render(w,g.n);const q=$("#gminaQuick");if(q&&w)q.innerHTML=W.quick(w);if(wikiOpen){el.querySelector(".wiki-card")?.classList.add("open");const b=el.querySelector("[data-wiki-more]");if(b){b.setAttribute("aria-expanded","true");b.textContent="Zwiń";}}if(keepTop)$("#gminaDetails").scrollTop=keepTop;}).catch(()=>{const el=$("#gminaWiki");if(el)el.innerHTML="";});
    const drawHl=()=>{if(selected!==g||category!=="Przegląd")return;const el=$("#gminaHighlights");if(!el)return;const key=g.k+":"+model.definitions.length;if(!hlCache.has(key))hlCache.set(key,W.highlights(model,data.gminy,g));const h=hlCache.get(key);
      el.innerHTML=h.length?`<section class="metric-section"><h2>${Icons.svg('trend-up')}Wyróżnia się na tle kraju</h2><ol class="highlight-list">${h.map(x=>`<li><span class="hl-rank">${x.rank.toLocaleString('pl-PL')}.</span><span class="hl-body">${Icons.svg(window.IndicatorIcons.of(x.def).icon)}<span>${esc(x.def.label)}<small>${esc(model.formatValue({...x.def,value:x.v},false))} ${esc(x.def.unit||'')} · ${x.rank.toLocaleString('pl-PL')}. miejsce z ${x.n.toLocaleString('pl-PL')} gmin</small></span></span><button type="button" class="stat-map-link" data-stat-map="${esc(x.def.key)}" aria-label="Pokaż ${esc(x.def.label)} na tle kraju">${Icons.svg('map-trifold')}</button></li>`).join('')}</ol></section>`:'';if(keepTop)$("#gminaDetails").scrollTop=keepTop;};
    if(hlCache.has(g.k+":"+model.definitions.length))drawHl();else setTimeout(drawHl,30);
  }
  function failure(error) {
    console.warn("Municipality data:", error.message);
    $("#gminaCard").innerHTML = `<div class="inline-error">Dane gmin są chwilowo niedostępne.<br><button type="button" class="retry" data-gmina-retry>Spróbuj ponownie</button></div>`;
  }
  /* Population next to the gmina name: whole gmina (GUS), plus the town for urban-rural gminas (data/miasta.json). */
  let towns={};
  const townsReady=fetch("data/miasta.json").then(r=>r.ok?r.json():{miasta:{}}).then(d=>{towns=d.miasta||{};}).catch(()=>{});
  function popText(g){
    const pop=model.metric(g,model.definitions.find(d=>d.key==="ludnosc")).value;if(!Number.isFinite(pop))return "";
    const t=towns[g.k],fmt=v=>Math.round(v).toLocaleString("pl-PL");
    return t&&/miejsko-wiejska/.test(g.typ||"")?`${fmt(pop)}, ${fmt(t.v)} w mieście${t.n&&t.n!==g.n?" "+t.n:""}`:fmt(pop);
  }
  function popTag(g){const t=popText(g);return t?` <span class="gmina-pop">(${esc(t)})</span>`:"";}
  async function initialize() {
    try {
      await load();
      await Promise.all([window.GusClient.ready().catch(()=>{}),townsReady]);
      const params = new URLSearchParams(location.search), initial = params.get("gmina") || app.store.get("gmina", null);
      if (pendingParcel) { const id = pendingParcel; pendingParcel = null; selected = data.gminy.find((g) => g.k === id) || null; drawCard(); }
      else if (initial && data.gminy.some((g) => g.k === initial)) { selected = data.gminy.find((g) => g.k === initial); drawCard(); if (params.has("gmina")) app.showGmina(); }
      else chooser();
      if(selected){await window.GusClient.seed(selected).catch(()=>{});drawCard();loadGus(selected,false).catch(()=>{});}
    } catch (error) { failure(error); }
  }
  window.PLOTS_GMINY = {
    select,
    openDetails(replace=false){if(!selected)return;renderDetails();dialog.showModal();window.UIHistory?.open("gmina-details",()=>dialog.close(),replace);},
    async setContext(id,message='') {
      const context=++contextRevision;await load();if(context!==contextRevision)return;const g=id?data.gminy.find(item=>item.k===id):null;
      const changed=selected?.k!==g?.k;selected=g||null;selectedYear=null;
      if(selected){app.store.set('gmina',selected.k);await window.GusClient.seed(selected).catch(()=>{});if(context!==contextRevision)return;drawCard();if(changed)loadGus(selected,false).catch(()=>{});}
      else{document.dispatchEvent(new CustomEvent('plots:gmina',{detail:{id:null}}));app.store.set('gmina',null);$('#gminaCard').innerHTML=`<div class="empty-context">${icon('town')}<h2>Gmina miejsca</h2><p class="muted small">${esc(message||'Wybierz punkt, adres lub działkę na mapie.')}</p><button type="button" class="gmina-back" data-choose-gmina>Wyszukaj gminę</button></div>`;}
      if(dialog.open&&selected)renderDetails();
    },
    current: () => selected?.k || null,
    async all() { await load(); return data.gminy; },
    async search(query) { await load(); return model.search(data.gminy, query).map((g) => ({ kind: "gmina", data: g, title: g.n, sub: `${g.typ || "Gmina"} · ${region(g)} · TERYT ${g.k}` })); }
  };
  $("#gminaCard").addEventListener("click", (e) => {
    const button = e.target.closest("button"); if (!button) return;
    if (button.dataset.gmina) select(button.dataset.gmina, true);
    if (button.hasAttribute("data-choose-gmina")) chooser();
    if (button.hasAttribute("data-gmina-details")) { window.PLOTS_GMINY.openDetails(); }
    if (button.hasAttribute("data-gmina-retry")) initialize();
  });
  $("#dataCategories").addEventListener("click", (e) => { const b = e.target.closest("[data-category]"); if (b) { changeCategory(b.dataset.category); } });
  dialog.addEventListener("close",()=>window.UIHistory?.dismiss("gmina-details"));
  $("#closeGmina").onclick = () => dialog.close();
  $("#gminaDetails").addEventListener("gmina-pick", (e) => { select(e.detail, false).then(()=>{$("#gminaDetails").scrollTop=0;}); });
  $("#gminaDetails").addEventListener("input", (e) => { if (e.target.id === "indSearch") { indQuery = e.target.value; runIndicatorSearch(indQuery); } });
  $("#gminaDetails").addEventListener("click", (e) => { const more=e.target.closest("[data-wiki-more]");if(more){const open=more.getAttribute("aria-expanded")!=="true";more.setAttribute("aria-expanded",open);more.textContent=open?"Zwiń":"Czytaj dalej";more.closest(".wiki-card").classList.toggle("open",open);} });
  $("#gminaDetails").addEventListener("click", (e) => { if (e.target.closest("[data-gmina-map]")) { dialog.close(); select(selected.k, true); } const n=e.target.closest("[data-neighbor]"); if (n) { select(n.dataset.neighbor, false).then(()=>{$("#gminaDetails").scrollTop=0;}); } });
  $("#gminaDetails").addEventListener("click", async e=>{const b=e.target.closest("[data-refresh-gus]");if(b){b.disabled=true;b.textContent="Pobieram…";try{await loadGus(selected,true);}finally{if(b.isConnected){b.disabled=false;b.textContent="Odśwież z GUS";}}}});
  $("#gminaDetails").addEventListener("change",e=>{if(e.target.id==="dataYear"){selectedYear=e.target.value?Number(e.target.value):null;renderDetails();}});
  document.addEventListener("plots:parcel", e=>{const id=model.parcelTeryt(e.detail.id_dzialki);if(id)window.PLOTS_GMINY.setContext(id).catch(failure);});
  initialize();
})();
