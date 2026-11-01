(function(){
 'use strict';
 const app=window.PLOTS,map=app.map,esc=app.esc,icon=window.Icons.svg,model=window.IsochroneModel;
 const cache=new Map();let selected=null,time=15,mode='within',enabled=false,revision=0,controller=null,timer=null,geometry=null;
 const collection=features=>({type:'FeatureCollection',features}),empty=()=>collection([]);
 function clear(){revision++;controller?.abort();clearTimeout(timer);selected=null;enabled=false;geometry=null;for(const id of ['service-iso-area','service-iso-border'])map.getSource(id)?.setData(empty());}
 function initialize(){
  for(const id of ['service-iso-area','service-iso-border']){app.registerOverlaySource(id);map.addSource(id,{type:'geojson',data:empty(),attribution:'© OpenStreetMap · Valhalla'});}
  map.addLayer({id:'service-iso-fill',type:'fill',source:'service-iso-area',paint:{'fill-color':'#087cfc','fill-opacity':.2}},map.getLayer('dz-fill')?'dz-fill':undefined);
  map.addLayer({id:'service-iso-line',type:'line',source:'service-iso-border',paint:{'line-color':'#087cfc','line-width':2.5}});
 }
 if(map.loaded())initialize();else map.once('load',initialize);
 document.addEventListener('plots:selection',clear);
 function status(text){const el=document.getElementById('isoStatus');if(el)el.textContent=text;}
 function draw(){
  if(!geometry||!enabled)return;app.focusMap(true);
  const reachable=model.area(geometry,'within',polygonClipping),area=model.area(geometry,mode,polygonClipping);
  map.getSource('service-iso-area')?.setData(collection([{type:'Feature',geometry:{type:'MultiPolygon',coordinates:area},properties:{}}]));
  map.getSource('service-iso-border')?.setData(collection([{type:'Feature',geometry:{type:'MultiPolygon',coordinates:reachable},properties:{}}]));
  map.setPaintProperty('service-iso-fill','fill-color',mode==='outside'?'#657786':'#087cfc');
  status(`${mode==='outside'?'Poza zasięgiem':'Dojście do obiektu w'} ${time} min · pieszo 5 km/h · OSM / Valhalla${mode==='outside'?' · obejmuje też miejsca bez wyznaczonego dojścia':''}`);
 }
 async function calculate(){
  if(!selected||!enabled)return;const point={...selected},current=++revision;controller?.abort();controller=new AbortController();const active=controller,timeout=setTimeout(()=>active.abort(),30000);
  geometry=null;map.getSource('service-iso-area')?.setData(empty());map.getSource('service-iso-border')?.setData(empty());status('Wyznaczam zasięg po sieci pieszej…');
  try{
   const key=`${point.lon},${point.lat}/${time}`,minutes=time;
   let result=cache.get(key);
   if(!result){
    const endpoint=window.PLOTS_CONFIG?.isochroneUrl||new URL('isochrone',window.PLOTS_CONFIG?.routingUrl||'https://valhalla1.openstreetmap.de/sources_to_targets').href;
    const url=new URL(endpoint);if(url.protocol!=='https:')throw Error('Usługa wymaga HTTPS');
    url.searchParams.set('json',JSON.stringify({locations:[{lat:point.lat,lon:point.lon,radius:100,search_cutoff:100}],costing:'pedestrian',costing_options:{pedestrian:{walking_speed:5,use_ferry:0}},contours:[{time:minutes}],polygons:true,denoise:.1,generalize:20,reverse:true}));
    const r=await fetch(url,{signal:active.signal});if(!r.ok)throw Error(r.status===429?'Usługa jest zajęta. Wybierz czas ponownie za chwilę.':'Nie udało się wyznaczyć zasięgu. Wybierz czas, aby ponowić.');
    result=model.polygons(await r.json(),minutes);cache.set(key,result);while(cache.size>30)cache.delete(cache.keys().next().value);
   }
   if(current!==revision||!enabled)return;geometry=result;draw();
   const bounds=new maplibregl.LngLatBounds();const add=v=>typeof v[0]==='number'?bounds.extend(v):v.forEach(add);result.forEach(add);
   if(!bounds.isEmpty()){map.stop();map.setPadding({top:0,bottom:0,left:0,right:0});map.fitBounds(bounds,{padding:app.padding(),duration:650,maxZoom:16,retainPadding:false});}
  }catch(error){if(current===revision)status(error.name==='AbortError'?'Zasięg chwilowo niedostępny. Wybierz czas, aby ponowić.':error.message);}finally{clearTimeout(timeout);}
 }
 function queue(){clearTimeout(timer);revision++;controller?.abort();geometry=null;for(const id of ['service-iso-area','service-iso-border'])map.getSource(id)?.setData(empty());timer=setTimeout(calculate,300);}
 function open(point,network){
  const lon=Number(point.lon),lat=Number(point.lat);if(!Number.isFinite(lon)||!Number.isFinite(lat))return;
  const google=new URL('https://www.google.com/maps/search/');google.searchParams.set('api','1');google.searchParams.set('query',`${lat},${lon}`);
  app.showInfo(`<div class="service-heading"><span class="service-icon">${icon('map-pin')}</span><div><p class="eyebrow">${esc(network.label)}</p><h2 id="serviceName">${esc(point.name||'Wczytuję nazwę…')}</h2></div></div><a class="google-action" href="${esc(google.href)}" target="_blank" rel="noopener noreferrer">${icon('google-logo')}Pokaż w Google Maps${icon('arrow-up-right')}</a><section class="iso-controls"><label class="sw"><input id="isoEnabled" type="checkbox"/><span></span><div>Zasięg dojścia pieszego<small>Izochrona do wybranego obiektu</small></div></label><div id="isoOptions" hidden><div class="iso-mode" role="group" aria-label="Rodzaj zasięgu"><button type="button" data-iso-mode="within" aria-pressed="true">Do</button><button type="button" data-iso-mode="outside" aria-pressed="false">Dalej niż</button></div><div class="iso-times" aria-label="Czas dojścia">${model.minutes.map(n=>`<button type="button" data-iso-minutes="${n}" aria-pressed="${n===15}">${n}<small>min</small></button>`).join('')}</div></div><p id="isoStatus" class="source-note" role="status">Włącz zasięg i wybierz czas dojścia.</p></section><p class="source-note muted">${esc(network.source)} · ${esc(network.source_date)}</p>`);
  selected={...point,lon,lat};time=15;mode='within';app.markPoint([lon,lat]);document.dispatchEvent(new CustomEvent('plots:point',{detail:{lon,lat}}));
  const currentPlace=selected;if(!point.name)window.PLOTS_SURROUNDINGS.nameFor(point).then(name=>{const el=document.getElementById('serviceName');if(el&&selected===currentPlace)el.textContent=name;});
  const toggle=document.getElementById('isoEnabled');toggle.onchange=()=>{enabled=toggle.checked;document.getElementById('isoOptions').hidden=!enabled;if(enabled)queue();else{revision++;controller?.abort();clearTimeout(timer);geometry=null;for(const id of ['service-iso-area','service-iso-border'])map.getSource(id)?.setData(empty());app.focusMap(false);status('Zasięg wyłączony.');}};
 }
 document.getElementById('card').addEventListener('click',e=>{
  const t=e.target.closest('[data-iso-minutes]'),m=e.target.closest('[data-iso-mode]');
  if(t){time=Number(t.dataset.isoMinutes);document.querySelectorAll('[data-iso-minutes]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.isoMinutes)===time)));queue();}
  if(m){mode=m.dataset.isoMode;document.querySelectorAll('[data-iso-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.isoMode===mode)));draw();}
 });
 window.ServicePlaces={open};
})();
