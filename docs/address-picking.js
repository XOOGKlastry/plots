(function(root){
 'use strict';
 function closest(features,point,project){
  const seen=new Set(),ranked=[];
  for(const f of features){const coordinates=f.geometry?.coordinates;if(f.geometry?.type!=='Point'||!coordinates)continue;const key=f.properties?.fid||f.properties?.id||coordinates.join(',');if(seen.has(key))continue;seen.add(key);const p=project(coordinates),distance=(p.x-point.x)**2+(p.y-point.y)**2;ranked.push({feature:f,distance});}
  ranked.sort((a,b)=>a.distance-b.distance);return ranked[0]?.feature||null;
 }
 const api={closest};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AddressPicking=api;
})(typeof window!=='undefined'?window:globalThis);
