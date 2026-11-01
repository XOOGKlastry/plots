(function(root){
 'use strict';
 const minutes=[5,10,15,20,25,30,40,50,60];
 function polygons(response,time){
  if(!minutes.includes(time)||response.type!=='FeatureCollection'||!Array.isArray(response.features))throw Error('Nieprawidłowa izochrona');
  const shapes=response.features.filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type)&&Number(f.properties?.contour)===time).map(f=>f.geometry.coordinates);
  let count=0;const walk=v=>{if(!Array.isArray(v))throw Error('Nieprawidłowa geometria');if(typeof v[0]==='number'){if(v.length<2||!Number.isFinite(v[0])||!Number.isFinite(v[1])||Math.abs(v[0])>180||Math.abs(v[1])>85||++count>50000)throw Error('Nieprawidłowe współrzędne');}else v.forEach(walk);};shapes.forEach(walk);
  if(!count)throw Error('Nie znaleziono zasięgu dojścia w sieci pieszej');return shapes;
 }
 function area(shapes,mode,clip){const reachable=clip.union(...shapes);return mode==='outside'?clip.difference([[[ -180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]],reachable):reachable;}
 const api={minutes,polygons,area};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IsochroneModel=api;
})(typeof window!=='undefined'?window:globalThis);
