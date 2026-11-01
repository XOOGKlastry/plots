"use strict";
const CACHE="mapa-shell-20261101-1";
const ROOT=new URL("./",self.location.href);
const ASSETS=["./","index.html","style.css","design.css","config.js","grupy.js","gminy-model.js","gus-client.js","parcel-model.js","app.js","indicator-model.js","gminy.js","access-model.js","address-access.js","planning.js","surroundings-model.js","surroundings.js","mobile.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable.png","icons.js","icons/phosphor.svg","municipality-model.js","municipality-context.js","municipality-crests.js","isochrone-model.js","service-places.js","layer-ui.js","vendor/polygon-clipping.js","data/municipality-crests.json","data/municipalities.topojson","data/gminy.json","data/gus-catalog.json","data/bdl-units.json","data/gus-population.json","data/map-services.json","data/surroundings.json","styles/map-light.json","styles/map-dark.json"];
const LIBRARIES=["https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js","https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"];
self.addEventListener("install",event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS.map(p=>new URL(p,ROOT).href));await Promise.allSettled(LIBRARIES.map(async url=>{const r=await fetch(url,{mode:"cors"});if(r.ok)await cache.put(url,r);}));})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(key=>key.startsWith("mapa-shell-")&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})()));
self.addEventListener("message",event=>{if(event.data?.type==="ACTIVATE_UPDATE")self.skipWaiting();});
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);if(request.method!=="GET")return;
  if(request.mode==="navigate"&&url.origin===ROOT.origin&&url.pathname.startsWith(ROOT.pathname)){
    event.respondWith(fetch(request).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(new URL("index.html",ROOT).href,response.clone());}return response;}).catch(()=>caches.match(new URL("index.html",ROOT).href)));return;
  }
  const crestPack=url.origin===ROOT.origin&&url.pathname.startsWith(ROOT.pathname)&&/^data\/crests-(02|04|06|08|10|12|14|16|18|20|22|24|26|28|30|32)\.bin$/.test(url.pathname.slice(ROOT.pathname.length));
  if(crestPack){event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}return response;})));return;}
  const allowed=ASSETS.some(path=>new URL(path,ROOT).href===url.href)||LIBRARIES.includes(url.href);
  if(allowed)event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
  // Live planning, maps and statistics are never presented as an offline tile cache.
});
