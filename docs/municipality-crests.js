(function(){
 'use strict';
 const app=window.PLOTS,esc=app.esc;let pending=null;const packs=new Map(),urls=new Map();
 function ready(){if(!pending)pending=fetch('data/municipality-crests.json').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{pending=null;throw e;});return pending;}
 async function load(entry){
  if(!entry.pack)return 'https://commons.wikimedia.org/wiki/Special:Redirect/file/'+encodeURIComponent(entry.file)+'?width=120';
  const key=entry.pack+'/'+entry.offset;if(urls.has(key))return urls.get(key);
  if(!packs.has(entry.pack))packs.set(entry.pack,fetch('data/'+entry.pack).then(r=>{if(!r.ok)throw Error();return r.arrayBuffer();}).catch(e=>{packs.delete(entry.pack);throw e;}));
  const buffer=await packs.get(entry.pack);if(entry.offset<0||entry.offset+entry.length>buffer.byteLength)throw Error('Nieprawidłowy pakiet herbów');
  const bytes=new Uint8Array(buffer,entry.offset,entry.length);if(String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WEBP')throw Error('Nieprawidłowy obraz herbu');
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));urls.set(key,url);while(urls.size>100){const oldest=urls.keys().next().value;URL.revokeObjectURL(urls.get(oldest));urls.delete(oldest);}while(packs.size>3)packs.delete(packs.keys().next().value);return url;
 }
 async function hydrate(el){
  if(el.dataset.loaded)return;el.dataset.loaded='true';
  try{const meta=await ready(),entry=meta.entries[el.dataset.crest];if(!entry){el.title='Brak zweryfikowanego herbu w źródle';return;}
   const url=await load(entry);if(!el.isConnected)return;const a=document.createElement('a');a.href='https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(entry.file);a.target='_blank';a.rel='noopener noreferrer';a.title='Herb · źródło: Wikimedia Commons';const img=document.createElement('img');img.alt='Herb gminy '+el.dataset.name;img.width=56;img.height=64;img.decoding='async';img.src=url;img.onerror=()=>{a.remove();el.title='Nie udało się wczytać herbu';};img.onload=()=>{el.querySelector('svg')?.remove();};a.append(img);el.append(a);
  }catch{el.title='Herb chwilowo niedostępny';}
 }
 function scan(){document.querySelectorAll('[data-crest]:not([data-loaded])').forEach(hydrate);}
 new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
 window.MunicipalityCrests={ready,render:g=>`<span class="municipality-crest" data-crest="${esc(g.k)}" data-name="${esc(g.n)}">${window.Icons.svg('shield')}</span>`};scan();
})();
