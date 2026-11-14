(function(){
 'use strict';
 const app=window.PLOTS,map=app.map,cache=new Map(),pending=new Map();let current=null,revision=0,data=null;
 const empty=()=>({type:'FeatureCollection',features:[]});
 // The selected gmina outline is always shown in the Gmina tab (no separate layer switch).
 function visible(){return !window.DistanceModule?.isOpen()&&app.currentTab()==='gmina';}
 // A user gesture after selection cancels the pending fit, so a quick zoom-out is never undone by a late boundary load.
 let gesture=0;map.on('movestart',e=>{if(e.originalEvent)gesture++;});
 function render(){map.getSource('municipal-boundaries')?.setData(visible()&&data?data:empty());}
 function save(id,value){try{localStorage.setItem('plots.boundary.'+id,JSON.stringify(value));let recent=JSON.parse(localStorage.getItem('plots.boundaryRecent')||'[]');recent=[id,...recent.filter(x=>x!==id)];recent.slice(6).forEach(x=>localStorage.removeItem('plots.boundary.'+x));localStorage.setItem('plots.boundaryRecent',JSON.stringify(recent.slice(0,6)));}catch{/* Storage is optional. */}}
 async function load(id){
  if(cache.has(id))return cache.get(id);
  if(!pending.has(id))pending.set(id,app.api('/api/gmina-granice?id='+id).then(value=>{if(value.type!=='FeatureCollection'||!Array.isArray(value.bbox)||value.simplified!==false)throw Error('Nieprawidłowe granice');cache.set(id,value);save(id,value);return value;}).catch(error=>{try{const saved=JSON.parse(localStorage.getItem('plots.boundary.'+id)||'null');if(saved?.municipality===id&&saved.features&&saved.bbox){cache.set(id,saved);return saved;}}catch{}throw error;}).finally(()=>pending.delete(id)));
  return pending.get(id);
 }
 async function select(id,fit=false){
  if(current!==id){current=id;revision++;data=null;render();}const run=revision,moves=gesture;if(!id)return false;
  try{const value=await load(id);if(run!==revision)return false;data=value;render();if(fit&&gesture===moves&&app.currentTab()==='gmina'&&!window.StatsMap?.isOpen()){const anim=window.Motion?.on(),far=map.getZoom()<8.5;app.frame(value.bbox,16,anim?{duration:far?2300:1100}:{});if(anim)map.once('moveend',()=>{if(run===revision)flash();});return true;}if(window.Motion?.on())flash();return true;}
  catch(error){if(run===revision&&fit)app.toast('Granice gminy są chwilowo niedostępne');return false;}
 }
 // Short glow of the outline and fill when a gmina is shown (only with animations on).
 let glow=0;
 function flash(){
  if(!map.getLayer('municipal-boundary-glow'))return;const id=++glow,t0=performance.now(),dur=1700;
  const step=now=>{if(id!==glow||!map.getLayer('municipal-boundary-glow'))return;const t=Math.min(1,(now-t0)/dur),a=Math.sin(Math.PI*t);
   map.setPaintProperty('municipal-boundary-glow','line-opacity',.55*a);map.setPaintProperty('municipal-boundary-fill','fill-opacity',.06+.16*a);
   if(t<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
 }
 function initialize(){
  app.registerOverlaySource('municipal-boundaries');map.addSource('municipal-boundaries',{type:'geojson',data:empty(),attribution:'© GUGiK · PRG'});
  map.addLayer({id:'municipal-boundary-fill',type:'fill',source:'municipal-boundaries',paint:{'fill-color':['match',['get','kind'],'miasto','#8b5cf6','#087cfc'],'fill-opacity':.06}},map.getLayer('dz-fill')?'dz-fill':undefined);
  map.addLayer({id:'municipal-boundary-line',type:'line',source:'municipal-boundaries',filter:['==',['get','kind'],'gmina'],paint:{'line-color':'#087cfc','line-width':3}});
  map.addLayer({id:'municipal-boundary-glow',type:'line',source:'municipal-boundaries',filter:['==',['get','kind'],'gmina'],paint:{'line-color':'#087cfc','line-width':16,'line-blur':10,'line-opacity':0}},'municipal-boundary-line');
  map.addLayer({id:'municipal-city-line',type:'line',source:'municipal-boundaries',filter:['==',['get','kind'],'miasto'],paint:{'line-color':'#8b5cf6','line-width':2.5,'line-dasharray':[3,2]}});render();
 }
 if(map.loaded())initialize();else map.once('load',initialize);
 document.addEventListener('plots:gmina',e=>{if(e.detail.id!==current)select(e.detail.id,visible());});
 document.addEventListener('plots:mode',render);
 document.addEventListener('plots:tab',e=>{render();if(e.detail==='gmina'&&current)select(current,false);});
 window.MunicipalBoundaries={select,current:()=>current,fit:()=>current?select(current,true):Promise.resolve(false)};
})();
