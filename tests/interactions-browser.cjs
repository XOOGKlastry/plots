const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/tiles/**/*.pbf',r=>r.fulfill({status:200,body:Buffer.alloc(0)}));
 await page.route('**/api/at?*',r=>r.fulfill({status:404,body:'Not found'}));
 await page.route('https://bdl.stat.gov.pl/api/v1/data/by-unit/**',r=>r.fulfill({json:require('./fixtures/gus-ustka.json')}));
 await page.route('https://valhalla1.openstreetmap.de/sources_to_targets?*',r=>{
  const p=JSON.parse(new URL(r.request().url()).searchParams.get('json'));
  assert.equal(p.costing,'pedestrian');assert.equal(p.units,'kilometers');
  r.fulfill({json:{units:'kilometers',sources_to_targets:[p.targets.map((_,i)=>({to_index:i,distance:i===0?8:1+i/10,time:600+i*50}))]}});
 });
 await page.route('https://mapy.geoportal.gov.pl/wss/ext/**',r=>{
  if(new URL(r.request().url()).searchParams.get('REQUEST')==='GetFeatureInfo')r.fulfill({contentType:'text/html',body:'<table><tr><td>Maksymalna wysokość</td><td>12 m</td></tr><tr><td>Powierzchnia biologicznie czynna</td><td>40%</td></tr></table><script>window.bad=true</script>'});else r.continue();
 });
 await require('./browser-admin-fixture.cjs')(page);
 await page.goto('http://127.0.0.1:8091/?gmina=2212011',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.PLOTS?.map.loaded()&&document.getElementById('networkSelect'));
 await page.evaluate(()=>PLOTS.showAddress({lon:16.8611,lat:54.5804,ulica:'Marynarki Polskiej',numer:'1',miejscowosc:'Ustka'}));
 await page.locator('[data-access="szkola"]').click();
 await page.locator('.access-results li').nth(2).waitFor();
 assert.equal(await page.locator('.access-results li').count(),3);
 const distances=await page.evaluate(()=>PLOTS.map.getSource('address-directions')._data.features);
 assert.equal(distances.filter(f=>f.geometry.type==='LineString').length,3);
 assert.match(await page.locator('#accessResults').innerText(),/po drogach/);
 assert.equal(await page.locator('#surBuildings').count(),0);
 await page.waitForFunction(()=>!PLOTS.map.isMoving());
 await page.screenshot({path:path.join(__dirname,'../../browser-results/address-directions-mobile.png')});
 // Blank-map click always identifies all three planning services as bullet lists.
 await page.mouse.click(100,200);
 await page.locator('.plan-result').nth(2).waitFor();
 assert.equal(await page.locator('.plan-facts').count(),3);
 assert.match(await page.locator('.plan-facts').first().innerText(),/Maksymalna wysokość: 12 m/);
 assert.equal(await page.evaluate(()=>window.bad),undefined);
 assert.equal(await page.evaluate(()=>PLOTS.map.getSource('address-directions')._data.features.length),0);
 await page.screenshot({path:path.join(__dirname,'../../browser-results/planning-point-mobile.png')});
 // Only one panel can cover the map; visible map buttons never intersect the sheet.
 for(const [width,height]of[[320,568],[390,844],[768,900],[1440,950]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>PLOTS.snap('half'));await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const overlaps=await page.evaluate(()=>{const p=document.getElementById('panel').getBoundingClientRect();return [...document.querySelectorAll('#layersFab,#collapse,#locate,.maplibregl-ctrl-zoom-in,.maplibregl-ctrl-zoom-out')].filter(e=>getComputedStyle(e).visibility!=='hidden'&&e.getBoundingClientRect().width).filter(e=>{const b=e.getBoundingClientRect();return b.left<p.right&&b.right>p.left&&b.top<p.bottom&&b.bottom>p.top;}).map(e=>e.id||e.className);});
  assert.deepEqual(overlaps,[],`overlapping controls ${width}×${height}`);
  await page.locator('#layersFab').click();if(width<768)assert.equal(await page.locator('#panel').isVisible(),false);
  await page.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[]);console.log('Address-only walking, network ranking, three directions, blank-point planning, bullet sanitation, stale-line clearing and panel geometry: passed');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
