(function(){
 'use strict';
 const app=window.PLOTS,map=app.map,cache=new Map(),pending=new Map();let current=null,revision=0,data=null;
 const empty=()=>({type:'FeatureCollection',features:[]});
 const toggle=document.getElementById('lyrMunicipality');toggle.checked=app.store.get('municipalityBoundary',true);
 function visible(){return !window.DistanceModule?.isOpen()&&toggle.checked&&app.currentTab()==='gmina';}
 function render(){map.getSource('municipal-boundaries')?.setData(visible()&&data?data:empty());}
 function save(id,value){try{localStorage.setItem('plots.boundary.'+id,JSON.stringify(value));let recent=JSON.parse(localStorage.getItem('plots.boundaryRecent')||'[]');recent=[id,...recent.filter(x=>x!==id)];recent.slice(6).forEach(x=>localStorage.removeItem('plots.boundary.'+x));localStorage.setItem('plots.boundaryRecent',JSON.stringify(recent.slice(0,6)));}catch{/* Storage is optional. */}}
 async function load(id){
  if(cache.has(id))return cache.get(id);
  if(!pending.has(id))pending.set(id,app.api('/api/gmina-granice?id='+id).then(value=>{if(value.type!=='FeatureCollection'||!Array.isArray(value.bbox)||value.simplified!==false)throw Error('Nieprawidłowe granice');cache.set(id,value);save(id,value);return value;}).catch(error=>{try{const saved=JSON.parse(localStorage.getItem('plots.boundary.'+id)||'null');if(saved?.municipality===id&&saved.features&&saved.bbox){cache.set(id,saved);return saved;}}catch{}throw error;}).finally(()=>pending.delete(id)));
  return pending.get(id);
 }
 async function select(id,fit=false){
  if(current!==id){current=id;revision++;data=null;render();}const run=revision;if(!id)return false;
  try{const value=await load(id);if(run!==revision)return false;data=value;render();if(fit&&app.currentTab()==='gmina'){app.frame(value.bbox,16);return true;}return true;}
  catch(error){if(run===revision&&fit)app.toast('Granice gminy są chwilowo niedostępne');return false;}
 }
 function initialize(){
  app.registerOverlaySource('municipal-boundaries');map.addSource('municipal-boundaries',{type:'geojson',data:empty(),attribution:'© GUGiK · PRG'});
  map.addLayer({id:'municipal-boundary-fill',type:'fill',source:'municipal-boundaries',paint:{'fill-color':['match',['get','kind'],'miasto','#8b5cf6','#087cfc'],'fill-opacity':.06}},map.getLayer('dz-fill')?'dz-fill':undefined);
  map.addLayer({id:'municipal-boundary-line',type:'line',source:'municipal-boundaries',filter:['==',['get','kind'],'gmina'],paint:{'line-color':'#087cfc','line-width':3}});
  map.addLayer({id:'municipal-city-line',type:'line',source:'municipal-boundaries',filter:['==',['get','kind'],'miasto'],paint:{'line-color':'#8b5cf6','line-width':2.5,'line-dasharray':[3,2]}});render();
 }
 if(map.loaded())initialize();else map.once('load',initialize);
 toggle.onchange=()=>{app.store.set('municipalityBoundary',toggle.checked);render();};
 document.addEventListener('plots:gmina',e=>{if(e.detail.id!==current)select(e.detail.id,visible());});
 document.addEventListener('plots:mode',render);
 document.addEventListener('plots:tab',e=>{render();if(e.detail==='gmina'&&current)select(current,true);});
 window.MunicipalBoundaries={select,current:()=>current,fit:()=>current?select(current,true):Promise.resolve(false)};
})();
