const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const address={lon:16.8545485,lat:54.5879904,TERYT_GMI:'2212011',ulica:'Marynarki Polskiej',numer:'1',miejscowosc:'Ustka'};
 const parcel={id_dzialki:'221201_1.0001.538/6',numer_dzialki:'538/6',powierzchnia_geom_m2:5232.28,bbox:[[16.8544,54.5878],[16.8547,54.5881]]};
 await page.route('**/tiles/**/*.pbf',r=>r.fulfill({status:200,body:Buffer.alloc(0)}));await require('./browser-admin-fixture.cjs')(page);
 await page.route('**/api/at?*',r=>r.fulfill({status:404,body:'not found'}));
 await page.route('**/api/adres?*',r=>r.fulfill({json:{wyniki:[address]}}));
 await page.route('**/api/dzialka?*',async r=>{const id=new URL(r.request().url()).searchParams.get('id');if(id.startsWith('146501')){await new Promise(resolve=>setTimeout(resolve,350));await r.fulfill({json:{...parcel,id_dzialki:id,numer_dzialki:'1',bbox:[[21,52.2],[21.001,52.201]]}});}else await r.fulfill({json:parcel});});
 await page.route('https://bdl.stat.gov.pl/api/v1/data/by-unit/**',r=>r.fulfill({json:require('./fixtures/gus-ustka.json')}));
 await page.goto('http://127.0.0.1:8091/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!PLOTS_GMINY&&PLOTS.map.loaded());
 const enter=async text=>{await page.locator('#q').fill(text);await page.locator('#q').press('Enter');};
 const visible=async coordinates=>{await page.waitForFunction(()=>!PLOTS.map.isMoving());const position=await page.evaluate(c=>{const p=PLOTS.map.project(c),sheet=document.getElementById('panel').getBoundingClientRect();return {x:p.x,y:p.y,top:sheet.top};},coordinates);assert.ok(position.x>10&&position.x<380&&position.y>80&&position.y<position.top+5,JSON.stringify(position));};
 await enter('Ustka Marynarki 1');await page.locator('#addressAccess').waitFor();await visible([address.lon,address.lat]);
 await page.locator('#q').fill('Ustka');await page.locator('#sugg li').first().waitFor();await page.locator('#q').press('ArrowDown');await enter(parcel.id_dzialki);await page.locator('#card h2').filter({hasText:'538/6'}).waitFor();await visible([16.85455,54.58795]);
 await enter('Białaczów');await page.waitForFunction(()=>PLOTS_GMINY.current()==='1007013'&&PLOTS.map.getSource('municipal-boundaries')._data.features.length===2);await visible([20.30,51.295]);
 await enter('146501_1.0001.1');await page.waitForTimeout(25);await enter(parcel.id_dzialki);await page.locator('#card h2').filter({hasText:'538/6'}).waitFor();await page.waitForTimeout(500);await visible([16.85455,54.58795]);assert.match(await page.locator('#card').innerText(),/221201_1/);
 assert.deepEqual(errors,[]);console.log('Address/parcel/municipality searches frame the selected place above the phone sheet; full municipal/city outlines, stale suggestions and racing requests: passed');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
