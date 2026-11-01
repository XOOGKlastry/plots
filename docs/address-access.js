(function(){
  'use strict';
  const app=window.PLOTS,map=app.map,esc=app.esc,model=window.AccessModel;
  const endpoint=window.PLOTS_CONFIG?.routingUrl||'https://valhalla1.openstreetmap.de/sources_to_targets';
  const resultCache=new Map();let currentResults=[];let origin=null,revision=0,controller=null;
  const empty=()=>({type:'FeatureCollection',features:[]});
  function clear(){revision++;controller?.abort();origin=null;document.getElementById('card').classList.remove('access-focused');map.getSource('address-directions')?.setData(empty());}
  function initialize(){
    app.registerOverlaySource('address-directions');map.addSource('address-directions',{type:'geojson',data:empty(),attribution:'© OpenStreetMap · Valhalla'});
    map.addLayer({id:'address-direction-lines',type:'line',source:'address-directions',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#007aff','line-width':2.5,'line-dasharray':[2,3],'line-opacity':.85}});
    map.addLayer({id:'address-direction-points',type:'circle',source:'address-directions',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':13,'circle-color':'#007aff','circle-stroke-color':'#fff','circle-stroke-width':3}});
    map.addLayer({id:'address-direction-labels',type:'symbol',source:'address-directions',filter:['==',['geometry-type'],'Point'],layout:{'text-field':['to-string',['get','rank']],'text-font':['Noto Sans Regular'],'text-size':12,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
  }
  if(map.loaded())initialize();else map.once('load',initialize);
  document.addEventListener('plots:selection',clear);
  document.addEventListener('plots:address',async e=>{
    const current=revision;origin={lon:Number(e.detail.lon),lat:Number(e.detail.lat)};
    const cfg=await window.PLOTS_SURROUNDINGS.ready().catch(()=>null),el=document.getElementById('addressAccess');
    if(!el||current!==revision)return;if(!cfg){el.innerHTML='<p class="muted small">Katalog obiektów jest chwilowo niedostępny. Odśwież stronę, aby spróbować ponownie.</p>';return;}
    const frequent=['szkola','przedszkole','poz','apteka'],categoryIcons={szkola:'graduation-cap',przedszkole:'baby',poz:'first-aid-kit',apteka:'pill'};
    el.innerHTML=`<section class="address-access"><h3>${Icons.svg('person-simple-walk')}Dojście pieszo</h3><div class="access-categories">${frequent.map(id=>{const n=cfg.networks.find(n=>n.id===id);return `<button type="button" data-access="${id}" title="${esc(n.label)}">${Icons.svg(categoryIcons[id])}<span>${esc({szkola:'Szkoły',przedszkole:'Przedszkola',poz:'Przychodnie',apteka:'Apteki'}[id])}</span></button>`;}).join('')}</div><label class="access-select">Inne obiekty<select id="accessCategory"><option value="">Wybierz kategorię</option>${cfg.categories.map(c=>`<optgroup label="${esc(c.label)}">${cfg.networks.filter(n=>n.cat===c.id).map(n=>`<option value="${esc(n.id)}">${esc(n.label)}</option>`).join('')}</optgroup>`).join('')}</select></label><div id="accessResults" aria-live="polite"><p class="muted small">Wybierz kategorię, aby zobaczyć trzy najbliższe obiekty.</p></div></section>`;
  });
  async function matrix(at,targets,signal){
    const loc=p=>({lat:p.lat,lon:p.lon,radius:100,search_cutoff:100});
    const payload={sources:[loc(at)],targets:targets.map(loc),costing:'pedestrian',units:'kilometers'};
    const url=new URL(endpoint);if(url.protocol!=='https:')throw Error('Routing wymaga HTTPS');url.searchParams.set('json',JSON.stringify(payload));
    const r=await fetch(url,{signal});if(!r.ok)throw Error(r.status===429?'Usługa dojścia jest zajęta. Spróbuj za chwilę.':'Nie udało się obliczyć dojścia. Spróbuj ponownie.');
    return model.matrixRow(await r.json(),targets);
  }
  async function nearest(at,id,signal,current){
    const key=`${at.lon},${at.lat}/${id}`;if(resultCache.has(key))return resultCache.get(key);
    const candidates=await window.PLOTS_SURROUNDINGS.candidates(at,id,25000),results=[];let done=false,checked=0;
    for(let i=0;i<Math.min(candidates.length,120);i+=30){
      if(current!==revision)throw new DOMException('Przerwano','AbortError');
      const batch=candidates.slice(i,i+30);results.push(...await matrix(at,batch,signal));checked+=batch.length;
      const next=candidates[checked]?.straight??25000;
      if(model.complete(results,next)){done=true;break;}
      if(checked>=candidates.length){done=true;break;}
      await new Promise(resolve=>setTimeout(resolve,1100));
    }
    const top=await Promise.all(model.closest(results).map(async p=>({...p,name:await window.PLOTS_SURROUNDINGS.nameFor(p)})));
    const result={top,complete:done,checked,total:candidates.length};resultCache.set(key,result);while(resultCache.size>30)resultCache.delete(resultCache.keys().next().value);return result;
  }
  async function choose(id){
    if(!origin)return;const at={...origin},current=++revision;controller?.abort();controller=new AbortController();const activeController=controller;const timeout=setTimeout(()=>activeController.abort(),60000);
    const el=document.getElementById('accessResults');if(!el)return;document.getElementById('card').classList.add('access-focused');
    document.querySelectorAll('[data-access]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.access===id)));
    el.innerHTML='<p class="muted small">Sprawdzam dojścia piesze po drogach…</p>';map.getSource('address-directions')?.setData(empty());
    try{
      const result=await nearest(at,id,controller.signal,current);if(current!==revision||!el.isConnected)return;
      currentResults=result.top;app.focusMap(result.top.length>0);
      const features=result.top.flatMap((p,i)=>[{type:'Feature',geometry:{type:'LineString',coordinates:[[at.lon,at.lat],[p.lon,p.lat]]},properties:{rank:i+1}},{type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},properties:{rank:i+1}}]);
      map.getSource('address-directions')?.setData({type:'FeatureCollection',features});
      el.innerHTML=result.top.length?`<ol class="access-results">${result.top.map((p,i)=>`<li><button class="access-result" type="button" data-facility="${i}" title="${esc(p.name)}"><span class="access-number">${i+1}</span><span class="access-place">${esc(p.name)}</span><span class="access-cost"><strong>${Math.max(1,Math.round(p.seconds/60))}<small>min</small></strong><span>≈ ${p.metres<1000?Math.round(p.metres/10)*10+' m':(p.metres/1000).toLocaleString('pl-PL',{maximumFractionDigits:2})+' km'}</span></span>${Icons.svg('caret-right','result-chevron')}</button></li>`).join('')}</ol><p class="source-note">${result.complete?'Najbliższe dostępne dojścia w promieniu 25 km.':'Wyniki wśród '+result.checked+' sprawdzonych obiektów — wyszukiwanie ograniczone.'} Przerywane linie wskazują kierunek; liczby oznaczają dojście po drogach. OSM · Valhalla.</p>`:'<p class="muted small">Nie znaleziono dostępnych dojść do obiektów w promieniu 25 km.</p>';
      const parcel=document.getElementById('adrParcel');if(parcel)parcel.hidden=true;
      app.closeLayers();if(app.isMobile())app.snap('half');
      if(result.top.length){const bounds=new maplibregl.LngLatBounds([at.lon,at.lat],[at.lon,at.lat]);result.top.forEach(p=>bounds.extend([p.lon,p.lat]));app.frame([...bounds.getSouthWest().toArray(),...bounds.getNorthEast().toArray()],16);}
    }catch(error){if(current===revision&&el.isConnected)el.innerHTML=`<p class="inline-error">${esc(error.name==='AbortError'?'Dojście jest chwilowo niedostępne. Wybierz kategorię, aby spróbować ponownie.':error.message)}</p>`;}finally{clearTimeout(timeout);}
  }
  document.getElementById('card').addEventListener('click',e=>{const b=e.target.closest('[data-access]'),facility=e.target.closest('[data-facility]');if(b)choose(b.dataset.access);if(facility){const point=currentResults[Number(facility.dataset.facility)];if(point)window.PLOTS_SURROUNDINGS.openPoint(point);}});
  document.getElementById('card').addEventListener('change',e=>{if(e.target.id==='accessCategory'&&e.target.value)choose(e.target.value);});
})();
