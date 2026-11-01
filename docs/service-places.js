(function(){
 'use strict';
 const app=window.PLOTS,esc=app.esc,icon=window.Icons.svg;let selected=null;
 document.addEventListener('plots:selection',()=>selected=null);
 function open(point,network){
  const lon=Number(point.lon),lat=Number(point.lat);if(!Number.isFinite(lon)||!Number.isFinite(lat))return;
  const google=new URL('https://www.google.com/maps/search/');google.searchParams.set('api','1');google.searchParams.set('query',`${lat},${lon}`);
  app.showInfo(`<div class="service-heading"><span class="service-icon">${icon('map-pin')}</span><div><p class="eyebrow">${esc(network.label)}</p><h2 id="serviceName">${esc(point.name||'Wczytuję nazwę…')}</h2></div></div><a class="google-action" href="${esc(google.href)}" target="_blank" rel="noopener noreferrer">${icon('google-logo')}Pokaż w Google Maps${icon('arrow-up-right')}</a><button type="button" class="category-access-action" data-enable-category="${esc(network.id)}">${icon('path')}Zasięg całej kategorii${icon('arrow-up-right')}</button><p class="source-note">Wspólny zasięg dojścia do najbliższego obiektu tej kategorii. Czas i tryb zmienisz w panelu warstw.</p><p class="source-note muted">${esc(network.source)} · ${esc(network.source_date)}</p>`);
  selected={...point,lon,lat};app.markPoint([lon,lat]);document.dispatchEvent(new CustomEvent('plots:point',{detail:{lon,lat}}));
  const target=selected;if(!point.name)window.PLOTS_SURROUNDINGS.nameFor(point).then(name=>{const el=document.getElementById('serviceName');if(el&&selected===target)el.textContent=name;});
 }
 document.getElementById('card').addEventListener('click',e=>{const b=e.target.closest('[data-enable-category]');if(b)window.CategoryAccess.enable(b.dataset.enableCategory);});
 window.ServicePlaces={open};
})();
