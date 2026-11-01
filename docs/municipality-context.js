(function(){
 'use strict';
 const model=window.MunicipalityModel;let shapes=null,pending=null,revision=0;
 function ready(){if(!pending)pending=fetch('data/municipalities.topojson').then(r=>{if(!r.ok)throw Error('Granice gmin niedostępne');return r.json();}).then(t=>shapes=model.decode(t)).catch(e=>{pending=null;throw e;});return pending;}
 async function update(detail){
  const current=++revision;
  const id=model.teryt(detail.TERYT_GMI||detail.teryt_gmi||detail.teryt||detail.gmina_teryt);
  if(id){await window.PLOTS_GMINY.setContext(id);return;}
  // Clear the former municipality immediately; a distant old profile must not linger.
  await window.PLOTS_GMINY.setContext(null,'Ustalam gminę dla wskazanego miejsca…');
  try{
   try{const value=await window.PLOTS.api('/api/gmina-punkt?lon='+encodeURIComponent(detail.lon)+'&lat='+encodeURIComponent(detail.lat));if(current!==revision)return;await window.PLOTS_GMINY.setContext(value.id,value.id?'':'Nie ustalono gminy dla tego punktu.');return;}catch{/* Offline fallback uses the saved country topology. */}
   const features=shapes||await ready();if(current!==revision)return;const found=model.lookup(features,Number(detail.lon),Number(detail.lat));await window.PLOTS_GMINY.setContext(found,found?'':'Nie ustalono gminy dla tego punktu. Punkt może leżeć poza granicami Polski lub na granicy jednostek.');}
  catch(error){if(current===revision)await window.PLOTS_GMINY.setContext(null,'Granice gmin są chwilowo niedostępne. Spróbuj ponownie.');}
 }
 document.addEventListener('plots:address',e=>update(e.detail).catch(()=>window.PLOTS.toast('Dane gmin są chwilowo niedostępne')));
 document.addEventListener('plots:point',e=>update(e.detail).catch(()=>window.PLOTS.toast('Dane gmin są chwilowo niedostępne')));
 document.addEventListener('plots:parcel',()=>revision++);
 document.addEventListener('plots:manual-gmina',()=>revision++);
 window.MunicipalityContext={ready,update};
})();
