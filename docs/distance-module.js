(function(){
 'use strict';
 const app=window.PLOTS,map=app.map,icon=Icons.svg;
 const palette=['#440154','#414487','#2a788e','#22a884','#7ad151','#fde725'];
 let opened=false,config=null,revision=0,mode='all',minutes=15,timer=null,origin=null,originMarker=null,previousPoi=false,serviceRevision=0,picking=false,pickWasCompact=false,transport='pedestrian',autoTimer=null,originRevision=0;
 const panel=document.createElement('aside');panel.id='distancePanel';panel.hidden=true;panel.setAttribute('aria-label','Moduł odległości');
 const arrows=id=>`<div class="dv-arrows"><button type="button" class="dv-arrow" data-scroll="${id}" data-dir="-1" aria-label="Przewiń w lewo">${icon('caret-left')}</button><button type="button" class="dv-arrow" data-scroll="${id}" data-dir="1" aria-label="Przewiń w prawo">${icon('caret-right')}</button></div>`;
 panel.innerHTML=`<button id="distanceHandle" class="distance-handle" aria-label="Przeciągnij, aby zmienić wysokość panelu"><span></span></button><header class="distance-heading"><img id="distanceBadge" class="distance-badge" alt="" hidden><div><small id="distanceEyebrow">ODLEGŁOŚCI · PIESZO</small><h2 id="distanceTitle">Odległości</h2></div><button class="icbtn" type="button" data-distance-gmina aria-label="Dane gminy punktu" title="Dane gminy">${icon('buildings')}</button><button class="icbtn" type="button" data-distance-collapse aria-label="Zwiń moduł">${icon('caret-down')}</button><button type="button" data-distance-back class="icbtn" aria-label="Wyłącz moduł odległości">${icon('x')}</button></header>
 <div class="analysis-origin"><button id="focusAnalysisOrigin" aria-label="Pokaż punkt analizy">${icon('map-pin')}<span><small>PUNKT ANALIZY</small><b id="analysisOriginLabel">Wskaż na mapie</b></span></button><button id="changeAnalysisOrigin" aria-pressed="false">Zmień</button></div>
 <div class="distance-body">
 <section id="dvPicker" class="dv-picker" aria-label="Wybór obiektów"><label class="dv-search">${icon('magnifying-glass')}<input id="dvSearch" type="search" placeholder="Szukaj, np. apteka, paczkomat, basen" aria-label="Szukaj rodzaju miejsca" autocomplete="off"></label><div id="distanceChips"></div><p id="dvNone" class="muted small" hidden>Nic nie pasuje. Spróbuj innego słowa.</p></section>
 <button type="button" id="dvChosen" class="dv-chosen" aria-label="Zmień rodzaj szukanych miejsc"></button>
 <div class="transport-switch" role="group" aria-label="Sposób podróży"><button data-transport="pedestrian" aria-pressed="true">${icon('person-simple-walk')}<span>Pieszo</span></button><button data-transport="auto" aria-pressed="false">${icon('car')}<span>Samochodem</span></button><button data-transport="bicycle" aria-pressed="false">${icon('bicycle')}<span>Rowerem</span></button></div>
 <p id="transportNote" hidden>Dojazd liczony po drogach od punktu analizy. Kolory budynków pokazujemy dla dojść pieszych.</p>
 <section class="dv-sec dv-near"><div class="dv-head"><h3><span>Najbliżej</span><small id="dvNearSub">pieszo od punktu analizy</small></h3>${arrows('dvCarousel')}</div><div id="accessResults" aria-live="polite"></div><p id="distanceSelection" class="distance-selection" hidden></p><button type="button" id="showNearest" class="module-nearest" hidden>${icon('path')}Trzy najbliższe od punktu analizy${icon('caret-right')}</button></section>
 <section class="dv-sec dv-colors"><div class="dv-head"><h3><span>Kolory budynków</span><small>czas dojścia pieszo do najbliższego obiektu</small></h3></div><div id="distanceCategory"></div><div class="distance-segments" role="group" aria-label="Widok budynków"><button data-distance-mode="all" aria-pressed="true">Wszystkie</button><button data-distance-mode="within" aria-pressed="false">Do</button><button data-distance-mode="outside" aria-pressed="false">Dalej niż</button></div>
 <div id="buildingTimes" class="walking-slider"><label for="walkingMinutes"><span id="walkingTimeLabel">Próg czasu dojścia</span><output id="walkingTimeValue" for="walkingMinutes">15 min</output></label><input id="walkingMinutes" type="range" min="5" max="60" step="1" value="15" aria-label="Czas dojścia pieszo" aria-valuetext="15 minut pieszo"><div class="slider-ticks"><span>5 min</span><span>30</span><span>60 min</span></div></div>
 <div id="buildingLegend" class="walking-legend"><div><span>Minuty do najbliższego obiektu</span><span><i class="missing-swatch"></i>brak danych</span></div><div class="walking-colors">${palette.map(c=>`<i style="background:${c}"></i>`).join('')}</div><div class="walking-breaks"><span>&lt;5</span><span>5–10</span><span>10–15</span><span>15–30</span><span>30–45</span><span>45+</span></div></div>
 <p id="buildingStatus" role="status" class="source-note">Wybierz kategorię.</p></section>
 <div class="distance-source dv-source"><h4>Źródła i sposób liczenia</h4><div id="distanceSources"></div><p>Budynki mieszkalne BDOT10k. Kolor to czas dojścia do najbliższego obiektu całej kategorii po sieci pieszej przy 5 km/h. Wyniki przybliżone: odległości co 20 m do 2 km, co 100 m do 10 km i co 500 m dalej. Brak danych nie oznacza zera. Najbliższe obiekty są liczone osobno od punktu analizy po drogach OpenStreetMap (Valhalla).</p></div></div>`;
 panel.classList.add('dv2');
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
  config=cfg;attach();renderPicker();document.getElementById('networkSelect').addEventListener('change',()=>{renderPicker();window.AddressAccess?.clear();if(origin)window.AddressAccess?.setOrigin(origin);document.getElementById('accessResults').innerHTML='';document.getElementById('distanceSelection').hidden=true;serviceRevision++;document.body.classList.remove('distance-results');queue();scheduleNearest();});if(opened){queue();scheduleNearest();}
 }).catch(()=>status('Katalog usług jest chwilowo niedostępny. Odśwież aplikację.'));
 async function update(){
  if(!opened||!config)return;if(transport!=='pedestrian'){map.getSource('distance-buildings')?.setData({type:'FeatureCollection',features:[]});return;}const run=++revision;map.getSource('distance-buildings')?.setData({type:'FeatureCollection',features:[]});
  if(map.getZoom()<13){status('Przybliż mapę, aby zobaczyć budynki i czas dojścia.');return;}
  status('Wczytuję budynki i odległości po sieci pieszej…');
  try{const id=document.getElementById('networkSelect').value,value=await window.PLOTS_SURROUNDINGS.buildings(map.getBounds(),id,mode,minutes);if(run!==revision||!opened)return;map.getSource('distance-buildings')?.setData({type:'FeatureCollection',features:value.features});status(`${value.features.length.toLocaleString('pl-PL')} budynków${mode==='all'?'':mode==='within'?' · do '+minutes+' min':' · ponad '+minutes+' min'}${value.clipped?' · Przybliż mapę: limit widoku':''}`);sync();}
  catch(error){if(run===revision)status(error.message+' Przybliż mapę lub zmień kategorię.');}
 }
 const POPULAR=['zabka','biedronka','lidl','apteka','poz','przystanek','szkola','przedszkole','inpost','any_locker','paliwa','park'];
 const CAT_ICON={paczki:'package',zdrowie:'first-aid',edukacja:'graduation-cap',bezpieczenstwo:'shield-check',kultura:'mask-happy',sklepy:'shopping-cart',transport:'bus'};
 const CAT_SHORT={bezpieczenstwo:'Urzędy',kultura:'Kultura i sport',sklepy:'Sklepy'};
 const MODE_TXT={pedestrian:'pieszo',auto:'samochodem',bicycle:'rowerem'};
 const shortLabel=l=>String(l).split(/\s[(\/]|\s–\s|\slub\s/)[0].replace(/\s*\(.*$/,'').trim();
 const badge=id=>window.PoiIcons?`<img class="poi-badge" src="${window.PoiIcons.url(id)}" alt="">`:'';
 let choosing=false;
 const fold=t=>String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l');
 function current(){return document.getElementById('networkSelect')?.value;}
 function nearSub(){const n=config?.networks.find(x=>x.id===current());document.getElementById('dvNearSub').textContent=`${n?shortLabel(n.label)+' · ':''}${MODE_TXT[transport]||''} od punktu analizy`;}
 function updArrows(){panel.querySelectorAll('.dv-arrows').forEach(box=>{const el=scroller(box.querySelector('[data-scroll]').dataset.scroll);const can=el&&el.scrollWidth>el.clientWidth+4;box.hidden=!can;if(!can)return;box.querySelector('[data-dir="-1"]').disabled=el.scrollLeft<4;box.querySelector('[data-dir="1"]').disabled=el.scrollLeft+el.clientWidth>=el.scrollWidth-4;});}
 function scroller(id){return document.getElementById(id);}
 /* The big chooser: every kind of place, grouped, as large buttons. It opens every time the module starts. */
 function renderGrid(){
  if(!config)return;const sel=current(),byId=new Map(config.networks.map(n=>[n.id,n]));
  const tile=id=>{const n=byId.get(id);return `<button type="button" class="dv-tile" data-net="${app.esc(id)}" data-q="${app.esc(fold(n.label))}" aria-pressed="${id===sel}" title="${app.esc(n.label)}"><span class="dv-ic">${badge(id)}</span><span class="dv-lbl">${app.esc(shortLabel(n.label))}</span></button>`;};
  const groups=[{id:'pop',label:'Popularne',ids:POPULAR.filter(id=>byId.has(id))},...config.categories.map(c=>({id:c.id,label:CAT_SHORT[c.id]||c.label,ids:config.networks.filter(n=>n.cat===c.id).map(n=>n.id)})).filter(g=>g.ids.length)];
  document.getElementById('distanceChips').innerHTML=groups.map(g=>`<section class="dv-group" data-g="${g.id}"><h4>${icon(g.id==='pop'?'heart':CAT_ICON[g.id]||'map-pin')}${app.esc(g.label)}</h4><div class="dv-grid">${g.ids.map(tile).join('')}</div></section>`).join('');
 }
 function filterGrid(q){
  q=fold(q.trim());let any=false;
  panel.querySelectorAll('.dv-group').forEach(g=>{
   // While searching, the "Popularne" group would only repeat matches from the categories below.
   if(q&&g.dataset.g==='pop'){g.hidden=true;return;}
   let n=0;g.querySelectorAll('.dv-tile').forEach(t=>{const ok=!q||t.dataset.q.includes(q);t.hidden=!ok;if(ok)n++;});g.hidden=!n;if(n)any=true;});
  document.getElementById('dvNone').hidden=any;
 }
 function setChoosing(v){
  choosing=!!v&&!transit;panel.classList.toggle('choosing',choosing);document.body.classList.toggle('distance-choosing',choosing);renderPicker();
  if(choosing){renderGrid();const q=document.getElementById('dvSearch');q.value='';filterGrid('');panel.querySelector('.distance-body').scrollTop=0;if(app.isMobile())setSnap('full');}
  sync();
 }
 function renderPicker(){
  if(!config)return;const sel=current(),n=config.networks.find(x=>x.id===sel);
  if(n){document.getElementById('distanceTitle').textContent=choosing?'Wybierz miejsca':shortLabel(n.label);const b=document.getElementById('distanceBadge');if(window.PoiIcons){b.src=window.PoiIcons.url(sel);b.hidden=choosing;}
   document.getElementById('dvChosen').innerHTML=`<span class="dv-ic">${badge(sel)}</span><span class="dv-chosen-txt"><small>Szukasz</small><b>${app.esc(shortLabel(n.label))}</b></span><span class="dv-change">${icon('squares-four')}Zmień</span>`;}
  if(choosing)panel.querySelectorAll('#distanceChips .dv-tile').forEach(t=>t.setAttribute('aria-pressed',String(t.dataset.net===sel)));
  nearSub();requestAnimationFrame(updArrows);
 }
 function pickNetwork(id){const select=document.getElementById('networkSelect');const same=!select||select.value===id;setChoosing(false);if(!same){select.value=id;select.dispatchEvent(new Event('change'));}renderPicker();setSnap(app.isMobile()&&innerHeight<700?'peek':'half');if(!origin)setPicking(true);else if(same)scheduleNearest();}
 panel.addEventListener('scroll',e=>{if(e.target.matches?.('.dv-carousel'))updArrows();},true);
 document.getElementById('dvSearch').addEventListener('input',e=>filterGrid(e.target.value));
 function queue(){revision++;clearTimeout(timer);if(opened)timer=setTimeout(update,180);}
 function setPicking(value){if(value&&!picking)pickWasCompact=document.body.classList.contains('distance-compact');if(!value&&picking)setSnap(pickWasCompact?'peek':'half');picking=value;document.body.classList.toggle('distance-picking',value);pickHint.hidden=!value;document.getElementById('changeAnalysisOrigin').setAttribute('aria-pressed',String(value));if(value){setSnap('peek');map.getCanvas().style.cursor='crosshair';}else map.getCanvas().style.cursor='';sync();}
 function drawOrigin(){
  if(!opened||!origin){originMarker?.remove();return;}
  if(!originMarker){const el=document.createElement('div');el.className='analysis-origin-marker';el.innerHTML=`<span>Punkt analizy</span><i>${icon('crosshair')}</i>`;originMarker=new maplibregl.Marker({element:el,anchor:'bottom'});}
  originMarker.setLngLat([origin.lon,origin.lat]).addTo(map);
 }
 function scheduleNearest(){clearTimeout(autoTimer);if(opened&&origin&&config&&!choosing&&transport!=='transit')autoTimer=setTimeout(()=>window.AddressAccess?.choose(document.getElementById('networkSelect').value,transport),450);}
 async function resolveOriginAddress(at,version){try{const data=await app.api('/api/adres-punkt?lon='+at.lon+'&lat='+at.lat);if(version===originRevision&&opened&&data.address){origin.label=data.address;document.getElementById('analysisOriginLabel').textContent=data.address;}}catch{/* Coordinates remain valid when address service is unavailable. */}}
 function setOrigin(value){
  const valid=value&&Number.isFinite(+value.lon)&&Number.isFinite(+value.lat);if(value&&!valid)return;
  const changed=!valid||!origin||origin.lon!==+value.lon||origin.lat!==+value.lat;
  if(changed){document.body.classList.remove('distance-results');window.AddressAccess?.clear();document.getElementById('accessResults').innerHTML='';document.getElementById('distanceSelection').hidden=true;serviceRevision++;}
  origin=valid?{lon:+value.lon,lat:+value.lat,label:value.label||value.adres||''}:null;
  if(origin)window.AddressAccess?.setOrigin(origin);
  document.getElementById('showNearest').disabled=!origin;
  document.getElementById('focusAnalysisOrigin').disabled=!origin;
  document.getElementById('analysisOriginLabel').textContent=origin?(origin.label||`${origin.lat.toFixed(5)}, ${origin.lon.toFixed(5)}`):'Wskaż na mapie';drawOrigin();sync();if(changed){originRevision++;document.dispatchEvent(new CustomEvent('plots:origin',{detail:origin}));if(origin&&!origin.label)resolveOriginAddress({...origin},originRevision);scheduleNearest();}
 }
 let transit=false;
 function setTransit(on){
  transit=!!on;panel.classList.toggle('transit-mode',transit);document.body.classList.toggle('transit-module',transit);
  panel.setAttribute('aria-label',transit?'Moduł komunikacji publicznej':'Moduł odległości');
  panel.querySelector('[data-distance-back]').setAttribute('aria-label',transit?'Wyłącz moduł komunikacji publicznej':'Wyłącz moduł odległości');
  if(transit)transport='transit';else if(transport==='transit')transport='pedestrian';
  panel.querySelectorAll('[data-transport]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.transport===transport)));
  panel.classList.toggle('motor-mode',transport!=='pedestrian');
  document.getElementById('distanceEyebrow').textContent=transit?'KOMUNIKACJA PUBLICZNA':transport==='auto'?'ODLEGŁOŚCI · SAMOCHODEM':transport==='bicycle'?'ODLEGŁOŚCI · ROWEREM':'ODLEGŁOŚCI · PIESZO';
  if(transit){setChoosing(false);window.AddressAccess?.clear();document.getElementById('accessResults').innerHTML='';}
  window.Transit?.setActive(transit);
 }
 function open(value=null,network=null,options={}){
  if(window.StatsMap?.isOpen())window.StatsMap.close();attach();const place=value||app.currentPlace();
  if(!opened){previousPoi=document.getElementById('surPoi')?.checked||false;opened=true;panel.hidden=false;document.body.classList.toggle('distance-compact',innerHeight<700);app.setDistanceMode(true);app.clearPlace();window.UIHistory?.open('distance',()=>close({history:false}),window.UIHistory?.current()==='place');}
  setOrigin(place||origin);setTransit(!!options.transit);
  const select=document.getElementById('networkSelect');if(select&&network){select.value=network;select.dispatchEvent(new Event('change'));}renderPicker();
  const poi=document.getElementById('surPoi');if(poi){poi.checked=true;poi.dispatchEvent(new Event('change',{bubbles:true}));}
  app.closeLayers();window.PlaceUI?.closePalette();sync();
  if(transit){/* the reach map frames itself */}else if(origin)app.framePoint(origin.lon,origin.lat,Math.max(14,map.getZoom()));else if(map.getZoom()<13){const at=map.getCenter();app.framePoint(at.lng,at.lat,14);}
  setSnap(app.isMobile()&&innerHeight<700?'peek':'half');
  // Every start shows the big chooser first; a module opened for a given category (or public transport) skips it.
  if(!transit&&!network){setPicking(false);setChoosing(true);}else{setChoosing(false);if(!origin)setPicking(true);}queue();scheduleNearest();
 }
 function close(options={}){
  if(!opened)return;opened=false;if(transit)setTransit(false);choosing=false;panel.classList.remove('choosing');document.body.classList.remove('distance-choosing');clearTimeout(autoTimer);originRevision++;revision++;serviceRevision++;clearTimeout(timer);setPicking(false);document.body.classList.remove('distance-results');originMarker?.remove();origin=null;document.getElementById('accessResults').innerHTML='';document.getElementById('distanceSelection').hidden=true;panel.hidden=true;
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
  const net=e.target.closest('[data-net]');if(net){pickNetwork(net.dataset.net);return;}
  if(e.target.closest('#dvChosen')){setChoosing(true);return;}
  const arr=e.target.closest('[data-scroll]');if(arr){const el=scroller(arr.dataset.scroll);if(el)el.scrollBy({left:Number(arr.dataset.dir)*Math.max(120,el.clientWidth*.8),behavior:window.Motion?.on()===false?'auto':'smooth'});return;}
  if(e.target.closest('[data-distance-gmina]'))toGmina().catch(()=>app.toast('Dane gminy są chwilowo niedostępne'));
  if(e.target.closest('[data-distance-collapse],#distanceHandle'))setSnap(panel.dataset.snap==='peek'?'half':'peek');
  const m=e.target.closest('[data-distance-mode]');if(m){setMode(m.dataset.distanceMode);sync();}
  if(e.target.closest('#changeAnalysisOrigin'))setPicking(!picking);
  if(e.target.closest('#focusAnalysisOrigin')&&origin)app.framePoint(origin.lon,origin.lat,Math.max(15,map.getZoom()));
  if(e.target.closest('#showNearest')){setPicking(false);if(panel.dataset.snap==='peek')setSnap('half');window.AddressAccess?.choose(document.getElementById('networkSelect').value,transport);sync();}
  const travel=e.target.closest('[data-transport]');if(travel){transport=travel.dataset.transport;panel.querySelectorAll('[data-transport]').forEach(b=>b.setAttribute('aria-pressed',String(b===travel)));panel.classList.toggle('motor-mode',transport!=='pedestrian');document.getElementById('transportNote').hidden=transport==='pedestrian';document.getElementById('distanceEyebrow').textContent=transport==='auto'?'ODLEGŁOŚCI · SAMOCHODEM':transport==='bicycle'?'ODLEGŁOŚCI · ROWEREM':'ODLEGŁOŚCI · PIESZO';window.AddressAccess?.clear();document.getElementById('accessResults').innerHTML='';if(origin)window.AddressAccess?.setOrigin(origin);nearSub();queue();scheduleNearest();}
 });
 document.getElementById('walkingMinutes').addEventListener('input',e=>{minutes=Number(e.target.value);document.getElementById('walkingTimeValue').textContent=minutes+' min';e.target.setAttribute('aria-valuetext',minutes+' minut pieszo');setMode(mode==='all'?'within':mode);});
 document.addEventListener('click',e=>{if(e.target.closest('[data-open-distance]'))open(app.currentPlace());else if(e.target.closest('[data-open-transit]'))open(app.currentPlace(),null,{transit:true});});
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
 window.DistanceModule={open,close,isOpen:()=>opened,isTransit:()=>transit,height,setOrigin,getTransport:()=>transport,showResults(){const c=document.getElementById('dvCarousel');if(c)c.scrollLeft=0;sync();},arrows:()=>requestAnimationFrame(updArrows),getOrigin:()=>origin?{...origin}:null,sync,showService(p){const el=document.getElementById('distanceSelection');el.hidden=false;el.innerHTML=`${app.esc(p.name||'Obiekt usługowy')} · <a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}" target="_blank" rel="noopener noreferrer">Google Maps</a>`;},handleClick(e){
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
