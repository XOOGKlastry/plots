const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../docs/gminy-model.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/data/gminy.json'), 'utf8'));
const ustka = data.gminy.find(g => g.k === '2212011');

test('municipalities have unique, seven-digit TERYT codes', () => {
  assert.equal(new Set(data.gminy.map(g => g.k)).size, data.gminy.length);
  assert.ok(data.gminy.length > 2400);
  assert.ok(data.gminy.every(g => /^\d{7}$/.test(g.k)));
});
test('search preserves separate urban and rural units with the same name', () => {
  const results = model.search(data.gminy, 'Ustka');
  assert.ok(results.some(g => g.k === '2212011'));
  assert.ok(results.some(g => g.k === '2212102'));
  assert.equal(model.search(data.gminy, '2212102')[0].k, '2212102');
});
test('search handles Polish letters and multiple tokens', () => {
  assert.equal(model.normalize(' ŁÓDŹ '), 'lodz');
  assert.ok(model.search(data.gminy, 'lodz').some(g => g.n === 'Łódź'));
  assert.equal(model.search(data.gminy, 'Ustka wiejska')[0].k, '2212102');
  assert.deepEqual(model.search(data.gminy, 'x'), []);
});
test('a dated surface measurement takes priority over the older base value', () => {
  const item = model.metrics(ustka).find(m => m.key === 'powierzchnia');
  assert.equal(item.value, 11.09);
  assert.equal(item.year, 2025);
  assert.equal(item.unit, 'km²');
  assert.notEqual(item.value, ustka.powierzchnia);
});
test('unknown observation dates are never replaced by the snapshot year', () => {
  const item = model.metrics(ustka).find(m => m.key === 'kanalizacja_proc');
  assert.equal(item.value, 98);
  assert.equal(item.year, null);
});
test('zero, missing, nonnumeric and nonfinite values remain distinct', () => {
  const definition = { key: 'x', digits: 1, unit: '%' };
  assert.equal(model.metric({ x: 0 }, definition).value, 0);
  for (const x of [null, undefined, '', '0', NaN, Infinity]) {
    assert.equal(model.metric({ x }, definition).value, null);
  }
  assert.equal(model.formatValue(model.metric({}, definition)), 'Brak danych');
});
test('REGON values are already normalized per 1000 people and are not converted twice', () => {
  const item = model.metrics(ustka).find(m => m.key === 'firmy_na_1000');
  assert.equal(item.value, 173.9);
  assert.equal(item.unit, 'na 1000 os.');
});
test('parcel TERYT parsing keeps leading zeroes and rejects incomplete IDs', () => {
  assert.equal(model.parcelTeryt('020101_1.0001.123/4'), '0201011');
  assert.equal(model.parcelTeryt('221201_1.0001.1'), '2212011');
  assert.equal(model.parcelTeryt('123/4'), null);
});
