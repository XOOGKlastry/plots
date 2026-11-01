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
  document.addEventListener('plots:address',e=>{origin={lon:+e.detail.lon,lat:+e.detail.lat};window.DistanceModule?.setOrigin(origin);});
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
    const el=document.getElementById('accessResults');if(!el)return;
    document.querySelectorAll('[data-access]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.access===id)));
    el.innerHTML='<p class="muted small">Sprawdzam dojścia piesze po drogach…</p>';map.getSource('address-directions')?.setData(empty());
    try{
      const result=await nearest(at,id,controller.signal,current);if(current!==revision||!el.isConnected)return;
      currentResults=result.top;app.focusMap(result.top.length>0);
      const features=result.top.flatMap((p,i)=>[{type:'Feature',geometry:{type:'LineString',coordinates:[[at.lon,at.lat],[p.lon,p.lat]]},properties:{rank:i+1}},{type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},properties:{rank:i+1}}]);
      map.getSource('address-directions')?.setData({type:'FeatureCollection',features});
      el.innerHTML=result.top.length?`<ol class="access-results">${result.top.map((p,i)=>`<li><button class="access-result" type="button" data-facility="${i}" title="${esc(p.name)}"><span class="access-number">${i+1}</span><span class="access-place">${esc(p.name)}</span><span class="access-cost"><strong>${Math.max(1,Math.round(p.seconds/60))}<small>min</small></strong><span>≈ ${p.metres<1000?Math.round(p.metres/10)*10+' m':(p.metres/1000).toLocaleString('pl-PL',{maximumFractionDigits:2})+' km'}</span></span>${Icons.svg('caret-right','result-chevron')}</button></li>`).join('')}</ol><p class="source-note">${result.complete?'Najbliższe dostępne dojścia w promieniu 25 km.':'Wyniki wśród '+result.checked+' sprawdzonych obiektów — wyszukiwanie ograniczone.'} Przerywane linie wskazują kierunek; liczby oznaczają dojście po drogach. OSM · Valhalla.</p>`:'<p class="muted small">Nie znaleziono dostępnych dojść do obiektów w promieniu 25 km.</p>';
      app.closeLayers();window.DistanceModule?.sync();
      if(result.top.length){const bounds=new maplibregl.LngLatBounds([at.lon,at.lat],[at.lon,at.lat]);result.top.forEach(p=>bounds.extend([p.lon,p.lat]));app.frame([...bounds.getSouthWest().toArray(),...bounds.getNorthEast().toArray()],16);}
    }catch(error){if(current===revision&&el.isConnected)el.innerHTML=`<p class="inline-error">${esc(error.name==='AbortError'?'Dojście jest chwilowo niedostępne. Wybierz kategorię, aby spróbować ponownie.':error.message)}</p>`;}finally{clearTimeout(timeout);}
  }
  document.addEventListener('click',e=>{const facility=e.target.closest('[data-facility]');if(facility){const point=currentResults[Number(facility.dataset.facility)];if(point)window.DistanceModule?.showService(point);}});
  window.AddressAccess={choose,clear,setOrigin:p=>{origin={lon:+p.lon,lat:+p.lat};}};
})();
