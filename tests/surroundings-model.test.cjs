const test=require('node:test'),assert=require('node:assert/strict');const m=require('../docs/surroundings-model.js');
test('walking codes handle quantization boundaries and missing connectivity',()=>{
 assert.equal(m.distance(0),0);assert.equal(m.distance(99),1980);assert.equal(m.distance(100),2000);assert.equal(m.distance(179),9900);assert.equal(m.distance(180),10000);assert.equal(m.distance(254),47000);assert.equal(m.distance(255),null);
 assert.equal(m.passes(255,'near',1500),false);assert.equal(m.passes(255,'far',1500),false);assert.equal(m.passes(50,'near',1500),true);assert.equal(m.passes(120,'far',1500),true);
});
test('POI decoder preserves signed longitude, latitude and category index',()=>{
 const buffer=new ArrayBuffer(13),v=new DataView(buffer);v.setUint32(0,1,true);v.setInt32(4,16861900,true);v.setInt32(8,54580300,true);v.setUint8(12,2);
 assert.deepEqual(m.parsePoi(buffer),[{lon:16.8619,lat:54.5803,type:2,index:0}]);assert.throws(()=>m.parsePoi(buffer.slice(0,10)));
});
test('building indices are not reordered before looking up network distances',()=>{
 const buffer=new ArrayBuffer(14),v=new DataView(buffer);v.setUint32(0,2,true);v.setUint16(4,0,true);v.setUint16(6,65535,true);v.setUint16(8,65535,true);v.setUint16(10,0,true);v.setUint8(12,1);
 const buildings=m.parseBuildings(buffer,'5_11',{origin:[14,49],tile:.5});assert.equal(buildings.n,2);assert.deepEqual(buildings.point(0),{lon:16.5,lat:55,active:true});assert.deepEqual(buildings.point(1),{lon:17,lat:54.5,active:false});
});
test('RCN decoder excludes cells below the minimum transaction count',()=>{
 const buffer=new ArrayBuffer(20),v=new DataView(buffer);v.setUint32(0,2,true);v.setUint16(8,900,true);v.setUint16(10,4,true);v.setUint16(16,1100,true);v.setUint16(18,5,true);
 const cells=m.parsePrices(buffer,{dlon:.015,dlat:.009},[14,49],5);assert.equal(cells.length,1);assert.equal(cells[0].median,11000);assert.equal(cells[0].count,5);
});
