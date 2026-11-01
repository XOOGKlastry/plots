/* Build from the supplied municipality source directory; no image resampling. */
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(process.argv[2]||''),target=path.resolve(__dirname,'../docs/data');
if(!process.argv[2])throw Error('Usage: node scripts/build-municipality-context.cjs <source-directory>');
const read=name=>JSON.parse(fs.readFileSync(path.join(source,name),'utf8'));
const base=read('baza.json'),images=read('herby.json').miasta,topology=read('gminy.topojson');
const localByFile=new Map(images.map(i=>[i.plik,i])),byName=new Map(images.map(i=>[i.n,i]));
const entries={},packs=new Map();
for(const g of [...base.gminy].sort((a,b)=>a.k.localeCompare(b.k))){
 const extra=g.typ==='gmina wiejska'?null:byName.get(g.n),file=g.herb||extra?.plik;
 if(!file)continue;
 const local=localByFile.get(file),entry={file};
 if(local){
  const key=g.k.slice(0,2);if(!packs.has(key))packs.set(key,{parts:[],size:0,files:new Map()});const p=packs.get(key);
  if(!p.files.has(file)){const asset=path.resolve(source,local.img);if(!asset.startsWith(source+path.sep))throw Error('Invalid image path');const bytes=fs.readFileSync(asset);p.files.set(file,{offset:p.size,length:bytes.length});p.parts.push(bytes);p.size+=bytes.length;}
  Object.assign(entry,{pack:`crests-${key}.bin`,...p.files.get(file)});
 }
 entries[g.k]=entry;
}
for(const [key,p]of packs)fs.writeFileSync(path.join(target,`crests-${key}.bin`),Buffer.concat(p.parts));
fs.writeFileSync(path.join(target,'municipality-crests.json'),JSON.stringify({version:1,checked:'2026-10-31',source:'Wikidata P94 / Wikimedia Commons; supplied cached WebP renditions',entries}),'utf8');
const shapes=Object.values(topology.objects).flatMap(o=>o.geometries||[]).filter(g=>g.type);
if(new Set(shapes.map(g=>g.properties.k)).size!==2479)throw Error('Incomplete municipal boundaries');
fs.copyFileSync(path.join(source,'gminy.topojson'),path.join(target,'municipalities.topojson'));
console.log(JSON.stringify({municipalities:base.gminy.length,crests:Object.keys(entries).length,cached:Object.values(entries).filter(e=>e.pack).length,packs:packs.size,boundaries:shapes.length}));
