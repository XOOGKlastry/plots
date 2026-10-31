/* Node 20+. Reviewed variables are defined in docs/data/gus-catalog.json. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),target=path.join(root,'docs','data');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let requestCount=0;
async function get(resource){
  await sleep(350);
  const headers={Accept:'application/json'};
  if(process.env.GUS_API_KEY)headers['X-ClientId']=process.env.GUS_API_KEY;
  const response=await fetch('https://bdl.stat.gov.pl/api/v1/'+resource,{headers,signal:AbortSignal.timeout(30000)});requestCount++;
  if(response.status===429)throw Error('Limit GUS. Dotychczasowe pliki pozostają bez zmian; spróbuj później.');
  if(!response.ok)throw Error('GUS HTTP '+response.status);
  return response.json();
}
function save(name,value){const file=path.join(target,name),temp=file+'.next';fs.writeFileSync(temp,JSON.stringify(value),'utf8');fs.renameSync(temp,file);}
async function main(){
  const previous=JSON.parse(fs.readFileSync(path.join(target,'gus-catalog.json'),'utf8'));
  const variables=[];
  for(const definition of previous.variables){const metadata=await get(`variables/${definition.id}?format=json`);if(metadata.measureUnitId!==definition.metadata.measureUnitId)throw Error('Zmieniła się jednostka zmiennej '+definition.id);variables.push({...definition,metadata});}
  const populationVariable=variables.find(d=>d.id===72305)?.metadata;
  if(!populationVariable)throw Error('Brak zmiennej ludności w katalogu');
  const year=Math.max(...populationVariable.years.map(Number)),units={},values={};let excluded=0;
  for(let page=0;;page++){
    const data=await get(`data/by-variable/72305?unit-level=6&year=${year}&page-size=100&page=${page}&format=json`);
    if(!Array.isArray(data.results))throw Error('Nieprawidłowa odpowiedź GUS');
    for(const unit of data.results){
      if(!/^\d{12}$/.test(unit.id))throw Error('Nieprawidłowy kod jednostki BDL');
      if(!/[123]$/.test(unit.id)){excluded++;continue;}
      const teryt=unit.id.slice(2,4)+unit.id.slice(7);
      if(units[teryt]&&units[teryt].id!==unit.id)throw Error('Niejednoznaczny TERYT '+teryt);
      units[teryt]={id:unit.id,name:unit.name};
      const observation=unit.values.find(v=>Number(v.year)===year&&typeof v.val==='number'&&Number.isFinite(v.val));
      if(observation)values[teryt]={value:observation.val,year,attrId:observation.attrId};
    }
    if((page+1)*100>=data.totalRecords)break;
  }
  if(Object.keys(units).length<2300||Object.keys(values).length<2300)throw Error('Nieoczekiwanie małe pokrycie danych; nie zapisano zmian');
  const at=new Date().toISOString();
  save('gus-catalog.json',{version:1,source:'GUS BDL',checked:at.slice(0,10),variables});
  save('bdl-units.json',{retrievedAt:at,source:'GUS BDL',units});
  save('gus-population.json',{retrievedAt:at,source:'GUS BDL',variable:populationVariable,values});
  console.log(JSON.stringify({year,municipalities:Object.keys(units).length,observations:Object.keys(values).length,excludedSubmunicipalUnits:excluded,requests:requestCount}));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
