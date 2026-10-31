(function(root){
  'use strict';
  function matrixRow(response,targets){
    if(response.units!=='kilometers'||!Array.isArray(response.sources_to_targets?.[0]))throw Error('Nieprawidłowa odpowiedź routingu');
    const row=response.sources_to_targets[0];
    return targets.flatMap((p,i)=>{const v=row.find(x=>x.to_index===i);return typeof v?.distance==='number'&&Number.isFinite(v.distance)&&v.distance>=0&&typeof v.time==='number'&&Number.isFinite(v.time)?[{...p,metres:v.distance*1000,seconds:v.time}]:[];});
  }
  function closest(results){return [...results].sort((a,b)=>a.metres-b.metres||a.straight-b.straight).slice(0,3);}
  // Conservative allowance for snapping: an unseen target must be at least this far away.
  function complete(results,nextStraight){const top=closest(results);return top.length===3&&nextStraight-200>top[2].metres;}
  const api={matrixRow,closest,complete};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AccessModel=api;
})(typeof window!=='undefined'?window:globalThis);
