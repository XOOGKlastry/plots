(function(){
  "use strict";
  const app=window.PLOTS,map=app.map,esc=app.esc,model=window.SurroundingsModel;
  const DATA="https://xoogklastry.github.io/jakdaleko/",container=document.getElementById("surroundingsLayers");
  const cache=new Map(),pending=new Map();let config=null,configError=null,revision=0,priceRevision=0,selectionRevision=0,timer=null;
  const state={network:app.store.get("surroundings.network","poz"),poi:app.store.get("surroundings.poi",false),prices:app.store.get("surroundings.prices",false)};
  const collection=features=>({type:"FeatureCollection",features});
  async function binary(path){if(cache.has(path))return cache.get(path);if(!pending.has(path))pending.set(path,fetch(DATA+path,{signal:AbortSignal.timeout(20000)}).then(r=>{if(!r.ok)throw Error("Nie udało się pobrać danych otoczenia");return r.arrayBuffer();}).then(b=>{cache.set(path,b);while(cache.size>32)cache.delete(cache.keys().next().value);return b;}).finally(()=>pending.delete(path)));return pending.get(path);}
  const net=()=>config.networks.find(n=>n.id===state.network);
  function tiles(bounds){const keys=[];for(let x=Math.floor((bounds.getWest()-config.origin[0])/config.tile);x<=Math.floor((bounds.getEast()-config.origin[0])/config.tile);x++)for(let y=Math.floor((bounds.getSouth()-config.origin[1])/config.tile);y<=Math.floor((bounds.getNorth()-config.origin[1])/config.tile);y++){if(keys.length>9)return [];keys.push(x+"_"+y);}return keys;}
  function inView(p,b){return p.lon>=b.getWest()&&p.lon<=b.getEast()&&p.lat>=b.getSouth()&&p.lat<=b.getNorth();}
  function status(text){document.getElementById("surroundingsStatus").textContent=text;}
  function source(id){return map.getSource(id);}
  function save(){Object.entries(state).forEach(([key,value])=>app.store.set("surroundings."+key,value));}
  async function update(){
    if(!config||!source("near-poi"))return;
    const run=++revision,bounds=map.getBounds(),network=net();
    const info=document.getElementById("networkSource");info.textContent=`${network.source} · ${network.source_kind} · ${network.source_date}`;
    source("near-poi").setData(collection([]));
    if(!state.poi){status("");return;}
    if(map.getZoom()<11){status("Przybliż mapę, aby wczytać punkty usług.");return;}
    const keys=tiles(bounds);if(!keys.length){status("Przybliż mapę — widok obejmuje zbyt duży obszar.");return;}
    status("Wczytuję otoczenie…");
    try{
      let points=[];
      if(state.poi){
        if(network.ptiles){for(const tile of keys){const entry=network.ptiles[tile];if(!entry)continue;const buffer=await binary(`poi/${network.id}/t/${tile}.bin`);points.push(...model.parsePoi(buffer,entry[1]).filter(p=>inView(p,bounds)).map(p=>({type:"Feature",geometry:{type:"Point",coordinates:[p.lon,p.lat]},properties:{network:network.id,index:p.index,tile,type:p.type}})));}}
        else{const buffer=await binary(`poi/${network.id}/all.bin`);points=model.parsePoi(buffer).filter(p=>inView(p,bounds)).map(p=>({type:"Feature",geometry:{type:"Point",coordinates:[p.lon,p.lat]},properties:{network:network.id,index:p.index,tile:"",type:p.type}}));}
      }
      if(run!==revision)return;
      source("near-poi").setData(collection(points));
      status(`${points.length.toLocaleString("pl-PL")} obiektów w widoku`);
    }catch(error){if(run===revision)status(error.message+". Spróbuj przybliżyć mapę lub wybrać inną sieć.");}
  }
  async function loadPrices(){
    const run=++priceRevision;
    if(!state.prices){for(const id of ["near-price-g1","near-price-g5"])if(map.getLayer(id))map.setLayoutProperty(id,"visibility","none");document.getElementById("priceLegend").hidden=true;return;}
    try{for(const key of ["g1","g5"]){
      const id="near-price-"+key;
      if(!source(id)){
        const cells=model.parsePrices(await binary(`price/${key}.bin`),config.price.grids[key],config.price.origin,config.price.min_n);
        const features=cells.map(c=>({type:"Feature",geometry:{type:"Polygon",coordinates:[[[c.x,c.y],[c.x+c.dx,c.y],[c.x+c.dx,c.y+c.dy],[c.x,c.y+c.dy],[c.x,c.y]]]},properties:{median:c.median,count:c.count,grid:key}}));
        if(run!==priceRevision||!state.prices)return;
        app.registerOverlaySource(id);map.addSource(id,{type:"geojson",data:collection(features),attribution:"© GUGiK · Rejestr Cen Nieruchomości"});
        map.addLayer({id,type:"fill",source:id,...(key==="g1"?{minzoom:10}:{maxzoom:10}),paint:{"fill-color":["step",["get","median"],"#fff2bc",5000,"#fed381",8000,"#fda85b",11000,"#ef6c45",14000,"#b93338"],"fill-opacity":.48}},map.getLayer("dz-fill")?"dz-fill":undefined);
      }else map.setLayoutProperty(id,"visibility","visible");
    }}catch(error){status(error.message+". Ceny są chwilowo niedostępne.");}
    document.getElementById("priceLegend").hidden=!state.prices;
  }
  function remember(){save();container.dispatchEvent(new Event("change",{bubbles:true}));}
  const namesCache=new Map();
  async function nameFor(properties){const n=config.networks.find(n=>n.id===properties.network),tile=properties.tile,path=tile?`poi/${n.id}/n/${tile}.json`:`poi/${n.id}/names.json`;try{if(!namesCache.has(path))namesCache.set(path,fetch(DATA+path,{signal:AbortSignal.timeout(12000)}).then(r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{namesCache.delete(path);throw e;}));const names=await namesCache.get(path);while(namesCache.size>24)namesCache.delete(namesCache.keys().next().value);return typeof names[properties.index]==="string"?names[properties.index]:n.label;}catch{return n.label;}}
  const readyResolvers=[];
  function metres(a,b){const R=6371008.8,r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r,q=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2;return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));}
  window.PLOTS_SURROUNDINGS={
    ready(){if(configError)return Promise.reject(configError);return config?Promise.resolve(config):new Promise((resolve,reject)=>readyResolvers.push({resolve,reject}));},
    nameFor,
    async buildings(bounds,network,mode,minutes){
      const keys=tiles(bounds);if(!keys.length)throw Error('Zbyt rozległy widok');const features=[];let clipped=false;
      for(const tile of keys){if(!config.tiles[tile])continue;const positions=model.parseBuildings(await binary(`p/${tile}.bin`),tile,config),codes=new Uint8Array(await binary(`d/${network}/${tile}.bin`));if(codes.length!==positions.n)throw Error('Niezgodne dane budynków');
       for(let i=0;i<positions.n;i++){const p=positions.point(i),code=codes[i];if(!p.active||!inView(p,bounds)||!BuildingDistanceModel.matches(code,mode,minutes))continue;if(features.length>=50000){clipped=true;break;}features.push({type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},properties:{code,minutes:BuildingDistanceModel.time(code)??-1,tile,index:i}});}if(clipped)break;
      }return {features,clipped};
    },
    openPoint(point){const network=config?.networks.find(n=>n.id===point.network);if(network)window.ServicePlaces.open(point,network);},
    async candidates(origin,id,radius=25000){
      const cfg=await this.ready(),n=cfg.networks.find(x=>x.id===id);if(!n)throw Error('Nieznana kategoria');
      const dx=radius/(111000*Math.cos(origin.lat*Math.PI/180)),dy=radius/111000,points=[];
      if(n.ptiles){
        for(let x=Math.floor((origin.lon-dx-cfg.origin[0])/cfg.tile);x<=Math.floor((origin.lon+dx-cfg.origin[0])/cfg.tile);x++)for(let y=Math.floor((origin.lat-dy-cfg.origin[1])/cfg.tile);y<=Math.floor((origin.lat+dy-cfg.origin[1])/cfg.tile);y++){
          const tile=x+'_'+y,entry=n.ptiles[tile];if(!entry)continue;
          points.push(...model.parsePoi(await binary(`poi/${id}/t/${tile}.bin`),entry[1]).map(p=>({...p,tile,network:id})));
        }
      }else points.push(...model.parsePoi(await binary(`poi/${id}/all.bin`)).map(p=>({...p,tile:'',network:id})));
      return points.map(p=>({...p,straight:metres(origin,p)})).filter(p=>p.straight<=radius).sort((a,b)=>a.straight-b.straight||a.index-b.index);
    },
    handleClick(e){
    if(!config)return false;
    const ids=["near-poi-points"].filter(id=>map.getLayer(id));
    const hit=map.queryRenderedFeatures([[e.point.x-5,e.point.y-5],[e.point.x+5,e.point.y+5]],{layers:ids})[0];if(!hit)return false;
    const p={...hit.properties,lon:hit.geometry.coordinates[0],lat:hit.geometry.coordinates[1]};
    const network=config.networks.find(n=>n.id===p.network);window.ServicePlaces.open(p,network);
    return true;
  }};
  async function initialize(){
    try{const r=await fetch("data/surroundings.json");if(!r.ok)throw Error();config=await r.json();if(!net())state.network=config.networks[0].id;readyResolvers.splice(0).forEach(p=>p.resolve(config));
      container.innerHTML=`<h3>Usługi i otoczenie</h3><label class="network-select-label">Kategoria usług<select id="networkSelect" aria-label="Kategoria usług">${config.categories.map(c=>`<optgroup label="${esc(c.label)}">${config.networks.filter(n=>n.cat===c.id).map(n=>`<option value="${esc(n.id)}" ${n.id===state.network?"selected":""}>${esc(n.label)}</option>`).join("")}</optgroup>`).join("")}</select></label><p id="networkSource" class="source-note muted"></p><div class="layer-entry" data-keywords="usługi punkty zdrowie edukacja transport sklepy paczkomaty"><label class="sw"><input id="surPoi" type="checkbox" ${state.poi?"checked":""}/><span></span><div>Obiekty na mapie<small>Odległości w osobnym module</small></div></label></div><div class="layer-entry" data-keywords="ceny mieszkania rcn nieruchomości"><label class="sw"><input id="surPrices" type="checkbox" ${state.prices?"checked":""}/><span></span><div>Ceny mieszkań · RCN<small>Mediana zł/m² · min. 5 transakcji</small></div></label></div><div id="priceLegend" class="price-legend" ${state.prices?"":"hidden"}><div><i style="background:#fff2bc"></i>&lt; 5 tys.</div><div><i style="background:#fed381"></i>5–8 tys.</div><div><i style="background:#fda85b"></i>8–11 tys.</div><div><i style="background:#ef6c45"></i>11–14 tys.</div><div><i style="background:#b93338"></i>≥ 14 tys. zł/m²</div><p>${esc(config.price.period[0])} – ${esc(config.price.period[1])}</p></div><p id="surroundingsStatus" class="source-note muted" role="status"></p>`;
      for(const id of ["near-poi"]){app.registerOverlaySource(id);map.addSource(id,{type:"geojson",data:collection([])});}
      map.addLayer({id:"near-poi-points",type:"circle",source:"near-poi",minzoom:11,paint:{"circle-radius":5,"circle-color":"#087cfc","circle-stroke-color":"#fff","circle-stroke-width":2}});
      document.getElementById("networkSelect").onchange=e=>{state.network=e.target.value;remember();update();};
      for(const [id,key] of [["surPoi","poi"],["surPrices","prices"]])document.getElementById(id).onchange=e=>{state[key]=e.target.checked;remember();if(key==="prices")loadPrices();else update();};
      map.on("moveend",()=>{clearTimeout(timer);timer=setTimeout(update,150);});remember();update();if(state.prices)loadPrices();
    }catch(error){configError=error;readyResolvers.splice(0).forEach(p=>p.reject(error));container.innerHTML='<h3>Usługi i otoczenie</h3><p class="source-note muted">Nie udało się wczytać katalogu. Odśwież aplikację, aby spróbować ponownie.</p>';}
  }
  if(map.loaded())initialize();else map.once("load",initialize);
})();
