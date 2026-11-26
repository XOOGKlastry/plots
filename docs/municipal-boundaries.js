(function(){
 'use strict';
 const app=window.PLOTS,map=app.map,cache=new Map(),pending=new Map();let current=null,revision=0,data=null;
 const empty=()=>({type:'FeatureCollection',features:[]});
 // The selected gmina outline is always shown in the Gmina tab (no separate layer switch).
 let forced=null;// a curiosity can show a gmina outline outside the Gmina tab
 function visible(){return !window.DistanceModule?.isOpen()&&(app.currentTab()==='gmina'||(forced&&forced===current));}
 map.on('movestart',e=>{if(e.originalEvent)flight++;});
 // Neighbours: gminy sharing a border arc with the selected one (from the country topology the app already loads).
 let nbIndex=null;
 function neighbours(id){
  const topo=window.MunicipalityContext?.topology?.();if(!topo||!id)return [];
  if(!nbIndex){const own=new Map(),seen=new Set();const walk=(a,k)=>Array.isArray(a)?a.forEach(x=>walk(x,k)):(()=>{const i=a<0?~a:a;(own.get(i)||own.set(i,new Set()).get(i)).add(k);})();
   for(const o of Object.values(topo.objects))for(const g of o.geometries||[]){if(!g.arcs||seen.has(g.properties.k))continue;seen.add(g.properties.k);walk(g.arcs,String(g.properties.k));}
   nbIndex=new Map();for(const ks of own.values())for(const a of ks)for(const b of ks)if(a!==b)(nbIndex.get(a)||nbIndex.set(a,new Set()).get(a)).add(b);}
  return [...(nbIndex.get(String(id))||[])];
 }
 function nbData(){if(!current)return empty();const fs=neighbours(current).map(k=>window.MunicipalityContext.shape(k)).filter(Boolean);
  return {type:'FeatureCollection',features:fs.map(s=>({type:'Feature',properties:{},geometry:{type:'MultiPolygon',coordinates:s.polygons}}))};}
 function render(){const on=visible()&&data;map.getSource('municipal-boundaries')?.setData(on?data:empty());map.getSource('municipal-neighbours')?.setData(on?nbData():empty());}
 function save(id,value){try{localStorage.setItem('plots.boundary.'+id,JSON.stringify(value));let recent=JSON.parse(localStorage.getItem('plots.boundaryRecent')||'[]');recent=[id,...recent.filter(x=>x!==id)];recent.slice(6).forEach(x=>localStorage.removeItem('plots.boundary.'+x));localStorage.setItem('plots.boundaryRecent',JSON.stringify(recent.slice(0,6)));}catch{/* Storage is optional. */}}
 async function load(id){
  if(cache.has(id))return cache.get(id);
  if(!pending.has(id))pending.set(id,app.api('/api/gmina-granice?id='+id).then(value=>{if(value.type!=='FeatureCollection'||!Array.isArray(value.bbox)||value.simplified!==false)throw Error('Nieprawidłowe granice');cache.set(id,value);save(id,value);return value;}).catch(error=>{try{const saved=JSON.parse(localStorage.getItem('plots.boundary.'+id)||'null');if(saved?.municipality===id&&saved.features&&saved.bbox){cache.set(id,saved);return saved;}}catch{}throw error;}).finally(()=>pending.delete(id)));
  return pending.get(id);
 }
 // One controller: highlight at once (local outline), fly once with a single token, then swap in the detailed outline.
 let flight=0;
 function quick(id){const s=window.MunicipalityContext?.shape?.(id);if(!s)return null;return {type:'FeatureCollection',bbox:s.bbox,features:[{type:'Feature',properties:{kind:'gmina'},geometry:{type:'MultiPolygon',coordinates:s.polygons}}]};}
 function fly(bbox){const run=++flight,anim=window.Motion?.on(),far=map.getZoom()<8.5;app.frame(bbox,16,anim?{duration:far?1800:900}:{});if(anim)map.once('moveend',()=>{if(run===flight)flash();});else flash();}
 async function select(id,fit=false){
  if(current!==id){current=id;revision++;data=null;}const run=revision;
  if(!id){render();return false;}
  const q=data?null:quick(id);if(q){data=q;render();}
  const canFly=()=>fit&&app.currentTab()==='gmina'&&!window.StatsMap?.isOpen();
  let flown=false;if(q&&canFly()){fly(q.bbox);flown=true;}
  try{const value=await load(id);if(run!==revision)return flown;data=value;render();if(!flown&&canFly()){fly(value.bbox);flown=true;}return true;}
  catch(error){if(run===revision&&fit&&!flown)app.toast('Granice gminy są chwilowo niedostępne');return flown;}
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
  app.registerOverlaySource('municipal-neighbours');map.addSource('municipal-neighbours',{type:'geojson',data:empty(),tolerance:.6});
  map.addLayer({id:'municipal-neighbour-fill',type:'fill',source:'municipal-neighbours',paint:{'fill-color':'#4dabf7','fill-opacity':.09}},map.getLayer('dz-fill')?'dz-fill':undefined);
  map.addLayer({id:'municipal-neighbour-line',type:'line',source:'municipal-neighbours',paint:{'line-color':'#4dabf7','line-width':2,'line-opacity':.8}});
  window.MunicipalityContext?.ready?.().then(()=>render()).catch(()=>{});
  map.addLayer({id:'municipal-boundary-fill',type:'fill',source:'municipal-boundaries',paint:{'fill-color':['match',['get','kind'],'miasto','#8b5cf6','#087cfc'],'fill-opacity':.06}},map.getLayer('dz-fill')?'dz-fill':undefined);
  map.addLayer({id:'municipal-boundary-line',type:'line',source:'municipal-boundaries',filter:['==',['get','kind'],'gmina'],paint:{'line-color':'#087cfc','line-width':3}});
  map.addLayer({id:'municipal-boundary-glow',type:'line',source:'municipal-boundaries',filter:['==',['get','kind'],'gmina'],paint:{'line-color':'#087cfc','line-width':16,'line-blur':10,'line-opacity':0}},'municipal-boundary-line');
  map.addLayer({id:'municipal-city-line',type:'line',source:'municipal-boundaries',filter:['==',['get','kind'],'miasto'],paint:{'line-color':'#8b5cf6','line-width':2.5,'line-dasharray':[3,2]}});render();
 }
 if(map.loaded())setTimeout(initialize);else map.once('load',initialize);
 document.addEventListener('plots:gmina',e=>{if(e.detail.id!==current)select(e.detail.id,false);});
 document.addEventListener('plots:mode',render);
 document.addEventListener('plots:tab',e=>{render();if(e.detail==='gmina'&&current)select(current,false);});
 window.MunicipalBoundaries={show:id=>{forced=id;return select(id,false).then(()=>render());},select,current:()=>current,fit:()=>current?select(current,true):Promise.resolve(false)};
})();
