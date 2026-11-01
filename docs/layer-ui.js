(function(){
 'use strict';
 const panel=document.getElementById('layerPanel'),icon=window.Icons.svg;
 function group(element,label,name){
  const details=document.createElement('details');details.className='layer-section';
  details.innerHTML=`<summary>${icon(name)}<span>${label}</span><small class="group-count"></small>${icon('caret-down','section-chevron')}</summary><div class="layer-section-body"></div>`;
  element.before(details);details.lastElementChild.append(element);details.addEventListener('toggle',()=>{if(details.open&&!document.getElementById('layerFilter').value.trim())panel.querySelectorAll('.layer-section').forEach(d=>{if(d!==details)d.open=false;});});return details;
 }
 function counts(){panel.querySelectorAll('.layer-section').forEach(d=>{const n=d.querySelectorAll('.layer-entry input[type=checkbox]:checked').length;d.querySelector('.group-count').textContent=n?n+' aktywne':'';});}
 function setup(){
  if(panel.dataset.grouped||!document.getElementById('surPrices')||!document.getElementById('plan-mpzp'))return;
  panel.dataset.grouped='true';
  group(document.getElementById('cadastralLayers'),'Granice, działki i adresy','house-line');
  group(document.getElementById('planningLayers'),'Planowanie przestrzenne','map-trifold');
  const services=document.getElementById('surroundingsLayers'),priceEntry=document.getElementById('surPrices').closest('.layer-entry'),legend=document.getElementById('priceLegend');
  const prices=document.createElement('div');prices.id='priceLayers';prices.className='layer-group';services.after(prices);prices.append(priceEntry,legend);
  group(prices,'Ceny nieruchomości','buildings');
  const settings=document.createElement('div');settings.className='layer-settings';panel.querySelector('#noLayers').after(settings);
  const range=document.querySelector('#cadastralLayers .range');if(range)settings.append(range);
  for(const el of [...panel.children])if(el.id==='legendDetails'||el.id==='installApp'||el.matches('p.source-note'))settings.append(el);
  group(settings,'Wygląd i informacje','sliders-horizontal');
  panel.querySelectorAll('.layer-section .layer-group>h3').forEach(h=>h.hidden=true);
  const source=document.getElementById('networkSource');if(source){const details=document.createElement('details');details.className='layer-source';details.innerHTML='<summary>Źródło danych</summary>';source.before(details);details.append(source);}
  const modes=document.createElement('nav');modes.className='layer-mode-tabs';modes.setAttribute('aria-label','Rodzaj ustawień mapy');modes.innerHTML=`<button type="button" data-layer-mode="map" aria-pressed="true">${icon('map-trifold')}Mapa</button><button type="button" data-layer-mode="access" aria-pressed="false">${icon('person-simple-walk')}Obiekty i dojście</button>`;
  const general=document.createElement('div');general.id='layerMapSettings';const access=document.createElement('div');access.id='layerServices';access.hidden=true;
  const header=panel.querySelector('.section-head');header.after(modes);for(const el of [...panel.children])if(el!==header&&el!==modes)general.append(el);access.append(services);panel.append(general,access);
  function show(mode){general.hidden=mode!=='map';access.hidden=mode!=='access';modes.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layerMode===mode)));if(mode==='access'){const search=document.getElementById('layerFilter');if(search.value){search.value='';search.dispatchEvent(new Event('input'));}}panel.scrollTop=0;}
  modes.addEventListener('click',e=>{const b=e.target.closest('[data-layer-mode]');if(b)show(b.dataset.layerMode);});window.LayerControls={show};
  panel.addEventListener('change',counts);counts();observer.disconnect();

 }
 const observer=new MutationObserver(setup);observer.observe(panel,{childList:true,subtree:true});setup();
 document.getElementById('layerFilter').addEventListener('input',e=>{
  const q=e.target.value.trim();if(!q)return;
  panel.querySelectorAll('.layer-section').forEach(d=>{const rows=[...d.querySelectorAll('.layer-entry')];if(rows.length){d.hidden=!rows.some(el=>!el.hidden);if(!d.hidden)d.open=true;}});
 });
 document.getElementById('layerFilter').addEventListener('input',e=>{if(!e.target.value.trim())panel.querySelectorAll('.layer-section').forEach(d=>d.hidden=false);});
})();
