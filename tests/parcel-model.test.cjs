const test=require('node:test'),assert=require('node:assert/strict');const model=require('../docs/parcel-model.js');
test('full-geometry area has priority and retains metric units',()=>{assert.deepEqual(model.area({powierzchnia_geom_m2:1234.5,pole_ewid:.2}),{m2:1234.5,ha:.12345,source:'Z geometrii'});});
test('cadastral hectares remain usable while an older API has no geometry area',()=>{assert.deepEqual(model.area({pole_ewid:'0.1234'}),{m2:1234,ha:.1234,source:'Ewidencyjna'});});
test('missing or invalid area is not silently presented as zero',()=>{for(const value of [null,undefined,'',0,-1,NaN,Infinity])assert.equal(model.area({powierzchnia_geom_m2:value}).m2,null);});
test('both representations are formatted with Polish decimal separators',()=>{assert.match(model.format(1234.5,'m²'),/1\s?234,5 m²/);assert.equal(model.format(.12345,'ha'),'0,1235 ha');});
