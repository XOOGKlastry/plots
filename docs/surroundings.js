(function(){
  "use strict";
  const app=window.PLOTS,map=app.map,esc=app.esc,model=window.SurroundingsModel;
  const DATA="https://xoogklastry.github.io/jakdaleko/",container=document.getElementById("surroundingsLayers");
  const cache=new Map(),pending=new Map();let config=null,revision=0,priceRevision=0,selectionRevision=0,timer=null;
  const state={network:app.store.get("surroundings.network","poz"),poi:app.store.get("surroundings.poi",false),buildings:app.store.get("surroundings.buildings",false),prices:app.store.get("surroundings.prices",false),mode:app.store.get("surroundings.mode","all"),threshold:app.store.get("surroundings.threshold",1500)};
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
    source("near-poi").setData(collection([]));source("near-buildings").setData(collection([]));
    if(!state.poi&&!state.buildings){status("");return;}
    if(map.getZoom()<11){status("Przybliż mapę, aby wczytać punkty usług.");return;}
    const keys=tiles(bounds);if(!keys.length){status("Przybliż mapę — widok obejmuje zbyt duży obszar.");return;}
    status("Wczytuję otoczenie…");
    try{
      let points=[];
      if(state.poi){
        if(network.ptiles){for(const tile of keys){const entry=network.ptiles[tile];if(!entry)continue;const buffer=await binary(`poi/${network.id}/t/${tile}.bin`);points.push(...model.parsePoi(buffer,entry[1]).filter(p=>inView(p,bounds)).map(p=>({type:"Feature",geometry:{type:"Point",coordinates:[p.lon,p.lat]},properties:{network:network.id,index:p.index,tile,type:p.type}})));}}
        else{const buffer=await binary(`poi/${network.id}/all.bin`);points=model.parsePoi(buffer).filter(p=>inView(p,bounds)).map(p=>({type:"Feature",geometry:{type:"Point",coordinates:[p.lon,p.lat]},properties:{network:network.id,index:p.index,tile:"",type:p.type}}));}
      }
      const buildings=[];let clipped=false;
      if(state.buildings&&map.getZoom()>=15){
        for(const tile of keys){if(!config.tiles[tile])continue;
          const buffer=await binary(`p/${tile}.bin`),positions=model.parseBuildings(buffer,tile,config),codes=new Uint8Array(await binary(`d/${network.id}/${tile}.bin`));
          if(codes.length!==positions.n)throw Error("Niezgodna liczba budynków i odległości");
          for(let i=0;i<positions.n;i++){const p=positions.point(i);if(!p.active||!inView(p,bounds)||!model.passes(codes[i],state.mode,state.threshold))continue;if(buildings.length>=15000){clipped=true;break;}buildings.push({type:"Feature",geometry:{type:"Point",coordinates:[p.lon,p.lat]},properties:{tile,index:i,code:codes[i],network:network.id}});}
          if(clipped)break;
        }
      }
      if(run!==revision)return;
      source("near-poi").setData(collection(points));source("near-buildings").setData(collection(buildings));
      status(`${points.length.toLocaleString("pl-PL")} punktów usług w widoku${state.buildings?map.getZoom()<15?" · Budynki: przybliż mapę":" · "+buildings.length.toLocaleString("pl-PL")+" budynków w widoku":""}${clipped?" · Limit widoku: przybliż mapę":""}`);
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
  async function nameFor(properties){const n=config.networks.find(n=>n.id===properties.network),tile=properties.tile,path=tile?`poi/${n.id}/n/${tile}.json`:`poi/${n.id}/names.json`;try{const r=await fetch(DATA+path);if(!r.ok)throw Error();const names=await r.json();return typeof names[properties.index]==="string"?names[properties.index]:n.label;}catch{return n.label;}}
  window.PLOTS_SURROUNDINGS={handleClick(e){
    if(!config)return false;
    const ids=["near-poi-points","near-building-points","near-price-g1","near-price-g5"].filter(id=>map.getLayer(id));
    const hit=map.queryRenderedFeatures([[e.point.x-5,e.point.y-5],[e.point.x+5,e.point.y+5]],{layers:ids})[0];if(!hit)return false;
    const p=hit.properties;
    const selection=++selectionRevision;
    if(hit.layer.id==="near-poi-points"){
      const n=config.networks.find(n=>n.id===p.network);app.showInfo(`<div class="phead"><div><h2>${esc(n.label)}</h2></div></div><p id="poiName" class="muted small">Wczytuję nazwę…</p><p class="source-note">${esc(n.source)} · ${esc(n.source_date)}</p>`);
      nameFor(p).then(name=>{const el=document.getElementById("poiName");if(el&&selection===selectionRevision)el.textContent=name;});
    }else if(hit.layer.id==="near-building-points"){
      const d=model.distance(Number(p.code)),n=config.networks.find(n=>n.id===p.network);
      app.showInfo(`<div class="phead"><div><h2>Otoczenie budynku</h2><p class="muted small">Budynek mieszkalny BDOT10k</p></div></div><div class="gmina-stats"><div class="gmina-stat"><strong>${d===null?"Brak danych":Number(p.code)===254?"≥ 47 km":d>=1000?"≈ "+(d/1000).toLocaleString("pl-PL",{maximumFractionDigits:2})+" km":"≈ "+d+" m"}</strong><small>pieszo po sieci dróg</small></div><div class="gmina-stat"><strong>${esc(n.label)}</strong><small>do najbliższego punktu tej kategorii</small></div></div><p class="source-note muted">Odległości z grafu pieszego BDOT10k. Wartości zakodowane z dokładnością 20 m do 2 km, 100 m do 10 km i 500 m dalej. Brak połączenia lub danych nie jest odległością zero.</p><p class="source-note">${esc(n.source)} · ${esc(n.source_date)}</p>`);
    }else{
      app.showInfo(`<div class="phead"><div><h2>Ceny mieszkań</h2><p class="muted small">Mediana transakcji w okolicy</p></div></div><div class="price-summary"><strong>${Number(p.median).toLocaleString("pl-PL")} zł/m²</strong><span>${Number(p.count).toLocaleString("pl-PL")} transakcji · siatka ${p.grid==="g1"?"około 1 km":"około 5 km"}</span></div><p class="source-note">RCN · GUGiK · ${esc(config.price.period[0])} – ${esc(config.price.period[1])}. Tylko lokale mieszkalne i komórki z co najmniej ${config.price.min_n} transakcjami. To mediana dla okolicy, nie wycena wskazanego budynku.</p>`);
    }
    return true;
  }};
  async function initialize(){
    try{const r=await fetch("data/surroundings.json");if(!r.ok)throw Error();config=await r.json();if(!net())state.network=config.networks[0].id;
      container.innerHTML=`<h3>Usługi i otoczenie</h3><label class="network-select-label">Kategoria usług<select id="networkSelect" aria-label="Kategoria usług">${config.categories.map(c=>`<optgroup label="${esc(c.label)}">${config.networks.filter(n=>n.cat===c.id).map(n=>`<option value="${esc(n.id)}" ${n.id===state.network?"selected":""}>${esc(n.label)}</option>`).join("")}</optgroup>`).join("")}</select></label><p id="networkSource" class="source-note muted"></p><div class="layer-entry" data-keywords="usługi punkty zdrowie edukacja transport sklepy paczkomaty"><label class="sw"><input id="surPoi" type="checkbox" ${state.poi?"checked":""}/><span></span><div>Punkty usługowe<small>Źródło i data zależą od kategorii</small></div></label></div><div class="layer-entry" data-keywords="budynki dostępność odległość piesza jakdaleko"><label class="sw"><input id="surBuildings" type="checkbox" ${state.buildings?"checked":""}/><span></span><div>Dostępność piesza budynków<small>Budynki mieszkalne · od dużego przybliżenia</small></div></label></div><div class="distance-controls"><label>Warunek<select id="walkMode"><option value="all">Wszystkie budynki</option><option value="near">Bliżej niż</option><option value="far">Dalej niż</option></select></label><label>Odległość <output id="walkOutput">${state.threshold} m</output><input id="walkThreshold" type="range" min="100" max="5000" step="100" value="${state.threshold}"/></label></div><div class="layer-entry" data-keywords="ceny mieszkania rcn nieruchomości"><label class="sw"><input id="surPrices" type="checkbox" ${state.prices?"checked":""}/><span></span><div>Ceny mieszkań · RCN<small>Mediana zł/m² · min. 5 transakcji</small></div></label></div><div id="priceLegend" class="price-legend" ${state.prices?"":"hidden"}><div><i style="background:#fff2bc"></i>&lt; 5 tys.</div><div><i style="background:#fed381"></i>5–8 tys.</div><div><i style="background:#fda85b"></i>8–11 tys.</div><div><i style="background:#ef6c45"></i>11–14 tys.</div><div><i style="background:#b93338"></i>≥ 14 tys. zł/m²</div><p>${esc(config.price.period[0])} – ${esc(config.price.period[1])}</p></div><p id="surroundingsStatus" class="source-note muted" role="status"></p>`;
      for(const id of ["near-poi","near-buildings"]){app.registerOverlaySource(id);map.addSource(id,{type:"geojson",data:collection([])});}
      map.addLayer({id:"near-building-points",type:"circle",source:"near-buildings",minzoom:15,paint:{"circle-radius":["interpolate",["linear"],["zoom"],15,2.5,18,5],"circle-color":["case",["==",["get","code"],255],"#90959f",["step",["get","code"],"#bfdbfe",50,"#60a5fa",100,"#2563eb",130,"#1e3a8a"]],"circle-opacity":.85}});
      map.addLayer({id:"near-poi-points",type:"circle",source:"near-poi",minzoom:11,paint:{"circle-radius":5,"circle-color":"#087cfc","circle-stroke-color":"#fff","circle-stroke-width":2}});
      document.getElementById("networkSelect").onchange=e=>{state.network=e.target.value;remember();update();};
      for(const [id,key] of [["surPoi","poi"],["surBuildings","buildings"],["surPrices","prices"]])document.getElementById(id).onchange=e=>{state[key]=e.target.checked;remember();if(key==="prices")loadPrices();else update();};
      const mode=document.getElementById("walkMode");mode.value=state.mode;mode.onchange=e=>{state.mode=e.target.value;remember();update();};
      document.getElementById("walkThreshold").oninput=e=>{state.threshold=Number(e.target.value);document.getElementById("walkOutput").textContent=state.threshold+" m";save();clearTimeout(timer);timer=setTimeout(update,180);};
      const legend=document.createElement("div");legend.className="price-legend";legend.innerHTML='<div><i style="background:#bfdbfe"></i>&lt; 1 km</div><div><i style="background:#60a5fa"></i>1–2 km</div><div><i style="background:#2563eb"></i>2–5 km</div><div><i style="background:#1e3a8a"></i>≥ 5 km</div><div><i style="background:#90959f"></i>brak połączenia / danych</div><p>Odległość piesza po sieci dróg</p>';legend.hidden=!state.buildings;container.querySelector('.distance-controls').append(legend);document.getElementById("surBuildings").addEventListener("change",()=>legend.hidden=!state.buildings);
      map.on("moveend",()=>{clearTimeout(timer);timer=setTimeout(update,150);});remember();update();if(state.prices)loadPrices();
    }catch(error){container.innerHTML='<h3>Usługi i otoczenie</h3><p class="source-note muted">Nie udało się wczytać katalogu. Odśwież aplikację, aby spróbować ponownie.</p>';}
  }
  if(map.loaded())initialize();else map.once("load",initialize);
})();
