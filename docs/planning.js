(function () {
  "use strict";
  const app = window.PLOTS, map = app.map, esc = app.esc;
  const services = [
    { id: "mpzp", label: "MPZP", description: "Rysunki planów i strefy", url: "https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaMiejscowychPlanowZagospodarowaniaPrzestrzennego", layers: "raster,wektor-str", query: "raster,wektor-str", date: "Usługi gmin / GUGiK" },
    { id: "pog", label: "Plany ogólne · uchwalone", description: "Strefy planistyczne", url: "https://mapy.geoportal.gov.pl/wss/ext/PlanyOgolneGmin", layers: "strefaPlanistyczna,aktPlanowaniaprzestrzennego", query: "strefaPlanistyczna,aktPlanowaniaprzestrzennego", date: "GUGiK · uchwalone POG" },
    { id: "pog-draft", label: "Plany ogólne · projekty", description: "Projekty, nie plany uchwalone", url: "https://mapy.geoportal.gov.pl/wss/ext/ProjektowanePlanyOgolneGmin", layers: "strefaPlanistyczna,obszarUzupelnieniaZabudowy", query: "strefaPlanistyczna,obszarUzupelnieniaZabudowy", date: "GUGiK · projektowane POG" }
  ];
  const panel = document.getElementById("planningLayers");
  panel.innerHTML = `<h3>Planowanie przestrzenne</h3>${services.map(s=>`<div class="layer-entry" data-keywords="planowanie ${esc(s.label)} mpzp pog zagospodarowanie"><label class="sw"><input type="checkbox" id="plan-${s.id}" data-plan="${s.id}"/><span></span><div>${esc(s.label)}<small>${esc(s.description)}</small></div></label></div>`).join("")}<button type="button" id="inspectPlans" class="secondary-action" aria-pressed="false">Wskaż plan na mapie</button><p class="source-note muted">Zasięg zależy od publikacji gmin. Projekty są oddzielone od uchwalonych planów. <a href="https://rejestr-urbanistyczny.gov.pl/published" target="_blank" rel="noopener noreferrer">Rejestr Urbanistyczny</a></p><p id="planningStatus" class="source-note muted" role="status"></p>`;
  let inspect = false, request = 0;
  window.PLOTS_PLANNING = { inspecting: () => inspect, inspectPoint: e => identify(e,true), loadInto };
  function count() { panel.dispatchEvent(new Event("change", { bubbles: true })); }
  function active() { return services.filter(s=>document.getElementById("plan-"+s.id).checked); }
  function initialize() {
    for (const s of services) {
      const id = "plan-source-" + s.id;
      app.registerOverlaySource(id);
      map.addSource(id, { type: "raster", tiles: [s.url+"?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS="+s.layers+"&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=TRUE"], tileSize: 256, maxzoom: 20, attribution: "© GUGiK · " + s.label });
      const checkbox = document.getElementById("plan-" + s.id);
      checkbox.checked = app.store.get("planning." + s.id, false);
      map.addLayer({ id, type:"raster", source:id, minzoom: 9, layout:{visibility:checkbox.checked?"visible":"none"}, paint:{"raster-opacity":.72,"raster-fade-duration":100} });
      checkbox.onchange=()=>{map.setLayoutProperty(id,"visibility",checkbox.checked?"visible":"none");app.store.set("planning."+s.id,checkbox.checked);document.getElementById("planningStatus").textContent=checkbox.checked?"Jeśli nie widzisz danych, przybliż mapę lub sprawdź zasięg publikacji gminy.":"";if(!active().length){inspect=false;document.getElementById("inspectPlans").setAttribute("aria-pressed","false");}};
    }
    count();
  }
  if (map.loaded()) initialize(); else map.once("load", initialize);
  document.getElementById("inspectPlans").onclick=()=>{
    if(!active().length){app.toast("Najpierw włącz MPZP lub plan ogólny");return;}
    inspect=!inspect;document.getElementById("inspectPlans").setAttribute("aria-pressed",String(inspect));
    document.getElementById("planningStatus").textContent=inspect?"Wskaż punkt na mapie. Identyfikacja dotyczy aktywnych usług planowania.":"";
    app.toast(inspect?"Wskaż plan na mapie":"Identyfikacja planów wyłączona");
    if(inspect)document.querySelector("[data-close-layers]").click();
  };
  async function identify(e, all=false){
    const selected=all?services:active();
    if(!selected.length)return;
    app.showInfo(`<div class="phead"><div><h2>Planowanie</h2><p class="muted small">Sprawdzam wskazany punkt…</p></div></div>`);
    app.markPoint([e.lngLat.lng,e.lngLat.lat]);
    document.dispatchEvent(new CustomEvent("plots:point",{detail:{lon:e.lngLat.lng,lat:e.lngLat.lat}}));
    const current=request;
    const parts=await queryPoint({lon:e.lngLat.lng,lat:e.lngLat.lat},selected);
    if(current!==request||app.currentTab()!=="info")return;
    app.showInfo(`<div class="phead"><div><h2>Planowanie</h2><p class="muted small">${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}</p></div></div>${parts.join("")}<p class="source-note muted">Brak obiektu w usłudze nie potwierdza braku planu. <a href="https://rejestr-urbanistyczny.gov.pl/published" target="_blank" rel="noopener noreferrer">Sprawdź rejestr</a></p>`);
  }
  const queryCache=new Map(),queryPending=new Map();
  async function queryPoint(point,selected=services){const key=[point.lon.toFixed(6),point.lat.toFixed(6),selected.map(s=>s.id).join(',')].join('/'),cached=queryCache.get(key);if(cached&&Date.now()-cached.at<60000)return cached.parts;if(!queryPending.has(key))queryPending.set(key,fetchPoint(point,selected).then(parts=>{if(!parts.some(p=>p.includes('Nie udało'))){queryCache.set(key,{at:Date.now(),parts});while(queryCache.size>20)queryCache.delete(queryCache.keys().next().value);}return parts;}).finally(()=>queryPending.delete(key)));return queryPending.get(key);}
  /* Plain-language reading of what the municipal services return. Every gmina publishes different columns,
     so the land-use symbol, its description, the plan name and the resolution are found by column-name heuristics. */
  const nk=t=>String(t||"").toLowerCase().replace(/ł/g,"l").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"");
  const USE={MN:["zabudowa mieszkaniowa jednorodzinna",1],MW:["zabudowa mieszkaniowa wielorodzinna",1],M:["zabudowa mieszkaniowa",1],MU:["zabudowa mieszkaniowo-usługowa",1],MNU:["zabudowa mieszkaniowa jednorodzinna z usługami",1],MWU:["zabudowa mieszkaniowa wielorodzinna z usługami",1],ML:["zabudowa letniskowa",1],MR:["zabudowa zagrodowa",1],RM:["zabudowa zagrodowa",1],
    U:["zabudowa usługowa",1],UC:["handel wielkopowierzchniowy",1],UH:["usługi handlu",1],US:["sport i rekreacja",1],UP:["usługi publiczne",1],UO:["usługi oświaty",1],UK:["usługi kultury",1],UZ:["usługi zdrowia",1],UT:["usługi turystyki",1],
    P:["produkcja, składy i magazyny",1],PU:["produkcja i usługi",1],PG:["teren górniczy",0],R:["teren rolniczy",0],RU:["obsługa produkcji rolnej",1],RL:["teren do zalesienia",0],
    ZL:["las",0],ZP:["zieleń urządzona",0],ZD:["ogrody działkowe",0],ZC:["cmentarz",0],ZN:["zieleń chroniona",0],Z:["zieleń",0],ZI:["zieleń izolacyjna",0],WS:["wody powierzchniowe",0],
    KD:["droga publiczna",0],KDA:["autostrada",0],KDS:["droga ekspresowa",0],KDG:["droga główna",0],KDZ:["droga zbiorcza",0],KDL:["droga lokalna",0],KDD:["droga dojazdowa",0],KDW:["droga wewnętrzna",0],KK:["teren kolejowy",0],KS:["parking",0],KP:["ciąg pieszy",0],
    E:["elektroenergetyka",0],G:["gazownictwo",0],W:["wodociągi",0],K:["kanalizacja",0],T:["telekomunikacja",0],IT:["infrastruktura techniczna",0]};
  function decodeSymbol(sym){
    const out=[];
    for(const t of String(sym||"").toUpperCase().match(/[A-ZŁ]+/g)||[]){const u=USE[t]||(t.length===3?USE[t.slice(0,2)]:null);if(u&&!out.includes(u))out.push(u);}
    return out;
  }
  const SKIP=/^(fid|gid|id|objectid|ogcfid|uuid|gmlid|shape|geom|geometry|thegeom|lokalnyid|wersjaid|przestrzennazw|organizationid|identyfikator|nrporzadk|gdbid|idpg|aktualny)/;
  function readRecords(doc){
    const recs=[];
    for(const table of doc.querySelectorAll("table")){
      const rows=[...table.querySelectorAll("tr")],head=rows.findIndex(r=>r.querySelector("th"));if(head<0)continue;
      const keys=[...rows[head].querySelectorAll("th")].map(c=>c.textContent.replace(/\s+/g," ").trim());
      for(const row of rows.slice(head+1)){const cells=[...row.querySelectorAll("td")];if(cells.length<2)continue;
        const rec=[];cells.forEach((c,i)=>{const v=c.textContent.replace(/\s+/g," ").trim();if(keys[i]&&v&&v!=="N;"&&v.toLowerCase()!=="null")rec.push([keys[i],v]);});
        if(rec.length)recs.push(rec);}
    }
    const seen=new Set();return recs.filter(r=>{const k=JSON.stringify(r.filter(([a])=>!SKIP.test(nk(a))));if(seen.has(k))return false;seen.add(k);return true;});
  }
  const pick=(rec,test,ok=()=>true)=>{for(const [k,v] of rec){if(test(nk(k))&&ok(v))return v;}return "";};
  function summarize(rec){
    const symbol=pick(rec,n=>/^(symbol|symb|oznaczenie|symbolwplanie|symbolterenu|oznaczenieterenu|przeznaczeniesymbol|funkcjasymbol|ozn)$/.test(n),v=>v.length<=14);
    let opis=pick(rec,n=>/^(przeznaczenie|opisoznac|opisprzeznaczenia|przeznaczeniepodstawowe|przeznaczenieterenu|funkcjapodstawowaopis|opissymbolu|nazwastrefy|profilpodstawowy)$/.test(n),v=>v.length>3);
    if(!opis)opis=pick(rec,n=>n.includes("przeznacz")&&!n.includes("symbol"),v=>v.length>3);
    const used=decodeSymbol(symbol||pick(rec,n=>/^(funkcjapodstawowa|rodzajoznaczenia)$/.test(n),v=>v.length<=14));
    const nazwa=pick(rec,n=>/^(nazwaplanu|nazwampzp|tytul|nazwa|name|nazwaskrocona)$/.test(n),v=>v.length>3);
    const uchwala=pick(rec,n=>/^(numeruchwaly|nruchwaly|uchwalenie|uchwala|dokumentuchwalajacy)$/.test(n));
    const data=pick(rec,n=>/^(datauchwalenia|datauchwaly)$/.test(n),v=>v.length<=24).replace(/,?\s*0?0:00(:00)?( AM)?$/i,"");
    const status=pick(rec,n=>/^(status|state|statusterenu)$/.test(n));
    const urls=rec.map(([,v])=>v).filter(v=>/^https:\/\/\S+$/.test(v)).slice(0,2);
    return {symbol,opis,used,nazwa,uchwala,data,status,urls,dead:/archiw|uchyl|niewa|wygas|nieobow/i.test(status)};
  }
  const cap=t=>t?t.charAt(0).toUpperCase()+t.slice(1):t;
  function planHTML(s,recs,text){
    if(!recs.length){
      if(s.id!=="mpzp")return {html:`<section class="plan-result plan-empty"><h3>${esc(s.label)}</h3><p>Brak danych dla tego punktu.</p></section>`,verdict:null};
      const noService=/brak serwisu/i.test(text);
      return {html:`<section class="plan-result plan-empty"><h3>${esc(s.label)}</h3><p>${noService?"Gmina nie udostępnia planów miejscowych w krajowej usłudze.":"Usługa nie zwraca planu miejscowego w tym punkcie."}</p><p class="muted small">Jeśli planu rzeczywiście nie ma, zabudowa wymaga zwykle decyzji o warunkach zabudowy. Potwierdź w urzędzie gminy.</p></section>`,
        verdict:{tone:"none",text:noService?"brak danych gminy":"brak planu w danych"}};
    }
    const sums=recs.map(summarize),best=sums.find(x=>(x.symbol||x.opis)&&!x.dead)||sums.find(x=>x.symbol||x.opis)||sums[0];
    const label=best.opis||best.used.map(u=>u[0]).join(", ");
    const build=best.used.length?best.used.some(u=>u[1]):null;
    const head=`<p class="plan-use">${best.symbol?`<b class="plan-sym">${esc(best.symbol)}</b>`:""}<span>${esc(cap(label)||"Teren objęty planem miejscowym")}</span></p>`;
    const tag=best.dead?`<p class="plan-tag warn">Status w usłudze: ${esc(best.status.toLowerCase())}</p>`:build===true?`<p class="plan-tag good">Według symbolu: teren pod zabudowę</p>`:build===false?`<p class="plan-tag warn">Według symbolu: teren bez zabudowy</p>`:"";
    const nazwa=best.nazwa&&(best.nazwa.length>120?best.nazwa.slice(0,118)+"…":best.nazwa),uchw=best.uchwala&&best.uchwala.replace(/^uchwała\s*(nr)?\s*/i,"").slice(0,90);
    const meta=[nazwa,uchw&&!(best.nazwa||"").toLowerCase().includes(uchw.toLowerCase().slice(0,14))&&("uchwała "+uchw),best.data].filter(Boolean);
    const raw=recs.slice(0,4).map(rec=>`<dl>${rec.filter(([k,v])=>!SKIP.test(nk(k))&&!/^https?:/.test(v)).slice(0,24).map(([k,v])=>`<div><dt>${esc(k.replace(/_/g," "))}</dt><dd>${esc(v.slice(0,400))}</dd></div>`).join("")}</dl>`).join("");
    const links=[...new Set(sums.flatMap(x=>x.urls))].slice(0,2).map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${i?"Dokument 2":"Dokument planu"}</a>`).join(" · ");
    const html=`<section class="plan-result plan-smart"><h3>${esc(s.label)}</h3>${head}${tag}${meta.length?`<p class="plan-meta">${esc(meta.join(" · "))}</p>`:""}${links?`<p class="plan-meta">${links}</p>`:""}<details class="plan-raw"><summary>Wszystkie dane z usługi${recs.length>1?` (${recs.length})`:""}</summary>${raw}</details><small>${esc(s.date)}</small></section>`;
    const verdict=s.id==="mpzp"?{tone:best.dead?"warn":build===true?"good":build===false?"warn":"info",text:best.symbol?`${best.symbol}${label?" · "+label.toLowerCase():""}`:label?label.toLowerCase():"jest plan miejscowy"}:null;
    return {html,verdict};
  }
  async function decodeBody(r){
    const buf=await r.arrayBuffer();
    try{return new TextDecoder("utf-8",{fatal:true}).decode(buf);}catch{return new TextDecoder("windows-1250").decode(buf);}
  }
  async function fetchPoint(point,selected=services){
    const R=6378137,merc=([lon,lat])=>[R*lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
    const center=merc([point.lon,point.lat]),metres=80;
    let verdict=null;
    const parts=await Promise.all(selected.map(async s=>{
      const url=new URL(s.url);const params={SERVICE:"WMS",VERSION:"1.3.0",REQUEST:"GetFeatureInfo",LAYERS:s.layers,QUERY_LAYERS:s.query,STYLES:"",CRS:"EPSG:3857",BBOX:[center[0]-metres,center[1]-metres,center[0]+metres,center[1]+metres].join(","),WIDTH:"256",HEIGHT:"256",I:"128",J:"128",FEATURE_COUNT:"10",INFO_FORMAT:"text/html"};
      Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
      try {
        const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error("HTTP "+r.status);
        const raw=await decodeBody(r);if(/ServiceException|ExceptionReport/i.test(raw))throw Error("Usługa nie zwróciła poprawnej identyfikacji");
        const doc=new DOMParser().parseFromString(raw,"text/html");doc.querySelectorAll("script,style,iframe,object").forEach(n=>n.remove());
        const res=planHTML(s,readRecords(doc),(doc.body.textContent||"").replace(/\s+/g," ").trim());
        if(res.verdict)verdict=res.verdict;
        return res.html;
      }catch(error){if(s.id==="mpzp")verdict={tone:"none",text:"nie udało się sprawdzić"};return `<section class="plan-result"><h3>${esc(s.label)}</h3><p>Nie udało się pobrać informacji z tej usługi. Spróbuj ponownie lub sprawdź dokument w rejestrze.</p></section>`;}
    }));
    parts.verdict=verdict;
    return parts;
  }
  async function loadInto(point,element){
    if(!element)return;const token=String(Math.random());element.dataset.request=token;element.innerHTML='<p class="muted small">Sprawdzam MPZP i plany ogólne w punkcie…</p>';
    const parts=await queryPoint(point);if(!element.isConnected||element.dataset.request!==token)return;
    // In the place card the empty general-plan answers only add noise: keep MPZP and whatever has data.
    const shown=parts.filter((h,i)=>i===0||!h.includes("plan-empty"));
    element.innerHTML=shown.join('')+'<p class="source-note">Informacje dotyczą wskazanego punktu, nie całej działki. Symbole odczytano automatycznie, wiążąca jest treść uchwały. Brak odpowiedzi usługi nie potwierdza braku planu.</p>';
    document.dispatchEvent(new CustomEvent("plots:verdict",{detail:{kind:"plan",point,verdict:parts.verdict||{tone:"none",text:"brak danych"}}}));
  }
  document.addEventListener('plots:selection',()=>request++);
  map.on('click',e=>{if(inspect&&map.getZoom()>=13&&!window.DistanceModule?.isOpen())identify(e);});
  map.on("error",e=>{if(e.sourceId?.startsWith("plan-source-"))document.getElementById("planningStatus").textContent="Usługa planowania jest chwilowo niedostępna lub nie obsługuje tego widoku.";});
})();
