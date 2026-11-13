(function (root) {
  "use strict";
  function parseObservations(catalog, response) {
    const out = {};
    for (const definition of catalog.variables) {
      const row = response.results?.find(r => Number(r.id) === definition.id);
      if (!row) continue;
      const history = (row.values || []).filter(v => typeof v.val === "number" && Number.isFinite(v.val) && /^\d{4}$/.test(String(v.year))).map(v => ({ value: v.val * definition.scale, year: Number(v.year), attrId: v.attrId })).sort((a,b)=>b.year-a.year);
      if (!history.length) continue;
      out[definition.key] = { ...history[0], history, source:"GUS BDL", variableId:definition.id, sourceUrl:`https://bdl.stat.gov.pl/api/v1/variables/${definition.id}` };
    }
    const derive = (key, numerator, denominator, multiplier, sourceKeys) => {
      if(!out[numerator]||!out[denominator])return;
      const history=out[numerator].history.flatMap(a=>{const b=out[denominator].history.find(v=>v.year===a.year&&v.value>0);return b?[{value:a.value/b.value*multiplier,year:a.year}]:[];});
      if(history.length)out[key]={...history[0],history,source:"GUS BDL · obliczenie",sourceUrl:"https://bdl.stat.gov.pl/",sourceKeys};
    };
    derive("pit_na_mieszk","pit_suma","ludnosc",1,[76046,72305]);
    derive("gestosc_ludnosci","ludnosc","powierzchnia",1,[72305,1]);
    return out;
  }
  if(typeof module!=="undefined"&&module.exports){module.exports={parseObservations};return;}
  let local=null, pendingLocal=null;
  const requests=new Map(), memory=new Map();
  function ready(){
    if(!pendingLocal)pendingLocal=Promise.all(["gus-catalog","bdl-units","gus-population"].map(name=>fetch(`data/${name}.json`).then(r=>{if(!r.ok)throw Error("Nie udało się wczytać katalogu GUS");return r.json();}))).then(([catalog,index,population])=>{
      local={catalog,index,population};
      catalog.latestYear=Math.max(...catalog.variables.flatMap(d=>d.metadata.years.map(Number)));
      catalog.years=[catalog.latestYear,catalog.latestYear-1,catalog.latestYear-2];
      const active=catalog.variables.filter(d=>d.metadata.years.some(y=>Number(y)>=catalog.latestYear-2));
      catalog.variables=active;
      root.GminyModel.addDefinitions(active.concat([
        {key:"gestosc_ludnosci",label:"Gęstość zaludnienia",category:"Ludność",unit:"os. / km²",digits:1},
        {key:"pit_na_mieszk",label:"PIT na mieszkańca",category:"Finanse i firmy",unit:"zł",digits:2}
      ]));
      return local;
    }).catch(e=>{pendingLocal=null;throw e;});
    return pendingLocal;
  }
  let energyData=null,pendingEnergy=null;
  function energy(){
    // Main GUS file plus other official sources in the same format (PKW elections, NID heritage, GDOŚ nature).
    const one=url=>fetch(url,{signal:AbortSignal.timeout(30000)}).then(r=>{if(!r.ok)throw Error("Nie udało się wczytać "+url);return r.json();}).then(doc=>{
      if(doc.version!==1||!Array.isArray(doc.units)||!Array.isArray(doc.variables))throw Error("Nieobsługiwany format "+url);return doc;});
    if(!pendingEnergy)pendingEnergy=Promise.all([one("data/gus-energia.json"),one("data/wskazniki-inne.json").catch(()=>null)]).then(([doc,other])=>{
      const docs=[doc,other].filter(Boolean),byKey=new Map();
      for(const d of docs){const index=new Map(d.units.map((k,i)=>[k,i]));for(const v of d.variables)byKey.set(v.key,{v,index});}
      root.GminyModel.addDefinitions(docs.flatMap(d=>d.variables).map(v=>({...v,label:v.label})));
      root.GminyModel.setExternal((k,definition)=>{
        const e=byKey.get(definition.key);if(!e)return null;const v=e.v,i=e.index.get(k);if(i===undefined)return null;
        const history=v.years.map((year,j)=>({year,value:v.values[j][i]})).filter(o=>typeof o.value==="number"&&Number.isFinite(o.value));
        if(!history.length)return null;
        return {...history[0],history,source:v.source||(v.level===5?"GUS BDL · dane powiatu":"GUS BDL"),variableId:v.id,sourceUrl:v.sourceUrl||(v.id?`https://bdl.stat.gov.pl/api/v1/variables/${v.id}`:undefined)};
      });
      energyData={built:doc.built,retrievedAt:doc.retrievedAt,count:doc.variables.length};return energyData;
    }).catch(e=>{pendingEnergy=null;throw e;});
    return pendingEnergy;
  }
  function readCache(id){try{const v=JSON.parse(localStorage.getItem("plots.gus."+id)||"null");return v?.version===1&&v.values&&typeof v.at==="number"?v:null;}catch{return null;}}
  function saveCache(id,value){try{localStorage.setItem("plots.gus."+id,JSON.stringify(value));let ids=JSON.parse(localStorage.getItem("plots.gusRecent")||"[]");if(!Array.isArray(ids))ids=[];const next=[id,...ids.filter(x=>x!==id)];next.slice(20).forEach(x=>localStorage.removeItem("plots.gus."+x));localStorage.setItem("plots.gusRecent",JSON.stringify(next.slice(0,20)));}catch{/* Browsing without storage still works. */}}
  async function seed(g){await ready();const p=local.population.values[g.k];if(p)g._gus={...(g._gus||{}),ludnosc:{...p,source:"GUS BDL",variableId:72305,history:[p]}};}
  async function enrich(g,force=false){
    await seed(g);await energy().catch(e=>console.warn(e.message));
    const cached=memory.get(g.k)||readCache(g.k);
    if(cached){g._gus={...g._gus,...cached.values};g._gusFetched=cached.at;g._gusStatus="Zapisane dane GUS";}
    if(cached&&!force&&Date.now()-cached.at<7*86400000)return g;
    const unit=local.index.units[g.k];if(!unit){g._gusStatus="Brak identyfikatora jednostki GUS";return g;}
    if(!requests.has(g.k)){
      const url=new URL("https://bdl.stat.gov.pl/api/v1/data/by-unit/"+unit.id);
      local.catalog.variables.forEach(d=>url.searchParams.append("var-id",d.id));
      local.catalog.years.forEach(y=>url.searchParams.append("year",y));url.searchParams.set("format","json");url.searchParams.set("page-size","100");
      requests.set(g.k,fetch(url,{signal:AbortSignal.timeout(20000)}).then(async r=>{
        if(!r.ok)throw Error(r.status===429?"Limit zapytań GUS — spróbuj później":"GUS jest chwilowo niedostępny");
        const response=await r.json();if(response.unitId!==unit.id)throw Error("Niezgodny identyfikator jednostki GUS");
        if(response.totalRecords>100)throw Error("Odpowiedź GUS wymaga stronicowania");
        const values=parseObservations(local.catalog,response),value={version:1,at:Date.now(),values};
        memory.set(g.k,value);saveCache(g.k,value);return value;
      }).finally(()=>requests.delete(g.k)));
    }
    try{const value=await requests.get(g.k);g._gus={...g._gus,...value.values};g._gusFetched=value.at;g._gusStatus="Dane bezpośrednio z GUS BDL";}
    catch(error){g._gusStatus=(cached?"Pokazano zapisane dane. ":"")+error.message;}
    return g;
  }
  root.GusClient={ready,seed,enrich,energy,energyInfo:()=>energyData,parseObservations,years:()=>local?.catalog.years||[2025,2024,2023]};
})(typeof window!=="undefined"?window:globalThis);
