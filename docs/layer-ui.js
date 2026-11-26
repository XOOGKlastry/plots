(function(){
 'use strict';
 const panel=document.getElementById('layerPanel'),icon=window.Icons.svg;
 function group(element,label,name){
  const details=document.createElement('details');details.className='layer-section';
  details.innerHTML=`<summary>${icon(name)}<span>${label}</span><small class="group-count"></small>${icon('caret-down','section-chevron')}</summary><div class="layer-section-body"></div>`;
  element.before(details);details.lastElementChild.append(element);details.addEventListener('toggle',()=>{if(details.open&&!document.getElementById('layerFilter').value.trim())panel.querySelectorAll('.layer-section').forEach(d=>{if(d!==details)d.open=false;});});return details;
 }
 const LOOK={lyrDz:['squares-four','#30b0c7'],lyrParcelColors:['palette','#ff9f0a'],lyrAdr:['map-pin','#ff3b30'],lyrOrthoLabels:['list-bullets','#64748b'],'plan-mpzp':['map-trifold','#0a84ff'],'plan-pog':['file-text','#5e5ce6'],'plan-pog-draft':['file-text','#bf5af2'],surPrices:['coins','#30d158'],poiAll:['storefront','#d6336c'],lyrAnim:['play','#8e8e93']};
 function decorate(){panel.querySelectorAll('.layer-entry label.sw').forEach(l=>{const input=l.querySelector('input'),look=input&&((window.LayerLook||{})[input.id]||LOOK[input.id]);if(!look||l.querySelector('.lk-ic'))return;const ic=document.createElement('span');ic.className='lk-ic';ic.style.setProperty('--c',look[1]);ic.innerHTML=icon(look[0]);l.insertBefore(ic,l.querySelector('div'));});}
 function counts(){panel.querySelectorAll('.layer-section').forEach(d=>{const n=d.querySelectorAll('.layer-entry input[type=checkbox]:checked').length;d.querySelector('.group-count').textContent=n?n+' aktywne':'';});}
 function setup(){
  if(panel.dataset.grouped||!document.getElementById('surPrices')||!document.getElementById('plan-mpzp'))return;
  panel.dataset.grouped='true';

  group(document.getElementById('planningLayers'),'Planowanie przestrzenne','map-trifold');
  if(document.getElementById('terrainLayers'))group(document.getElementById('terrainLayers'),'Dane o terenie','mountains');
  if(document.getElementById('energyLayers'))group(document.getElementById('energyLayers'),'Energetyka','lightning');
  if(document.getElementById('resourceLayers'))group(document.getElementById('resourceLayers'),'Wiatr i słońce','wind');
  if(document.getElementById('airLayers'))group(document.getElementById('airLayers'),'Jakość powietrza','cloud');
  for(const [id,t,ic] of [['transportLayers','Drogi i kolej','road-horizon'],['limitLayers','Lotnictwo, wojsko, przesył','airplane-tilt'],['heritageLayers','Zabytki','castle-turret'],['urbexLayers','Opuszczone miejsca','warning'],['youtubeLayers','Ciekawostki z YouTube','film-strip'],['curioLayers','Ciekawostki przestrzenne','ruler']]){const el=document.getElementById(id);if(el)group(el,t,ic);}
  if(document.getElementById('poiLayers'))group(document.getElementById('poiLayers'),'Usługi i miejsca','storefront');
  const services=document.getElementById('surroundingsLayers'),priceEntry=document.getElementById('surPrices').closest('.layer-entry'),legend=document.getElementById('priceLegend');
  const prices=document.createElement('div');prices.id='priceLayers';prices.className='layer-group';services.after(prices);prices.append(priceEntry,legend);
  group(prices,'Ceny nieruchomości','buildings');
  const settings=document.createElement('div');settings.className='layer-settings';panel.querySelector('#noLayers').after(settings);
  const cadastral=document.getElementById('cadastralLayers');cadastral.querySelector('h3').textContent='Nakładki';document.querySelector('#basemaps').after(cadastral);
  // Ownership colours: always visible (a phone tap near its edge can snap to the parcel switch, which used to hide this row); switching colours on also turns parcels on.
  const dzToggle=document.getElementById('lyrDz'),colors=document.createElement('div');colors.className='layer-entry layer-sub';colors.dataset.keywords='własności własność kolory działek grupy rejestrowe';colors.innerHTML='<label class="sw"><input type="checkbox" id="lyrParcelColors"><span></span><div>Własności<small>Koloruje działki według grup rejestrowych</small></div></label>';dzToggle.closest('.layer-entry').after(colors);
  const legendBox=document.getElementById('legendDetails');if(legendBox){legendBox.open=false;colors.append(legendBox);}
  const colorToggle=colors.querySelector('input');function syncColors(){colors.hidden=false;if(legendBox)legendBox.hidden=!colorToggle.checked;}
  colorToggle.checked=PLOTS.store.get('parcelColors','outline')==='groups';colorToggle.onchange=()=>{if(colorToggle.checked&&!dzToggle.checked){dzToggle.checked=true;dzToggle.dispatchEvent(new Event('change',{bubbles:true}));}PLOTS.setParcelColors(colorToggle.checked?'groups':'outline');syncColors();};dzToggle.addEventListener('change',syncColors);document.addEventListener('plots:parcel-colors',e=>{colorToggle.checked=e.detail==='groups';syncColors();});syncColors();
  // One tap turns every overlay off (parcels, addresses, plans, terrain, services); names on imagery stay.
  const off=document.createElement('button');off.type='button';off.id='layersOff';off.className='layers-off';
  document.querySelector('#basemaps').after(off);
  const onBoxes=()=>[...panel.querySelectorAll('.layer-entry input[type=checkbox]:checked')].filter(i=>i.id!=='lyrParcelColors');
  function syncOff(){const n=onBoxes().length;off.disabled=!n;off.innerHTML=`${Icons.svg('stack')}${n?`Wyłącz warstwy <b>${n}</b>`:'Warstwy wyłączone'}`;}
  off.onclick=()=>{const c=document.getElementById('lyrParcelColors');if(c?.checked){c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));}onBoxes().forEach(i=>{i.checked=false;i.dispatchEvent(new Event('change',{bubbles:true}));});syncOff();};
  panel.addEventListener('change',()=>setTimeout(syncOff));syncOff();
  const range=document.querySelector('#cadastralLayers .range');if(range)settings.append(range);
  for(const el of [...panel.children])if(el.id==='legendDetails'||el.id==='installApp'||el.matches('p.source-note'))settings.append(el);
  group(settings,'Wygląd i informacje','sliders-horizontal');
  panel.querySelectorAll('.layer-section .layer-group>h3').forEach(h=>h.hidden=true);
  const source=document.getElementById('networkSource');if(source){const details=document.createElement('details');details.className='layer-source';details.innerHTML='<summary>Źródło danych</summary>';source.before(details);details.append(source);}
  const general=document.createElement('div');general.id='layerMapSettings';const header=panel.querySelector('.section-head');for(const el of [...panel.children])if(el!==header&&el!==services)general.append(el);panel.append(general);services.hidden=true;
  window.LayerControls={show(mode){if(mode==='access'){window.DistanceModule?.open();}else panel.scrollTop=0;}};
  document.dispatchEvent(new Event('plots:layers-ready'));
  panel.addEventListener('change',counts);counts();observer.disconnect();decorate();setTimeout(decorate,1500);

 }
 const observer=new MutationObserver(setup);observer.observe(panel,{childList:true,subtree:true});setup();
 document.getElementById('layerFilter').addEventListener('input',e=>{
  const q=e.target.value.trim();if(!q)return;
  panel.querySelectorAll('.layer-section').forEach(d=>{const rows=[...d.querySelectorAll('.layer-entry')];if(rows.length){d.hidden=!rows.some(el=>!el.hidden);if(!d.hidden)d.open=true;}});
 });
 document.getElementById('layerFilter').addEventListener('input',e=>{if(!e.target.value.trim())panel.querySelectorAll('.layer-section').forEach(d=>d.hidden=false);});
})();
