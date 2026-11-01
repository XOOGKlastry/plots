(function(root){
 'use strict';
 function decode(topology){
  const transform=topology.transform,arcs=topology.arcs.map(arc=>{let x=0,y=0;return arc.map(p=>{if(!transform)return p.slice();x+=p[0];y+=p[1];return [x*transform.scale[0]+transform.translate[0],y*transform.scale[1]+transform.translate[1]];});});
  function ring(indices){const out=[];for(const index of indices){const points=index<0?arcs[~index].slice().reverse():arcs[index];out.push(...(out.length?points.slice(1):points));}return out;}
  const seen=new Set(),features=[];
  for(const o of Object.values(topology.objects))for(const g of o.geometries||[]){
   if(!g.type||seen.has(g.properties.k))continue;seen.add(g.properties.k);
   const polygons=g.type==='Polygon'?[g.arcs.map(ring)]:g.type==='MultiPolygon'?g.arcs.map(p=>p.map(ring)):[];
   if(!polygons.length)throw Error('Nieobsługiwana geometria granic');
   let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
   polygons.forEach(p=>p.forEach(r=>r.forEach(([x,y])=>{if(!Number.isFinite(x)||!Number.isFinite(y)||x<13||x>25||y<48||y>56)throw Error('Nieprawidłowy układ granic');minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);})));features.push({id:g.properties.k,polygons,bbox:[minX,minY,maxX,maxY]});
  }
  return features;
 }
 function inRing(point,ring){
  const [x,y]=point;let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const [xi,yi]=ring[i],[xj,yj]=ring[j],cross=(x-xi)*(yj-yi)-(y-yi)*(xj-xi);
   if(Math.abs(cross)<1e-12&&Math.min(xi,xj)<=x&&x<=Math.max(xi,xj)&&Math.min(yi,yj)<=y&&y<=Math.max(yi,yj))return 2;
   if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }return inside?1:0;
 }
 function contains(point,feature){return feature.polygons.some(p=>inRing(point,p[0])===1&&!p.slice(1).some(r=>inRing(point,r)));}
 function lookup(features,lon,lat){
  if(!Number.isFinite(lon)||!Number.isFinite(lat))return null;
  const hits=features.filter(f=>lon>=f.bbox[0]&&lon<=f.bbox[2]&&lat>=f.bbox[1]&&lat<=f.bbox[3]&&contains([lon,lat],f));
  return hits.length===1?hits[0].id:null;
 }
 function teryt(value){const raw=String(value||''),s=/^\d{6}_\d$/.test(raw)?raw.replace('_',''):raw;if(!/^\d{6}[1234589]$/.test(s))return null;return /[45]$/.test(s)?s.slice(0,6)+'3':/[89]$/.test(s)?s.slice(0,4)+'011':s;}

 const api={decode,inRing,contains,lookup,teryt};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MunicipalityModel=api;
})(typeof window!=='undefined'?window:globalThis);
