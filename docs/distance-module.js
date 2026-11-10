(function(){
 'use strict';
 const app=window.PLOTS,map=app.map,icon=Icons.svg;
 const palette=['#440154','#414487','#2a788e','#22a884','#7ad151','#fde725'];
 let opened=false,config=null,revision=0,mode='all',minutes=15,timer=null,origin=null,originMarker=null,previousPoi=false,serviceRevision=0,picking=false,pickWasCompact=false,transport='pedestrian',autoTimer=null,originRevision=0;
 const panel=document.createElement('aside');panel.id='distancePanel';panel.hidden=true;panel.setAttribute('aria-label','Moduł odległości');
 panel.innerHTML=`<button id="distanceHandle" class="distance-handle" aria-label="Przeciągnij, aby zmienić wysokość panelu"><span></span></button><header class="distance-heading"><div><small>DOSTĘPNOŚĆ PIESZA</small><h2>Odległości</h2></div><button class="icbtn" type="button" data-distance-collapse aria-label="Zwiń moduł">${icon('caret-down')}</button><button type="button" data-distance-back class="icbtn" aria-label="Wyłącz moduł odległości">${icon('x')}</button></header>
 <nav class="module-switch" aria-label="Moduły aplikacji"><button data-distance-map>${icon('map-trifold')}Mapa</button><button aria-current="page">${icon('person-simple-walk')}Odległości</button><button data-distance-gmina>${icon('buildings')}Gmina</button></nav>
 <div class="analysis-origin"><button id="focusAnalysisOrigin" aria-label="Pokaż punkt analizy">${icon('map-pin')}<span><small>PUNKT ANALIZY</small><b id="analysisOriginLabel">Wskaż na mapie</b></span></button><button id="changeAnalysisOrigin" aria-pressed="false">Zmień</button></div>
 <div class="distance-body"><div class="transport-switch" role="group" aria-label="Sposób podróży"><button data-transport="pedestrian" aria-pressed="true">Pieszo</button><button data-transport="auto" aria-pressed="false">Samochodem</button><button data-transport="bicycle" aria-pressed="false">Rowerem</button></div><p id="transportNote" hidden>Kolory budynków są dostępne dla dojść pieszych. Dojazdy od punktu są liczone po wybranej sieci.</p><button type="button" id="distanceSettings">${icon('sliders-horizontal')}Ustawienia analizy</button><div id="distanceCategory"></div><div class="distance-segments" role="group" aria-label="Widok budynków"><button data-distance-mode="all" aria-pressed="true">Wszystkie</button><button data-distance-mode="within" aria-pressed="false">Do</button><button data-distance-mode="outside" aria-pressed="false">Dalej niż</button></div>
 <div id="buildingTimes" class="walking-slider"><label for="walkingMinutes"><span id="walkingTimeLabel">Próg czasu dojścia</span><output id="walkingTimeValue" for="walkingMinutes">15 min</output></label><input id="walkingMinutes" type="range" min="5" max="60" step="1" value="15" aria-label="Czas dojścia pieszo" aria-valuetext="15 minut pieszo"><div class="slider-ticks"><span>5 min</span><span>30</span><span>60 min</span></div></div>
 <div id="buildingLegend" class="walking-legend"><div><span>Czas do najbliższego obiektu · min</span><span><i class="missing-swatch"></i>brak danych</span></div><div class="walking-colors">${palette.map(c=>`<i style="background:${c}"></i>`).join('')}</div><div class="walking-breaks"><span>&lt;5</span><span>5–10</span><span>10–15</span><span>15–30</span><span>30–45</span><span>45+</span></div></div>
 <p id="buildingStatus" role="status" class="source-note">Wybierz kategorię.</p><p id="distanceSelection" class="distance-selection" hidden></p><button type="button" id="showNearest" class="module-nearest">${icon('path')}Trzy najbliższe od punktu analizy${icon('caret-right')}</button><div id="accessResults" aria-live="polite"></div><details class="distance-source"><summary>Źródło i sposób liczenia</summary><div id="distanceSources"></div><p>Budynki mieszkalne BDOT10k. Kolor to czas dojścia do najbliższego obiektu całej kategorii po sieci pieszej przy 5 km/h. Wyniki przybliżone: odległości co 20 m do 2 km, co 100 m do 10 km i co 500 m dalej. Przedziały są lewostronnie domknięte. Brak danych nie oznacza zera. Trzy wskazane dojścia są obliczane osobno od oznaczonego punktu.</p></details></div>`;
 document.body.append(panel);
 const pickHint=document.createElement('div');pickHint.id='distancePickHint';pickHint.hidden=true;pickHint.innerHTML=`${icon('crosshair')}Dotknij mapy, aby ustawić punkt analizy<button class="icbtn" aria-label="Anuluj wybór punktu">${icon('x')}</button>`;document.body.append(pickHint);pickHint.querySelector('button').onclick=()=>setPicking(false);
 function height(){return opened?Math.ceil(panel.getBoundingClientRect().height)+16:0;}
 function sync(){if(opened){document.documentElement.style.setProperty('--sheetvis',height()+'px');document.body.classList.toggle('map-tight',innerHeight-height()<300);}}
 function status(text){document.getElementById('buildingStatus').textContent=text;}
 function attach(){
  if(!window.LayerControls||!document.getElementById('networkSelect'))return;
  const label=document.querySelector('.network-select-label'),services=document.getElementById('surroundingsLayers');if(services)services.hidden=false;
  if(label&&!panel.contains(label))document.getElementById('distanceCategory').append(label);
  const source=document.getElementById('networkSource');if(source&&!panel.contains(source))document.getElementById('distanceSources').append(source);
  if(services&&!panel.contains(services)){document.getElementById('distanceSources').append(services);const poi=services.querySelector('#surPoi')?.closest('.layer-entry');if(poi)poi.hidden=true;}
 }
 document.addEventListener('plots:layers-ready',attach);
 window.PLOTS_SURROUNDINGS.ready().then(cfg=>{
  config=cfg;attach();document.getElementById('networkSelect').addEventListener('change',()=>{window.AddressAccess?.clear();if(origin)window.AddressAccess?.setOrigin(origin);document.getElementById('accessResults').innerHTML='';document.getElementById('distanceSelection').hidden=true;serviceRevision++;document.body.classList.remove('distance-results');queue();scheduleNearest();});if(opened){queue();scheduleNearest();}
 }).catch(()=>status('Katalog usług jest chwilowo niedostępny. Odśwież aplikację.'));
 async function update(){
  if(!opened||!config)return;if(transport!=='pedestrian'){map.getSource('distance-buildings')?.setData({type:'FeatureCollection',features:[]});return;}const run=++revision;map.getSource('distance-buildings')?.setData({type:'FeatureCollection',features:[]});
  if(map.getZoom()<13){status('Przybliż mapę, aby zobaczyć budynki i czas dojścia.');return;}
  status('Wczytuję budynki i odległości po sieci pieszej…');
  try{const id=document.getElementById('networkSelect').value,value=await window.PLOTS_SURROUNDINGS.buildings(map.getBounds(),id,mode,minutes);if(run!==revision||!opened)return;map.getSource('distance-buildings')?.setData({type:'FeatureCollection',features:value.features});status(`${value.features.length.toLocaleString('pl-PL')} budynków${mode==='all'?'':mode==='within'?' · do '+minutes+' min':' · ponad '+minutes+' min'}${value.clipped?' · Przybliż mapę: limit widoku':''}`);sync();}
  catch(error){if(run===revision)status(error.message+' Przybliż mapę lub zmień kategorię.');}
 }
 function queue(){revision++;clearTimeout(timer);if(opened)timer=setTimeout(update,180);}
 function setPicking(value){if(value&&!picking)pickWasCompact=document.body.classList.contains('distance-compact');if(!value&&picking)setSnap(pickWasCompact?'peek':'half');picking=value;document.body.classList.toggle('distance-picking',value);pickHint.hidden=!value;document.getElementById('changeAnalysisOrigin').setAttribute('aria-pressed',String(value));if(value){setSnap('peek');map.getCanvas().style.cursor='crosshair';}else map.getCanvas().style.cursor='';sync();}
 function drawOrigin(){
  if(!opened||!origin){originMarker?.remove();return;}
  if(!originMarker){const el=document.createElement('div');el.className='analysis-origin-marker';el.innerHTML=`<span>Punkt analizy</span><i>${icon('crosshair')}</i>`;originMarker=new maplibregl.Marker({element:el,anchor:'bottom'});}
  originMarker.setLngLat([origin.lon,origin.lat]).addTo(map);
 }
 function scheduleNearest(){clearTimeout(autoTimer);if(opened&&origin&&config)autoTimer=setTimeout(()=>window.AddressAccess?.choose(document.getElementById('networkSelect').value,transport),450);}
 async function resolveOriginAddress(at,version){try{const data=await app.api('/api/adres-punkt?lon='+at.lon+'&lat='+at.lat);if(version===originRevision&&opened&&data.address){origin.label=data.address;document.getElementById('analysisOriginLabel').textContent=data.address;}}catch{/* Coordinates remain valid when address service is unavailable. */}}
 function setOrigin(value){
  const valid=value&&Number.isFinite(+value.lon)&&Number.isFinite(+value.lat);if(value&&!valid)return;
  const changed=!valid||!origin||origin.lon!==+value.lon||origin.lat!==+value.lat;
  if(changed){document.body.classList.remove('distance-results');window.AddressAccess?.clear();document.getElementById('accessResults').innerHTML='';document.getElementById('distanceSelection').hidden=true;serviceRevision++;}
  origin=valid?{lon:+value.lon,lat:+value.lat,label:value.label||value.adres||''}:null;
  if(origin)window.AddressAccess?.setOrigin(origin);
  document.getElementById('showNearest').disabled=!origin;
  document.getElementById('focusAnalysisOrigin').disabled=!origin;
  document.getElementById('analysisOriginLabel').textContent=origin?(origin.label||`${origin.lat.toFixed(5)}, ${origin.lon.toFixed(5)}`):'Wskaż na mapie';drawOrigin();sync();if(changed){originRevision++;if(origin&&!origin.label)resolveOriginAddress({...origin},originRevision);scheduleNearest();}
 }
 function open(value=null,network=null){
  attach();const place=value||app.currentPlace();
  if(!opened){previousPoi=document.getElementById('surPoi')?.checked||false;opened=true;panel.hidden=false;document.body.classList.toggle('distance-compact',innerHeight<700);app.setDistanceMode(true);app.clearPlace();window.UIHistory?.open('distance',()=>close({history:false}),window.UIHistory?.current()==='place');}
  setOrigin(place||origin);
  const select=document.getElementById('networkSelect');if(select&&network){select.value=network;select.dispatchEvent(new Event('change'));}
  const poi=document.getElementById('surPoi');if(poi){poi.checked=true;poi.dispatchEvent(new Event('change',{bubbles:true}));}
  app.closeLayers();window.PlaceUI?.closePalette();sync();
  if(origin)app.framePoint(origin.lon,origin.lat,Math.max(14,map.getZoom()));else if(map.getZoom()<13){const at=map.getCenter();app.framePoint(at.lng,at.lat,14);}
  setSnap(app.isMobile()&&innerHeight<700?'peek':'half');if(!origin)setPicking(true);queue();scheduleNearest();
 }
 function close(options={}){
  if(!opened)return;opened=false;clearTimeout(autoTimer);originRevision++;revision++;serviceRevision++;clearTimeout(timer);setPicking(false);document.body.classList.remove('distance-results');originMarker?.remove();origin=null;document.getElementById('accessResults').innerHTML='';document.getElementById('distanceSelection').hidden=true;panel.hidden=true;
  map.stop();map.setPadding({top:0,bottom:0,left:0,right:0});app.clearPlace();app.setDistanceMode(false);map.getSource('distance-buildings')?.setData({type:'FeatureCollection',features:[]});window.AddressAccess?.clear();
  const poi=document.getElementById('surPoi');if(poi){poi.checked=previousPoi;poi.dispatchEvent(new Event('change',{bubbles:true}));}
  if(options.history!==false)window.UIHistory?.dismiss('distance');
 }
 async function toGmina(){
  const at=origin?{...origin}:null;close({history:false});app.showGmina();window.UIHistory?.open('gmina',()=>app.clearPlace(),true);
  if(at)await window.MunicipalityContext.update(at);
  if(window.PLOTS_GMINY.current())window.PLOTS_GMINY.openDetails(true);
 }
 function initialize(){
  app.registerOverlaySource('distance-buildings');map.addSource('distance-buildings',{type:'geojson',data:{type:'FeatureCollection',features:[]},attribution:'© GUGiK · BDOT10k'});
  map.addLayer({id:'distance-building-points',type:'circle',source:'distance-buildings',paint:{'circle-radius':['interpolate',['linear'],['zoom'],13,3.5,15,5,18,8],'circle-color':['case',['==',['get','code'],255],'#9299a4',['step',['get','minutes'],palette[0],5,palette[1],10,palette[2],15,palette[3],30,palette[4],45,palette[5]]],'circle-stroke-color':'#fff','circle-stroke-width':1,'circle-opacity':1}},map.getLayer('address-direction-lines')?'address-direction-lines':undefined);
 }
 if(map.loaded())initialize();else map.once('load',initialize);
 function setMode(value){mode=value;panel.querySelectorAll('[data-distance-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.distanceMode===mode)));document.getElementById('walkingTimeLabel').textContent=mode==='outside'?'Dalej niż':mode==='within'?'Do':'Próg czasu dojścia';queue();}
 panel.addEventListener('click',e=>{
  if(e.target.closest('[data-distance-back],[data-distance-map]'))close();
  if(e.target.closest('[data-distance-gmina]'))toGmina().catch(()=>app.toast('Dane gminy są chwilowo niedostępne'));
  if(e.target.closest('[data-distance-collapse],#distanceHandle'))setSnap(panel.dataset.snap==='peek'?'half':'peek');
  const m=e.target.closest('[data-distance-mode]');if(m){setMode(m.dataset.distanceMode);sync();}
  if(e.target.closest('#distanceSettings')){document.body.classList.remove('distance-results');sync();}
  if(e.target.closest('#changeAnalysisOrigin'))setPicking(!picking);
  if(e.target.closest('#focusAnalysisOrigin')&&origin)app.framePoint(origin.lon,origin.lat,Math.max(15,map.getZoom()));
  if(e.target.closest('#showNearest')){setPicking(false);if(panel.dataset.snap==='peek')setSnap('half');window.AddressAccess?.choose(document.getElementById('networkSelect').value,transport);sync();}
  const travel=e.target.closest('[data-transport]');if(travel){transport=travel.dataset.transport;panel.querySelectorAll('[data-transport]').forEach(b=>b.setAttribute('aria-pressed',String(b===travel)));panel.classList.toggle('motor-mode',transport!=='pedestrian');document.getElementById('transportNote').hidden=transport==='pedestrian';panel.querySelector('.distance-heading small').textContent=transport==='auto'?'DOJAZD SAMOCHODEM':transport==='bicycle'?'DOJAZD ROWEREM':'DOSTĘPNOŚĆ PIESZA';window.AddressAccess?.clear();document.getElementById('accessResults').innerHTML='';if(origin)window.AddressAccess?.setOrigin(origin);queue();scheduleNearest();}
 });
 document.getElementById('walkingMinutes').addEventListener('input',e=>{minutes=Number(e.target.value);document.getElementById('walkingTimeValue').textContent=minutes+' min';e.target.setAttribute('aria-valuetext',minutes+' minut pieszo');setMode(mode==='all'?'within':mode);});
 document.addEventListener('click',e=>{if(e.target.closest('[data-open-distance]'))open(app.currentPlace());});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened&&window.UIHistory?.current()==='distance'&&document.getElementById('layerPanel').hidden){if(picking)setPicking(false);else close();}});
 function detents(){const full=Math.max(230,innerHeight-95);const peek=Math.min(full,190);return {peek,half:Math.max(peek,Math.min(full,innerHeight*.62)),full};}
 function setSnap(value){panel.dataset.snap=value;document.body.classList.toggle('distance-compact',value==='peek');if(app.isMobile())panel.style.height=detents()[value]+'px';else panel.style.height='';document.getElementById('distanceHandle').setAttribute('aria-expanded',String(value!=='peek'));sync();}
 let drag=null,ignoreClick=false;
 panel.addEventListener('touchstart',e=>{if(!app.isMobile()||e.touches.length!==1||!e.target.closest('#distanceHandle,.distance-heading')||e.target.closest('.distance-heading button'))return;drag={y:e.touches[0].clientY,height:panel.getBoundingClientRect().height,at:Date.now(),snap:panel.dataset.snap,moved:false};},{passive:true});
 panel.addEventListener('touchmove',e=>{if(!drag)return;if(e.touches.length!==1){drag=null;panel.classList.remove('sheet-dragging');setSnap(panel.dataset.snap);return;}const dy=e.touches[0].clientY-drag.y;if(Math.abs(dy)<5&&!drag.moved)return;drag.moved=true;panel.classList.add('sheet-dragging');document.body.classList.remove('distance-compact');const d=detents();panel.style.height=Math.max(d.peek,Math.min(d.full,drag.height-dy))+'px';if(e.cancelable)e.preventDefault();sync();},{passive:false});
 panel.addEventListener('touchend',e=>{if(!drag)return;const start=drag;drag=null;panel.classList.remove('sheet-dragging');if(!start.moved)return;ignoreClick=true;setTimeout(()=>ignoreClick=false,350);const dy=e.changedTouches[0].clientY-start.y,v=dy/Math.max(1,Date.now()-start.at),d=detents(),order=['peek','half','full'];if(start.snap==='peek'&&dy>100){close();return;}const h=start.height-dy;let next=Math.abs(v)>.45?order[Math.max(0,Math.min(2,order.indexOf(start.snap)+(v<0?1:-1)))]:order.reduce((a,b)=>Math.abs(d[a]-h)<Math.abs(d[b]-h)?a:b);setSnap(next);});
 panel.addEventListener('touchcancel',()=>{drag=null;panel.classList.remove('sheet-dragging');setSnap(panel.dataset.snap||'half');});
 panel.addEventListener('click',e=>{if(ignoreClick){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 map.on('moveend',queue);window.addEventListener('resize',()=>setSnap(panel.dataset.snap||'half'));
 window.DistanceModule={open,close,isOpen:()=>opened,height,setOrigin,getTransport:()=>transport,showResults(){document.body.classList.add('distance-results');panel.querySelector('.distance-body').scrollTop=0;sync();},getOrigin:()=>origin?{...origin}:null,sync,showService(p){const el=document.getElementById('distanceSelection');el.hidden=false;el.innerHTML=`${app.esc(p.name||'Obiekt usługowy')} · <a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}" target="_blank" rel="noopener noreferrer">Google Maps</a>`;},handleClick(e){
  if(!opened)return false;
  const address=app.addressAt?.(e);if(address){setOrigin({...address,label:address.label});setPicking(false);return true;}
  if(picking){setOrigin({lon:e.lngLat.lng,lat:e.lngLat.lat});setPicking(false);app.toast('Nowy punkt analizy ustawiony');return true;}
  if(window.AddressAccess?.handleClick(e))return true;
  const service=map.getLayer('near-poi-points')?map.queryRenderedFeatures([[e.point.x-10,e.point.y-10],[e.point.x+10,e.point.y+10]],{layers:['near-poi-points']})[0]:null;
  if(service){const p={...service.properties,lon:service.geometry.coordinates[0],lat:service.geometry.coordinates[1]};const selected=++serviceRevision;this.showService(p);if(!p.name)window.PLOTS_SURROUNDINGS.nameFor(p).then(name=>{if(opened&&selected===serviceRevision)this.showService({...p,name});});return true;}
  const f=map.queryRenderedFeatures([[e.point.x-6,e.point.y-6],[e.point.x+6,e.point.y+6]],{layers:['distance-building-points']})[0];
  if(f){const t=Number(f.properties.minutes);setOrigin({lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]});const el=document.getElementById('distanceSelection');el.hidden=false;el.textContent=Number(f.properties.code)===255?'Budynek · brak danych o dojściu':`Budynek · ${Number(f.properties.code)===254?'co najmniej':'około'} ${Math.round(t)} min do najbliższego obiektu kategorii`;}
  else setOrigin({lon:e.lngLat.lng,lat:e.lngLat.lat});return true;
 }};
 window.CategoryAccess={enable:id=>open(null,id),disable:close,showControls:()=>open()};
})();
