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
  window.PLOTS_PLANNING = { inspecting: () => inspect, inspectPoint: e => identify(e,true) };
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
    const current=request;
    const R=6378137,merc=([lon,lat])=>[R*lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
    const center=merc([e.lngLat.lng,e.lngLat.lat]),metres=80;
    const parts=await Promise.all(selected.map(async s=>{
      const url=new URL(s.url);const params={SERVICE:"WMS",VERSION:"1.3.0",REQUEST:"GetFeatureInfo",LAYERS:s.layers,QUERY_LAYERS:s.query,STYLES:"",CRS:"EPSG:3857",BBOX:[center[0]-metres,center[1]-metres,center[0]+metres,center[1]+metres].join(","),WIDTH:"256",HEIGHT:"256",I:"128",J:"128",FEATURE_COUNT:"10",INFO_FORMAT:"text/html"};
      Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
      try {
        const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error("HTTP "+r.status);
        const raw=await r.text();if(/ServiceException|ExceptionReport/i.test(raw))throw Error("Usługa nie zwróciła poprawnej identyfikacji");
        const doc=new DOMParser().parseFromString(raw,"text/html");doc.querySelectorAll("script,style,iframe,object").forEach(n=>n.remove());
        const text=(doc.body.textContent||"").replace(/\s+/g," ").trim();
        const links=[...doc.querySelectorAll("a[href]")].slice(0,4).flatMap(a=>{try{const target=new URL(a.getAttribute("href"),s.url);return target.protocol==="https:"?[`<a href="${esc(target.href)}" target="_blank" rel="noopener noreferrer">${esc((a.textContent||"Dokument źródłowy").slice(0,100))}</a>`]:[];}catch{return [];}});
        const table=[...doc.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('th,td')].map(c=>c.textContent.replace(/\s+/g,' ').trim()).filter(Boolean).join(': ')).filter(Boolean);
        const blocks=table.length?table:[...doc.querySelectorAll('p,li')].map(n=>n.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
        const facts=(blocks.length?blocks:text?[text]:['Usługa nie zwróciła obiektów dla tego punktu.']).slice(0,30);
        return `<section class="plan-result"><h3>${esc(s.label)}</h3><ul class="plan-facts">${facts.map(t=>`<li>${esc(t.slice(0,700))}</li>`).join('')}${links.map(link=>`<li>${link}</li>`).join('')}</ul><small>${esc(s.date)}</small></section>`;
      }catch(error){return `<section class="plan-result"><h3>${esc(s.label)}</h3><p>Nie udało się pobrać informacji z tej usługi. Spróbuj ponownie lub sprawdź dokument w rejestrze.</p></section>`;}
    }));
    if(current!==request||app.currentTab()!=="info")return;
    app.showInfo(`<div class="phead"><div><h2>Planowanie</h2><p class="muted small">${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}</p></div></div>${parts.join("")}<p class="source-note muted">Brak obiektu w usłudze nie potwierdza braku planu. <a href="https://rejestr-urbanistyczny.gov.pl/published" target="_blank" rel="noopener noreferrer">Sprawdź rejestr</a></p>`);
  }
  document.addEventListener('plots:selection',()=>request++);
  map.on('click',e=>{if(inspect)identify(e);});
  map.on("error",e=>{if(e.sourceId?.startsWith("plan-source-"))document.getElementById("planningStatus").textContent="Usługa planowania jest chwilowo niedostępna lub nie obsługuje tego widoku.";});
})();
