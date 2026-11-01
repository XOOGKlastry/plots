/* Run against a local static server. Real MapLibre, deterministic parcel API fixtures. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:8091';
const output = process.env.TEST_OUTPUT || path.join(__dirname, '../../browser-results');
fs.mkdirSync(output, { recursive: true });
const parcel = { id_dzialki: '221201_1.0001.123/4', numer_dzialki: '123/4', obreb: '0001', nazwa_obrebu: 'Ustka', pole_ewid: null, powierzchnia_geom_m2: 1234.5, grupa_rej: '4', klasouzytki: 'B', data_zrodla: '2026-10-20', bbox: [[16.86,54.58],[16.861,54.581]] };
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {}), args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, permissions: ['clipboard-read','clipboard-write'] });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/tiles/**/*.pbf', route => route.fulfill({status:200,contentType:'application/x-protobuf',body:Buffer.alloc(0)}));
  await page.route('**/api/adres?*', route => route.fulfill({json:{wyniki:[]}}));
  await page.route('**/api/dzialka?*', route => route.fulfill({json:parcel}));
  await page.route('https://bdl.stat.gov.pl/api/v1/data/by-unit/**', route => route.fulfill({json:require('./fixtures/gus-ustka.json')}));
 await require('./browser-admin-fixture.cjs')(page);
  await page.goto(base, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => window.PLOTS && window.PLOTS.map.loaded());
  await page.locator('#tab-gmina').click();
  await page.locator('#gminaSearch').fill('Ustka');
  assert.equal(await page.locator('#gminaResults button').count(), 2);
  await page.locator('[data-gmina="2212011"]').click();
  await page.locator('[data-gmina-details]').waitFor();
  await page.waitForFunction(()=>window.PLOTS.map.getZoom()>=10.9&&!window.PLOTS.map.isMoving());
  assert.match(await page.locator('#gminaCard').innerText(), /13\s211/);
  assert.match(await page.locator('#gminaCard').innerText(), /11,09/);
  await page.screenshot({path:path.join(output,'desktop-map.png')});
  await page.locator('[data-gmina-details]').click();
  assert.equal(await page.locator('#gminaDialog').evaluate(el=>el.open),true);
  await page.locator('[data-category="Warunki życia"]').click();
  assert.match(await page.locator('#gminaDetails').innerText(), /Rok niepodany/);
  await page.screenshot({path:path.join(output,'desktop-data.png')});
  await page.keyboard.press('Escape');
  await page.locator('#layersFab').click();
  assert.equal(await page.locator('#basemaps .bm').count(),3);
  for(const id of ['gp-orto','gp-topo','map']) {
    await page.locator(`.bm[data-id="${id}"]`).click();
    await page.waitForFunction(()=>window.PLOTS.map.isStyleLoaded());
    assert.ok(await page.evaluate(()=>!!PLOTS.map.getLayer('dz-fill')&&!!PLOTS.map.getSource('adresy')));
  }
  await page.locator('#layerFilter').fill('adres');
  assert.equal(await page.locator('.layer-entry:visible').count(),1);
  await page.locator('#layerFilter').fill('');
  await page.locator('label.sw').filter({has:page.locator('#lyrAdr')}).click();
  assert.equal(await page.locator('#layerCount').innerText(),'2');
  await page.keyboard.press('Escape');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.PLOTS?.map.loaded());
  assert.equal(await page.locator('#lyrAdr').isChecked(),false);
  // Parcel deep link, hectare units, source date, and municipality context.
  await page.goto(base+'/?id='+encodeURIComponent(parcel.id_dzialki),{waitUntil:'domcontentloaded'});
  await page.locator('#card h2').filter({hasText:'123/4'}).waitFor();
  assert.match(await page.locator('#card').innerText(),/0,1235 ha/);
  await page.locator('#tab-gmina').click();
  assert.match(await page.locator('#gminaCard').innerText(),/Ustka/);
  assert.match(await page.locator('#card').innerText(),/1\s?234,5 m²/);
  assert.equal(await page.locator('#shareView').count(),0);
  // Responsive layouts, real MapLibre resizing, mobile card and modal visibility.
  for(const theme of ['light','dark']) {
    await page.emulateMedia({colorScheme:theme});
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:900});
      await page.waitForTimeout(400);
      await page.locator('#tab-gmina').click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${theme} ${width}`);
      await page.locator('[data-gmina-details]').click();
      const box=await page.locator('#gminaDialog').boundingBox();
      assert.ok(box.x>=0&&box.x+box.width<=width+1,`dialog width ${width}`);
      await page.screenshot({path:path.join(output,`${theme}-${width}-data.png`)});
      await page.locator('#closeGmina').click();
      await page.screenshot({path:path.join(output,`${theme}-${width}-map.png`)});
    }
  }
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: search, TERYT, metadata, parcel regression, layers, persistence, geometry area, 4 widths × 2 themes.');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
