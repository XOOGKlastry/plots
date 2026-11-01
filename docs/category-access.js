(function(){
 'use strict';
 const app=window.PLOTS,map=app.map,icon=window.Icons.svg,model=window.IsochroneModel;
 let phase='idle';let enabled=false,minutes=15,mode='within',revision=0,controller=null,timer=null,result=null,config=null;
 const empty=()=>({type:'FeatureCollection',features:[]});
 const badge=document.createElement('div');badge.id='categoryAccessBadge';badge.hidden=true;document.body.append(badge);
 function clear(){for(const id of ['category-access-fill','category-access-border'])map.getSource(id)?.setData(empty());result=null;}
 function status(text){const el=document.getElementById('categoryAccessStatus');if(el)el.textContent=text;}
 function updateBadge(){const n=config?.networks.find(n=>n.id===document.getElementById('networkSelect')?.value);badge.hidden=!enabled;badge.innerHTML=`<button type="button" data-edit-category-access>${icon('person-simple-walk')}<span>${n?app.esc(n.label):'Dojście'}<small>${phase==='zoom'?'Przybliż mapę':phase==='loading'?'Obliczam…':phase==='error'?'Ponów obliczenie':(mode==='outside'?'Dalej niż':'Do')+' '+minutes+' min'}</small></span></button><button type="button" data-stop-category-access aria-label="Wyłącz zasięg kategorii">${icon('x')}</button>`;}
 function draw(){
  if(!result||!enabled)return;
  const shapes=result.features.map(f=>f.geometry.coordinates),bounds=result.bounds,rectangle=[[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[2],bounds[3]],[bounds[0],bounds[3]],[bounds[0],bounds[1]]]];
  const reachable=shapes.length?polygonClipping.union(...shapes):[];
  const area=mode==='outside'?(reachable.length?polygonClipping.difference(rectangle,reachable):[rectangle]):reachable;
  map.getSource('category-access-fill')?.setData({type:'FeatureCollection',features:area.length?[{type:'Feature',geometry:{type:'MultiPolygon',coordinates:area},properties:{}}]:[]});
  map.getSource('category-access-border')?.setData({type:'FeatureCollection',features:reachable.length?[{type:'Feature',geometry:{type:'MultiPolygon',coordinates:reachable},properties:{}}]:[]});
  map.setPaintProperty('category-access-area','fill-color',mode==='outside'?'#778694':'#11a3ac');app.focusMap(true);
  phase='ready';status(`${mode==='outside'?'Poza wspólnym zasięgiem':'Dojście do najbliższego obiektu'} · ${minutes} min · ${result.connected}/${result.sources} lokalizacji połączonych z siecią. BDOT10k · 5 km/h · pas 25 m przy drogach. Wszystkie źródła mogące wpływać na analizowany widok, także spoza ekranu.${mode==='outside'?' Szary obszar obejmuje również miejsca bez wyznaczonego dojścia.':''}`);updateBadge();
 }
 function bounds(){const p=app.padding(),canvas=map.getCanvas(),sw=map.unproject([p.left,canvas.clientHeight-p.bottom]),ne=map.unproject([canvas.clientWidth-p.right,p.top]);return [Math.floor(sw.lng*1e5)/1e5,Math.floor(sw.lat*1e5)/1e5,Math.ceil(ne.lng*1e5)/1e5,Math.ceil(ne.lat*1e5)/1e5];}

 async function calculate(){
  if(!enabled||!config)return;const run=++revision,b=bounds(),lat=(b[1]+b[3])/2,w=(b[2]-b[0])*111320*Math.cos(lat*Math.PI/180),h=(b[3]-b[1])*111320;
  clear();if(w>60000||h>60000||w*h>2000000000){phase='zoom';status('Przybliż mapę, aby wyznaczyć wspólny zasięg wszystkich obiektów kategorii.');updateBadge();return;}
  const network=document.getElementById('networkSelect').value,time=minutes,origin={lon:(b[0]+b[2])/2,lat};
  controller?.abort();controller=new AbortController();const active=controller,timeout=setTimeout(()=>active.abort(),45000);
  status('Wczytuję wszystkie obiekty kategorii, także wokół widoku…');
  try{
   const radius=Math.hypot(w,h)/2+time*5000/60+500,points=await window.PLOTS_SURROUNDINGS.candidates(origin,network,radius);
   if(run!==revision)return;
   status(`Wyznaczam wspólny zasięg · ${points.length.toLocaleString('pl-PL')} kandydatów…`);
   let value;
   for(let retry=0;retry<5;retry++){
    try{value=await app.api('/api/category-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bounds:b,minutes:time,points:points.map(p=>[p.lon,p.lat])}),signal:active.signal});break;}
    catch(error){if(error.status!==429||retry===4)throw error;await new Promise(resolve=>setTimeout(resolve,1200));if(run!==revision)return;}
   }
   if(run!==revision||!enabled)return;if(value.type!=='FeatureCollection'||!Array.isArray(value.bounds)||value.minutes!==time)throw Error('Nieprawidłowy wynik zasięgu');
   if(value.features.length)model.polygons(value,time);result=value;draw();
  }catch(error){if(run===revision){clear();phase='error';updateBadge();status(error.status===429?'Serwer zajęty. Wybierz czas, aby ponowić.':error.name==='AbortError'?'Wyznaczanie zasięgu przerwane. Zmień widok lub wybierz czas, aby ponowić.':error.message);}}
  finally{clearTimeout(timeout);}
 }
 function queue(){revision++;controller?.abort();clearTimeout(timer);clear();if(enabled){phase='loading';timer=setTimeout(calculate,650);}updateBadge();}
 function showControls(){app.openLayers();window.LayerControls?.show('access');const section=document.getElementById('surroundingsLayers')?.closest('.layer-section');if(section)section.open=true;document.getElementById('categoryAccessControls')?.scrollIntoView({block:'nearest',behavior:'smooth'});}
 function ensurePoints(){const p=document.getElementById('surPoi');if(p&&!p.checked){p.checked=true;p.dispatchEvent(new Event('change',{bubbles:true}));}}
 function notify(){document.getElementById('surroundingsLayers').dispatchEvent(new Event('change',{bubbles:true}));}
 function enable(id){ensurePoints();const select=document.getElementById('networkSelect');if(select&&id&&select.value!==id){select.value=id;select.dispatchEvent(new Event('change'));}enabled=true;document.getElementById('categoryAccessEnabled').checked=true;document.getElementById('categoryAccessOptions').hidden=false;queue();notify();app.closeLayers();}
 function disable(){enabled=false;document.getElementById('categoryAccessEnabled').checked=false;document.getElementById('categoryAccessOptions').hidden=true;queue();app.focusMap(false);notify();status('Zasięg kategorii wyłączony.');}
 function initializeMap(){
  for(const id of ['category-access-fill','category-access-border']){app.registerOverlaySource(id);map.addSource(id,{type:'geojson',data:empty(),attribution:'© GUGiK · BDOT10k'});}
  map.addLayer({id:'category-access-area',type:'fill',source:'category-access-fill',paint:{'fill-color':'#11a3ac','fill-opacity':.24}},map.getLayer('dz-fill')?'dz-fill':undefined);
  map.addLayer({id:'category-access-edge',type:'line',source:'category-access-border',paint:{'line-color':'#0c8f99','line-width':1.2,'line-opacity':.8}});
 }
 if(map.loaded())initializeMap();else map.once('load',initializeMap);
 window.PLOTS_SURROUNDINGS.ready().then(cfg=>{
  config=cfg;const panel=document.createElement('section');panel.id='categoryAccessControls';panel.innerHTML=`<div class="layer-entry" data-keywords="izochrony czas pieszo dojście zasięg dostępność"><label class="sw"><input id="categoryAccessEnabled" type="checkbox"/><span></span><div>Wspólny zasięg kategorii<small>Do najbliższego obiektu · wszystkie lokalizacje</small></div></label></div><div id="categoryAccessOptions" hidden><div class="iso-mode" role="group" aria-label="Rodzaj zasięgu kategorii"><button type="button" data-category-mode="within" aria-pressed="true">Do</button><button type="button" data-category-mode="outside" aria-pressed="false">Dalej niż</button></div><div class="iso-times">${model.minutes.map(n=>`<button type="button" data-category-minutes="${n}" aria-pressed="${n===minutes}">${n}<small>min</small></button>`).join('')}</div></div><p id="categoryAccessStatus" class="source-note" role="status">Wybierz kategorię powyżej i włącz wspólny zasięg.</p>`;
  document.getElementById('surroundingsLayers').append(panel);
  document.getElementById('categoryAccessEnabled').onchange=e=>{enabled=e.target.checked;document.getElementById('categoryAccessOptions').hidden=!enabled;if(enabled){ensurePoints();queue();}else disable();};
  document.getElementById('networkSelect').addEventListener('change',queue);
  panel.addEventListener('click',e=>{const t=e.target.closest('[data-category-minutes]'),m=e.target.closest('[data-category-mode]');if(t){minutes=Number(t.dataset.categoryMinutes);panel.querySelectorAll('[data-category-minutes]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.categoryMinutes)===minutes)));queue();}if(m){mode=m.dataset.categoryMode;panel.querySelectorAll('[data-category-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.categoryMode===mode)));draw();updateBadge();}});
 }).catch(()=>{});
 badge.addEventListener('click',e=>{if(e.target.closest('[data-edit-category-access]'))showControls();if(e.target.closest('[data-stop-category-access]'))disable();});
 document.addEventListener('plots:selection',()=>{if(enabled&&result)app.focusMap(true);});
 map.on('movestart',()=>{if(enabled){revision++;controller?.abort();clearTimeout(timer);clear();}});map.on('moveend',()=>{if(enabled)queue();});
 window.CategoryAccess={enable,disable,showControls};
})();
