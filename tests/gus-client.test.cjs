const test=require('node:test'),assert=require('node:assert/strict');
const {parseObservations}=require('../docs/gus-client.js');
const catalog=require('../docs/data/gus-catalog.json'),fixture=require('./fixtures/gus-ustka.json');
test('direct GUS observations retain explicit years and convert units once',()=>{
 const m=parseObservations(catalog,fixture);
 assert.equal(m.ludnosc.value,13211);assert.equal(m.ludnosc.year,2025);
 assert.equal(m.powierzchnia.value,11.09);assert.equal(m.firmy_na_1000.value,173.9);
 assert.ok(m.urodzenia_1000.history.some(v=>v.year===2024));
});
test('per-capita and density calculations join matching observation years',()=>{
 const m=parseObservations(catalog,fixture);assert.ok(Math.abs(m.pit_na_mieszk.value-3925.42997)<.01);
 const mismatch={results:[{id:76046,values:[{year:'2025',val:100}]},{id:72305,values:[{year:'2024',val:10}]}]};
 assert.equal(parseObservations(catalog,mismatch).pit_na_mieszk,undefined);
});
test('GUS null and textual values are not converted to statistical zero',()=>{
 const d={results:[{id:72305,values:[{year:'2025',val:null},{year:'2024',val:'0'},{year:'2023',val:0}]}]};
 assert.deepEqual(parseObservations(catalog,d).ludnosc.history.map(v=>v.value),[0]);
});
