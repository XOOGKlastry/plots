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

  group(document.getElementById('planningLayers'),'Planowanie przestrzenne','map-trifold');
  const services=document.getElementById('surroundingsLayers'),priceEntry=document.getElementById('surPrices').closest('.layer-entry'),legend=document.getElementById('priceLegend');
  const prices=document.createElement('div');prices.id='priceLayers';prices.className='layer-group';services.after(prices);prices.append(priceEntry,legend);
  group(prices,'Ceny nieruchomości','buildings');
  const settings=document.createElement('div');settings.className='layer-settings';panel.querySelector('#noLayers').after(settings);
  settings.append(document.getElementById('cadastralLayers'));
  const range=document.querySelector('#cadastralLayers .range');if(range)settings.append(range);
  for(const el of [...panel.children])if(el.id==='legendDetails'||el.id==='installApp'||el.matches('p.source-note'))settings.append(el);
  group(settings,'Wygląd i informacje','sliders-horizontal');
  panel.querySelectorAll('.layer-section .layer-group>h3').forEach(h=>h.hidden=true);
  const source=document.getElementById('networkSource');if(source){const details=document.createElement('details');details.className='layer-source';details.innerHTML='<summary>Źródło danych</summary>';source.before(details);details.append(source);}
  const general=document.createElement('div');general.id='layerMapSettings';const header=panel.querySelector('.section-head');for(const el of [...panel.children])if(el!==header&&el!==services)general.append(el);panel.append(general);services.hidden=true;
  window.LayerControls={show(mode){if(mode==='access'){window.DistanceModule?.open();}else panel.scrollTop=0;}};
  document.dispatchEvent(new Event('plots:layers-ready'));
  panel.addEventListener('change',counts);counts();observer.disconnect();

 }
 const observer=new MutationObserver(setup);observer.observe(panel,{childList:true,subtree:true});setup();
 document.getElementById('layerFilter').addEventListener('input',e=>{
  const q=e.target.value.trim();if(!q)return;
  panel.querySelectorAll('.layer-section').forEach(d=>{const rows=[...d.querySelectorAll('.layer-entry')];if(rows.length){d.hidden=!rows.some(el=>!el.hidden);if(!d.hidden)d.open=true;}});
 });
 document.getElementById('layerFilter').addEventListener('input',e=>{if(!e.target.value.trim())panel.querySelectorAll('.layer-section').forEach(d=>d.hidden=false);});
})();
