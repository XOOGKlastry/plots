const test=require('node:test'),assert=require('node:assert/strict'),m=require('../docs/address-picking.js');
const feature=(id,x,y)=>({properties:{id},geometry:{type:'Point',coordinates:[x,y]}}),project=c=>({x:c[0],y:c[1]});
test('nearest address wins rather than tile render order',()=>{const a=feature(1,100,100),b=feature(2,109,100);assert.equal(m.closest([b,a],{x:101,y:101},project),a);});
test('duplicate tile features and non-points do not change the picked address',()=>{const a=feature(1,100,100);assert.equal(m.closest([{geometry:{type:'Polygon',coordinates:[]}},a,a],{x:112,y:101},project),a);assert.equal(m.closest([],{x:0,y:0},project),null);});
