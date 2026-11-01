(function(){
 'use strict';const app=window.PLOTS,icon=Icons.svg;
 const button=document.createElement('button');button.id='parcelColorsFab';button.className='fab';button.setAttribute('aria-label','Kolory działek');button.innerHTML=icon('squares-four');
 const palette=document.createElement('aside');palette.id='parcelColorPanel';palette.className='floating-panel';palette.hidden=true;palette.innerHTML=`<header class="section-head"><h2>Kolory działek</h2><button class="icbtn" data-close-palette aria-label="Zamknij">${icon('x')}</button></header><button data-parcel-colors="outline">${icon('map-trifold')}Same granice</button><button data-parcel-colors="groups">${icon('squares-four')}Grupy rejestrowe</button><div id="paletteLegend"></div>`;
 document.body.append(button,palette);function closePalette(){palette.hidden=true;document.body.classList.remove('colors-open');}
 button.onclick=()=>{if(!palette.hidden){closePalette();return;}app.closeLayers();palette.hidden=false;document.body.classList.add('colors-open');palette.querySelectorAll('[data-parcel-colors]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.parcelColors===app.store.get('parcelColors','outline'))));};
 palette.onclick=e=>{if(e.target.closest('[data-close-palette]'))closePalette();const b=e.target.closest('[data-parcel-colors]');if(b){app.setParcelColors(b.dataset.parcelColors);palette.querySelectorAll('[data-parcel-colors]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.getElementById('paletteLegend').hidden=b.dataset.parcelColors!=='groups';}};
 const legend=document.getElementById('legendDetails');if(legend){document.getElementById('paletteLegend').append(legend);document.getElementById('paletteLegend').hidden=app.store.get('parcelColors','outline')!=='groups';}
 const distance=document.createElement('button');distance.id='distanceFab';distance.className='fab distance-fab';distance.dataset.openDistance='';distance.innerHTML=icon('person-simple-walk')+'<span>Odległości</span>';document.body.append(distance);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closePalette();});window.PlaceUI={closePalette};
})();
