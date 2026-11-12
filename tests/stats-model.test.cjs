const test=require('node:test'),assert=require('node:assert/strict'),S=require('../docs/stats-model.js');
const values=Array.from({length:700},(_,i)=>i+1);
test('quantiles give seven classes with similar counts',()=>{const s=S.classify(values,{palette:'zachod'});assert.equal(s.colors.length,7);const l=S.legend(s,values,0);for(const c of l)assert.ok(Math.abs(c.count-100)<=1,String(c.count));});
test('equal intervals split the range evenly',()=>{const s=S.classify([0,10,20,70],{method:'equal'});assert.equal(s.breaks.length,6);assert.equal(s.breaks[0],10);});
test('repeated values collapse classes without empty colours',()=>{const s=S.classify([0,0,0,0,0,0,1,2],{});assert.ok(s.colors.length<7);assert.equal(S.legend(s,[0,0,0,0,0,0,1,2],0).reduce((n,c)=>n+c.count,0),8);});
test('signed data keep zero as a class boundary',()=>{const v=[-5,-3,-1,1,2,8,9];const s=S.classify(v,{diverging:true});assert.ok(s.diverging);assert.ok(s.breaks.includes(0));assert.notEqual(S.colorOf(-1,s),S.colorOf(1,s));});
test('missing values get the no-data colour and format as a dash',()=>{const s=S.classify(values,{});assert.equal(S.colorOf(null,s),S.NODATA);assert.equal(S.format(NaN),'—');});
test('large numbers are compact',()=>{assert.match(S.format(1234567),/mln/);assert.match(S.format(45678),/tys\./);});
test('zeros get a neutral class of their own in diverging mode',()=>{const v=[-4,-2,-1,0,0,0,0,1,3,5];const s=S.classify(v,{diverging:true});assert.equal(S.classOf(0,s.breaks),s.zeroClass);assert.notEqual(S.classOf(1,s.breaks),s.zeroClass);assert.equal(S.legend(s,v,0)[s.zeroClass].count,4);});
