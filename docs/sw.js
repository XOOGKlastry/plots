"use strict";
const CACHE="mapa-shell-20261114-3100";
const ROOT=new URL("./",self.location.href);
const ASSETS=["./","index.html","style.css","design.css","config.js","grupy.js","gminy-model.js","indicator-icons.js","poi-icons.js","gmina-wiki.js","gmina-profile.js","gmina-extra.js","transit.js","gunzip-lite.js","motion.js","data/miasta.json","gus-client.js","parcel-model.js","app.js","ui-history.js","indicator-model.js","gminy.js","access-model.js","address-access.js","planning.js","terrain.js","surroundings-model.js","surroundings.js","mobile.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable.png","icons.js","address-picking.js","municipal-boundaries.js","building-distance-model.js","distance-module.js","icons/phosphor.svg","municipality-model.js","municipality-context.js","municipality-crests.js","service-places.js","layer-ui.js","stats-model.js","stats-map.js","data/municipality-crests.json","data/municipalities.topojson","data/gminy.json","data/gus-catalog.json","data/bdl-units.json","data/gus-population.json","data/surroundings.json","styles/map-light.json"];
const LIBRARIES=["https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js","https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"];
self.addEventListener("install",event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS.map(p=>new Request(new URL(p,ROOT).href,{cache:"reload"})));await Promise.allSettled(LIBRARIES.map(async url=>{const r=await fetch(url,{mode:"cors"});if(r.ok)await cache.put(url,r);}));await self.skipWaiting();})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(key=>key.startsWith("mapa-shell-")&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})()));
self.addEventListener("message",event=>{if(event.data?.type==="ACTIVATE_UPDATE")self.skipWaiting();});
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);if(request.method!=="GET")return;
  if(request.mode==="navigate"&&url.origin===ROOT.origin&&url.pathname.startsWith(ROOT.pathname)){
    event.respondWith(fetch(request).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(new URL("index.html",ROOT).href,response.clone());}return response;}).catch(()=>caches.match(new URL("index.html",ROOT).href)));return;
  }
  const crestPack=url.origin===ROOT.origin&&url.pathname.startsWith(ROOT.pathname)&&/^data\/crests-(02|04|06|08|10|12|14|16|18|20|22|24|26|28|30|32)\.bin$/.test(url.pathname.slice(ROOT.pathname.length));
  if(crestPack||url.href===new URL('data/crests-extra-20261110.bin',ROOT).href||url.href===new URL('data/gus-energia.json',ROOT).href){event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}return response;})));return;}
  // The tunnel address in config.js changes when the tunnel restarts: never serve a stale copy while online.
  if(url.href===new URL('config.js',ROOT).href){event.respondWith(fetch(request,{cache:'no-store'}).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}return response;}).catch(()=>caches.match(request)));return;}
  const allowed=ASSETS.some(path=>new URL(path,ROOT).href===url.href)||LIBRARIES.includes(url.href);
  // Application files: fresh from the network (so a new version works at once, without tapping "odśwież"), the saved copy only offline or on a slow link.
  if(allowed)event.respondWith((async()=>{
    const cache=await caches.open(CACHE),cached=await cache.match(request);
    const fresh=fetch(request,{cache:"no-cache"}).then(async response=>{if(response.ok)await cache.put(request,response.clone());return response;});
    if(!cached)return fresh;
    fresh.catch(()=>{});
    return Promise.race([fresh,new Promise(resolve=>setTimeout(resolve,4000))]).then(response=>response&&response.ok?response:cached).catch(()=>cached);
  })());
  // Live planning, maps and statistics are never presented as an offline tile cache.
});
