/* Extra thematic layers built from static files in docs/data (GeoJSON or JSON turned into GeoJSON): air quality stations,
   road and rail investments, planned high-speed rail, airports, military zones and other national datasets.
   Each layer is a small description (panel entry, map style, legend, card); data is fetched only when the layer is switched on.
   Tapping a point or line opens a short card with the source and a link to the official page. */
(function () {
  "use strict";
  const app = window.PLOTS, map = app && app.map, esc = app && app.esc, svg = n => window.Icons.svg(n);
  if (!app || !map) return;
  const fmt = (v, d = 1) => (+v).toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
  const link = (href, text) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>` : "";
  const row = (k, v) => v || v === 0 ? `<p><span class="muted">${esc(k)}:</span> <b>${esc(String(v))}</b></p>` : "";
  const legendRow = items => `<div class="terr-legend">${items.map(([c, l, kind]) => `<span><i style="${kind === "line" ? `background:${c};height:3px;border-radius:2px` : kind === "dash" ? `background:repeating-linear-gradient(90deg,${c} 0 5px,transparent 5px 8px);height:3px;border:0` : kind === "box" ? `background:${c};opacity:.75;border-radius:2px` : kind === "ring" ? `background:#fff;border:2px solid ${c};border-radius:50%;box-sizing:border-box` : `background:${c};border-radius:50%`}"></i>${esc(l)}</span>`).join("")}</div>`;
  const note = t => `<small class="terr-unit">${esc(t)}</small>`;
  const dist = (a, b) => { const k = Math.PI / 180, x = (b.lon - a.lon) * k * Math.cos((a.lat + b.lat) / 2 * k), y = (b.lat - a.lat) * k; return Math.hypot(x, y) * 6371000; };
  const fmtD = m => m < 950 ? `${Math.round(m / 10) * 10} m` : `${fmt(m / 1000, m < 10000 ? 1 : 0)} km`;

  /* ---------- Susza (PPSS 2021, Wody Polskie): hexagon hazard classes dissolved per type, one file per type ---------- */
  const SU_T = { r: ["rolnicza", "suszą rolniczą", "susza_rolnicza_klasa"], h: ["hydrologiczna", "suszą hydrologiczną", "susza_hydro_klasa"],
    g: ["hydrogeologiczna", "suszą hydrogeologiczną", "susza_hgeo_klasa"], l: ["łącznie", "suszą (wszystkie rodzaje łącznie)", "susza_lacz_proc"], a: ["atmosferyczna", "suszą atmosferyczną", "susza_atmo_proc"] };
  const SU_C = { 1: ["#9bc96b", "I słabe"], 2: ["#f2e14c", "II umiarkowane"], 3: ["#f59f1b", "III silne"], 4: ["#e0441f", "IV ekstremalne"] };
  let suT = (() => { try { const v = app.store.get("susza.t", "r"); return SU_T[v] ? v : "r"; } catch (e) { return "r"; } })();
  const suFile = t => fetch(`data/susza/ppss2021_${t}.geojson`).then(r => { if (!r.ok) throw Error(r.status); return r.json(); });
  const suLegend = () => `<div class="stats-seg ext-seg su-seg" role="group" aria-label="Rodzaj suszy">${Object.entries(SU_T).map(([k, v]) => `<button type="button" data-su="${k}" aria-pressed="${k === suT}">${esc(v[0])}</button>`).join("")}</div>` +
    legendRow(Object.entries(SU_C).filter(([c]) => suT !== "a" || c > 1).map(([, [c, l]]) => [c, l, "box"])) +
    note("Klasy zagrożenia z Planu przeciwdziałania skutkom suszy z 2021 r. (Wody Polskie), siatka heksagonów około 3,5 km². Projekt aktualizacji planu z 2026 r. (konsultacje do 6.02.2027) podaje klasy dla całych gmin, są w Statystykach w grupie „Susza (plany Wód Polskich)”.");

  /* ---------- Wody Polskie: Geobaza 2aPGW (plany gospodarowania wodami), zlewnie JCWP, wody podziemne, rzeki, administracja, obszary chronione ---------- */
  const WP_SRC = "Wody Polskie, Geobaza 2aPGW (drugie aktualizacje planów gospodarowania wodami na obszarach dorzeczy, wersja 15.09.2023)";
  const WP_T = { s: ["stan wód", "Ogólny stan wód"], e: ["ekologiczny", "Stan lub potencjał ekologiczny"], c: ["chemiczny", "Stan chemiczny"], r: ["ryzyko", "Ryzyko nieosiągnięcia celów środowiskowych"] };
  const WP_C = { s: [[0, "#4dabf7", "dobry"], [1, "#e8590c", "zły"], [9, "#ced4da", "brak oceny"]],
    e: [[1, "#1c7ed6", "bardzo dobry"], [2, "#40c057", "dobry"], [3, "#fcc419", "umiarkowany"], [4, "#fd7e14", "słaby"], [5, "#e03131", "zły"], [9, "#ced4da", "brak oceny"]],
    c: [[0, "#4dabf7", "dobry"], [1, "#e03131", "poniżej dobrego"], [9, "#ced4da", "brak oceny"]],
    r: [[0, "#69db7c", "niezagrożone"], [1, "#f76707", "zagrożone"]] };
  let wpT = (() => { try { const v = app.store.get("wody.t", "s"); return WP_T[v] ? v : "s"; } catch (e) { return "s"; } })();
  const wpColor = t => ["match", ["get", t], ...WP_C[t].flatMap(([v, c]) => [v, c]), "#ced4da"];
  const wpLegend = () => `<div class="stats-seg ext-seg su-seg" role="group" aria-label="Co pokazać">${Object.entries(WP_T).map(([k, v]) => `<button type="button" data-wp="${k}" aria-pressed="${k === wpT}">${esc(v[0])}</button>`).join("")}</div>` +
    legendRow(WP_C[wpT].map(([, c, l]) => [c, l, "box"])) + note("Zlewnie jednolitych części wód powierzchniowych (JCWP) z planów gospodarowania wodami. Kliknij zlewnię: stan, presje, cele i terminy.");
  const wpRow = (l, v) => v ? `<p><span class="muted">${esc(l)}:</span> ${esc(v)}</p>` : "";
  function jcwpBody(kod, d) {
    const r = d?.jcwp?.[kod]; if (!r) return `<p class="muted">Kod ${esc(kod)}. Szczegóły jeszcze się wczytują, kliknij ponownie za chwilę.</p>`;
    const F = d.pola, v = n => { const x = r[F.indexOf(n) + 1]; return x == null ? "" : d.slownik[x]; };
    const zly = /zły/.test(v("ocena_st")), ryz = /^jcwp zagrożona/.test(v("oc_ryz"));
    return `<p class="gs-st"><i style="background:${zly ? "#e8590c" : v("ocena_st") ? "#4dabf7" : "#ced4da"}"></i>${esc(v("ocena_st") || "stan nieoceniony")}</p>` +
      wpRow("Kod", kod) + wpRow("Typ", v("typ_jcwp")) + wpRow("Status", v("status_os")) + wpRow("Stan ekologiczny", v("st_eko")) + wpRow("Stan chemiczny", v("st_chem")) +
      `<p><span class="muted">Ryzyko:</span> <b style="color:${ryz ? "#d9480f" : "#2b8a3e"}">${esc(v("oc_ryz") || "brak danych")}</b></p>` +
      wpRow("Odstępstwo", v("typ_odst")) + wpRow("Termin osiągnięcia celu", v("cs_termin")) +
      wpRow("Presja: źródła eutrofizacji", v("pr_trofi")) + wpRow("Presja hydromorfologiczna", v("pr_hymo")) + wpRow("Presja ilościowa", v("pr_il")) +
      wpRow("Region wodny", v("reg_wodny")) + wpRow("RZGW", v("rzgw")) +
      `<p class="muted small">${link("https://apgw.gov.pl/", "Plany gospodarowania wodami (apgw.gov.pl)")}</p>`;
  }
  let pdT = "s";
  const pdColor = () => ["match", ["get", pdT], 1, "#e8590c", "#74c0fc"];
  const pdLegend = () => `<div class="stats-seg ext-seg su-seg" role="group" aria-label="Co pokazać"><button type="button" data-pd="s" aria-pressed="${pdT === "s"}">stan</button><button type="button" data-pd="r" aria-pressed="${pdT === "r"}">ryzyko</button></div>` +
    legendRow(pdT === "s" ? [["#74c0fc", "dobry", "box"], ["#e8590c", "słaby", "box"]] : [["#74c0fc", "niezagrożone", "box"], ["#e8590c", "zagrożone", "box"]]) + note("Jednolite części wód podziemnych (JCWPd), 174 obszary w Polsce.");
  const OCH = { PN: ["park narodowy", "#2b8a3e"], PK: ["park krajobrazowy", "#74b816"], Rez: ["rezerwat", "#087f5b"], "N2k SOO": ["Natura 2000, siedliska", "#1971c2"], "N2k OSO": ["Natura 2000, ptaki", "#4dabf7"],
    UE: ["użytek ekologiczny", "#f08c00"], OchK: ["obszar chronionego krajobrazu", "#c0eb75"], ZPK: ["zespół przyrodniczo-krajobrazowy", "#a9e34b"], SD: ["stanowisko dokumentacyjne", "#ae3ec9"], PP: ["pomnik przyrody", "#9c36b5"] };
  const ochColor = ["match", ["get", "t"], ...Object.entries(OCH).flatMap(([k, v]) => [k, v[1]]), "#868e96"];

  /* ---------- Stare mapy: zeskanowane arkusze z georeferencją z narożników ramki, kafle XYZ w data/stare/<seria> (mapgen/stare_mapy/stare.py) ---------- */
  const GPW = "https://mapy.geoportal.gov.pl/wss/service";
  const wmsT = (u, layers, extra = "", fmt = "image/jpeg") => `${u}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layers}&STYLES=&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=${fmt}${extra}`;
  const ORTO_T = `${GPW}/PZGIK/ORTO/WMS/StandardResolutionTime`, TOPO_W = `${GPW}/img/guest/TOPO/MapServer/WMSServer`, BDOT_W = `${GPW}/pub/guest/kompozycja_BDOT10k_WMS/MapServer/WMSServer`;
  const BDOT_L = "RZab,TPrz,SOd2,SOd1,GNu2,GNu1,TKa2,TKa1,TPi2,TPi1,UTrw,TLes,RKr,RTr,ku7,ku6,ku5,ku4,ku3,ku2,ku1,Mo,Pl3,Pl2,Pl1,kanOkr,rzOk,row,kan,rz,RowEt,kanEt,rzEt,WPow,Szu,LBrzN,LBrz,WPowEt,GrPol,Rez,GrPK,GrPN,GrDz,GrGm,GrPo,GrWo,GrPns,PRur,ZbTA,BudCm,TerCm,BudSp,Szkl,Kap,SwNch,SwCh,BudZr,BudGo,BudPWy,BudP2,BudP1,BudUWy,BudU,BudMWy,BudMJ,BudMW,Bzn,BHydA,BHydL,wyk,wa6,wa5,wa4,wa3,wa2,wa1,IUTA,ObOrA,ObPL,Prom,PomL,MurH,PerA,PerL,Tryb,UTrL,LTra,LKNc,LKBu,LKWs,TSt,LKNelJ,LKNelD,LKNelW,LKZelJ,LKZelD,LKZelW,Scz,Al,AlEt,Sch2,Sch1,DrDGr,DrLGr,JDrLNUt,JDLNTw,JDrZTw,JDrG,DrEk,JDrEk,AuBud,JAu,NazDr,NrDr,Umo,PPdz,Prze,TunK,TunD,Klad,MosK,MosD,UTrP,ObKom,InUTP,ZbTP,NazUl,ObOrP,WyBT,LTel,LEle,ObPP,DrzPomP,e13,e12,e11,e10,e9,e8,e7,e6,e5,e4,e3,e2,e1,s19,s18,s17,s16,s15,s14,s13,s12,s11,s10,s9,s8,s7,s6,s5,s4,s3,s2,s1";
  const ORTO_NOW = `${GPW}/PZGIK/ORTO/WMTS/StandardResolution?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}`;
  const AMZP = "Archiwum Map Zachodniej Polski (igrek.amzp.pl)";
  const STARE = {
    mtb: { n: "Messtischblatt", d: "Pruska mapa 1:25 000 z lat 1883–1884. Na razie arkusze Orzesche, Nicolai i Lendzin (Orzesze, Mikołów, Tychy, Lędziny). Arkusze ustawione według narożników ramki, możliwe przesunięcie do około 100 m", src: AMZP + ", skany Biblioteki Narodowej i Leibniz-Institut für Länderkunde", bb: [18.6667, 50.1, 19.1667, 50.2], minz: 11, maxz: 16, gdzie: "Orzesze, Mikołów, Tychy i Lędziny" },
    wig: { n: "WIG 1933", d: "Mapa Wojskowego Instytutu Geograficznego 1:25 000 z 1933 r. Na razie arkusze Orzesze, Tychy i Bieruń Stary", src: AMZP + ", skany Archiwum Map WIG", bb: [18.6667, 50.0833, 19.1667, 50.1667], minz: 11, maxz: 16, gdzie: "Orzesze, Tychy i Bieruń" },
    topo: { n: "Topograficzna", d: "Mapa topograficzna GUGiK, cały kraj. Starsze wydania (układ 1965 i 1942) GUGiK udostępnia tylko jako skany do pobrania", src: "GUGiK, usługi WMS mapy topograficznej i BDOT10k (geoportal.gov.pl)", minz: 8, maxz: 19 },
    p: { n: "Inne wydania", d: "Wszystkie wydania map w skali do 1:100 000 dostępne w archiwum dla Tychów i Dubidzy (gmina Kleszczów), a dla Górnego Śląska od Gliwic i Tarnowskich Gór po Pszczynę 30 arkuszy Messtischblatt i 32 arkusze WIG: pruskie, austriackie, rosyjskie, polskie WIG, niemieckie, amerykańskie i radzieckie. Arkusze ustawione według narożników ramki, możliwe przesunięcie do około 100–200 m", src: AMZP + ", skany Biblioteki Narodowej, Library of Congress, Archiwum Map WIG i innych bibliotek", bb: [18.6, 50.0, 19.35, 50.25], minz: 10, maxz: 15, gdzie: "Tychy, Dubidze i Górny Śląsk" },
    orto: { n: "Ortofoto archiwalne", d: "Archiwalne ortofotomapy GUGiK, cały kraj. Lata do wyboru to roczniki zdjęć, które istnieją w środku widoku mapy", src: "GUGiK, usługa WMS ortofotomap archiwalnych (geoportal.gov.pl)", minz: 13, maxz: 19 } };
  const P_N = { zmtb: "Messtischblatt 1:25 000, mozaika arkuszy (Śląsk Opolski i Górny)", zwig: "WIG 1:25 000, mozaika arkuszy (Wielkopolska, łódzkie, Śląsk)", rmtb: "Messtischblatt 1:25 000 (lata 1939–1944)", rwig: "WIG 1:25 000 (lata 1930–1940)", mtb: "Messtischblatt 1:25 000", wig: "WIG 1:25 000", wig26: "WIG 1:25 000, wydanie wczesne", ams25: "Amerykańska AMS 1:25 000", ussr50: "Radziecka 1:50 000", ams50: "Amerykańska AMS 1:50 000", kuk75: "Austro-węgierska 1:75 000", ros84: "Rosyjska 1:84 000", wig100: "WIG 1:100 000", bsk25: "Niemiecka mapa gleb (Bodenschätzung) 1:25 000", rus25: "Rosyjska 1:25 000 (1915)", kdr100: "Karte des Deutschen Reiches 1:100 000", kwr100: "Niemiecka mapa zachodniej Rosji 1:100 000", ussr100: "Radziecka 1:100 000", gr100: "Niemiecka 1:100 000 (Generalstab)", gsgs100: "Brytyjska GSGS 1:100 000", ams100: "Amerykańska AMS 1:100 000", rey200: "Mapa Reymanna 1:200 000 (dopasowanie przybliżone, ±0,5 km)", gm200: "Generalkarte von Mitteleuropa 1:200 000", tudr200: "Topographische Übersichtskarte des Deutschen Reiches 1:200 000", wig300: "WIG 1:300 000 (mapa operacyjna)", gsgs300: "Brytyjska GSGS 1:300 000", wiel: "Mapa Wielanda i Schubartha, księstwo raciborskie i Państwo Pszczyńskie (Homann, dopasowanie przybliżone, ±1 km)" };
  /* stare mapy z Cloudflare R2: jeden plik PMTiles na wydanie (mapgen/xyz2pmtiles.py); bez adresu działają kafle z data/stare */
  const STARE_R2 = (() => { try { const q = new URLSearchParams(location.search).get("stare"); const u = (q || (window.PLOTS_CONFIG || {}).STARE_URL || "").replace(/\/$/, "");
    if (u && window.pmtiles && window.maplibregl) { maplibregl.addProtocol("pmtiles", new pmtiles.Protocol().tile); return u; } } catch (e) {} return ""; })();
  let stPI = null; fetch(new URL("data/stare/p/index.json", location.href)).then(r => r.json()).then(j => { stPI = j; refreshLegend(); }).catch(() => { stPI = {}; });
  const pSer = k => k.replace(/_\d+$/, ""), pYr = k => k.match(/\d+$/)[0];
  const TOPO_E = { 92: "lata 1990–2000", bdot: "dziś (BDOT10k)" };
  const vSplit = v => v.split(":");
  const vName = v => { const [t, x] = vSplit(v); return t === "now" ? "Ortofoto aktualne" : t === "orto" ? `Ortofoto ${x}` : t === "topo" ? `Topograficzna ${TOPO_E[x]}` : t === "p" ? (x ? `${P_N[pSer(x)] || pSer(x)}, ${pYr(x)}` : STARE.p.n) : STARE[t].n; };
  const vOpt = v => { const [t, x] = vSplit(v); if (t === "now") return { minz: 0, maxz: 19 };
    const e = t === "p" && x && stPI && stPI[x]; return e ? { ...STARE.p, minz: e.z[0], maxz: e.z[1], bb: e.bbox } : STARE[t]; };
  const vUrl = v => { const [t, x] = vSplit(v);
    if (t === "now") return ORTO_NOW;
    if (t === "orto") return wmsT(ORTO_T, "Raster", `&TIME=${x}-01-01/${x}-12-31`);
    if (t === "topo") return x === "bdot" ? wmsT(BDOT_W, BDOT_L, "&TRANSPARENT=FALSE", "image/png") : wmsT(TOPO_W, "Raster");
    const rel = t === "p" ? "p/" + x : t;
    if (STARE_R2) return `pmtiles://${STARE_R2}/${rel}.pmtiles/{z}/{x}/{y}`;
    return new URL(`data/stare/${rel}/{z}/{x}/{y}.webp`, location.href).href.replace(/%7B/g, "{").replace(/%7D/g, "}"); };
  let stA = (() => { try { const v = app.store.get("stare.v", "mtb"); return STARE[vSplit(v)[0]] ? v : "mtb"; } catch (e) { return "mtb"; } })();
  let stOp = 1, stYears = null, stProbe = "", stProbing = false, cmp = null, cmpB = "now";
  const stT = () => vSplit(stA)[0];
  const STARE_BB = () => vOpt(stA).bb || STARE.mtb.bb;
  /* which yearly ortophoto flights exist at the map centre: one 8×8 px request per year, identical images = the same flight */
  const merc = (lng, lat) => [lng * 20037508.34 / 180, Math.log(Math.tan((90 + lat) * Math.PI / 360)) * 6378137];
  let stDone = 0, stFail = false;
  async function probeYears() {
    if (map.getZoom() < 11) return;
    const c = map.getCenter(), key = c.lng.toFixed(2) + "," + c.lat.toFixed(2);
    if (key === stProbe || stProbing) return;
    stProbe = key;
    try { const hit = JSON.parse(localStorage.getItem("plots.ortoYears") || "{}")[key]; if (hit) { stYears = hit; stFail = false; afterYears(); return; } } catch (e) {}
    stProbing = true; stDone = 0; stFail = false; refreshLegend();
    const [x, y] = merc(c.lng, c.lat), bb = [x - 100, y - 100, x + 100, y + 100].map(Math.round).join(",");
    const Y1 = new Date().getFullYear(), ys = []; for (let i = 1995; i <= Y1; i++) ys.push(i);
    const cv = document.createElement("canvas"); cv.width = cv.height = 32; const cx = cv.getContext("2d", { willReadFrequently: true });
    const res = []; let next = 0, lost = 0;
    const one = async yr => {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 20000);
      try {
        const r = await fetch(`${ORTO_T}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=Raster&STYLES=&SRS=EPSG:3857&BBOX=${bb}&WIDTH=32&HEIGHT=32&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${yr}-01-01/${yr}-12-31`, { signal: ac.signal });
        if (!r.ok) throw Error(r.status);
        const bm = await createImageBitmap(await r.blob());
        cx.clearRect(0, 0, 32, 32); cx.drawImage(bm, 0, 0, 32, 32); const d = cx.getImageData(0, 0, 32, 32).data;
        let any = false, h = 0; for (let i = 0; i < d.length; i++) { if (i % 4 === 3 && d[i]) any = true; h = (h * 31 + d[i]) | 0; }
        res[yr - 1995] = { yr, any, h };
      } catch (e) { lost++; res[yr - 1995] = { yr, lost: true }; } finally { clearTimeout(t); }
      stDone++; const h = document.querySelector("#x-leg-stare-mapy [data-st-prog]"); if (h) h.textContent = `${stDone} z ${ys.length}`;
    };
    // four at a time, so the map tiles from the same server are not starved
    await Promise.all([0, 1, 2, 3].map(async () => { while (next < ys.length) await one(ys[next++]); }));
    if (key !== stProbe) { stProbing = false; return; }
    const out = []; let last = null;
    for (const r of res) { if (!r || r.lost || !r.any) { last = null; continue; } if (r.h !== last) out.push(r.yr); last = r.h; }
    stProbing = false;
    if (lost > ys.length / 3) { stFail = true; stYears = []; for (let i = 1996; i <= Y1; i++) stYears.push(i); }
    else { stYears = out; if (!lost) try { const m = JSON.parse(localStorage.getItem("plots.ortoYears") || "{}"); m[key] = out; localStorage.setItem("plots.ortoYears", JSON.stringify(m)); } catch (e) {} }
    afterYears();
  }
  function afterYears() {
    const cur = +vSplit(stA)[1];
    if (stT() === "orto" && stYears.length && !stYears.includes(cur)) setA("orto:" + stYears.reduce((m, y) => Math.abs(y - cur) < Math.abs(m - cur) ? y : m, stYears[0]));
    else refreshLegend();
  }
  const stOpHtml = () => `<div class="st-op"><div class="st-op-head"><span>Przezroczystość starej mapy</span><output data-sto-out>${Math.round((1 - stOp) * 100)}%</output></div>` +
    `<input type="range" min="0" max="100" step="5" value="${Math.round((1 - stOp) * 100)}" data-sto aria-label="Przezroczystość starej mapy"></div>`;
  const yearsHtml = (cur, attr) => stProbing ? `<p class="st-hint st-load-h">Sprawdzam, z jakich lat są zdjęcia w tym miejscu (<span data-st-prog>${stDone} z ${new Date().getFullYear() - 1994}</span>). Serwer GUGiK bywa wolny.</p>` : map.getZoom() < 11 ? `<p class="st-hint">Przybliż mapę, żeby sprawdzić lata zdjęć w tym miejscu.</p>` :
    stYears && !stYears.length ? `<p class="st-hint">Brak zdjęć archiwalnych w tym miejscu.</p>` : stYears ? (stFail ? `<p class="st-hint">Serwer GUGiK nie odpowiedział na czas, więc nie wiadomo, z których lat są zdjęcia w tym miejscu. Pokazuję wszystkie lata, niektóre mogą być puste.</p>` : "") + `<div class="st-years" role="group" aria-label="Rok zdjęcia">${stYears.map(y => `<button type="button" ${attr}="${y}" aria-pressed="${y === +cur}">${y}</button>`).join("")}</div>` : "";
  const cmpOpts = () => { const o = ["now", ...(stYears || []).map(y => "orto:" + y), "topo:92", "topo:bdot", "mtb", "wig", ...Object.keys(stPI || {}).map(k => "p:" + k)].filter(v => v !== stA); if (!o.includes(cmpB)) o.unshift(cmpB); return o; };

  /* editions grouped by the country that made them; each edition says for which area it exists */
  const FLAG = (c, h = "") => `<svg class="st-flag" viewBox="0 0 30 20" aria-hidden="true">${c.map((col, i) => `<rect y="${i * 20 / c.length}" width="30" height="${20 / c.length + .2}" fill="${col}"/>`).join("")}${h}</svg>`;
  const P_KRAJ = [
    ["pl", "Polska", FLAG(["#fff", "#dc143c"]), ["zwig", "rwig", "wig26", "wig", "wig100", "wig300"]],
    ["de", "Prusy i Niemcy", FLAG(["#000", "#fff", "#dd0000"]), ["zmtb", "rmtb", "mtb", "bsk25", "kwr100", "gr100", "kdr100", "tudr200", "rey200"]],
    ["at", "Austro-Węgry", FLAG(["#000", "#ffd200"]), ["kuk75", "gm200", "wiel"]],
    ["ru", "Rosja carska", FLAG(["#fff", "#0039a6", "#d52b1e"]), ["rus25", "ros84"]],
    ["su", "ZSRR", FLAG(["#cc0000"], `<path d="M4 3l1 2.2 2.4.2-1.8 1.6.6 2.3L4 8.1 1.8 9.3l.6-2.3L.6 5.4 3 5.2z" fill="#ffd700"/>`), ["ussr50", "ussr100"]],
    ["us", "USA", FLAG(["#b22234", "#fff", "#b22234", "#fff", "#b22234", "#fff", "#b22234"], `<rect width="13" height="11" fill="#3c3b6e"/>`), ["ams25", "ams50", "ams100"]],
    ["gb", "Wielka Brytania", FLAG(["#012169"], `<path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.5"/>`), ["gsgs100", "gsgs300"]]];
  const P_GDZIE = [["Tychy", [18.87, 50.05, 19.08, 50.17]], ["Dubidze", [19.1, 51.05, 19.2, 51.15]]];
  const pWhere = k => { const b = stPI[k].bbox; if (/^r(mtb|wig)_/.test(k)) return "cały Górny Śląsk"; if (/^z(mtb|wig)_/.test(k)) return `mozaika ${stPI[k].arkuszy || ""} arkuszy`;
    return P_GDZIE.filter(([, g]) => b[0] < g[2] && b[2] > g[0] && b[1] < g[3] && b[3] > g[1]).map(([n]) => n).join(" i ") || "okolice"; };
  function pListHtml() {
    const by = Object.keys(stPI).reduce((m, k) => ((m[pSer(k)] = m[pSer(k)] || []).push(k), m), {});
    return P_KRAJ.map(([id, kraj, flag, ser]) => { const rows = ser.filter(s => by[s]); if (!rows.length) return "";
      return `<div class="st-kraj"><p class="st-kraj-h">${flag}<b>${kraj}</b></p>` + rows.map(sr => { const ks = by[sr], all = [...new Set(ks.map(pWhere))];
        return `<p class="st-lbl">${esc(P_N[sr] || sr)} <span class="st-gdzie">${all.length === 1 ? (/^z/.test(sr) ? "" : "dla: ") + all[0] : "różne obszary"}</span></p><div class="st-years" role="group" aria-label="${esc(P_N[sr] || sr)}">` +
          ks.map(k => `<button type="button" data-stp="${k}" aria-pressed="${stA === "p:" + k}">${pYr(k)}${all.length > 1 ? `<small>${esc(pWhere(k))}</small>` : ""}</button>`).join("") + `</div>`; }).join("") + `</div>`; }).join("");
  }
  const stLegend = () => { const t = stT(), S = vOpt(stA);
    return `<div class="st-series" role="group" aria-label="Seria map">${Object.entries(STARE).map(([k, v]) => `<button type="button" data-st="${k}" aria-pressed="${k === t}">${esc(v.n)}</button>`).join("")}</div>` +
    (t === "orto" ? `<p class="st-lbl">Rok zdjęcia</p>` + yearsHtml(vSplit(stA)[1], "data-sty") : "") +
    (t === "topo" ? `<div class="st-years" role="group" aria-label="Wydanie">${Object.entries(TOPO_E).map(([k, n]) => `<button type="button" data-ste="${k}" aria-pressed="${stA === "topo:" + k}">${esc(n)}</button>`).join("")}</div>` : "") +
    (t === "p" ? (!stPI ? `<p class="st-hint">Wczytuję listę wydań…</p>` : pListHtml()) : "") +
    (t === "p" ? `<p class="small">Pokaż na mapie: <a href="#" data-stgo="18.99,50.12">Tychy</a> · <a href="#" data-stgo="19.15,51.1">Dubidze</a> · <a href="#" data-stgo="18.85,50.2" data-stz="10">Górny Śląsk</a></p>` : "") +
    `<p class="st-status" data-st-status></p>` + stOpHtml() +
    `<div class="st-cmp-box"><button type="button" class="st-cmp-btn" data-cmp aria-pressed="${!!cmp}">${cmp ? "Zakończ porównanie" : "Porównaj z inną mapą (suwak na mapie)"}</button>` +
    (cmp ? `<label class="st-lbl" for="st-cmpb">Po prawej stronie linii</label><select id="st-cmpb" data-cmpb>${cmpOpts().map(v => `<option value="${v}"${v === cmpB ? " selected" : ""}>${esc(vName(v))}</option>`).join("")}</select><p class="st-hint">Po lewej: ${esc(vName(stA))}. Przeciągnij pionową linię na mapie.</p>` : "") + `</div>` +
    note(`${S.d}. Źródło: ${S.src}.`) + (S.bb ? `<p class="small"><a href="#" data-st-go>Pokaż arkusze na mapie</a></p>` : ""); };
  function stStatus() {
    const el = document.querySelector("#x-leg-stare-mapy [data-st-status]"); if (!el) return;
    const S = vOpt(stA), z = map.getZoom(), c = map.getCenter(); let cls = "ok", txt;
    if (z < S.minz) { cls = "zoom"; txt = "Przybliż mapę, aby zobaczyć tę mapę."; }
    else if (S.bb && !(c.lng > S.bb[0] && c.lng < S.bb[2] && c.lat > S.bb[1] && c.lat < S.bb[3])) { cls = "zoom"; txt = `Ta seria jest na razie tylko dla: ${S.gdzie}.`; }
    else { let ok = true; try { ok = map.isSourceLoaded("x-stare-mapy"); } catch (e) {} txt = ok ? `Widać: ${vName(stA)}` : `Wczytuję: ${vName(stA)}…`; if (!ok) cls = "load"; }
    if (el.dataset.c !== cls + txt) { el.dataset.c = cls + txt; el.className = "st-status st-" + cls; el.textContent = txt; }
  }
  let stHooked = false;
  const hookStatus = () => { if (stHooked) return; stHooked = true; let raf = 0; const kick = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; stStatus(); }); };
    map.on("sourcedata", kick); map.on("idle", kick); map.on("moveend", kick);
    let tm = 0; map.on("moveend", () => { clearTimeout(tm); tm = setTimeout(() => { if (document.getElementById("x-stare-mapy")?.checked && (stT() === "orto" || cmp)) probeYears(); }, 500); }); };
  function refreshLegend() { const box = document.getElementById("x-leg-stare-mapy"); if (!box || box.hidden) return; box.innerHTML = stLegend(); STL().legendInit(box); }
  const STL = () => window.ExtraLayers.LAYERS.find(x => x.id === "stare-mapy");
  function setA(v) {
    stA = v; try { app.store.set("stare.v", v); } catch (e) {}
    if (map.getLayer("x-stare")) map.removeLayer("x-stare"); if (map.getSource("x-stare-mapy")) map.removeSource("x-stare-mapy");
    added.delete("stare-mapy"); apply(STL(), true);
    if (cmp && cmpB === stA) { cmpB = stA === "now" ? "topo:bdot" : "now"; cmpSetB(); }
    if (cmp) cmpLabels();
  }
  /* swipe comparison: a second, non-interactive map on top of the main one, clipped to the right of the line; the main map keeps the left view */
  function cmpOpen() {
    if (cmp) return;
    const host = map.getContainer(), wrap = document.createElement("div"); wrap.className = "st-cmp";
    wrap.innerHTML = `<div class="st-cmp-map"></div><div class="st-cmp-line"><button type="button" class="st-cmp-h" aria-label="Przeciągnij, aby porównać mapy"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 6 3 12l6 6M15 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="st-cmp-tag st-cmp-l"></span><span class="st-cmp-tag st-cmp-r"></span></div>`;
    host.insertBefore(wrap, host.querySelector(".maplibregl-control-container"));
    const m2 = new maplibregl.Map({ container: wrap.querySelector(".st-cmp-map"), style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#f2f2f2" } }] },
      interactive: false, attributionControl: false, fadeDuration: 0, center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() });
    const sync = () => m2.jumpTo({ center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() });
    map.on("move", sync);
    cmp = { wrap, m2, sync, x: .5 };
    if (vSplit(stA)[0] === "orto" && stYears?.length) cmpB = "orto:" + stYears[stYears.length - 1]; else if (cmpB === stA) cmpB = "now";
    if (cmpB === stA) cmpB = "topo:bdot";
    m2.on("load", cmpSetB);
    const h = wrap.querySelector(".st-cmp-line");
    h.addEventListener("pointerdown", e => { e.preventDefault(); h.setPointerCapture(e.pointerId); const mv = ev => { const r = host.getBoundingClientRect(); cmp.x = Math.min(.85, Math.max(.15, (ev.clientX - r.left) / r.width)); cmpPos(); };
      const up = () => { h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); };
      h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up); });
    h.addEventListener("keydown", e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { cmp.x = Math.min(.85, Math.max(.15, cmp.x + (e.key === "ArrowLeft" ? -.05 : .05))); cmpPos(); } });
    cmpPos(); cmpLabels(); probeYears();
    // like the commute flows: a "Cofnij" chip at the top and the phone's back gesture leave the comparison
    let chip = document.getElementById("stCmpChip");
    if (!chip) { chip = document.createElement("div"); chip.id = "stCmpChip"; chip.className = "ext-chip"; document.body.appendChild(chip); }
    chip.innerHTML = `<button type="button" class="ext-back"><svg class="ic" aria-hidden="true"><use href="#i-back"/></svg>Cofnij</button>`;
    chip.hidden = false; chip.querySelector(".ext-back").onclick = () => { cmpClose(); refreshLegend(); };
    document.querySelectorAll("dialog[open]").forEach(d => d.close());
    if (app.isMobile?.()) app.snap?.("peek");
    if (!document.getElementById("layerPanel")?.hidden) document.querySelector("[data-close-layers]")?.click();
    setTimeout(() => window.UIHistory?.open("stcmp", () => { cmpClose(); refreshLegend(); }), 0);
  }
  function cmpPos() { if (!cmp) return; const p = (cmp.x * 100).toFixed(2) + "%"; cmp.wrap.querySelector(".st-cmp-map").style.clipPath = `inset(0 0 0 ${p})`; cmp.wrap.querySelector(".st-cmp-line").style.left = p; }
  function cmpLabels() { if (!cmp) return; const sh = v => vName(v).replace(/ (.*)/, ""); cmp.wrap.querySelector(".st-cmp-l").textContent = "◀ " + sh(stA); cmp.wrap.querySelector(".st-cmp-r").textContent = sh(cmpB) + " ▶"; }
  function cmpSetB() {
    if (!cmp) return; const m2 = cmp.m2; if (!m2.isStyleLoaded()) return;
    if (m2.getLayer("b")) m2.removeLayer("b"); if (m2.getSource("b")) m2.removeSource("b");
    const o = vOpt(cmpB);
    m2.addSource("b", { type: "raster", tiles: [vUrl(cmpB)], tileSize: 256, minzoom: o.minz || 0, maxzoom: o.maxz || 19, ...(o.bb ? { bounds: o.bb } : {}) });
    m2.addLayer({ id: "b", type: "raster", source: "b", paint: { "raster-fade-duration": 0 } });
    cmpLabels();
  }
  function cmpClose() { const ch = document.getElementById("stCmpChip"); if (ch) ch.hidden = true; if (!cmp) return; map.off("move", cmp.sync); try { cmp.m2.remove(); } catch (e) {} cmp.wrap.remove(); cmp = null; }

  /* ---------- GIOŚ stations ---------- */
  const NORM = { pm25: [10, 20], pm10: [20, 40], pm10_36: [45, 50], no2: [20, 40], bap: [1, 1], arsen: [6, 6], o3_dni: [18, 25], so2: [20, 20] };
  const PNAME = { pm25: "PM2,5", pm10: "PM10", pm10_36: "PM10, 36. doba", no2: "NO₂", bap: "benzo(a)piren", arsen: "arsen", o3_dni: "ozon, dni > 120", so2: "SO₂" };
  const PUNIT = { pm25: "µg/m³", pm10: "µg/m³", pm10_36: "µg/m³", no2: "µg/m³", bap: "ng/m³", arsen: "ng/m³", o3_dni: "dni", so2: "µg/m³" };
  const status = pom => { let s = Object.keys(pom).length ? 1 : 0; for (const [k, v] of Object.entries(pom)) { const n = NORM[k]; if (!n) continue; if (v > n[1]) s = Math.max(s, 3); else if (v > n[0]) s = Math.max(s, 2); } return s; };
  const ST_COL = ["#8e8e93", "#34a383", "#f59e3e", "#e5513d"], ST_TXT = ["brak rocznej serii", "normy dotrzymane", "powyżej norm UE od 2030 r.", "przekroczona obecna norma"];
  const stationsGeo = d => ({ type: "FeatureCollection", features: d.stacje.map(s => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lon, s.lat] }, properties: { ...s, pom: JSON.stringify(s.pom), mod: JSON.stringify(s.mod), wsk: JSON.stringify(s.wsk), st: status(s.pom) } })) });
  const J = v => { try { return typeof v === "string" ? JSON.parse(v) : v || {}; } catch (e) { return {}; } };
  function stationBody(p, year) {
    const pom = J(p.pom), mod = J(p.mod), wsk = J(p.wsk), keys = Object.keys(PNAME).filter(k => pom[k] != null);
    const dg = k => PUNIT[k] === "ng/m³" ? 2 : PUNIT[k] === "dni" ? 0 : 1;
    return `<p class="gs-st"><i style="background:${ST_COL[p.st]}"></i>${esc(ST_TXT[p.st])}</p>` +
      row("Adres", [p.adres, p.miasto].filter(Boolean).join(", ")) + row("Typ stacji", [p.typ, p.obszar && "obszar " + p.obszar].filter(Boolean).join(", ")) + row("Działa od", p.od) +
      (wsk.length ? `<p><span class="muted">Mierzy:</span> ${esc(wsk.join(", "))}</p>` : "") +
      (keys.length ? `<table class="gs-tab"><thead><tr><th>Średnio w ${year} r.</th><th>pomiar</th><th>model</th></tr></thead><tbody>${keys.map(k => `<tr><td>${esc(PNAME[k])}</td><td><b class="gs-${pom[k] > NORM[k][1] ? "bad" : pom[k] > NORM[k][0] ? "warn" : "ok"}">${fmt(pom[k], dg(k))}</b></td><td>${mod[k] != null ? fmt(mod[k], dg(k)) : "–"}</td></tr>`).join("")}</tbody></table><p class="muted small">Jednostki: µg/m³, benzo(a)piren i arsen ng/m³, ozon w dniach. Model: ocena roczna GIOŚ 2025 w kratce, w której stoi stacja.</p>` : `<p class="muted small">Brak rocznej serii pomiarowej o kompletności co najmniej 75% w ${year} r.</p>`) +
      `<p>${link(`https://powietrze.gios.gov.pl/pjp/current/station_details/info/${p.id}`, "Aktualne pomiary i indeks jakości powietrza (GIOŚ)")}</p>`;
  }

  /* ---------- road investments ---------- */
  const ROAD_COL = { b: "#d9480f", p: "#7048e8" };
  const RS = { r: ["w realizacji", "#d9480f"], t: ["w przetargu", "#e8590c"], p: ["w przygotowaniu", "#7048e8"], u: ["w użytkowaniu", "#2b8a3e"] };
  const CLS = { A: "autostrada", S: "droga ekspresowa", DK: "droga krajowa", DW: "droga wojewódzka lub lokalna" };
  function roadCard(p, d, side) {
    const refs = (p.ref || "").split(";").map(x => x.trim()).filter(Boolean);
    const title = [refs.map(r => /^\d+$/.test(r) ? (+r < 100 ? "DK" : "DW") + r : r).join(", "), p.n].filter(Boolean).join(" ") || (p.k === "b" ? "Droga w budowie" : "Planowana droga");
    const odc = side && refs.length ? side.odcinki.filter(o => o.s !== "u" && o.r.some(r => refs.includes(r))) : [];
    odc.sort((a, b) => "rtp".indexOf(a.s) - "rtp".indexOf(b.s));
    const date = p.od ? p.od.replace(/^(\d{4})-(\d{2}).*/, "$2.$1").replace(/^(\d{4})$/, "$1") : "";
    return { title, src: `OpenStreetMap (przebieg, stan ${d?.osm || ""}), GDDKiA Mapa Stanu Budowy Dróg (status i strony odcinków dróg krajowych)`,
      body: `<p class="gs-st"><i style="background:${ROAD_COL[p.k]}"></i>${p.k === "b" ? "W budowie lub przebudowie" : "Planowana"} · ${esc(CLS[p.c] || "")}</p>` + row("Planowane otwarcie (OpenStreetMap)", date) + (p.refx ? `<p class="muted small">Numer drogi przypisany z sąsiedniego odcinka, bo w OpenStreetMap ten fragment go nie ma.</p>` : "") +
        (odc.length ? `<p class="ext-sub"><b>Inwestycje GDDKiA na ${esc(refs.join(", "))}</b></p><ul class="terr-list">${odc.slice(0, 10).map(o => `<li><a href="${esc(o.u)}" target="_blank" rel="noopener noreferrer">${esc(o.n || o.d)}</a><small><span style="color:${RS[o.s][1]};font-weight:600">${RS[o.s][0]}</span>${o.w ? " · " + esc(o.w) : ""}</small></li>`).join("")}</ul>${odc.length > 10 ? `<p class="muted small">i ${odc.length - 10} dalszych odcinków.</p>` : ""}` : "") +
        `<p class="muted small">Przebieg planowanej drogi jest orientacyjny. O tym, którędy pójdzie droga, rozstrzyga decyzja o środowiskowych uwarunkowaniach, a potem decyzja ZRID.</p>` };
  }

  const zridCard = p => ({ title: p.n, src: "GUNB, Rejestr wniosków, decyzji i zgłoszeń (RWDZ), dane.gov.pl",
    body: `<p class="gs-st"><i style="background:${p.z ? "#e8590c" : "#f59f00"}"></i>${p.z ? "Zezwolenie na realizację inwestycji drogowej (ZRID)" : "Pozwolenie na budowę drogi"}</p>` + row("Miejscowość", p.m) + row("Wniosek złożony", p.w) + row("Decyzja wydana", p.d) + row("Działek we wniosku", p.dz) +
      `<p class="muted small">Decyzja pozwala rozpocząć budowę. ZRID dodatkowo przejmuje pod drogę działki w liniach rozgraniczających. Szczegóły wniosku: ${link("https://wyszukiwarka.gunb.gov.pl/", "wyszukiwarka GUNB")}.</p>` });

  /* ---------- road map over time: roads, rail and road decisions in one view, with a year slider ---------- */
  const MD_Y0 = 2023, MD_Y1 = 2032;
  let mdYear = Math.min(MD_Y1, Math.max(MD_Y0, new Date().getFullYear()));
  const yearOf = s => { const m = /(20\d\d)/.exec(s || ""); return m ? +m[1] : 0; };
  async function mdFetch() {
    const get = u => fetch(u).then(r => { if (!r.ok) throw Error(r.status); return r.json(); });
    const [dr, kol, dec] = await Promise.all([get("data/drogi/inwestycje.geojson"), get("data/kolej/inwestycje.geojson"), get("data/drogi/decyzje.geojson")]);
    const lenKm = g => { let s = 0; const cs = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : []; for (const c of cs) for (let i = 1; i < c.length; i++) s += dist({ lon: c[i - 1][0], lat: c[i - 1][1] }, { lon: c[i][0], lat: c[i][1] }); return s / 1000; };
    const feats = [];
    for (const f of dr.features) feats.push({ ...f, properties: { ...f.properties, src: "d", y: yearOf(f.properties.od), km: lenKm(f.geometry) } });
    for (const f of kol.features) if (f.properties.c === "rail" || f.properties.c === "kdp") feats.push({ ...f, properties: { ...f.properties, src: "k", y: yearOf(f.properties.od), km: lenKm(f.geometry) } });
    for (const f of dec.features) feats.push({ ...f, properties: { ...f.properties, src: "z", y: yearOf(f.properties.d) } });
    return { type: "FeatureCollection", osm: dr.osm, features: feats };
  }
  const MD_OPEN = "#2b8a3e";
  function mdFilters(Y) {
    const lin = ["in", ["get", "src"], ["literal", ["d", "k"]]], dated = [">", ["get", "y"], 0];
    return {
      "x-md-open": ["all", lin, dated, ["<=", ["get", "y"], Y]],
      "x-md-b": ["all", lin, ["==", ["get", "k"], "b"], ["any", ["!", dated], [">", ["get", "y"], Y]]],
      "x-md-p": ["all", lin, ["==", ["get", "k"], "p"], ["any", ["!", dated], [">", ["get", "y"], Y]]],
      "x-md-z": ["all", ["==", ["get", "src"], "z"], [">", ["get", "y"], 0], ["<=", ["get", "y"], Y]]
    };
  }
  function mdApply(Y) {
    mdYear = Y;
    for (const [id, f] of Object.entries(mdFilters(Y))) if (map.getLayer(id)) map.setFilter(id, f);
    if (map.getLayer("x-md-z")) map.setPaintProperty("x-md-z", "circle-radius", ["interpolate", ["linear"], ["zoom"], 6, ["case", ["==", ["get", "y"], Y], 3, 1.2], 13, ["case", ["==", ["get", "y"], Y], 7, 3.5]]);
    const box = document.getElementById("x-leg-mapa-drogowa"), d = raw["mapa-drogowa"];
    if (!box) return;
    const lab = box.querySelector("[data-md-y]"); if (lab) lab.textContent = Y;
    const out = box.querySelector("[data-md-stat]"); if (!out || !d) return;
    let open = 0, bud = 0, plan = 0, dec = 0, decY = 0;
    for (const f of d.features) {
      const p = f.properties;
      if (p.src === "z") { if (p.y && p.y <= Y) dec++; if (p.y === Y) decY++; continue; }
      if (p.y && p.y <= Y) open += p.km; else if (p.k === "b") bud += p.km; else plan += p.km;
    }
    out.innerHTML = `<b>${fmt(open, 0)} km</b> dróg i torów z planowanym otwarciem do końca ${Y} r. · <b>${fmt(bud, 0)} km</b> w budowie · <b>${fmt(plan, 0)} km</b> planowanych · <b>${fmt(dec, 0)}</b> decyzji drogowych od 2023 r., w tym <b>${fmt(decY, 0)}</b> w ${Y} r.`;
  }
  const mdLegend = () => `<div class="md-year"><label for="md-range">Rok: <b data-md-y>${mdYear}</b></label><input id="md-range" type="range" min="${MD_Y0}" max="${MD_Y1}" step="1" value="${mdYear}"><div class="md-ticks"><span>${MD_Y0}</span><span>${MD_Y1}</span></div></div><p class="small" data-md-stat></p>` +
    legendRow([[MD_OPEN, "planowane otwarcie do wybranego roku", "line"], ["#d9480f", "w budowie", "line"], ["#7048e8", "planowane", "dash"], ["#e8590c", "decyzja ZRID lub pozwolenie na drogę"]]) +
    note("Daty otwarcia pochodzą z OpenStreetMap i ma je tylko część odcinków; bez daty odcinek zostaje w stanie „w budowie” lub „planowany”. Drogi: OpenStreetMap i GDDKiA. Kolej: OpenStreetMap i PKP PLK. Decyzje: GUNB, RWDZ (rok wydania), widoczne od skali około 1:8 000 000.");

  /* ---------- rail investments ---------- */
  const RAIL_COL = { b: "#1971c2", p: "#4dabf7" };
  const RCLS = { rail: "linia kolejowa", tram: "linia tramwajowa", metro: "metro", kdp: "kolej dużych prędkości" };
  function railCard(p, d, side) {
    if (p.c === "st") return { title: p.n || (p.st === "station" ? "Nowa stacja" : "Nowy przystanek"), src: `OpenStreetMap (stan ${d?.osm || ""})`,
      body: `<p class="gs-st"><i style="background:${RAIL_COL[p.k]}"></i>${p.k === "b" ? "W budowie" : "Planowany"} ${p.st === "station" ? "stacja" : "przystanek"}</p><p class="muted small">Termin otwarcia i zakres prac podaje ${link("https://www.plk-inwestycje.pl/", "mapa inwestycji PKP PLK")}.</p>` };
    const refs = (p.ref || "").split(/[;,]/).map(x => x.trim()).filter(Boolean);
    const fold = t => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
    const STOP = /^(linia|linii|kolejowa|kolejowej|proponowana|planowana|wariant|budowa|odcinek|odcinku|polaczenie|polaczenia|nowej|modernizacji)$/;
    const toks = fold(p.n).split(/[^a-z0-9]+/).filter(w => w.length >= 5 && !STOP.test(w));
    const kp = side ? side.projekty.filter(x => (refs.length && x.l.some(l => refs.includes(l))) || (toks.length >= 2 && toks.filter(w => fold(x.n).includes(w)).length >= 2)) : [];
    return { title: p.n || (refs.length ? `Linia kolejowa nr ${refs.join(", ")}` : (p.k === "b" ? "Linia w budowie" : "Planowana linia")), src: `OpenStreetMap (przebieg, stan ${d?.osm || ""}), PKP PLK (Program Kolej Plus)`,
      body: `<p class="gs-st"><i style="background:${RAIL_COL[p.k]}"></i>${p.k === "b" ? "W budowie lub modernizacji" : "Planowana"} · ${esc(RCLS[p.c] || "")}</p>` + row("Numer linii", refs.join(", ")) + row("Planowane otwarcie (OpenStreetMap)", p.od) +
        (kp.length ? `<p class="ext-sub"><b>Program Kolej Plus na tej linii</b></p><ul class="terr-list">${kp.map(x => `<li>${link(x.u, x.n)}</li>`).join("")}</ul>` : "") +
        `<p class="muted small">Zakres i terminy prac PKP PLK: ${link("https://www.plk-inwestycje.pl/", "mapa inwestycji PKP PLK")}.</p>` };
  }

  /* ---------- E-PRTR industrial sources ---------- */
  const SEC = { 1: ["energetyka", "#c92a2a"], 2: ["produkcja i obróbka metali", "#4263eb"], 3: ["przemysł mineralny", "#868e96"], 4: ["przemysł chemiczny", "#ae3ec9"],
    5: ["odpady i ścieki", "#2f9e44"], 6: ["papier i drewno", "#a9743f"], 7: ["hodowla zwierząt", "#f08c00"], 8: ["przetwórstwo spożywcze", "#e8590c"], 9: ["inna działalność", "#495057"] };
  const EPOL = { co2: "dwutlenek węgla CO₂", nox: "tlenki azotu NOx", sox: "tlenki siarki SOx", pm10: "pył PM10", co: "tlenek węgla CO", nh3: "amoniak NH₃", ch4: "metan CH₄",
    n2o: "podtlenek azotu N₂O", nmvoc: "lotne związki organiczne (NMVOC)", hg: "rtęć", benzen: "benzen", wwa: "WWA", dioksyny: "dioksyny i furany", hcl: "chlor (HCl)", hf: "fluor (HF)",
    as: "arsen", cd: "kadm", pb: "ołów", zn: "cynk", ni: "nikiel", cr: "chrom", cu: "miedź", hfc: "HFC", hcfc: "HCFC", hcn: "cyjanowodór" };
  const mass = kg => kg >= 1e9 ? `${fmt(kg / 1e9, 1)} mln t` : kg >= 1e6 ? `${fmt(kg / 1e6, kg >= 1e8 ? 0 : 1)} tys. t` : kg >= 1000 ? `${fmt(kg / 1000, kg >= 1e5 ? 0 : 1)} t` : kg >= 1 ? `${fmt(kg, kg >= 100 ? 0 : 1)} kg` : `${fmt(kg * 1000, 0)} g`;
  function trendSvg(ser, y0) {
    const v = ser.map(x => x == null ? null : x), max = Math.max(...v.filter(x => x != null)); if (!(max > 0)) return "";
    const w = 260, h = 54, bw = w / v.length;
    return `<svg class="ep-trend" viewBox="0 0 ${w} ${h + 14}" role="img" aria-label="Emisja w kolejnych latach">${v.map((x, i) => x == null ? "" : `<rect x="${(i * bw + 1).toFixed(1)}" y="${(h - x / max * h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(1, x / max * h).toFixed(1)}" rx="1.5"></rect>`).join("")}<text x="0" y="${h + 12}">${y0}</text><text x="${w}" y="${h + 12}" text-anchor="end">${y0 + v.length - 1}</text></svg>`;
  }
  function eprtrCard(p, d) {
    const f = (d?.features || []).find(x => x.properties.id === p.id), q = f ? f.properties : p, sec = SEC[q.s] || SEC[9];
    const e = J(q.e), t = J(q.t), y0 = d?.lata?.[0] || 2007;
    const tk = ["co2", "nox", "pm10", "sox"].find(k => t[k]);
    return { title: q.n, src: "EEA, Industrial Reporting under IED and E-PRTR, wersja 16 (luty 2026), licencja CC BY 4.0",
      body: `<p class="gs-st"><i style="background:${sec[1]}"></i>${esc(sec[0])} · działalność ${esc(q.a)} wg załącznika I E-PRTR</p>` + row("Miejscowość", q.m) + row("Rok sprawozdania", q.y) +
        (Object.keys(e).length ? `<table class="gs-tab"><thead><tr><th>Emisja do powietrza w ${q.y} r.</th><th>rocznie</th></tr></thead><tbody>${Object.entries(e).slice(0, 12).map(([k, v]) => `<tr><td>${esc(EPOL[k] || k)}</td><td><b>${esc(mass(v))}</b></td></tr>`).join("")}</tbody></table>` : "<p class=\"muted\">Zakład nie zgłosił emisji do powietrza powyżej progów.</p>") +
        (tk ? `<p class="ext-sub"><b>${esc(EPOL[tk])} w latach ${y0}–${y0 + t[tk].length - 1}</b></p>${trendSvg(t[tk], y0)}` : "") +
        `<p class="muted small">Dane podaje sam zakład, tylko dla substancji powyżej progów rozporządzenia E-PRTR. Mniejsze źródła, jak domowe piece i ruch drogowy, nie są tu ujęte.</p><p>${link("https://industry.eea.europa.eu/", "Europejski portal emisji przemysłowych (EEA)")}</p>` };
  }

  /* ---------- airports, military areas, transmission investments ---------- */
  const AERO = { p: ["port lotniczy", "#1c7ed6"], a: ["lotnisko", "#4dabf7"], w: ["lotnisko wojskowe", "#495057"], l: ["lądowisko lub lotnisko bez kodu ICAO", "#91a7ff"], h: ["lądowisko dla śmigłowców", "#ae3ec9"] };
  const LAW_H = "Obiekty o wysokości od 50 do 100 m zgłasza się Ministrowi Obrony Narodowej najpóźniej 2 miesiące przed osiągnięciem 50 m (Prawo lotnicze, art. 87¹a). Obiekty od 100 m wzwyż są przeszkodami lotniczymi w całym kraju, a w pobliżu lotnisk także niższe obiekty w powierzchniach ograniczających (art. 87).";
  async function lotFetch() {
    const get = u => fetch(u).then(r => { if (!r.ok) throw Error(r.status); return r.json(); });
    const [a, z] = await Promise.all([get("data/lotnictwo/lotniska.geojson"), get("data/lotnictwo/strefy.geojson")]);
    return { type: "FeatureCollection", osm: a.osm, features: [...z.features.map(f => ({ ...f, properties: { ...f.properties, src: "s" } })), ...a.features.map(f => ({ ...f, properties: { ...f.properties, src: "a" } }))] };
  }
  const aeroLinks = `<p>${link("https://dronemap.pansa.pl", "Strefy w przestrzeni powietrznej: DroneMap PAŻP")} · ${link("https://www.ais.pansa.pl/publikacje/aip-polska/", "AIP Polska")} · ${link("https://ulc.gov.pl/pl/lotniska-i-infrastruktura", "lotniska w ULC")}</p>`;
  function lotCard(p) {
    if (p.src === "s") return { title: `${p.n || p.icao}: ${p.s === "i" ? "pozioma powierzchnia ograniczająca" : "stożkowa powierzchnia ograniczająca"} (szacunek)`, src: "Szacunek według ICAO, załącznik 14, z drogi startowej w OpenStreetMap",
      body: `<p class="gs-st"><i style="background:${p.s === "i" ? "#e03131" : "#f08c00"}"></i>${p.s === "i" ? `Zabudowa do około ${p.h} m nad poziomem lotniska` : `Dopuszczalna wysokość rośnie od 45 do około ${p.h} m nad poziomem lotniska`}</p>
        <p>Szacunek dla drogi startowej kodu ${p.cd}. Wysokości liczy się od poziomu lotniska, nie od terenu działki. Wiążące powierzchnie i ograniczenia wysokości podaje zarządzający lotniskiem i Urząd Lotnictwa Cywilnego, a dla lotnisk wojskowych organ wojskowy.</p><p class="muted small">${esc(LAW_H)}</p>` + aeroLinks };
    const t = AERO[p.k] || AERO.l;
    return { title: p.n || t[0], src: "OpenStreetMap (współtwórcy OpenStreetMap, ODbL)",
      body: `<p class="gs-st"><i style="background:${t[1]}"></i>${esc(t[0])}</p>` + row("Kod ICAO", p.icao) + row("Kod IATA", p.iata) + row("Najdłuższa droga startowa", p.rw ? `${fmt(p.rw, 0)} m${p.tw ? ", utwardzona" : ""}` : "") + row("Zarządzający", p.op) +
        (p.www ? `<p>${link(p.www, "Strona lotniska")}</p>` : "") + `<p class="muted small">${esc(LAW_H)}</p>` + aeroLinks };
  }
  const MIL = { t: ["teren wojskowy", "#868e96"], p: ["poligon lub strzelnica", "#e8590c"], c: ["teren ćwiczeń", "#f59f00"], l: ["lotnisko wojskowe", "#495057"], b: ["baza wojskowa", "#5c7cfa"], n: ["obszar niebezpieczny", "#e03131"] };
  const PSE_COL = { b: "#c2255c", p: "#f783ac" };

  /* ---------- waste heat ---------- */
  const WH_K = { o: ["oczyszczalnia ścieków", "drop"], d: ["serwerownia", "hard-drives"], p: ["zakład przemysłowy (E-PRTR)", "factory"] };
  const WH_O = { 1: ["do 2 km od ciepłowni lub sieci", "#2f9e44"], 2: ["2–5 km od ciepłowni lub sieci", "#f59f00"], 3: ["dalej niż 5 km albo gmina bez sieci", "#adb5bd"] };
  const WH_USE = { o: "Ścieki mają przez cały rok 10–20 °C. Pompa ciepła na odpływie z oczyszczalni daje ciepło do sieci niskotemperaturowej, zwykle kilka MW na 100 tys. mieszkańców.",
    d: "Serwerownia oddaje prawie całą pobraną energię elektryczną jako ciepło o temperaturze 25–40 °C. Z pompą ciepła można je oddać do sieci ciepłowniczej.",
    p: "Zakład spala paliwo lub prowadzi procesy wysokotemperaturowe, więc część ciepła trafia do atmosfery. Wielkość emisji CO₂ daje przybliżenie skali." };
  function whCard(p) {
    const k = WH_K[p.k] || WH_K.p, o = WH_O[p.o] || WH_O[3];
    return { title: p.n || k[0], src: p.k === "p" ? "EEA, E-PRTR v16 (CC BY 4.0); ciepłownie: URE; sieć cieplna: GUS BDL" : "OpenStreetMap (ODbL); ciepłownie: URE; sieć cieplna: GUS BDL",
      body: `<p class="gs-st"><i style="background:${o[1]}"></i>${esc(k[0])} · ${esc(o[0])}</p>` + row("Miejscowość", p.m) + row("Operator", p.op) +
        row("Najbliższa ciepłownia lub elektrociepłownia", p.dc != null ? `${fmt(p.dc, 1)} km${p.cr ? ` (${p.cr})` : ""}` : "") +
        row("Najbliższa rura ciepłownicza w OpenStreetMap", p.dr != null && p.dr < 30 ? `${fmt(p.dr, 1)} km` : "") +
        row("Sieć cieplna w gminie", p.s ? `${fmt(p.s, 1)} km` : "brak sieci koncesjonowanej") + row("Emisja CO₂", p.co2 ? `${fmt(p.co2, 0)} t rocznie` : "") +
        `<p>${esc(WH_USE[p.k] || WH_USE.p)}</p><p class="muted small">Odległość liczona w linii prostej. Przebieg rur pokazuje warstwa „Sieć ciepłownicza (GESUT)” po dużym przybliżeniu.</p>` };
  }

  const ytLink = (id, alt) => id ? `<p><a href="https://www.youtube.com/watch?v=${esc(id)}" target="_blank" rel="noopener"><img src="https://img.youtube.com/vi/${esc(id)}/mqdefault.jpg" alt="" loading="lazy" style="width:100%;border-radius:8px"/><br/>Obejrzyj film</a></p>` : alt ? `<p><a href="${alt}" target="_blank" rel="noopener">Kanał na YouTube</a></p>` : "";
  const MSBD = { u: ["w użytkowaniu", "#343a40"], r: ["w realizacji", "#e03131"], p: ["w przetargu", "#2f9e44"], g: ["w przygotowaniu", "#1c7ed6"] };
  const LAYERS = [
    { id: "cieplo", box: "energyLayers", label: "Ciepło odpadowe", desc: "Oczyszczalnie, serwerownie i zakłady blisko sieci ciepłowniczej", kw: "ciepło odpadowe oczyszczalnia ścieków serwerownia data center pompa ciepła ciepłownictwo sieć ciepłownicza ciepło systemowe przemysł e-prtr odzysk ciepła",
      icon: ["thermometer-hot", "#e8590c"], url: "data/energia/cieplo.geojson",
      layers: s => [{ id: "x-cieplo", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "o"], 1, WH_O[1][1], 2, WH_O[2][1], WH_O[3][1]],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "k"], "p", 3.5, 2.5], 12, ["match", ["get", "k"], "p", 8, 6.5]],
          "circle-stroke-color": ["match", ["get", "k"], "o", "#1c7ed6", "d", "#7048e8", "#5c1a1a"], "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 12, 2.2] } },
        { id: "x-cieplo-lbl", type: "symbol", source: s, minzoom: 11, layout: { "text-field": ["coalesce", ["get", "n"], ""], "text-size": 10.5, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#7a2a05", "text-halo-color": "#fff", "text-halo-width": 1.5 } }],
      legend: () => legendRow(Object.values(WH_O).map(([l, c]) => [c, l])) + legendRow([["#1c7ed6", "obwódka: oczyszczalnia ścieków", "ring"], ["#7048e8", "serwerownia", "ring"], ["#5c1a1a", "zakład przemysłowy", "ring"]]) +
        note("Źródła ciepła odpadowego i ich odległość od najbliższej ciepłowni lub elektrociepłowni z koncesją URE albo rury ciepłowniczej z OpenStreetMap. Zielone i żółte leżą w gminach z siecią cieplną (GUS BDL). Oczyszczalnie i serwerownie: OpenStreetMap. Zakłady: E-PRTR bez energetyki, odpadów i hodowli."),
      card: p => whCard(p) },
    { id: "gios", box: "airLayers", label: "Stacje pomiarowe GIOŚ", desc: "Pomiary 2025 na tle norm, link do bieżących danych", kw: "stacje pomiarowe gioś monitoring powietrza pomiary indeks jakości powietrza smog",
      icon: ["broadcast", "#34a383"], url: "data/gios/stacje.json", toGeo: stationsGeo,
      layers: s => [{ id: "x-gios", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "st"], 3, ST_COL[3], 2, ST_COL[2], 1, ST_COL[1], ST_COL[0]], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 7, 14, 9], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
        { id: "x-gios-lbl", type: "symbol", source: s, minzoom: 10, layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#1f5d4c", "text-halo-color": "#fff", "text-halo-width": 1.5 } }],
      legend: () => legendRow([[ST_COL[1], "normy dotrzymane"], [ST_COL[2], "powyżej norm od 2030 r."], [ST_COL[3], "przekroczona norma"], [ST_COL[0], "bez rocznej serii"]]) + note("Kolor według średnich rocznych 2025 z pomiarów stacji. Źródło: GIOŚ, Państwowy Monitoring Środowiska (lista stacji z API PJP, statystyki roczne z Banku danych pomiarowych)."),
      card: (p, d) => ({ title: p.n, body: stationBody(p, d?.rok || 2025), src: "GIOŚ, Państwowy Monitoring Środowiska: lista stacji (API PJP), statystyki roczne 2025 (Bank danych pomiarowych), ocena roczna 2025 (modelowanie)" }) },
    { id: "eprtr", box: "airLayers", label: "Duże źródła emisji (E-PRTR)", desc: "Elektrownie, huty, zakłady i fermy, emisje zgłoszone za 2024 r.", kw: "e-prtr eprtr emisje przemysłowe zakłady elektrownia huta ciepłownia ferma co2 pył tlenki azotu źródła zanieczyszczeń komin",
      icon: ["factory", "#c92a2a"], url: "data/emisje/eprtr.geojson",
      layers: s => {
        const r = k => ["min", 26, ["+", 3, ["*", k, ["sqrt", ["max", ["get", "co2"], ["/", ["get", "nx"], 4000]]]]]];
        return [{ id: "x-eprtr", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "s"], ...Object.entries(SEC).flatMap(([k, v]) => [+k, v[1]]), "#495057"], "circle-opacity": .78,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, r(.11), 10, r(.2), 14, r(.3)], "circle-stroke-color": "#fff", "circle-stroke-width": 1.3 } },
        { id: "x-eprtr-lbl", type: "symbol", source: s, minzoom: 10, layout: { "text-field": ["get", "m"], "text-size": 10.5, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#5c1a1a", "text-halo-color": "#fff", "text-halo-width": 1.5 } }];
      },
      legend: () => legendRow(Object.values(SEC).map(([l, c]) => [c, l])) + note("Wielkość punktu według rocznej emisji CO₂ (gdy jej brak, według tlenków azotu). Ponad 680 zakładów, które zgłosiły emisje za lata 2022–2024. Źródło: Europejska Agencja Środowiska, Industrial Reporting (E-PRTR), wersja 16 z lutego 2026 r., CC BY 4.0."),
      card: (p, d) => eprtrCard(p, d) },
    { id: "canard", box: "transportLayers", label: "Fotoradary i odcinkowy pomiar", desc: "Urządzenia GITD: fotoradary, odcinkowy pomiar prędkości, kamery na czerwonym świetle", kw: "fotoradar fotoradary odcinkowy pomiar prędkości canard gitd czerwone światło kamera przejazd kolejowy mandat prędkość",
      icon: ["gauge", "#e03131"], url: "data/drogi/canard.geojson",
      layers: s => [
        { id: "x-canard-odc", type: "line", source: s, filter: ["==", ["geometry-type"], "LineString"], layout: { "line-cap": "round" }, paint: { "line-color": "#9c36b5", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2, 12, 5], "line-opacity": .8 } },
        { id: "x-canard", type: "circle", source: s, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": ["match", ["get", "k"], "punktowe", "#e03131", "odcinkowy pomiar prędkości", "#9c36b5", "czerwone światło", "#f08c00", "#1c7ed6"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 10, 5.5, 14, 8], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } },
        { id: "x-canard-v", type: "symbol", source: s, minzoom: 11, filter: ["all", ["==", ["geometry-type"], "Point"], ["has", "v"]], layout: { "text-field": ["to-string", ["get", "v"]], "text-size": 11, "text-font": ["Noto Sans Bold"], "text-offset": [0, -1.3], "text-anchor": "bottom", "text-allow-overlap": true }, paint: { "text-color": "#c92a2a", "text-halo-color": "#fff", "text-halo-width": 2 }, noClick: true }],
      legend: () => legendRow([["#e03131", "fotoradar (pomiar punktowy)"], ["#9c36b5", "odcinkowy pomiar prędkości"], ["#f08c00", "przejazd na czerwonym świetle"], ["#1c7ed6", "czerwone światło na przejeździe kolejowym"]]) + note("Stacjonarne urządzenia rejestrujące Inspekcji Transportu Drogowego, stan na 30 czerwca 2026. Bez urządzeń straży miejskich i mobilnych pomiarów policji. Liczba przy punkcie to ograniczenie prędkości w km/h z mapy OpenStreetMap (może być nieaktualne). Przebieg odcinków poprowadzony po drogach OSM. Źródła: GITD, Centrum Automatycznego Nadzoru nad Ruchem Drogowym (CANARD), dane.gov.pl; OpenStreetMap."),
      card: p => ({ title: { "punktowe": "Fotoradar", "odcinkowy pomiar prędkości": "Odcinkowy pomiar prędkości", "czerwone światło": "Kamera na czerwonym świetle", "czerwone światło kolejowe": "Kamera na przejeździe kolejowym" }[p.k] || "Urządzenie rejestrujące", src: "GITD, CANARD (dane.gov.pl), stan na 30.06.2026",
        body: `<p class="gs-st"><i style="background:${{ "punktowe": "#e03131", "odcinkowy pomiar prędkości": "#9c36b5", "czerwone światło": "#f08c00" }[p.k] || "#1c7ed6"}"></i>${esc(p.m || "")}${p.u ? ", " + esc(p.u) : ""}</p>` +
          (p.d ? `<p>Droga ${esc(p.d)}${p.km ? ", km " + esc(p.km) : ""}</p>` : "") + (p.l ? `<p>Długość odcinka ${fmt(p.l / 1000, 1)} km</p>` : "") +
          (p.v ? `<p><b>Ograniczenie prędkości: ${p.v} km/h</b>${p.vv ? ` (na odcinku także ${p.vv.filter(x => x !== p.v).join(", ")} km/h)` : ""}</p><p class="small muted">Limit z mapy OpenStreetMap, może być nieaktualny. Wiążą znaki na drodze.</p>` : "") + `<p class="small muted">${esc(p.t || "")}${p.c ? " · " + esc(p.c) : ""}</p>` }) },
    { id: "msbd", box: "transportLayers", label: "Budowa dróg krajowych (GDDKiA)", desc: "Autostrady, ekspresówki i obwodnice: w użytkowaniu, budowie, przetargu, przygotowaniu", kw: "budowa dróg gddkia mapa stanu budowy dróg autostrada droga ekspresowa obwodnica inwestycje drogowe przetarg realizacja przygotowanie",
      icon: ["road-horizon", "#e03131"], url: "data/drogi/msbd.geojson",
      layers: s => [{ id: "x-msbd", type: "line", source: s, filter: ["!=", ["get", "src"], "schemat"], layout: { "line-cap": "round", "line-join": "round", "line-sort-key": ["match", ["get", "s"], "u", 0, 1] },
        paint: { "line-color": ["match", ["get", "s"], "r", MSBD.r[1], "p", MSBD.p[1], "g", MSBD.g[1], MSBD.u[1]], "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "s"], "u", 1.2, 2.5], 10, ["match", ["get", "s"], "u", 3, 5]], "line-opacity": .9 } },
        { id: "x-msbd-sch", type: "line", source: s, filter: ["==", ["get", "src"], "schemat"], layout: { "line-cap": "round", "line-join": "round", "line-sort-key": ["match", ["get", "s"], "u", 0, 1] },
        paint: { "line-color": ["match", ["get", "s"], "r", MSBD.r[1], "p", MSBD.p[1], "g", MSBD.g[1], MSBD.u[1]], "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "s"], "u", 1.2, 2.5], 10, ["match", ["get", "s"], "u", 3, 5]], "line-opacity": .9, "line-dasharray": [2, 1.5] } }],
      legend: () => legendRow(Object.values(MSBD).map(([l, c]) => [c, l, "line"])) + note("Stan według Mapy Stanu Budowy Dróg GDDKiA. Przebieg dociągnięty do dróg z BDOT10k (GUGiK) lub OpenStreetMap. Odcinki jeszcze niezbudowane, których nie ma w żadnym z nich, pokazano schematycznie (linia przerywana, dokładność 1–2 km). Nazwy i terminy odcinków podaje GDDKiA."),
      card: p => { const t = MSBD[p.s] || MSBD.u; return { title: (p.t === "A" ? "Autostrada" : p.t === "S" ? "Droga ekspresowa" : "Droga krajowa") + ": " + t[0], src: "GDDKiA, Mapa Stanu Budowy Dróg (gov.pl)",
        body: `<p class="gs-st"><i style="background:${t[1]}"></i>${esc(t[0])}</p><p><a href="https://www.gov.pl/web/gddkia/msbd" target="_blank" rel="noopener">Lista odcinków i szczegóły w GDDKiA</a></p><p class="muted small">${p.src === "schemat" ? "Przebieg schematyczny według GDDKiA, dokładność 1–2 km." : "Przebieg według " + (p.src === "bdot" ? "BDOT10k (GUGiK)" : "OpenStreetMap") + "."}</p>` }; } },
    { id: "mapa-drogowa", box: "transportLayers", label: "Mapa drogowa na osi czasu", desc: "Drogi, kolej i decyzje drogowe, suwak lat 2023–2032", kw: "mapa drogowa oś czasu harmonogram kiedy otwarcie drogi kolej inwestycje suwak lat zrid plan",
      icon: ["calendar-dots", "#2b8a3e"], url: "mapa-drogowa", fetch: mdFetch, side: "data/drogi/gddkia.json", side2: ["mapa-drogowa-k", "data/kolej/kolejplus.json"],
      layers: s => [
        { id: "x-md-p", type: "line", source: s, filter: mdFilters(mdYear)["x-md-p"], layout: { "line-cap": "round" }, paint: { "line-color": "#7048e8", "line-dasharray": [1.6, 1.4], "line-opacity": .85, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 12, 3.5] } },
        { id: "x-md-b", type: "line", source: s, filter: mdFilters(mdYear)["x-md-b"], layout: { "line-cap": "round" }, paint: { "line-color": "#d9480f", "line-opacity": .9, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.3, 12, 4] } },
        { id: "x-md-open", type: "line", source: s, filter: mdFilters(mdYear)["x-md-open"], layout: { "line-cap": "round" }, paint: { "line-color": MD_OPEN, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 2, 12, 5.5] } },
        { id: "x-md-z", type: "circle", source: s, minzoom: 6, filter: mdFilters(mdYear)["x-md-z"], paint: { "circle-color": ["match", ["get", "z"], 1, "#e8590c", "#f59f00"], "circle-opacity": .85, "circle-radius": 3, "circle-stroke-color": "#fff", "circle-stroke-width": 1 } }],
      legend: mdLegend,
      legendInit: box => { const r = box.querySelector("#md-range"); if (r) r.oninput = () => mdApply(+r.value); mdApply(mdYear); },
      card: (p, d, f, side) => p.src === "z" ? zridCard(p) : p.src === "k" ? railCard(p, d, sideData["mapa-drogowa-k"]) : roadCard(p, d, side) },
    { id: "lotniska", box: "limitLayers", label: "Lotniska i ograniczenia wysokości", desc: "Lotniska, lądowiska i orientacyjne strefy wokół dróg startowych", kw: "lotnisko lotniska lądowisko port lotniczy ograniczenie wysokości przeszkody lotnicze powierzchnie ograniczające wiatrak komin maszt ulc",
      icon: ["airplane-tilt", "#1c7ed6"], url: "lotniska", fetch: lotFetch, fillClick: true,
      layers: s => [
        { id: "x-lot-c", type: "fill", source: s, filter: ["all", ["==", ["get", "src"], "s"], ["==", ["get", "s"], "c"]], paint: { "fill-color": "#f08c00", "fill-opacity": .12 } },
        { id: "x-lot-i", type: "fill", source: s, filter: ["all", ["==", ["get", "src"], "s"], ["==", ["get", "s"], "i"]], paint: { "fill-color": "#e03131", "fill-opacity": .13 } },
        { id: "x-lot-ol", type: "line", source: s, filter: ["==", ["get", "src"], "s"], paint: { "line-color": ["match", ["get", "s"], "i", "#e03131", "#f08c00"], "line-width": 1, "line-dasharray": [2, 2], "line-opacity": .7 }, noClick: true },
        { id: "x-lot-a", type: "circle", source: s, filter: ["==", ["get", "src"], "a"], paint: { "circle-color": ["match", ["get", "k"], ...Object.entries(AERO).flatMap(([k, v]) => [k, v[1]]), "#91a7ff"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "k"], "p", 6, "a", 4.5, "w", 4.5, 3], 12, ["match", ["get", "k"], "p", 11, 8]], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
        { id: "x-lot-lbl", type: "symbol", source: s, minzoom: 8, filter: ["==", ["get", "src"], "a"], layout: { "text-field": ["coalesce", ["get", "n"], ""], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#164a7a", "text-halo-color": "#fff", "text-halo-width": 1.5 } }],
      legend: () => legendRow(Object.values(AERO).map(([l, c]) => [c, l])) + legendRow([["#e03131", "pozioma powierzchnia (około 45 m nad lotniskiem)", "box"], ["#f08c00", "powierzchnia stożkowa (do 100 m)", "box"]]) +
        note("Strefy są szacunkiem według ICAO (załącznik 14) z długości drogi startowej, tylko dla lotnisk z kodem ICAO. Wiążące są powierzchnie ograniczające z rejestracji lotniska w ULC. Strefy przestrzeni powietrznej (zakazane, ograniczone, niebezpieczne, TSA) publikuje PAŻP na mapie DroneMap i w AIP, bez otwartego pliku danych. Źródło lotnisk: OpenStreetMap.") + aeroLinks,
      card: p => lotCard(p) },
    { id: "wojsko", box: "limitLayers", label: "Tereny wojskowe", desc: "Tereny zamknięte, poligony, strzelnice, lotniska wojskowe", kw: "teren wojskowy wojsko poligon strzelnica teren zamknięty jednostka wojskowa baza obszar niebezpieczny",
      icon: ["shield-warning", "#495057"], url: "data/lotnictwo/wojsko.geojson", fillClick: true,
      layers: s => [
        { id: "x-woj-f", type: "fill", source: s, paint: { "fill-color": ["match", ["get", "k"], ...Object.entries(MIL).flatMap(([k, v]) => [k, v[1]]), "#868e96"], "fill-opacity": .22 } },
        { id: "x-woj-l", type: "line", source: s, paint: { "line-color": ["match", ["get", "k"], ...Object.entries(MIL).flatMap(([k, v]) => [k, v[1]]), "#868e96"], "line-width": ["interpolate", ["linear"], ["zoom"], 6, .6, 13, 2], "line-dasharray": [3, 1.5] }, noClick: true }],
      legend: () => legendRow(Object.values(MIL).map(([l, c]) => [c, l, "box"])) + note("Obszary co najmniej 2 ha według OpenStreetMap. Granice terenów zamkniętych ustala Minister Obrony Narodowej, a wiążące dane ma starostwo (ewidencja gruntów i budynków). Na terenie zamkniętym plan ogólny i plan miejscowy nie obowiązują."),
      card: p => { const t = MIL[p.k] || MIL.t; return { title: p.n || t[0], src: "OpenStreetMap (współtwórcy OpenStreetMap, ODbL)",
        body: `<p class="gs-st"><i style="background:${t[1]}"></i>${esc(t[0])}</p>` + row("Powierzchnia", p.ha ? `${fmt(p.ha, 0)} ha` : "") +
          `<p class="muted small">Granice według OpenStreetMap są orientacyjne. Czy działka leży na terenie zamkniętym, potwierdza wypis z ewidencji gruntów w starostwie. Budowa w sąsiedztwie poligonu może wymagać uzgodnienia z organem wojskowym.</p>` }; } },
    { id: "yt-drogi", img: "img/autostrady-polska.png", box: "youtubeLayers", label: "Ciekawostki drogowe", desc: "Dziwne drogi, mosty, przejazdy i nazwy z serii kanału Autostrady Polska", kw: "ciekawostki drogowe youtube autostrady polska droga most brod prom przejazd kolejowy granica dziwna nazwa pomnik film",
      icon: ["road-horizon", "#212529"], url: "data/youtube/ciekawostki.geojson",
      layers: s => [{ id: "x-yt-drogi", type: "circle", source: s, paint: { "circle-color": ["concat", "#", ["get", "c"]], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 7, 14, 9], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } },
        { id: "x-yt-drogi-lbl", type: "symbol", source: s, minzoom: 10, layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 14 }, paint: { "text-color": "#343a40", "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => legendRow([["#000000", "droga"], ["#0288D1", "woda"], ["#795548", "kolej"], ["#0097A7", "pomniki"], ["#FFEA00", "kolej i woda"], ["#673AB7", "granica"], ["#0F9D58", "przyroda"], ["#FF5252", "dziwna nazwa"], ["#F9A825", "inne"], ["#1A237E", "zagraniczne"]]) + note("Miejsca z serii „Ciekawostki drogowe”, odcinki 1–14. Za zgodą autora. Źródło: kanał Autostrady Polska (YouTube), mapa w Moich Mapach Google."),
      card: p => ({ title: p.n, src: "Autostrady Polska (YouTube), za zgodą autora",
        body: `<p class="gs-st"><i style="background:#${esc(p.c || "000000")}"></i>${esc(p.k || "ciekawostka")}${p.o ? ` · odcinek ${esc(p.o)}` : ""}</p>` + (p.opis ? `<p>${esc(p.opis)}</p>` : "") + ytLink(p.yt, "https://www.youtube.com/c/AutostradyPolska1978") }) },
    { id: "yt-legendy", box: "youtubeLayers", label: "Legendy polskiego YouTube", desc: "Miejsca słynnych scen z polskich filmów na YouTube", kw: "legendy polskiego youtube memy słynne sceny filmy youtuberzy miejsca kultowe nagrania",
      icon: ["film-strip", "#e03131"], url: "data/youtube/legendy.geojson",
      layers: s => [{ id: "x-yt-leg", type: "circle", source: s, paint: { "circle-color": "#fa5252", "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 7, 14, 9], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } },
        { id: "x-yt-leg-lbl", type: "symbol", source: s, minzoom: 10, layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 14 }, paint: { "text-color": "#a61e1e", "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => note("Miejsca, w których nagrano słynne sceny z polskich filmów na YouTube, i miejsca związane z ich bohaterami. Za zgodą autora. Źródło: mapa „Legendy Polskiego YouTube” w Moich Mapach Google."),
      card: p => ({ title: p.n, src: "„Legendy Polskiego YouTube” (Moje Mapy Google), za zgodą autora",
        body: (p.opis ? `<p>${esc(p.opis)}</p>` : "") + ytLink(p.yt) }) },
    { id: "zanikle", box: "urbexLayers", label: "Wsie bez mieszkańców", desc: "Miejscowości z urzędową nazwą, w których w spisie 2021 nikt nie mieszkał", kw: "zanikłe wsie wymarłe wsie miejscowości bez mieszkańców wyludnienie opuszczone wsie spis 2021 nsp prng",
      icon: ["house-line", "#6741d9"], url: "data/zanikle/puste.geojson",
      layers: s => [
        { id: "x-zanikle", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "r"], "wieś", "#6741d9", "#b197fc"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3.5, 10, 6, 14, 8], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } },
        { id: "x-zanikle-lbl", type: "symbol", source: s, minzoom: 9, layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#4b2c9e", "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => legendRow([["#6741d9", "wieś"], ["#b197fc", "osada, kolonia, przysiółek"]]) + note("Miejscowość z Państwowego Rejestru Nazw Geograficznych leży w obwodzie spisowym, w którym w NSP 2021 nie spisano żadnego mieszkańca. To dolne oszacowanie: pusta wieś w jednym obwodzie z zamieszkaną się tu nie pojawi. Źródła: GUGiK, PRNG; GUS, Narodowy Spis Powszechny 2021 (ludność w obwodach spisowych)."),
      card: p => ({ title: p.n, src: "GUGiK, PRNG; GUS, NSP 2021 (obwody spisowe)",
        body: `<p class="gs-st"><i style="background:${p.r === "wieś" ? "#6741d9" : "#b197fc"}"></i>${esc(p.r || "miejscowość")} · gmina ${esc(p.g || "")}</p><p>W spisie 2021 nikt tu nie mieszkał, ale nazwa wciąż jest urzędowa.</p>` }) },
    { id: "zabytki", box: "heritageLayers", label: "Rejestr zabytków", desc: "Zabytki nieruchome wpisane do rejestru: kościoły, dwory, parki, kamienice", kw: "zabytki rejestr zabytków nieruchome kościół pałac dwór park zabytkowy konserwator nid ochrona konserwatorska kamienica",
      icon: ["castle-turret", "#a61e4d"], vtiles: "data/zabytki/zabytki.pmtiles", attr: "NID, rejestr zabytków; PRG GUGiK",
      layers: s => [
        { id: "x-zabytki", type: "circle", source: s, "source-layer": "rejestr", paint: { "circle-color": ["case", ["==", ["get", "q"], "a"], "#a61e4d", "#e599b4"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 1.6, 10, 3.5, 14, 7], "circle-stroke-color": "#fff", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0, 10, 1] } },
        { id: "x-zabytki-lbl", type: "symbol", source: s, "source-layer": "rejestr", minzoom: 15, layout: { "text-field": ["get", "n"], "text-size": 10.5, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.1], "text-anchor": "top", "text-max-width": 11 }, paint: { "text-color": "#7a1238", "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => legendRow([["#a61e4d", "położenie wg adresu"], ["#e599b4", "położenie przybliżone (środek miejscowości)"]]) + note("Obiekty wpisane do rejestru zabytków nieruchomych. Wpis oznacza, że budowa, rozbiórka i większość prac wymaga pozwolenia wojewódzkiego konserwatora zabytków. NID nie podaje współrzędnych, więc punkt ustalono z adresu (PRG) albo, gdy adresu brak, w środku miejscowości. Obszarowe wpisy (układy urbanistyczne, parki) są pokazane jako punkt. Źródła: Narodowy Instytut Dziedzictwa (dane.gov.pl), GUGiK PRG."),
      card: p => ({ title: p.n || "Zabytek", src: "Narodowy Instytut Dziedzictwa (dane.gov.pl)",
        body: `<p class="gs-st"><i style="background:${p.q === "a" ? "#a61e4d" : "#e599b4"}"></i>Rejestr zabytków${p.f ? ", " + esc(p.f) : ""}</p>` + (p.c ? `<p>${esc(p.c)}</p>` : "") + (p.m ? `<p class="small">${esc(p.m)}${p.q === "a" ? "" : " · położenie przybliżone"}</p>` : "") +
          `<p>${link("https://zabytek.pl/pl/obiekty/zabytek?inspire_id=PL.1.9.ZIPOZ." + p.i + "&rejestr=rejestr-zabytkow", "Opis w zabytek.pl")}</p>` }) },
    { id: "archeo", box: "heritageLayers", label: "Stanowiska archeologiczne", desc: "Rejestr zabytków archeologicznych: grodziska, kurhany, osady, cmentarzyska", kw: "archeologia stanowiska archeologiczne grodzisko kurhan osada cmentarzysko azp zabytki archeologiczne rejestr nid badania",
      icon: ["shovel", "#8a5a2b"], vtiles: "data/zabytki/zabytki.pmtiles", attr: "NID, rejestr zabytków; PRG GUGiK",
      layers: s => [{ id: "x-archeo", type: "circle", source: s, "source-layer": "archeo", paint: { "circle-color": "#b5651d", "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2, 10, 4, 14, 7], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } }],
      legend: () => note("Stanowiska wpisane do rejestru zabytków archeologicznych. Prace ziemne w ich obrębie wymagają pozwolenia konserwatora i zwykle badań archeologicznych na koszt inwestora. NID podaje tylko miejscowość, więc punkt stoi w jej środku, a dokładne położenie trzeba sprawdzić u konserwatora. Stanowisk spoza rejestru (ewidencja AZP) NID nie udostępnia. Źródła: Narodowy Instytut Dziedzictwa (dane.gov.pl), GUGiK PRG."),
      card: p => ({ title: p.n || "Stanowisko archeologiczne", src: "Narodowy Instytut Dziedzictwa (dane.gov.pl)",
        body: `<p class="gs-st"><i style="background:#b5651d"></i>${esc(p.f || "stanowisko archeologiczne")}</p>` + (p.c ? `<p>${esc(p.c)}</p>` : "") + (p.z ? `<p class="small">AZP ${esc(p.z)} · położenie przybliżone</p>` : "") +
          `<p>${link("https://zabytek.pl/pl/obiekty/zabytek?inspire_id=PL.1.9.ZIPOZ." + p.i + "&rejestr=rejestr-zabytkow", "Opis w zabytek.pl")}</p>` }) },
    { id: "grodziska", box: "heritageLayers", label: "Grodziska i kurhany", desc: "Grodziska, kurhany, megality i inne stanowiska archeologiczne z OpenStreetMap", kw: "grodzisko grodziska gród kurhan kurhany megality cmentarzysko osada archeologia słowianie wczesne średniowiecze wały",
      icon: ["mountains", "#8a5a2b"], url: "data/zabytki/grodziska.geojson",
      layers: s => [
        { id: "x-grodziska", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "k"], "g", "#8a5a2b", "k", "#2b8a3e", "#868e96"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2.5, 10, 5.5, 14, 9], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } },
        { id: "x-grodziska-lbl", type: "symbol", source: s, minzoom: 11, layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#5c3d1e", "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => legendRow([["#8a5a2b", "grodzisko"], ["#2b8a3e", "kurhan, megality, cmentarzysko"], ["#868e96", "inne stanowisko (osada, kopalnia)"]]) + note("Stanowiska oznaczone w OpenStreetMap, także spoza rejestru zabytków. Dla zabytków objętych ochroną prawną włącz warstwę „Stanowiska archeologiczne” (rejestr NID). Źródło: OpenStreetMap (licencja ODbL)."),
      card: p => ({ title: p.n || ({ g: "Grodzisko", k: "Kurhan" }[p.k] || "Stanowisko archeologiczne"), src: "OpenStreetMap (ODbL)",
        body: `<p class="gs-st"><i style="background:${{ g: "#8a5a2b", k: "#2b8a3e" }[p.k] || "#868e96"}"></i>${{ g: "grodzisko", k: "kurhan, megality, cmentarzysko" }[p.k] || "stanowisko archeologiczne"}${p.e ? ", " + esc(p.e) : ""}</p>` + (p.w ? `<p>${link("https://pl.wikipedia.org/wiki/" + encodeURIComponent((p.w.split(":").slice(1).join(":") || p.w).replace(/ /g, "_")), "Wikipedia")}</p>` : "") + `<p class="small">${link(p.o, "Obiekt w OpenStreetMap")}</p>` }) },
    { id: "pomniki", box: "heritageLayers", label: "Pomniki historii i UNESCO", desc: "Najcenniejsze zabytki Polski: pomniki historii i lista światowego dziedzictwa", kw: "pomnik historii unesco światowe dziedzictwo zabytki najcenniejsze zamek katedra kopalnia soli",
      icon: ["bank", "#c08b00"], url: "data/zabytki/pomniki.geojson",
      layers: s => [
        { id: "x-pomniki", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "k"], "un", "#1c7ed6", "#c08b00"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 7, 14, 10], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } },
        { id: "x-pomniki-lbl", type: "symbol", source: s, minzoom: 10, layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 14 }, paint: { "text-color": "#5c3d00", "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => legendRow([["#c08b00", "pomnik historii"], ["#1c7ed6", "lista światowego dziedzictwa UNESCO"]]) + note("Pomniki historii ustanawia Prezydent RP, listę UNESCO prowadzi Komitet Światowego Dziedzictwa. Źródło: Narodowy Instytut Dziedzictwa (dane.gov.pl)."),
      card: p => ({ title: p.n, src: "Narodowy Instytut Dziedzictwa (dane.gov.pl)",
        body: `<p class="gs-st"><i style="background:${p.k === "un" ? "#1c7ed6" : "#c08b00"}"></i>${p.k === "un" ? "Światowe dziedzictwo UNESCO" : "Pomnik historii"}${p.d ? ", wpis " + esc(p.d) : ""}</p>` +
          (p.o ? `<p>${esc(p.o)}</p>` : "") + (p.r ? `<p>${esc(p.r)}</p>` : "") + (p.m ? `<p class="small">${esc(p.m)}</p>` : "") +
          (p.u ? `<p>${link(p.u, "Opis w zabytek.pl")}</p>` : "") }) },
    { id: "ulice-dl", box: "curioLayers", label: "Najdłuższe i najkrótsze ulice", desc: "Najdłuższe ulice jako ciągły odcinek i najkrótsze ulice w gminie, według osi ulic z PRG", kw: "najdłuższa ulica w polsce długość ulicy aleja ranking ciekawostki prg",
      icon: ["road-horizon", "#e8590c"], url: "data/granice/daleko.geojson",
      layers: s => [{ id: "x-ulice-dl", type: "line", source: s, filter: ["==", ["get", "k"], "u"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#e8590c", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 6] } },
        { id: "x-ulice-kr", type: "circle", source: s, filter: ["==", ["get", "k"], "k"], paint: { "circle-color": "#1098ad", "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 14, 9], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } }],
      legend: () => note("Ulica to wszystkie odcinki o tej samej nazwie w gminie. Najdłuższe: najdłuższy ciągły przejazd ulicą, bez doliczania odgałęzień. Najkrótsze: cała ulica w gminie ma tylko tyle (od 10 m, krótsze to zwykle błędy w danych). Bez autostrad i dróg ekspresowych. Źródło: GUGiK PRG (osie ulic), obliczenia własne."),
      rank: d => [{ t: "Najdłuższe", c: "#e8590c", items: d.features.filter(x => P(x).k === "u").map(x => [P(x).n, P(x).d / 1000, "km", XY(x), P(x).m + (P(x).g !== P(x).m ? ", gm. " + P(x).g : ""), 12]) },
        { t: "Najkrótsze", c: "#1098ad", items: d.features.filter(x => P(x).k === "k").map(x => [P(x).n, P(x).d, "m", XY(x), P(x).m + (P(x).g !== P(x).m ? ", gm. " + P(x).g : ""), 18]) }],
      card: p => p.k === "k" ? ({ title: p.n, src: "GUGiK PRG (obliczenia własne)", body: `<p class="gs-st"><i style="background:#1098ad"></i>Tylko <b>${fmt(p.d, 1)} m</b> długości</p><p>${esc(p.m)}${p.g !== p.m ? ", gm. " + esc(p.g) : ""}</p>` }) : p.k === "u" ? ({ title: p.n, src: "GUGiK PRG (obliczenia własne)", body: `<p class="gs-st"><i style="background:#e8590c"></i><b>${fmt(p.d / 1000, 1)} km</b> długości</p><p>${esc(p.m)}${p.g !== p.m ? ", gm. " + esc(p.g) : ""}</p>` }) : null },
    { id: "urzad-daleko", gmina: true, box: "curioLayers", label: "Najdalej do urzędu gminy", desc: "Wsie najbardziej oddalone od urzędu swojej gminy i gminy o najdłuższej średniej drodze do urzędu", kw: "najdalej do urzędu gminy odległość wieś urząd gminy daleko ciekawostki prng",
      icon: ["bank", "#5f3dc4"], url: "data/granice/daleko.geojson",
      layers: s => [
        { id: "x-urz-l", type: "line", source: s, filter: ["==", ["get", "k"], "w"], paint: { "line-color": "#5f3dc4", "line-width": 2.5, "line-dasharray": [2, 1.5] } },
        { id: "x-urz-p", type: "circle", source: s, filter: ["==", ["get", "k"], "s"], paint: { "circle-color": "#9775fa", "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 11, 9], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } }],
      legend: () => legendRow([["#5f3dc4", "wieś i urząd jej gminy (w linii prostej)", "dash"], ["#9775fa", "urzędy gmin, do których wsie mają średnio najdalej"]]) + note("Odległość w linii prostej od punktu wsi do siedziby urzędu. Źródło: GUGiK PRNG (wsie), Katalog Podmiotów Publicznych gov.pl (adresy urzędów), obliczenia własne."),
      rank: d => { const f = d.features; return [
        { t: "Najdalsze wsie", c: "#5f3dc4", items: f.filter(x => P(x).k === "w").map(x => [P(x).n, P(x).d, "km", x.geometry.coordinates[0], "gm. " + P(x).g, 12]) },
        { t: "Średnio najdalej", c: "#9775fa", items: f.filter(x => P(x).k === "s").map(x => [P(x).n, P(x).d, "km", XY(x), `${P(x).c} wsi, najdalsza ${fmt(P(x).x, 1)} km`, 10]) }]; },
      card: p => p.k === "w" ? ({ title: p.n, src: "GUGiK PRNG, KAPP gov.pl (obliczenia własne)", body: `<p class="gs-st"><i style="background:#5f3dc4"></i><b>${fmt(p.d, 1)} km</b> do urzędu gminy</p><p>${esc(p.u)}</p>` })
        : p.k === "s" ? ({ title: "Gmina " + p.n, src: "GUGiK PRNG, KAPP gov.pl (obliczenia własne)", body: `<p class="gs-st"><i style="background:#9775fa"></i>Średnio <b>${fmt(p.d, 1)} km</b> z wsi do urzędu</p><p>${p.c} wsi, najdalsza ${fmt(p.x, 1)} km</p>` }) : null },
    { id: "rekordy-granic", gmina: true, box: "curioLayers", label: "Rekordy granic gmin", desc: "Najdłuższe i najkrótsze granice między dwiema gminami oraz gminy z największą liczbą sąsiadów", kw: "najkrótsza granica gmin najdłuższa granica sąsiedzi gminy liczba sąsiadów rekord ciekawostki prg",
      icon: ["arrows-left-right", "#c2255c"], url: "data/granice/rekordy.geojson",
      layers: s => [
        { id: "x-rek-l", type: "line", source: s, filter: ["==", ["get", "k"], "L"], layout: { "line-cap": "round" }, paint: { "line-color": "#c2255c", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3, 11, 6], "line-opacity": .85 } },
        { id: "x-rek-pt", type: "circle", source: s, filter: ["in", ["get", "k"], ["literal", ["S", "N"]]], paint: { "circle-color": ["match", ["get", "k"], "S", "#f08c00", "#1971c2"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 12, 10], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
        { id: "x-rek-lbl", type: "symbol", source: s, filter: ["==", ["get", "k"], "N"], layout: { "text-field": ["to-string", ["get", "c"]], "text-size": 10, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true }, paint: { "text-color": "#fff" }, noClick: true }],
      legend: () => legendRow([["#c2255c", "najdłuższe granice między dwiema gminami", "line"], ["#f08c00", "najkrótsze granice (czasem krótsze niż metr)"], ["#1971c2", "gminy z największą liczbą sąsiadów"]]) + note("Długość wspólnej granicy dwóch gmin liczona z PRG. Najkrótsze granice to miejsca, gdzie gminy stykają się prawie w jednym punkcie. Źródło: GUGiK PRG, obliczenia własne."),
      rank: d => { const f = d.features; return [
        { t: "Najkrótsze", c: "#f08c00", items: f.filter(x => P(x).k === "S").map(x => [P(x).a + " / " + P(x).b, P(x).m, "m", XY(x), "", 19]) },
        { t: "Najdłuższe", c: "#c2255c", items: f.filter(x => P(x).k === "L").map(x => [P(x).a + " / " + P(x).b, P(x).m / 1000, "km", XY(x), "", 10]) },
        { t: "Najwięcej sąsiadów", c: "#1971c2", items: f.filter(x => P(x).k === "N").map(x => [P(x).a, P(x).c, "gmin", XY(x), "", 10]) }]; },
      card: p => p.k === "N" ? ({ title: p.a, src: "GUGiK PRG (obliczenia własne)", body: `<p class="gs-st"><i style="background:#1971c2"></i>Graniczy z <b>${p.c}</b> gminami</p>` })
        : ({ title: p.a + " / " + p.b, src: "GUGiK PRG (obliczenia własne)", body: `<p class="gs-st"><i style="background:${p.k === "S" ? "#f08c00" : "#c2255c"}"></i>Wspólna granica: <b>${p.k === "S" ? fmt(p.m, 1) + " m" : fmt(p.m / 1000, 1) + " km"}</b></p>` }) },
    { id: "bud-rekordy", box: "curioLayers", label: "Rekordy budynków", desc: "Największe, najwyższe, najdłuższe i najmniejsze budynki w Polsce oraz największy budynek każdej gminy", kw: "największy budynek w polsce najwyższy budynek kondygnacje najmniejszy dom najdłuższy budynek hala rekord ciekawostki bdot",
      icon: ["buildings", "#5f3dc4"], url: "data/granice/bud_rekordy.geojson",
      layers: s => [{ id: "x-budrek-g", type: "circle", source: s, minzoom: 8, filter: ["==", ["get", "k"], "G"], paint: { "circle-color": "#b197fc", "circle-radius": 5, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } },
        { id: "x-budrek", type: "circle", source: s, filter: ["!=", ["get", "k"], "G"], paint: { "circle-color": ["match", ["get", "k"], "A", "#5f3dc4", "N", "#c2255c", "L", "#e8590c", "B", "#1971c2", "#0ca678"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 12, 10], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } }],
      legend: () => legendRow([["#5f3dc4", "największa powierzchnia zabudowy"], ["#c2255c", "najwięcej kondygnacji"], ["#e8590c", "najdłuższe"], ["#1971c2", "najdłuższe bloki mieszkalne"], ["#0ca678", "najmniejsze domy (od 8 m²)"], ["#b197fc", "największy budynek gminy (od zoomu 8)"]]) + note("Powierzchnia rzutu budynku i liczba kondygnacji według BDOT10k. Najmniejsze domy to budynki jedno- i wielorodzinne w użyciu, od 8 m², mniejsze to zwykle błędy. Budynki od 3 kondygnacji, które przylegają do siebie i mają tyle samo kondygnacji, liczę jako jeden budynek: blok z kilkoma klatkami, falowiec, superjednostka. Długość to najdłuższy odcinek prosty w obrysie. Źródło: GUGiK BDOT10k, obliczenia własne."),
      rank: d => { const f = d.features, r = (k, t, c, u) => ({ t, c, items: f.filter(x => P(x).k === k).map(x => [P(x).f + (P(x).nz ? ": " + P(x).nz : ""), P(x).v, u, XY(x), P(x).g, 16]) });
        return [r("A", "Największe", "#5f3dc4", "m²"), r("N", "Najwyższe", "#c2255c", "kond."), r("L", "Najdłuższe", "#e8590c", "m"), r("B", "Najdłuższe bloki", "#1971c2", "m"), r("S", "Najmniejsze domy", "#0ca678", "m²")]; },
      card: p => ({ title: p.nz || p.f, src: "GUGiK BDOT10k (obliczenia własne)", body: `<p class="gs-st"><i style="background:#5f3dc4"></i>${{ A: "Powierzchnia zabudowy", N: "Liczba kondygnacji", L: "Długość", B: "Długość", S: "Powierzchnia zabudowy", G: "Największy budynek gminy" }[p.k]}: <b>${fmt(p.v, p.v < 20 && p.v % 1 ? 1 : 0)} ${{ N: "", L: "m", B: "m" }[p.k] ?? "m²"}</b></p>${p.c > 1 ? `<p>Złożony z ${p.c} przylegających części o tej samej wysokości</p>` : ""}<p>${esc(p.f)}${p.n ? `, ${p.n} kondygnacji` : ""}${p.a ? `, ${fmt(p.a, 0)} m²` : ""}</p><p>Gmina ${esc(p.g)}</p>` }) },
    { id: "bud-wysokie", box: "curioLayers", label: "Wieżowce, wielkie hale i najgęstsze km²", desc: "Budynki od 15 kondygnacji, hale od 2 ha i kilometry kwadratowe z największą liczbą budynków", kw: "wieżowce wieżowiec wysokie budynki bloki hale magazyny logistyczne najgęściej zabudowany kilometr ciekawostki bdot",
      icon: ["buildings", "#c2255c"], url: "data/granice/bud_wysokie.geojson",
      layers: s => [{ id: "x-budw-k", type: "fill", source: s, filter: ["==", ["get", "k"], "K"], paint: { "fill-color": "#f08c00", "fill-opacity": .45, "fill-outline-color": "#e8590c" } },
        { id: "x-budw", type: "circle", source: s, filter: ["!=", ["get", "k"], "K"], paint: { "circle-color": ["match", ["get", "k"], "W", "#c2255c", "#1971c2"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2.5, 12, 8], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } }],
      legend: () => legendRow([["#c2255c", "budynki od 15 kondygnacji"], ["#1971c2", "magazyny i hale produkcyjne od 2 ha"], ["#f08c00", "60 kilometrów kwadratowych z największą liczbą budynków", "box"]]) + note("Kondygnacje i powierzchnia rzutu według BDOT10k. Siatka 1 km w układzie PL-1992. Wiele najgęstszych kilometrów to ogródki działkowe z altanami. Źródło: GUGiK BDOT10k, obliczenia własne."),
      rank: d => { const f = d.features, r = (t, c, flt, v, u, nm) => ({ t, c, items: f.filter(flt).sort((a, b) => v(b) - v(a)).slice(0, 40).map(x => [nm(x), v(x), u, XY(x), P(x).f || "", 15]) });
        return [r("Najwyższe", "#c2255c", x => P(x).k === "W", x => P(x).n, "kond.", x => P(x).nz || P(x).f), r("Największe hale", "#1971c2", x => P(x).k === "H", x => P(x).a / 10000, "ha", x => P(x).nz || P(x).f),
          r("Najgęstsze km²", "#f08c00", x => P(x).k === "K", x => P(x).b, "bud.", x => `${P(x).r}. kilometr (${fmt(P(x).m, 0)} mieszkalnych)`)]; },
      card: p => p.k === "K" ? ({ title: `${p.r}. najgęściej zabudowany km²`, src: "GUGiK BDOT10k (obliczenia własne)", body: `<p class="gs-st"><i style="background:#f08c00"></i><b>${fmt(p.b, 0)}</b> budynków na 1 km², w tym ${fmt(p.m, 0)} mieszkalnych</p>` })
        : ({ title: p.nz || p.f, src: "GUGiK BDOT10k (obliczenia własne)", body: `<p class="gs-st"><i style="background:${p.k === "W" ? "#c2255c" : "#1971c2"}"></i>${p.n ? `<b>${p.n}</b> kondygnacji, ` : ""}<b>${fmt(p.a, 0)} m²</b> rzutu</p><p>${esc(p.f)}</p>` }) },
    { id: "bud-las-wyspy", box: "curioLayers", label: "Domy w głębi lasu i na wyspach", desc: "Budynki mieszkalne najdalej od skraju lasu oraz wyspy na jeziorach i rzekach, na których ktoś mieszka", kw: "dom w lesie najgłębiej w lesie leśniczówka wyspa zamieszkana dom na wyspie jezioro ciekawostki bdot",
      icon: ["tree", "#2b8a3e"], url: "data/granice/bud_las_wyspy.geojson",
      layers: s => [{ id: "x-blw-w", type: "fill", source: s, filter: ["==", ["get", "k"], "W"], paint: { "fill-color": "#1c7ed6", "fill-opacity": .45, "fill-outline-color": "#1864ab" } },
        { id: "x-blw-l", type: "circle", source: s, filter: ["==", ["get", "k"], "L"], paint: { "circle-color": "#2b8a3e", "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 12, 10], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } }],
      fillClick: true,
      legend: () => legendRow([["#2b8a3e", "dom najdalej od skraju lasu"], ["#1c7ed6", "zamieszkana wyspa", "box"]]) + note("Odległość budynku mieszkalnego od najbliższego skraju lasu (BDOT10k, tereny leśne), bliskie domy liczone raz. Wyspy to dziury w wodach powierzchniowych BDOT10k z co najmniej jednym budynkiem mieszkalnym. Źródło: GUGiK BDOT10k, obliczenia własne."),
      rank: d => { const f = d.features; return [{ t: "Najgłębiej w lesie", c: "#2b8a3e", items: f.filter(x => P(x).k === "L").map(x => [P(x).f, P(x).d, "m", XY(x), "gm. " + P(x).g, 15]) },
        { t: "Wyspy z domami", c: "#1c7ed6", items: f.filter(x => P(x).k === "W").slice(0, 50).map(x => [P(x).n, P(x).c, "dom.", P(x).x, fmt(P(x).a / 10000, 1) + " ha", 15]) }]; },
      card: p => p.k === "L" ? ({ title: "Dom w głębi lasu", src: "GUGiK BDOT10k (obliczenia własne)", body: `<p class="gs-st"><i style="background:#2b8a3e"></i><b>${fmt(p.d, 0)} m</b> do skraju lasu</p><p>${esc(p.f)}, gm. ${esc(p.g)}</p>` })
        : ({ title: "Wyspa: " + p.n, src: "GUGiK BDOT10k (obliczenia własne)", body: `<p class="gs-st"><i style="background:#1c7ed6"></i><b>${p.c}</b> budynków mieszkalnych</p><p>Powierzchnia ${fmt(p.a / 10000, 1)} ha</p>` }) },
    { id: "granice-bud", showGmina: true, fillClick: true, box: "curioLayers", label: "Budynki przecięte granicą", desc: "Domy, hale i garaże, przez które biegnie granica gmin, powiatów lub województw", kw: "granica gminy przecina budynek dom na granicy dwie gminy podzielony budynek powiat województwo ciekawostki prg bdot",
      icon: ["buildings", "#d6336c"], url: "data/granice/budynki.geojson",
      layers: s => [
        { id: "x-granbud-f", type: "fill", source: s, filter: ["has", "o"], minzoom: 13, paint: { "fill-color": ["match", ["get", "l"], "w", "#c2255c", "p", "#f76707", "#fab005"], "fill-opacity": .55 } },
        { id: "x-granbud", type: "circle", source: s, filter: ["!", ["has", "o"]], maxzoom: 15, paint: { "circle-color": ["match", ["get", "l"], "w", "#c2255c", "p", "#f76707", "#fab005"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "l"], "g", 2.5, 4], 10, 6], "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } }],
      legend: () => legendRow([["#c2255c", "granica województw"], ["#f76707", "granica powiatów"], ["#fab005", "granica gmin"]]) + note("Budynki z BDOT10k, które granica gminy z PRG dzieli tak, że w każdej gminie leży co najmniej 5% budynku i 5 m². Część przypadków to niedokładność granic lub obrysów, a nie prawdziwy podział. Taki budynek płaci podatek i ma adres w gminie, w której leży działka. Źródło: GUGiK (BDOT10k, PRG), obliczenia własne."),
      rank: d => { const f = d.features.filter(x => !P(x).o); return [
        { t: "Największe", c: "#d6336c", items: top(f, x => P(x).a, 12).map(x => [(P(x).f || "budynek") + ": " + P(x).g.map(g => g[0]).join(" / "), P(x).a, "m²", XY(x), P(x).n, 17]) },
        { t: "Granica województw", c: "#c2255c", items: top(f.filter(x => P(x).l === "w"), x => P(x).a, 31).map(x => [P(x).g.map(g => g[0]).join(" / "), P(x).a, "m²", XY(x), P(x).f, 17]) },
        { t: "Pół na pół", c: "#f76707", items: top(f.filter(x => (P(x).g || []).length > 1), x => -Math.abs(P(x).g[0][1] - 50) * 1e6 + P(x).a, 12).map(x => [P(x).g.map(g => g[0] + " " + g[1] + "%").join(" / "), P(x).a, "m²", XY(x), P(x).f, 17]) }]; },
      card: p => ({ title: p.n || (p.f ? p.f[0].toUpperCase() + p.f.slice(1) : "Budynek") + " na granicy", src: "GUGiK: BDOT10k, PRG (obliczenia własne)",
        body: `<p class="gs-st"><i style="background:${{ w: "#c2255c", p: "#f76707" }[p.l] || "#fab005"}"></i>Granica ${{ w: "województw", p: "powiatów" }[p.l] || "gmin"}</p>` +
          (p.g || []).map(g => `<p>${esc(g[0])}: <b>${g[1]}%</b> budynku</p>`).join("") + `<p class="small">${p.a ? fmt(p.a, 0) + " m²" : ""}${p.k ? " · kondygnacji: " + esc(p.k) : ""}${p.x ? " · " + esc(p.x) : ""}</p>` }) },
    { id: "proste", box: "curioLayers", label: "Najdłuższe proste drogi i tory", desc: "Ranking najdłuższych prostych odcinków dróg i linii kolejowych w Polsce", kw: "najdłuższa prosta droga tor kolejowy prosty odcinek rekord ranking autostrada linia kolejowa ciekawostki bdot",
      icon: ["ruler", "#1971c2"], url: "data/granice/proste.geojson",
      layers: s => [
        { id: "x-proste", type: "line", source: s, layout: { "line-cap": "round" }, paint: { "line-color": ["match", ["get", "t"], "t", "#5f3dc4", "#1971c2"], "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["case", ["<=", ["get", "r"], 10], 4, 2.5], 12, 7], "line-opacity": .85 } },
        { id: "x-proste-lbl", type: "symbol", source: s, minzoom: 7, layout: { "symbol-placement": "line-center", "text-field": ["concat", ["to-string", ["get", "km"]], " km"], "text-size": 11, "text-font": ["Noto Sans Bold"] }, paint: { "text-color": ["match", ["get", "t"], "t", "#5f3dc4", "#1971c2"], "text-halo-color": "#fff", "text-halo-width": 2 }, noClick: true }],
      legend: () => legendRow([["#1971c2", "droga (60 najdłuższych prostych)"], ["#5f3dc4", "tor kolejowy (30 najdłuższych)"]]) + note("Prosta to odcinek, który odbiega od linii łączącej jego końce najwyżej o 5 m, a na łączeniach zmienia kierunek o mniej niż 1°. Liczone z dróg i torów BDOT10k, jezdnie równoległe liczone raz. Źródło: GUGiK BDOT10k, obliczenia własne."),
      rank: d => { const f = d.features; return [
        { t: "Drogi", c: "#1971c2", items: f.filter(x => P(x).t === "d").slice(0, 15).map(x => [P(x).n ? P(x).n.split("|")[0] : P(x).c, P(x).km, "km", XY(x), P(x).s || P(x).m, 12]) },
        { t: "Tory", c: "#5f3dc4", items: f.filter(x => P(x).t === "t").slice(0, 15).map(x => ["linia " + (P(x).n || "?"), P(x).km, "km", XY(x), P(x).s, 12]) }]; },
      card: p => ({ title: `${p.r}. ${p.t === "t" ? "najdłuższy prosty tor" : "najdłuższa prosta droga"}: ${fmt(p.km, 1)} km`, src: "GUGiK BDOT10k (obliczenia własne)",
        body: `<p class="gs-st"><i style="background:${p.t === "t" ? "#5f3dc4" : "#1971c2"}"></i>${esc(p.c || "")}${p.n ? " · " + esc(p.t === "t" ? "linia " + p.n : p.n.replace(/\|/g, ", ")) : ""}</p>` + (p.s ? `<p>${esc(p.s)}</p>` : "") + (p.m ? `<p class="small">${esc(p.m)}</p>` : "") }) },
    { id: "odludzia", box: "curioLayers", label: "Odludzia i samotne domy", desc: "Miejsca najdalej od asfaltu, od budynków i od domów w każdym województwie, najbardziej samotne domy", kw: "odludzie najdalej od drogi asfaltu budynku pustkowie samotny dom najbardziej odludne miejsce dzicz ciekawostki",
      icon: ["tree", "#2b8a3e"], url: "data/granice/odludzia.geojson",
      layers: s => [{ id: "x-odludzia", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "k"], "a", "#2b8a3e", "b", "#0b7285", "m", "#7048e8", "#e8590c"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["case", ["==", ["get", "pl"], true], 9, ["==", ["get", "k"], "s"], 3.5, 6], 11, 10], "circle-stroke-color": ["case", ["==", ["get", "pl"], true], "#000", "#fff"], "circle-stroke-width": ["case", ["==", ["get", "pl"], true], 2.5, 1.5] } }],
      legend: () => legendRow([["#2b8a3e", "najdalej od drogi utwardzonej (w każdym województwie)"], ["#0b7285", "najdalej od jakiegokolwiek budynku (w każdym województwie)"], ["#7048e8", "najdalej od budynku mieszkalnego (w każdym województwie)"], ["#e8590c", "50 najbardziej samotnych domów mieszkalnych"]]) + note("Czarna obwódka to rekord Polski. Droga utwardzona to asfalt, beton, kostka, płyty i bruk. Odległości liczone z BDOT10k, więc pomijają drogi i budynki, których tam brak. Źródło: GUGiK BDOT10k, PRG, PRNG, obliczenia własne."),
      rank: d => { const f = d.features; return [
        { t: "Od asfaltu", c: "#2b8a3e", items: top(f.filter(x => P(x).k === "a"), x => P(x).d, 16).map(x => [P(x).w, P(x).d / 1000, "km", XY(x), P(x).m && "koło: " + P(x).m, 12]) },
        { t: "Od budynków", c: "#0b7285", items: top(f.filter(x => P(x).k === "b"), x => P(x).d, 16).map(x => [P(x).w, P(x).d / 1000, "km", XY(x), P(x).m && "koło: " + P(x).m, 12]) },
        { t: "Od domów", c: "#7048e8", items: top(f.filter(x => P(x).k === "m"), x => P(x).d, 16).map(x => [P(x).w, P(x).d / 1000, "km", XY(x), P(x).m && "koło: " + P(x).m, 12]) },
        { t: "Samotne domy", c: "#e8590c", items: top(f.filter(x => P(x).k === "s"), x => P(x).d, 15).map(x => [P(x).m + ", gm. " + P(x).g, P(x).d, "m", XY(x), P(x).f, 16]) }]; },
      card: p => ({ title: p.k === "s" ? `${p.r}. najbardziej samotny dom` : ({ a: "Najdalej od asfaltu", b: "Najdalej od budynków", m: "Najdalej od domów" }[p.k]) + (p.pl ? " w Polsce" : ", woj. " + p.w), src: "GUGiK BDOT10k, PRNG (obliczenia własne)",
        body: `<p class="gs-st"><i style="background:${{ a: "#2b8a3e", b: "#0b7285", m: "#7048e8" }[p.k] || "#e8590c"}"></i><b>${fmtD(p.d)}</b> ${p.k === "a" ? "do najbliższej drogi utwardzonej" : p.k === "m" ? "do najbliższego budynku mieszkalnego" : "do najbliższego budynku"}</p>` + (p.f ? `<p>${esc(p.f)}, ${p.a} m²</p>` : "") + (p.m ? `<p>Najbliższa miejscowość: ${esc(p.m)}${p.md != null ? " (" + fmtD(p.md) + ")" : ""}, gm. ${esc(p.g || "")}</p>` : "") }) },
    { id: "wysokosci", gmina: true, box: "curioLayers", label: "Najwyżej i najniżej w gminie", desc: "Najwyższy i najniższy punkt każdej gminy z wysokością", kw: "najwyższy punkt gminy najniższy punkt szczyt wysokość n.p.m. depresja góra wzniesienie ciekawostki dem",
      icon: ["mountains", "#5c940d"], url: "data/granice/wysokosci.geojson",
      layers: s => [
        { id: "x-wysokosci", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "k"], "max", "#5c940d", "#1971c2"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2.5, 10, 6], "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } },
        { id: "x-wysokosci-lbl", type: "symbol", source: s, minzoom: 9, layout: { "text-field": ["concat", ["to-string", ["round", ["get", "h"]]], " m"], "text-size": 11, "text-font": ["Noto Sans Bold"], "text-offset": [0, -1.2], "text-anchor": "bottom" }, paint: { "text-color": ["match", ["get", "k"], "max", "#2b8a3e", "#1864ab"], "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => legendRow([["#5c940d", "najwyższy punkt gminy"], ["#1971c2", "najniższy punkt gminy"]]) + note("Wysokość z modelu Copernicus DEM (siatka 30 m). To model powierzchni terenu z pokryciem, więc w lasach i miastach najwyższym punktem może być korona drzew albo dach, a nad wodą zdarzają się wartości poniżej zera. Wynik przybliżony, do ±10 m. Źródło: Copernicus DEM GLO-30 (ESA), granice gmin GUGiK PRG."),
      rank: d => { const f = d.features; return [
        { t: "Najwyżej", c: "#5c940d", items: top(f.filter(x => P(x).k === "max"), x => P(x).h, 15).map(x => [P(x).n, Math.round(P(x).h), "m", XY(x), "", 13]) },
        { t: "Najniżej", c: "#1971c2", items: top(f.filter(x => P(x).k === "min"), x => P(x).h, 15, true).map(x => [P(x).n, Math.round(P(x).h), "m", XY(x), "", 13]) },
        { t: "Najbardziej płaskie", c: "#868e96", items: top(f.filter(x => P(x).k === "max"), x => P(x).d, 15, true).map(x => [P(x).n, Math.round(P(x).d), "m różnicy", XY(x), "", 11]) },
        { t: "Największa różnica", c: "#e67700", items: top(f.filter(x => P(x).k === "max"), x => P(x).d, 15).map(x => [P(x).n, Math.round(P(x).d), "m różnicy", XY(x), "", 11]) }]; },
      card: p => ({ title: (p.k === "max" ? "Najwyższy punkt: " : "Najniższy punkt: ") + p.n, src: "Copernicus DEM GLO-30 (ESA), PRG",
        body: `<p class="gs-st"><i style="background:${p.k === "max" ? "#5c940d" : "#1971c2"}"></i><b>${fmt(p.h, 0)} m n.p.m.</b></p><p>Różnica wysokości w gminie: ${fmt(p.d, 0)} m</p><p class="small muted">Model 30 m, wynik przybliżony</p>` }) },
    { id: "wezly", showGmina: true, box: "curioLayers", label: "Trójstyki granic", desc: "Punkty, w których schodzą się 3 lub 4 gminy, powiaty albo województwa", kw: "trójstyk czwórstyk granice gmin powiatów województw punkt styku granica ciekawostki prg",
      icon: ["crosshair", "#5f3dc4"], url: "data/granice/wezly.geojson",
      layers: s => [{ id: "x-wezly", type: "circle", source: s, filter: ["any", ["!=", ["get", "l"], "g"], [">=", ["zoom"], 9], [">=", ["get", "n"], 4]], paint: { "circle-color": ["match", ["get", "l"], "w", "#c2255c", "p", "#f76707", "#7950f2"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "l"], "w", 5, "p", 2.5, 2], 11, ["match", ["get", "l"], "w", 9, "p", 6, 5]], "circle-stroke-color": ["case", [">=", ["get", "n"], 4], "#000", "#fff"], "circle-stroke-width": ["case", [">=", ["get", "n"], 4], 2.5, 1.2] } }],
      legend: () => legendRow([["#c2255c", "trójstyk województw (19)"], ["#f76707", "trójstyk powiatów (625)"], ["#7950f2", "trójstyk gmin, widoczny od zoomu 9"]]) + note("Punkty, w których stykają się granice trzech gmin. Czarna obwódka to czwórstyk: 6 miejsc w Polsce, gdzie spotykają się cztery gminy. Źródło: GUGiK PRG, obliczenia własne."),
      rank: d => { const f = d.features; return [
        { t: "Czwórstyki", c: "#000000", items: f.filter(x => P(x).n >= 4).map(x => [P(x).g.join(" / "), P(x).n, "gminy", XY(x), "", 14]) },
        { t: "Województw", c: "#c2255c", items: f.filter(x => P(x).l === "w").map(x => [P(x).g.join(" / "), 3, "gminy", XY(x), "", 13]) }]; },
      card: p => ({ title: (p.n >= 4 ? "Czwórstyk" : "Trójstyk") + " " + ({ w: "województw", p: "powiatów" }[p.l] || "gmin"), src: "GUGiK PRG (obliczenia własne)",
        body: `<p class="gs-st"><i style="background:${{ w: "#c2255c", p: "#f76707" }[p.l] || "#7950f2"}"></i>Spotykają się ${p.n} gminy</p>` + (p.g || []).map(g => `<p>${esc(g)}</p>`).join("") }) },
    { id: "enklawy", gmina: true, fillClick: true, box: "curioLayers", label: "Enklawy i eksklawy gmin", desc: "Gminy otoczone przez jedną gminę i części gmin oderwane od reszty", kw: "enklawa eksklawa gmina otoczona oderwana część gminy obwarzanek granice ciekawostki prg",
      icon: ["target", "#0b7285"], url: "data/granice/enklawy.geojson",
      layers: s => [
        { id: "x-eksklawy", type: "fill", source: s, filter: ["==", ["get", "e"], "eks"], paint: { "fill-color": "#0b7285", "fill-opacity": .45, "fill-outline-color": "#0b7285" } },
        { id: "x-dziw", type: "fill", source: s, filter: ["all", ["==", ["get", "e"], "dziw"], ["==", ["geometry-type"], "Polygon"]], paint: { "fill-color": "#d6336c", "fill-opacity": .6, "fill-outline-color": "#a61e4d" } },
        { id: "x-dziw-pt", type: "circle", source: s, filter: ["any", ["==", ["get", "e"], "dziwp"], ["all", ["==", ["get", "e"], "dziw"], ["==", ["geometry-type"], "Point"]]], maxzoom: 13, paint: { "circle-color": "#d6336c", "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 11, 9], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
        { id: "x-enklawy", type: "circle", source: s, filter: ["==", ["get", "e"], "enk"], paint: { "circle-color": "#15aabf", "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 11, 8], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } }],
      legend: () => legendRow([["#d6336c", "najdziwniejsze: kawałek gminy w środku innej, obcej gminy", "box"], ["#15aabf", "enklawa: gmina w całości otoczona jedną gminą"], ["#0b7285", "eksklawa: część gminy oderwana od reszty", "box"]]) + note("Enklawy to najczęściej miasta otoczone gminą wiejską o tej samej nazwie. Eksklawy liczone od 1 ha. Źródło: GUGiK PRG, obliczenia własne."),
      rank: d => { const f = d.features; return [
        { t: "Najdziwniejsze", c: "#d6336c", items: top(f.filter(x => P(x).e === "dziw"), x => P(x).a, 30).map(x => [P(x).n + " w gm. " + P(x).s, P(x).a, "ha", XY(x), P(x).b > 0 ? P(x).b + " bud." : "", 14]) },
        { t: "Enklawy", c: "#15aabf", items: top(f.filter(x => P(x).e === "enk"), x => P(x).a, 20).map(x => [P(x).n + " w gm. " + P(x).s, P(x).a, "km²", XY(x), P(x).t, 11]) },
        { t: "Eksklawy", c: "#0b7285", items: top(f.filter(x => P(x).e === "eks"), x => P(x).a, 20).map(x => [P(x).n, P(x).a, "ha", XY(x), P(x).t, 13]) }]; },
      card: p => p.e === "dziw" || p.e === "dziwp" ? ({ title: p.n + " w gminie " + p.s, src: "GUGiK PRG, BDOT10k, PRNG (obliczenia własne)", body: `<p class="gs-st"><i style="background:#d6336c"></i>Najdziwniejsza enklawa</p><p>${esc(p.o)}</p>` }) : p.e === "enk" ? ({ title: p.n, src: "GUGiK PRG (obliczenia własne)", body: `<p class="gs-st"><i style="background:#15aabf"></i>Enklawa, ${esc(p.t || "")}</p><p>W całości otoczona przez gminę ${esc(p.s)}</p><p class="small">${fmt(p.a, 1)} km²</p>` })
        : ({ title: p.n, src: "GUGiK PRG (obliczenia własne)", body: `<p class="gs-st"><i style="background:#0b7285"></i>Eksklawa, ${esc(p.t || "")}</p><p>Oderwana część gminy, ${fmt(p.a, 1)} ha</p>${p.c > 1 ? `<p class="small">Gmina ma ${p.c} oderwanych części</p>` : ""}` }) },
    { id: "ksztalty", gmina: true, box: "curioLayers", label: "Kształty gmin: rekordy", desc: "Najbardziej okrągłe, najbardziej poszarpane i najbardziej wydłużone gminy", kw: "kształt gminy najbardziej okrągła zwarta poszarpana wydłużona granice ranking ciekawostki",
      icon: ["map-pin", "#2f9e44"], url: "data/granice/ksztalty.geojson",
      layers: s => [{ id: "x-ksztalty", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "k"], "zw", "#2f9e44", "po", "#e8590c", "#1971c2"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 6, 10, 10], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } },
        { id: "x-ksztalty-lbl", type: "symbol", source: s, layout: { "text-field": ["to-string", ["get", "r"]], "text-size": 10, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true }, paint: { "text-color": "#fff" }, noClick: true }],
      legend: () => legendRow([["#2f9e44", "najbardziej zwarte, blisko koła (15)"], ["#e8590c", "najbardziej poszarpane granice (15)"], ["#1971c2", "najbardziej wydłużone (15)"]]) + note("Zwartość to wskaźnik Polsby-Popper: 4π·powierzchnia/obwód², gdzie 1 oznacza koło. Wydłużenie to stosunek boków najmniejszego prostokąta, w który wpisuje się gmina. Liczba w kółku to miejsce w rankingu. Źródło: GUGiK PRG, obliczenia własne."),
      rank: d => { const f = d.features, s = (k, c, t, v, u) => ({ t, c, items: f.filter(x => P(x).k === k).map(x => [P(x).n, v(x), u, XY(x), P(x).t, 11]) }); return [
        s("zw", "#2f9e44", "Najbardziej okrągłe", x => P(x).pp, ""), s("po", "#e8590c", "Najbardziej poszarpane", x => P(x).pp, ""), s("wy", "#1971c2", "Najbardziej wydłużone", x => P(x).el, ": 1")]; },
      card: p => ({ title: p.n, src: "GUGiK PRG (obliczenia własne)", body: `<p class="gs-st"><i style="background:${{ zw: "#2f9e44", po: "#e8590c" }[p.k] || "#1971c2"}"></i>${p.r}. miejsce: ${{ zw: "najbardziej zwarta", po: "najbardziej poszarpana", wy: "najbardziej wydłużona" }[p.k]}</p><p>Zwartość ${fmt(p.pp, 2)} (koło = 1)</p><p>Wydłużenie ${fmt(p.el, 2)} : 1</p><p class="small">${esc(p.t || "")}</p>` }) },
    { id: "ulice-granica", showGmina: true, box: "curioLayers", label: "Ulice na granicy gmin", desc: "Ulice, których jedna strona leży w innej gminie niż druga", kw: "ulica na granicy gmin dwie gminy jedna ulica druga strona ulicy inna gmina adres granica ciekawostki",
      icon: ["path", "#c2255c"], url: "data/granice/ulice_granica.geojson",
      layers: s => [
        { id: "x-ulgr-l", type: "line", source: s, filter: ["==", ["get", "z"], "b"], layout: { "line-cap": "round" }, paint: { "line-color": "#c2255c", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2, 14, 6], "line-opacity": .8 } },
        { id: "x-ulgr", type: "circle", source: s, filter: ["==", ["get", "z"], "a"], paint: { "circle-color": "#f06595", "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2.5, 12, 7], "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } }],
      legend: () => legendRow([["#f06595", "ulica z adresami w dwóch gminach (punkty adresowe po obu stronach granicy)"], ["#c2255c", "droga biegnąca granicą gmin (co najmniej 150 m)"]]) + note("Mieszkańcy takiej ulicy mają różne urzędy gmin, podatki i często kody pocztowe. Źródło: GUGiK PRG (granice, punkty adresowe), BDOT10k, obliczenia własne."),
      rank: d => { const f = d.features; return [
        { t: "Najwięcej adresów", c: "#f06595", items: top(f.filter(x => P(x).z === "a"), x => P(x).a[0] + P(x).a[1], 15).map(x => ["ul. " + P(x).u, P(x).a[0] + P(x).a[1], "adr.", XY(x), P(x).g.join(" / "), 16]) },
        { t: "Najdłużej granicą", c: "#c2255c", items: top(f.filter(x => P(x).z === "b"), x => P(x).m, 15).map(x => [P(x).u, P(x).m / 1000, "km", XY(x), P(x).g.join(" / "), 13]) }]; },
      card: p => ({ title: "ul. " + p.u, src: "GUGiK PRG, BDOT10k (obliczenia własne)", body: `<p class="gs-st"><i style="background:${p.z === "a" ? "#f06595" : "#c2255c"}"></i>Na granicy gmin</p>` + (p.g || []).map((g, i) => `<p>${esc(g)}${p.a ? `: ${p.a[i]} adresów przy granicy` : ""}</p>`).join("") + (p.m ? `<p class="small">Granicą biegnie ${fmtD(p.m)} drogi</p>` : "") }) },
    { id: "nazwy-msc", box: "curioLayers", label: "Nazwy miejscowości: rekordy", desc: "Najdłuższe, najkrótsze i wieloczłonowe nazwy, najczęstsze nazwy i imienniczki gmin", kw: "nazwy miejscowości najdłuższa nazwa najkrótsza nazwa nowa wieś dąbrowa zalesie najczęstsza nazwa wieś prng ciekawostki",
      icon: ["map-pin", "#862e9c"], url: "data/granice/nazwy.geojson",
      layers: s => [
        { id: "x-nazwy", type: "circle", source: s, filter: ["!=", ["get", "k"], "gm"], paint: { "circle-color": ["match", ["get", "k"], "dl", "#862e9c", "kr", "#e64980", "cz", "#5c940d", "#adb5bd"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "k"], "cz10", 2.5, 4.5], 11, 8], "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } },
        { id: "x-nazwy-gm", type: "circle", source: s, minzoom: 8, filter: ["==", ["get", "k"], "gm"], paint: { "circle-color": "#fab005", "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3, 12, 6], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } },
        { id: "x-nazwy-lbl", type: "symbol", source: s, minzoom: 10, filter: ["!=", ["get", "k"], "gm"], layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 14 }, paint: { "text-color": "#5f3dc4", "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => legendRow([["#862e9c", "25 najdłuższych nazw"], ["#e64980", "25 najkrótszych nazw"], ["#5c940d", "25 nazw o największej liczbie członów"], ["#adb5bd", "10 najczęstszych nazw (każde wystąpienie)"], ["#fab005", "wieś o nazwie gminy z innego powiatu (od zoomu 8)"]]) + note("Urzędowe nazwy miejscowości bez części miejscowości. Najczęstsze nazwy: Nowa Wieś, Dąbrowa, Zalesie, Dąbrówka, Podlesie. Źródło: GUGiK PRNG, obliczenia własne."),
      rank: d => { const f = d.features, s = (k, c, t, v, u, lab) => ({ t, c, items: f.filter(x => P(x).k === k).map(x => [lab ? lab(x) : P(x).n, v(x), u, XY(x), P(x).o + ", gm. " + P(x).g, 13]) });
        const cz = {}; f.filter(x => P(x).k === "cz10").forEach(x => { cz[P(x).n] = cz[P(x).n] || x; });
        return [s("dl", "#862e9c", "Najdłuższe", x => P(x).c, "znaków"), s("kr", "#e64980", "Najkrótsze", x => P(x).c, "znaki"), s("cz", "#5c940d", "Najwięcej członów", x => P(x).s, "członów"),
          { t: "Najczęstsze", c: "#868e96", items: Object.values(cz).sort((a, b) => P(a).r - P(b).r).map(x => [P(x).n, P(x).x, "razy", XY(x), "kliknij nazwę na mapie, by zobaczyć wszystkie", 7]) }]; },
      card: p => ({ title: p.n, src: "GUGiK PRNG (obliczenia własne)", body: `<p class="gs-st"><i style="background:${{ dl: "#862e9c", kr: "#e64980", cz: "#5c940d", gm: "#fab005" }[p.k] || "#adb5bd"}"></i>${{ dl: `${p.r}. najdłuższa nazwa (${p.c} znaków)`, kr: `${p.r}. najkrótsza nazwa (${p.c} znaki)`, cz: `${p.r}. miejsce: ${p.s} członów`, cz10: `${p.r}. najczęstsza nazwa, ${p.x} miejscowości w Polsce`, gm: "Nosi nazwę gminy, która leży gdzie indziej" }[p.k]}</p><p>${esc(p.o || "")}, gm. ${esc(p.g || "")}</p><p class="small">woj. ${esc(p.w || "")}</p>` }) },
    { id: "nazwy-tem", box: "curioLayers", label: "Nazwy miejscowości: tematy", desc: "Wsie o nazwach zwierząt, jedzenia, kolorów i krajów, śmieszne nazwy, liczebniki, pary Nowa i Stara, Huty, Wole, osady leśne, dawne nazwy", kw: "nazwy miejscowości zwierzęta jedzenie kolory kraje świata ameryka paryż rzym śmieszne nazwy pupki swornegacie wąchock liczebniki nowa stara huta wola wólka osada leśna dawna nazwa niemiecka nazwa historyczna ta sama nazwa samogłoski ż ź ś prng ciekawostki",
      icon: ["map-pin", "#0c8599"], url: "data/granice/nazwy_tem.geojson",
      layers: s => [
        { id: "x-nazwy-tem", type: "circle", source: s, filter: ["==", ["get", "k"], ntCur["x-nazwy-tem"]], paint: { "circle-color": ["match", ["get", "k"], ...Object.entries(NTK).flatMap(([k, v]) => [k, v[1]]), "#868e96"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3.5, 11, 8], "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } },
        { id: "x-nazwy-tem-lbl", type: "symbol", source: s, minzoom: 8, filter: ["==", ["get", "k"], ntCur["x-nazwy-tem"]], layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.1], "text-anchor": "top" }, paint: { "text-color": "#0b7285", "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => `<select class="bud-metric" onchange="NazwySel('x-nazwy-tem',this.value)">${Object.entries(NTK).map(([k, v]) => `<option value="${k}"${k === ntCur["x-nazwy-tem"] ? " selected" : ""}>${v[0]}</option>`).join("")}</select>` + note("Nazwy urzędowe wsi, miast, osad i kolonii, dobrane po rdzeniu słowa, więc część ma inne pochodzenie (Psary to dawna osada psiarzy). Pary Nowa i Stara leżą w tej samej gminie. Ta sama nazwa najbliżej: dwie wsie o jednej nazwie w sąsiednich gminach. Dawne nazwy to zapis w PRNG, zwykle nazwy niemieckie sprzed 1945 r. Źródło: GUGiK PRNG, obliczenia własne."),
      rank: d => { const f = d.features, s = (k, v, u, sub, sort) => { let L = f.filter(x => P(x).k === k); if (sort) L.sort(sort); return { t: NTK[k][0], c: NTK[k][1], items: L.slice(0, 300).map(x => [P(x).n, v(x), u, XY(x), sub(x), 12]) }; }, g = x => "gm. " + P(x).g + ", woj. " + P(x).w;
        return [s("bl", x => P(x).d, "km", x => "druga w gm. " + P(x).t, (a, b) => P(a).d - P(b).d), s("fu", () => "", "", g), s("sw", () => "", "", g), s("ns", x => P(x).d, "km", x => "para: " + P(x).t, (a, b) => P(b).d - P(a).d), s("sa", x => P(x).d, "liter", g), s("sz", x => P(x).d, "× ż/ź/ś", g), s("je", () => "", "", g), s("li", () => "", "", g)]; },
      card: p => ({ title: p.n, src: "GUGiK PRNG (obliczenia własne)", body: `<p class="gs-st"><i style="background:${(NTK[p.k] || [])[1]}"></i>${(NTK[p.k] || [""])[0]}</p>${p.k === "bl" ? `<p>Wieś o tej samej nazwie w gm. ${esc(p.t)}, ${fmt(p.d, 2)} km stąd</p>` : ""}${p.k === "ns" ? `<p>Para: ${esc(p.t)}, ${fmt(p.d, 1)} km stąd</p>` : ""}${p.h ? `<p>Dawne nazwy: <b>${esc(p.h)}</b></p>` : ""}<p>${esc(p.o || "")}, gm. ${esc(p.g || "")}</p><p class="small">woj. ${esc(p.w || "")}</p>` }) },
    { id: "nazwy-suf", box: "curioLayers", label: "Końcówki nazw wsi", desc: "Mapa wsi według końcówki nazwy: -ice, -owo, -ów, -in, -no, -isko, -ki, -y", kw: "końcówki nazw wsi ice owo ów in dialekt nazewnictwo mapa nazw osadnictwo patronimiczne prng ciekawostki",
      icon: ["map-pin", "#5f3dc4"], url: "data/granice/nazwy_sufiksy.geojson",
      layers: s => [{ id: "x-nazwy-suf", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "s"], ...NSUF.flatMap(r => [r[0], r[1]]), "#868e96"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 1.6, 10, 5], "circle-opacity": .8 } }],
      legend: () => `<select class="bud-metric" onchange="NazwySuf(this.value)"><option value="">wszystkie końcówki</option>${NSUF.map(r => `<option value="${r[0]}">${r[2]}</option>`).join("")}</select>` + legendRow(NSUF.map(r => [r[1], r[2]])) + note("Jednowyrazowe nazwy wsi. Na zachodzie i północy więcej -owo i -in, na południu -ice i -ów, na wschodzie -ki i -y. Źródło: GUGiK PRNG, obliczenia własne."),
      card: p => ({ title: p.n, src: "GUGiK PRNG", body: `<p class="gs-st"><i style="background:${(NSUF.find(r => r[0] === p.s) || [])[1]}"></i>Końcówka ${(NSUF.find(r => r[0] === p.s) || [])[2]}</p>` }) },
    { id: "ulice-tem", box: "curioLayers", label: "Nazwy ulic: tematy", desc: "Patroni ulic, ulice kwiatowe i owocowe, miesiące, Krótka dłuższa niż Długa, Warszawska najdalej od Warszawy, najdłuższe nazwy", kw: "nazwy ulic patron jana pawła ii piłsudskiego mickiewicza kościuszki sienkiewicza kwiatowa różana owocowa wiśniowa 3 maja 11 listopada krótka długa warszawska krakowska najdłuższa nazwa ulicy najpopularniejsze ulice polna leśna prg ciekawostki",
      icon: ["road-horizon", "#c2255c"], url: "data/granice/ulice_tem.geojson",
      layers: s => [
        { id: "x-ulice-tem", type: "circle", source: s, filter: ["==", ["get", "k"], ntCur["x-ulice-tem"]], paint: { "circle-color": ["case", ["==", ["get", "k"], "pt"], ["match", ["get", "p"], ...UPAT.flatMap((r, i) => [i, r[1]]), "#868e96"], ["==", ["get", "k"], "bo"], ["match", ["get", "p"], 0, "#e64980", "#f08c00"], ["match", ["get", "k"], ...Object.entries(UTK).flatMap(([k, v]) => [k, v[1]]), "#868e96"]], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "k"], "pt", 2.2, "bo", 2.2, "mi", 3, 5], 11, 7], "circle-stroke-color": "#fff", "circle-stroke-width": ["match", ["get", "k"], "pt", 0.4, "bo", 0.4, 1.4] } },
        { id: "x-ulice-tem-lbl", type: "symbol", source: s, minzoom: 9, filter: ["==", ["get", "k"], ntCur["x-ulice-tem"]], layout: { "text-field": ["concat", "ul. ", ["get", "n"]], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.1], "text-anchor": "top", "text-max-width": 16 }, paint: { "text-color": "#a61e4d", "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => `<select class="bud-metric" onchange="NazwySel('x-ulice-tem',this.value)">${Object.entries(UTK).map(([k, v]) => `<option value="${k}"${k === ntCur["x-ulice-tem"] ? " selected" : ""}>${v[0]}</option>`).join("")}</select>` + legendRow(UPAT.map(r => [r[1], r[0]])) + note("Ulica to nazwa w gminie, punkt leży na jej osi. Kolory powyżej dotyczą patronów. Kwiatowe są różowe, owocowe pomarańczowe. Najpopularniejsze nazwy ulic w Polsce: Polna, Słoneczna, Leśna, Ogrodowa, Krótka (pełna lista w rankingu). Źródło: GUGiK PRG, osie ulic, obliczenia własne."),
      rank: d => { const f = d.features, s = (k, v, u, sub, sort) => { let L = f.filter(x => P(x).k === k); if (sort) L.sort(sort); return { t: UTK[k][0], c: UTK[k][1], items: L.slice(0, 300).map(x => [P(x).n, v(x), u, XY(x), sub(x), 14]) }; }, g = x => P(x).m + ", gm. " + P(x).g;
        const cnt = {}; f.filter(x => P(x).k === "pt").forEach(x => { cnt[P(x).p] = (cnt[P(x).p] || 0) + 1; });
        return [s("mc", x => P(x).d, "km", x => g(x) + ", tyle od " + P(x).t, (a, b) => P(b).d - P(a).d), s("kd", x => P(x).l, "m", x => g(x) + ", a Długa ma " + P(x).d + " m", (a, b) => P(b).l / P(b).d - P(a).l / P(a).d), s("dl", x => P(x).d, "znaków", g),
          { t: "Patroni", c: "#c2255c", items: UPAT.map((r, i) => ["ul. " + r[0], cnt[i] || 0, "gmin", [19.4, 52], "ulice tego patrona w gminach", 6]).sort((a, b) => b[1] - a[1]) },
          { t: "Najpopularniejsze", c: "#495057", items: (window.ULPOP || []).map(r => ["ul. " + r[0], r[1], "gmin", [19.4, 52], "ulica o tej nazwie jest w tylu gminach", 6]) }]; },
      card: p => ({ title: "ul. " + p.n, src: "GUGiK PRG (obliczenia własne)", body: `<p class="gs-st"><i style="background:${p.k === "pt" ? UPAT[p.p][1] : (UTK[p.k] || [])[1]}"></i>${(UTK[p.k] || [""])[0]}</p>${p.k === "mc" ? `<p>${fmt(p.d, 0)} km od ${esc(p.t)}</p>` : ""}${p.k === "kd" ? `<p>Krótka: ${fmt(p.l, 0)} m, Długa w tej gminie: ${fmt(p.d, 0)} m</p>` : ""}<p>${esc(p.m || "")}, gm. ${esc(p.g || "")}</p><p class="small">długość ulicy w gminie ${fmt(p.l, 0)} m</p>` }) },
    { id: "ulice-woj", box: "curioLayers", label: "Ulice typowe dla regionu", desc: "Nazwy ulic, które są częste w danym województwie, a rzadkie w reszcie Polski", kw: "nazwy ulic typowa ulica województwo region bydgoska kajki opatowska krapkowicka charakterystyczna prg ciekawostki",
      icon: ["road-horizon", "#e67700"], url: "data/granice/ulice_woj.geojson",
      layers: s => [
        { id: "x-ulwoj", type: "circle", source: s, paint: { "circle-color": "#e67700", "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 7, 9, 12], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
        { id: "x-ulwoj-lbl", type: "symbol", source: s, layout: { "text-field": ["concat", "ul. ", ["get", "u"]], "text-size": ["interpolate", ["linear"], ["zoom"], 5, 12, 9, 16], "text-font": ["Noto Sans Bold"], "text-offset": [0, 1.1], "text-anchor": "top", "text-allow-overlap": true }, paint: { "text-color": "#d9480f", "text-halo-color": "#fff", "text-halo-width": 2 }, noClick: true }],
      legend: () => note("Dla każdego województwa nazwa ulicy, która występuje tam najczęściej w porównaniu z resztą kraju (udział w województwie podzielony przez udział w Polsce, co najmniej 15 ulic). Kliknij punkt, by zobaczyć 8 najbardziej regionalnych nazw. Źródło: GUGiK PRG, punkty adresowe, obliczenia własne."),
      rank: d => [{ t: "Najbardziej „swoje” ulice", c: "#e67700", items: [...d.features].sort((a, b) => P(b).q - P(a).q).map(x => [P(x).w + ": ul. " + P(x).u, P(x).q, "× częściej", XY(x), `${P(x).c} z ${P(x).l[0][2]} takich ulic w Polsce`, 7]) }],
      card: p => ({ title: "Woj. " + p.w, src: "GUGiK PRG (obliczenia własne)",
        body: `<p class="gs-st"><i style="background:#e67700"></i>Ulice typowe dla regionu</p><ol class="fun-list" style="--c:#e67700">${(p.l || []).map((r, i) => `<li><span class="fr-n">${i + 1}</span><span class="fr-t">ul. ${esc(r[0])}<small>${r[1]} w województwie, ${r[2]} w Polsce</small></span><span class="fr-v">${fmt(r[3], 1)}×</span><i style="width:${Math.max(4, 100 * r[3] / p.l[0][3])}%"></i></li>`).join("")}</ol>` }) },
    { id: "geografia", fillClick: true, box: "curioLayers", label: "Geografia: rekordy", desc: "Biegun niedostępności Polski i województw, przecięcia pełnych stopni, gminy z jednym sąsiadem, najdłuższe proste granice, granice po rzekach, wyspy na jeziorach, jeziora", kw: "biegun niedostępności najdalej od granicy polski środek confluence pełne stopnie równoleżnik południk gmina z jednym sąsiadem worek turoszowski bogatynia prosta granica granica na rzece wyspa na jeziorze największe jezioro województwa gminy jezior prg bdot ciekawostki",
      icon: ["globe-hemisphere-east", "#1864ab"], url: "data/granice/geografia.geojson",
      layers: s => [
        { id: "x-geo-wy", type: "fill", source: s, filter: ["all", ["==", ["get", "k"], "wy"], ["==", ["geometry-type"], "Polygon"]], paint: { "fill-color": "#2f9e44", "fill-opacity": .6, "fill-outline-color": "#2b8a3e" } },
        { id: "x-geo-pr", type: "line", source: s, filter: ["==", ["get", "k"], "pr"], layout: { "line-cap": "round" }, paint: { "line-color": "#e8590c", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 6] } },
        { id: "x-geo", type: "circle", source: s, filter: ["all", ["==", ["geometry-type"], "Point"], ["in", ["get", "k"], ["literal", ["bn", "cf", "j1", "jw"]]], ["any", ["!=", ["get", "k"], "j1"], [">", ["get", "p"], 0], [">=", ["zoom"], 8]]], paint: { "circle-color": ["match", ["get", "k"], "bn", "#c92a2a", "cf", "#495057", "j1", "#7048e8", "jw", "#1971c2", "#868e96"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "k"], "bn", 6, 4.5], 11, 9], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } },
        { id: "x-geo-lbl", type: "symbol", source: s, minzoom: 6, filter: ["all", ["==", ["geometry-type"], "Point"], ["in", ["get", "k"], ["literal", ["bn", "cf"]]]], layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.1], "text-anchor": "top" }, paint: { "text-color": "#343a40", "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => legendRow([["#c92a2a", "biegun niedostępności: najdalej od granicy"], ["#495057", "przecięcie pełnych stopni"], ["#7048e8", "gmina z jednym sąsiadem w Polsce"], ["#1971c2", "największy zbiornik wodny województwa"], ["#e8590c", "najdłuższe proste odcinki granic gmin", "line"], ["#2f9e44", "największe wyspy na jeziorach", "box"]]) + note("Gminy z jednym sąsiadem pokazuję od razu tylko wtedy, gdy część ich granicy to granica państwa albo morze (np. Bogatynia w Worku Turoszowskim). Miasta otoczone gminą obwarzankową widać od zoomu 8. Proste granice bez odcinków po wodzie. Granica po rzece: część granicy gminy do 5 m od rzeki ze zbioru BDOT. Jeziora i zbiorniki od 1 ha, także stawy. Źródło: GUGiK PRG, BDOT10k, obliczenia własne."),
      rank: d => { const f = d.features, q = k => f.filter(x => P(x).k === k);
        return [{ t: "Biegun niedostępności", c: "#c92a2a", items: q("bn").sort((a, b) => P(b).d - P(a).d).map(x => [P(x).n === "Polska" ? "Polska" : "woj. " + P(x).n, P(x).d / 1000, "km do granicy", XY(x), "", P(x).n === "Polska" ? 8 : 9]) },
          { t: "Jeden sąsiad", c: "#7048e8", items: q("j1").sort((a, b) => P(b).p - P(a).p).map(x => [P(x).n, P(x).p, "% granicy na granicy Polski", XY(x), "jedyny sąsiad: " + P(x).s, 10]) },
          { t: "Proste granice", c: "#e8590c", items: q("pr").map(x => [P(x).n, P(x).d / 1000, "km", XY(x), "", 12]) },
          { t: "Granica po rzece", c: "#1098ad", items: q("rz").sort((a, b) => P(b).d - P(a).d).slice(0, 100).map(x => [P(x).n, P(x).d, "% granicy", XY(x), "", 10]) },
          { t: "Najwięcej jezior", c: "#1971c2", items: q("jg").sort((a, b) => P(b).c - P(a).c).slice(0, 100).map(x => [P(x).n, P(x).c, "zbiorników od 1 ha", XY(x), fmt(P(x).p, 1) + "% powierzchni gminy pod wodą", 10]) },
          { t: "Wyspy na jeziorach", c: "#2f9e44", items: q("wy").filter(x => x.geometry.type === "Polygon").map(x => [P(x).n || "jezioro bez nazwy", P(x).d / 1e4, "ha", XY(x), "", 13]) },
          { t: "Największe w województwie", c: "#1971c2", items: q("jw").sort((a, b) => P(b).d - P(a).d).map(x => [P(x).n, P(x).d / 1e6, "km²", XY(x), "woj. " + P(x).w, 11]) },
          { t: "Pełne stopnie", c: "#495057", items: q("cf").map(x => [P(x).n, "", "", XY(x), "gm. " + P(x).g, 13]) }]; },
      card: p => ({ title: p.k === "bn" ? "Biegun niedostępności: " + (p.n === "Polska" ? "Polska" : "woj. " + p.n) : p.k === "wy" ? "Wyspa: " + (p.n || "jezioro bez nazwy") : p.n, src: "GUGiK PRG, BDOT10k (obliczenia własne)",
        body: { bn: `<p>Punkt najdalej od granicy: <b>${fmt(p.d / 1000, 1)} km</b> do najbliższej granicy ${p.n === "Polska" ? "Polski" : "województwa"}</p>`, cf: `<p>Przecięcie pełnych stopni długości i szerokości geograficznej</p><p>Gmina ${esc(p.g || "")}</p>`, j1: `<p>Jedyny sąsiad w Polsce: <b>${esc(p.s)}</b></p><p>${p.p > 0 ? fmt(p.p, 1) + "% granicy to granica Polski albo morze" : "Miasto otoczone jedną gminą"}</p>`, pr: `<p>Prosty odcinek granicy: <b>${fmt(p.d / 1000, 2)} km</b></p>`, jw: `<p>Największy zbiornik wodny województwa ${esc(p.w)}: <b>${fmt(p.d / 1e6, 1)} km²</b></p>`, wy: `<p>Wyspa: <b>${fmt(p.d / 1e4, 1)} ha</b></p>` }[p.k] || "" }) },
    { id: "srodki", box: "curioLayers", label: "Środki geometryczne", desc: "Środek Polski, województw, powiatów i gmin, z opisem, co tam jest", kw: "środek polski środek geometryczny gminy powiatu województwa centroid pępek ciekawostki",
      icon: ["target", "#d6336c"], url: "data/granice/srodki.geojson",
      layers: s => [{ id: "x-srodki", type: "circle", source: s, filter: ["any", ["in", ["get", "l"], ["literal", ["k", "w"]]], ["all", ["==", ["get", "l"], "p"], [">=", ["zoom"], 7]], [">=", ["zoom"], 9]], paint: { "circle-color": ["match", ["get", "l"], "k", "#c92a2a", "w", "#d6336c", "p", "#f783ac", "#fcc2d7"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "l"], "k", 8, "w", 6, 3], 11, ["match", ["get", "l"], "k", 12, "w", 10, "p", 8, 6]], "circle-stroke-color": ["match", ["get", "l"], "g", "#d6336c", "#fff"], "circle-stroke-width": 1.5 } }],
      legend: () => legendRow([["#c92a2a", "środek Polski"], ["#d6336c", "środek województwa"], ["#f783ac", "środek powiatu (od zoomu 7)"], ["#fcc2d7", "środek gminy (od zoomu 9)"]]) + note("Środek ciężkości obszaru według granic PRG. W gminach o nieregularnym kształcie środek może wypaść poza gminą, co zaznacza karta. Pokrycie terenu z BDOT10k. Źródło: GUGiK PRG, BDOT10k, PRNG, obliczenia własne."),
      rank: d => { const f = d.features; return [
        { t: "Polska i województwa", c: "#d6336c", items: f.filter(x => ["k", "w"].includes(P(x).l)).map(x => [P(x).n, P(x).md ?? 0, "m do wsi", XY(x), (P(x).p || "") + (P(x).m ? ", " + P(x).m : ""), 14]) },
        { t: "Poza swoją gminą", c: "#f783ac", items: f.filter(x => P(x).o && P(x).l === "g").slice(0, 30).map(x => [P(x).n, P(x).md ?? 0, "m do wsi", XY(x), P(x).t, 12]) }]; },
      card: p => ({ title: "Środek: " + p.n, src: "GUGiK PRG, BDOT10k, PRNG (obliczenia własne)", body: `<p class="gs-st"><i style="background:#d6336c"></i>${{ k: "Środek geometryczny Polski", w: "Środek województwa", p: "Środek powiatu", g: "Środek gminy" }[p.l]}${p.t ? ", " + esc(p.t) : ""}</p>` + (p.o ? `<p><b>Wypada poza obszarem jednostki</b></p>` : "") + (p.p ? `<p>Na miejscu: ${esc(p.p)}</p>` : "") + (p.m ? `<p>Najbliższa miejscowość: ${esc(p.m)}${p.mr ? " (" + esc(p.mr) + ")" : ""}${p.md != null ? ", " + fmtD(p.md) : ""}</p>` : "") + (p.b != null ? `<p class="small">Najbliższy budynek: ${fmtD(p.b)}</p>` : "") }) },
    { id: "urbex", box: "urbexLayers", label: "Opuszczone miejsca (urbex)", desc: "Opuszczone fabryki, bunkry, pałace, szpitale i inne obiekty", kw: "urbex opuszczone miejsca ruiny bunkier fabryka pałac dwór szpital opuszczony pustostan eksploracja militarne podziemia tunele",
      icon: ["warning", "#e8590c"], url: "data/urbex/miejsca.geojson",
      layers: s => [
        { id: "x-urbex", type: "circle", source: s, paint: { "circle-color": ["case", ["has", "a"], "#adb5bd", "#f59f00"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 10, 6, 14, 9], "circle-stroke-color": "#7a3d00", "circle-stroke-width": 1.2 } },
        { id: "x-urbex-ic", type: "symbol", source: s, minzoom: 9, layout: { "text-field": "!", "text-size": ["interpolate", ["linear"], ["zoom"], 9, 9, 14, 13], "text-font": ["Noto Sans Bold"], "text-allow-overlap": true }, paint: { "text-color": "#3b1d00" }, noClick: true },
        { id: "x-urbex-lbl", type: "symbol", source: s, minzoom: 12, layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#7a3d00", "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => legendRow([["#f59f00", "miejsce opuszczone"], ["#adb5bd", "oznaczone jako nieistniejące lub zabezpieczone"]]) + note("Miejsca zgłaszane przez społeczność eksploratorów, położenie przybliżone. Większość to teren prywatny lub zamknięty: wejście bez zgody właściciela jest naruszeniem prawa, a stan budynków bywa groźny (zawalenia, szyby, azbest). Źródła: desolate.zone, urbexy.pl."),
      card: p => ({ title: p.n || "Opuszczone miejsce", src: "desolate.zone, urbexy.pl (zgłoszenia społeczności)",
        body: `<p class="gs-st"><i style="background:${p.a ? "#adb5bd" : "#f59f00"}"></i>${esc(p.k || "opuszczony obiekt")}${p.a ? " · nieaktualne" : ""}</p>` +
          (p.u ? `<p><a href="${esc(p.u)}" target="_blank" rel="noopener">Opis i zdjęcia</a></p>` : "") +
          `<p class="muted small">Wejście na teren bez zgody właściciela jest nielegalne, a budynki mogą grozić zawaleniem.</p>` }) },
    { id: "bunkry", box: "urbexLayers", label: "Bunkry i forty", desc: "Schrony bojowe, bunkry, forty i twierdze z mapy OpenStreetMap", kw: "bunkry bunkier schron schrony forty fort twierdza fortyfikacje militaria wał pomorski międzyrzecki rejon umocniony linia mołotowa regelbau tobruk",
      icon: ["shield", "#495057"], url: "data/urbex/bunkry.geojson",
      layers: s => [
        { id: "x-bunkry", type: "circle", source: s, paint: { "circle-color": ["match", ["get", "k"], "f", "#7048e8", "#495057"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "k"], "f", 3.5, 2], 10, 5, 14, 8], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } },
        { id: "x-bunkry-lbl", type: "symbol", source: s, minzoom: 12, layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#343a40", "text-halo-color": "#fff", "text-halo-width": 1.5 }, noClick: true }],
      legend: () => legendRow([["#495057", "bunkier, schron"], ["#7048e8", "fort, twierdza"]]) + note("Obiekty oznaczone na mapie OpenStreetMap przez społeczność, więc pokrycie bywa nierówne. Wiele bunkrów leży na terenie prywatnym, wojskowym albo w rezerwatach nietoperzy (zimą wejście zabronione). Źródło: OpenStreetMap (licencja ODbL)."),
      card: p => ({ title: p.n || (p.k === "f" ? "Fort" : "Bunkier"), src: "OpenStreetMap (ODbL)",
        body: `<p class="gs-st"><i style="background:${p.k === "f" ? "#7048e8" : "#495057"}"></i>${esc(p.t || (p.k === "f" ? "fort, twierdza" : "bunkier, schron"))}${p.r ? " · ruina" : ""}</p>` + (p.w ? `<p>${link("https://pl.wikipedia.org/wiki/" + encodeURIComponent((p.w.split(":").slice(1).join(":") || p.w).replace(/ /g, "_")), "Wikipedia")}</p>` : "") + `<p class="small">${link(p.o, "Obiekt w OpenStreetMap")}</p>` }) },
    { id: "przesyl", box: "limitLayers", label: "Linie przesyłowe w budowie", desc: "Linie 110 kV i wyższe oraz stacje w budowie lub planowane", kw: "linie przesyłowe pse budowa linii 400 kv 220 kv 110 kv planowana linia stacja elektroenergetyczna przesył energii",
      icon: ["lightning", "#c2255c"], url: "data/przesyl/inwestycje.geojson",
      layers: s => [
        { id: "x-pse-p", type: "line", source: s, filter: ["all", ["==", ["get", "k"], "p"], ["!=", ["get", "c"], "st"]], layout: { "line-cap": "round" }, paint: { "line-color": PSE_COL.p, "line-dasharray": [1.6, 1.4], "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.4, 12, 4] } },
        { id: "x-pse-b", type: "line", source: s, filter: ["all", ["==", ["get", "k"], "b"], ["!=", ["get", "c"], "st"]], layout: { "line-cap": "round" }, paint: { "line-color": PSE_COL.b, "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["case", [">=", ["get", "v"], 220], 2.2, 1.4], 12, ["case", [">=", ["get", "v"], 220], 5, 3.5]] } },
        { id: "x-pse-st", type: "circle", source: s, filter: ["==", ["get", "c"], "st"], paint: { "circle-color": "#fff", "circle-stroke-color": ["match", ["get", "k"], "b", PSE_COL.b, PSE_COL.p], "circle-stroke-width": 2.5, "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 7] } }],
      legend: () => legendRow([[PSE_COL.b, "w budowie", "line"], [PSE_COL.p, "planowana", "dash"], ["#fff", "nowa stacja"]]) + note("Linie 110 kV i wyższe oznaczone w OpenStreetMap jako budowane lub planowane, przebieg orientacyjny. Zakres i terminy inwestycji podaje PSE (linie 220 i 400 kV) i operator sieci dystrybucyjnej (110 kV).") + `<p class="small">${link("https://www.pse.pl/inwestycje", "Inwestycje PSE")}</p>`,
      card: (p, d) => ({ title: p.n || (p.c === "st" ? "Nowa stacja elektroenergetyczna" : `Linia ${p.v ? p.v + " kV" : "wysokiego napięcia"}`), src: `OpenStreetMap (stan ${d?.osm || ""}, ODbL)`,
        body: `<p class="gs-st"><i style="background:${PSE_COL[p.k]}"></i>${p.k === "b" ? "W budowie" : "Planowana"}${p.c === "kab" ? " · linia kablowa" : ""}</p>` + row("Napięcie", p.v ? `${p.v} kV` : "") + row("Operator", p.op) +
          `<p class="muted small">Przebieg z OpenStreetMap jest orientacyjny. Pas technologiczny linii ogranicza zabudowę, jego szerokość podaje operator.</p><p>${link("https://www.pse.pl/inwestycje", "Inwestycje PSE")}</p>` }) },
    { id: "drogi", box: "transportLayers", label: "Inwestycje drogowe", desc: "Drogi w budowie i planowane, status GDDKiA", kw: "inwestycje drogowe budowa dróg gddkia autostrady drogi ekspresowe obwodnice planowane drogi w budowie przetarg przygotowanie s19 s10 s74",
      icon: ["road-horizon", "#d9480f"], url: "data/drogi/inwestycje.geojson", side: "data/drogi/gddkia.json",
      layers: s => [
        { id: "x-drogi-p", type: "line", source: s, filter: ["==", ["get", "k"], "p"], layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ROAD_COL.p, "line-dasharray": [1.6, 1.4], "line-opacity": .9, "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "c"], ["A", "S"], 1.6, "DK", 1, .6], 12, ["match", ["get", "c"], ["A", "S"], 4.5, "DK", 3.5, 2.5]] } },
        { id: "x-drogi-b", type: "line", source: s, filter: ["==", ["get", "k"], "b"], layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ROAD_COL.b, "line-opacity": .95, "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "c"], ["A", "S"], 2, "DK", 1.2, .7], 12, ["match", ["get", "c"], ["A", "S"], 5.5, "DK", 4, 3]] } },
        { id: "x-drogi-lbl", type: "symbol", source: s, minzoom: 8, filter: ["has", "ref"], layout: { "symbol-placement": "line", "symbol-spacing": 320, "text-field": ["get", "ref"], "text-size": 11, "text-font": ["Noto Sans Bold"] }, paint: { "text-color": "#7a2a05", "text-halo-color": "#fff", "text-halo-width": 1.6 } }],
      legend: () => legendRow([[ROAD_COL.b, "w budowie lub przebudowie", "line"], [ROAD_COL.p, "planowana", "dash"]]) + note("Grubość linii: autostrady i drogi ekspresowe, drogi krajowe, wojewódzkie. Przebieg: OpenStreetMap. Stan inwestycji i strony odcinków: GDDKiA, Mapa Stanu Budowy Dróg. Przebieg planowanych dróg jest orientacyjny, wiążące są decyzje środowiskowe i ZRID."),
      card: (p, d, f, side) => roadCard(p, d, side) },
    { id: "zrid", box: "transportLayers", label: "Decyzje na budowę dróg", desc: "ZRID i pozwolenia na drogi od 2023 r. (GUNB)", kw: "zrid zezwolenie na realizację inwestycji drogowej decyzje drogowe pozwolenie na budowę drogi przebudowa rozbudowa ulicy gunb rwdz",
      icon: ["stamp", "#e8590c"], url: "data/drogi/decyzje.geojson", minz: 8,
      layers: s => [{ id: "x-zrid", type: "circle", source: s, minzoom: 8, paint: { "circle-color": ["match", ["get", "z"], 1, "#e8590c", "#f59f00"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, ["match", ["get", "z"], 1, 4, 2.5], 13, ["match", ["get", "z"], 1, 8, 6]], "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } }],
      legend: () => legendRow([["#e8590c", "zezwolenie na realizację inwestycji drogowej (ZRID)"], ["#f59f00", "pozwolenie na budowę drogi lub ulicy"]]) + note("Decyzje wydane od 2023 r. w kategorii XXV (drogi), punkt w środku działek objętych wnioskiem. Źródło: GUNB, Rejestr wniosków, decyzji i zgłoszeń (dane.gov.pl). Rejestr nie obejmuje wszystkich decyzji wojewodów, więc brak punktu nie oznacza braku inwestycji. Widoczne od skali około 1:2 000 000."),
      card: p => zridCard(p) },
    ...[["ldwn", "Hałas drogowy w ciągu doby", "Wskaźnik LDWN, mapy akustyczne GDDKiA 2022"], ["ln", "Hałas drogowy nocą", "Wskaźnik LN, mapy akustyczne GDDKiA 2022"]].map(([k, label, desc]) => ({
      id: "halas-" + k, box: "transportLayers", label, desc, kw: "hałas drogowy mapa akustyczna strategiczna mapa hałasu gddkia ldwn ln decybele db noc", icon: ["speaker-high", k === "ln" ? "#5f3dc4" : "#e8590c"], minz: 13,
      tiles: () => app.base + "/tiles/halas/" + k + "/{z}/{x}/{y}.png", attr: "GDDKiA, strategiczne mapy hałasu 2022",
      layers: s => [{ id: "x-halas-" + k, type: "raster", source: s, minzoom: 13, paint: { "raster-opacity": .62, "raster-fade-duration": 0 } }],
      legend: () => legendRow([["#fa881d", "55–60 dB", "box"], ["#fa5704", "60–65", "box"], ["#dc3c3c", "65–70", "box"], ["#ae7cd6", "70–75", "box"], ["#02a9df", "75–80", "box"], ["#004be4", "80 i więcej", "box"]]) +
        note(`${k === "ln" ? "Średni poziom hałasu w porze nocnej (22–6)." : "Średni poziom hałasu z całej doby, z wagą dla wieczoru i nocy."} Drogi krajowe o ruchu powyżej 3 mln pojazdów rocznie, poza dużymi miastami, które mają własne mapy. Źródło: GDDKiA, strategiczne mapy hałasu 2022 (Geoportal). Widoczne od skali około 1:70 000.`) })),
    { id: "kolej", box: "transportLayers", label: "Inwestycje kolejowe", desc: "Linie w budowie i planowane, nowe przystanki, Kolej Plus", kw: "inwestycje kolejowe kolej plk modernizacja linii nowe przystanki kolej plus tramwaj metro planowana linia kolejowa",
      icon: ["train", "#1971c2"], url: "data/kolej/inwestycje.geojson", side: "data/kolej/kolejplus.json",
      layers: s => [
        { id: "x-kolej-p", type: "line", source: s, filter: ["all", ["==", ["get", "k"], "p"], ["in", ["get", "c"], ["literal", ["rail", "tram", "metro"]]]], layout: { "line-cap": "round" },
          paint: { "line-color": RAIL_COL.p, "line-dasharray": [1.2, 1.6], "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "c"], "rail", 1.2, .5], 12, ["match", ["get", "c"], "rail", 3.5, 2]] } },
        { id: "x-kolej-b", type: "line", source: s, filter: ["all", ["==", ["get", "k"], "b"], ["in", ["get", "c"], ["literal", ["rail", "tram", "metro"]]]], layout: { "line-cap": "round" },
          paint: { "line-color": RAIL_COL.b, "line-width": ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "c"], "rail", 1.6, .6], 12, ["match", ["get", "c"], "rail", 4.5, 2.5]] } },
        { id: "x-kolej-st", type: "circle", source: s, minzoom: 7, filter: ["==", ["get", "c"], "st"], paint: { "circle-color": "#fff", "circle-stroke-color": ["match", ["get", "k"], "b", RAIL_COL.b, RAIL_COL.p], "circle-stroke-width": 2.5, "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 3, 13, 6] } },
        { id: "x-kolej-lbl", type: "symbol", source: s, minzoom: 11, filter: ["==", ["get", "c"], "st"], layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.1], "text-anchor": "top" }, paint: { "text-color": "#0b4a8b", "text-halo-color": "#fff", "text-halo-width": 1.5 } }],
      legend: () => legendRow([[RAIL_COL.b, "w budowie lub modernizacji", "line"], [RAIL_COL.p, "planowana", "dash"], ["#fff", "nowy przystanek lub stacja"]]) + note("Cieńsze linie: tramwaj i metro. Przebieg: OpenStreetMap. Projekty Programu Kolej Plus: PKP PLK.") + `<p class="small">${link("https://www.plk-inwestycje.pl/", "Mapa inwestycji PKP PLK")} · ${link("https://www.plk-inwestycje.pl/projekty/program-kolej-plus/", "Program Kolej Plus")}</p>`,
      card: (p, d, f, side) => railCard(p, d, side) },
    { id: "kdp", box: "transportLayers", label: "Kolej dużych prędkości", desc: "Planowane linie KDP, w tym linia Y", kw: "kolej dużych prędkości kdp linia y cpk port polska szybka kolej korytarz planowana kolej przez działkę",
      icon: ["train", "#c2255c"], url: "data/kolej/inwestycje.geojson",
      layers: s => [
        { id: "x-kdp-glow", type: "line", source: s, filter: ["==", ["get", "c"], "kdp"], layout: { "line-cap": "round" }, paint: { "line-color": "#c2255c", "line-opacity": .18, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 6, 12, 22] }, noClick: true },
        { id: "x-kdp", type: "line", source: s, filter: ["==", ["get", "c"], "kdp"], layout: { "line-cap": "round" }, paint: { "line-color": "#c2255c", "line-dasharray": [2, 1.2], "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.8, 12, 4] } }],
      legend: () => legendRow([["#c2255c", "planowana linia KDP (przebieg orientacyjny)", "dash"]]) + note("Przebieg z OpenStreetMap, odwzorowany przez wolontariuszy na podstawie publikowanych wariantów. Wiążące są decyzje środowiskowe i lokalizacyjne Port Polska (CPK). Mapy Port Polska nie wolno powielać, dlatego podajemy tylko odnośnik.") + `<p class="small">${link("https://portpolska.pl/pl/program-kolejowy", "Mapa inwestycji kolejowych Port Polska z działkami")}</p>`,
      card: p => ({ title: p.n || "Planowana linia kolei dużych prędkości", src: "OpenStreetMap (przebieg orientacyjny)",
        body: `<p class="gs-st"><i style="background:#c2255c"></i>${p.k === "b" ? "W budowie" : "Planowana"}</p><p>Linia kolei dużych prędkości. Przebieg w OpenStreetMap jest orientacyjny i może dotyczyć jednego z wariantów.</p><p>Czy działka leży w pasie inwestycji, sprawdzisz na ${link("https://portpolska.pl/pl/program-kolejowy", "mapie inwestycji kolejowych Port Polska")} (decyzje środowiskowe, plany rezerwacji terenu, decyzje lokalizacyjne).</p>` }) },
    { id: "bud-gmin", gmina: true, fillClick: true, box: "terrainLayers", label: "Zabudowa gmin", desc: "Liczba budynków i 14 innych miar zabudowy: domy, bloki, letniska, szklarnie, budowy, ruiny", kw: "liczba budynków gmina budynki gospodarcze domy letniskowe szklarnie bloki kondygnacje w budowie ruiny kościoły zabudowa gęstość bdot",
      icon: ["house-line", "#e8590c"], url: "data/granice/budynki_gmin.geojson",
      layers: s => [{ id: "x-bud-gmin", type: "fill", source: s, paint: { "fill-color": BudPaint("gb"), "fill-opacity": .62, "fill-outline-color": "#ffffff" } }],
      legend: () => `<label class="bud-metric">Pokaż: <select onchange="BudMetric(this.value)">${BUDM.map(m => `<option value="${m[0]}"${m[0] === budCur ? " selected" : ""}>${m[1]}</option>`).join("")}</select></label><div id="budLeg">${budLegend()}</div>` + note("Budynki istniejące, w budowie, nieczynne i zniszczone z BDOT10k, przypisane do gminy według położenia. Kolory to sześć równych grup gmin (kwantyle). Pozwolenia i rozbiórki z rejestru GUNB (RWDZ). Źródło: GUGiK BDOT10k, PRG, GUNB, obliczenia własne."),
      rank: d => { budData = d; budQ = {}; setTimeout(() => BudMetric(budCur), 50); const f = d.features, r = (t, c, k) => ({ t, c, items: [...f].filter(x => P(x)[k] != null).sort((a, b) => P(b)[k] - P(a)[k]).slice(0, 30).map(x => [P(x).n, P(x)[k], BUDM.find(m => m[0] === k)[2], P(x).c, P(x).w, 10]) });
        return [r("Najwięcej budynków", "#e8590c", "b"), r("Najgęściej", "#d9480f", "gb"), r("Gospodarcze na dom", "#8f5b17", "gd"), r("Letniska", "#0ca678", "le"), r("Bloki 5+", "#5f3dc4", "bl"), r("Budowy", "#1971c2", "wb"), r("Ruiny", "#495057", "rz"), r("Nowe domy", "#2f9e44", "pjm"), r("Rozbiórki", "#862e0f", "ro")]; },
      card: p => ({ title: "Gmina " + p.n, src: "GUGiK BDOT10k (obliczenia własne)", body: `<p class="gs-st"><i style="background:#e8590c"></i><b>${fmt(p.b, 0)}</b> budynków (${fmt(p.gb, 1)} na km²), w tym <b>${fmt(p.m, 0)}</b> mieszkalnych (${fmt(p.pm, 0)}%)</p>` + (p.jd == null ? "" : `<p>${fmt(p.jd, 0)} domów jednorodzinnych, ${fmt(p.wr, 0)} wielorodzinnych, ${fmt(p.go, 0)} gospodarczych (${fmt(p.gd, 1)} na dom), ${fmt(p.le, 0)} letniskowych</p><p>Średni budynek ${fmt(p.sa, 0)} m², średnio ${fmt(p.sk, 1)} kondygnacji, ${fmt(p.bl, 0)} budynków 5+ kondygnacji${p.wz ? `, ${fmt(p.wz, 0)} wieżowców 15+` : ""}</p><p>W budowie ${fmt(p.wb, 0)}, nieczynne lub zniszczone ${fmt(p.rz, 0)}, szklarnie ${fmt(p.sz, 0)}, budynki hodowlane ${fmt(p.ho, 0)}, kościoły i kaplice ${fmt(p.ko, 0)}</p>${p.pj != null ? `<p>Pozwolenia na budowę 2016–2025: ${fmt(p.pj, 0)} domów jednorodzinnych (${fmt(p.pjm, 1)} na 100 istniejących), wszystkich nowych obiektów ${fmt(p.pa, 0)}, rozbiórki ${fmt(p.ro, 0)}</p>` : ""}<p>Największy: ${p.mxn ? esc(p.mxn) + ", " : ""}${esc(p.mxf || "")} ${fmt(p.mx, 0)} m²</p>`) }) },
    { id: "bud-mieszk", gmina: true, fillClick: true, box: "terrainLayers", label: "Budynki mieszkalne w gminach", desc: "Ile budynków mieszkalnych stoi w każdej gminie i jak gęsto", kw: "liczba budynków gmina budynki mieszkalne domy zabudowa gęstość zabudowy bdot",
      icon: ["house-line", "#1971c2"], url: "data/granice/budynki_gmin.geojson",
      layers: s => [{ id: "x-bud-mieszk", type: "fill", source: s, paint: { "fill-color": ["step", ["get", "gm"], "#e7f5ff", 5, "#a5d8ff", 10, "#4dabf7", 25, "#1c7ed6", 75, "#1864ab", 250, "#0b3d6e"], "fill-opacity": .6, "fill-outline-color": "#ffffff" } }],
      legend: () => legendRow([["#e7f5ff", "poniżej 5 na km²"], ["#a5d8ff", "od 5 na km²"], ["#4dabf7", "od 10 na km²"], ["#1c7ed6", "od 25 na km²"], ["#1864ab", "od 75 na km²"], ["#0b3d6e", "od 250 na km²"]]) + note("Budynki istniejące i w budowie z BDOT10k, przypisane do gminy według położenia. Kolor: liczba budynków na km² powierzchni gminy. Źródło: GUGiK BDOT10k, PRG, obliczenia własne."),
      rank: d => { const f = d.features, r = (t, c, v, u) => ({ t, c, items: [...f].sort((a, b) => v(b) - v(a)).slice(0, 30).map(x => [P(x).n, v(x), u, P(x).c, P(x).w, 10]) }); return [r("Najwięcej", "#1971c2", x => P(x).m, ""), r("Najgęściej", "#1971c2", x => P(x).gm, "/km²"), { ...r("Najmniej", "#868e96", x => -P(x).m, ""), items: [...f].sort((a, b) => P(a).m - P(b).m).slice(0, 30).map(x => [P(x).n, P(x).m, "", P(x).c, P(x).w, 10]) }]; },
      card: p => ({ title: "Gmina " + p.n, src: "GUGiK BDOT10k (obliczenia własne)", body: `<p class="gs-st"><i style="background:#1971c2"></i><b>${fmt(p.b, 0)}</b> budynków, w tym <b>${fmt(p.m, 0)}</b> mieszkalnych (${fmt(100 * p.m / Math.max(p.b, 1), 0)}%)</p><p>${fmt(p.gb, 1)} budynków i ${fmt(p.gm, 1)} mieszkalnych na km², powierzchnia ${fmt(p.a, 1)} km²</p>` }) },
    { id: "noc", box: "terrainLayers", label: "Nocne światło (satelita)", desc: "Zdjęcie Ziemi nocą z satelity VIIRS, kompozycja z 2016 r.", kw: "nocne światło światła nocą satelita viirs black marble nasa zanieczyszczenie światłem łuna miasta oświetlenie ciemne niebo",
      icon: ["sparkle", "#3b4a8c"], maxz: 8, attr: "NASA Earth Observatory, Black Marble 2016 (GIBS)",
      tiles: () => "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
      layers: s => [{ id: "x-noc", type: "raster", source: s, paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 } }],
      legend: () => note("Jasne plamy to oświetlone miasta, drogi i zakłady, ciemne to obszary bez sztucznego światła (dobre do obserwacji nieba). Kompozycja bezchmurnych nocy z 2016 r., szczegółowość około 500 m, więc przy dużym przybliżeniu obraz się rozmywa. Źródło: NASA Earth Observatory, Black Marble (usługa NASA GIBS).") },
    { id: "susza", box: "terrainLayers", label: "Zagrożenie suszą", desc: "Rolnicza, hydrologiczna, hydrogeologiczna, atmosferyczna (PPSS 2021)", kw: "susza zagrożenie suszą rolnicza hydrologiczna hydrogeologiczna atmosferyczna ppss appss wody polskie retencja niedobór wody",
      icon: ["drop", "#e0441f"], url: "susza-ppss2021", fetch: () => suFile(suT), fillClick: true,
      layers: s => [
        { id: "x-susza-f", type: "fill", source: s, paint: { "fill-color": ["match", ["get", "c"], ...Object.entries(SU_C).flatMap(([k, v]) => [+k, v[0]]), "#ccc"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, .55, 12, .35] } },
        { id: "x-susza-l", type: "line", source: s, minzoom: 9, paint: { "line-color": "#7a4a12", "line-opacity": .25, "line-width": .6 }, noClick: true }],
      legend: suLegend,
      legendInit: box => box.querySelectorAll("[data-su]").forEach(b => b.onclick = async () => {
        const t = b.dataset.su; if (t === suT) return;
        suT = t; try { app.store.set("susza.t", t); } catch (e) {}
        box.innerHTML = suLegend(); window.ExtraLayers.LAYERS.find(L => L.id === "susza").legendInit(box);
        try { map.getSource("x-susza")?.setData(await suFile(t)); } catch (e) { app.toast("Nie udało się wczytać warstwy"); }
      }),
      card: p => { const t = SU_T[suT], c = SU_C[p.c] || ["#ccc", "brak klasy"];
        return { title: "Zagrożenie " + t[1], src: "Wody Polskie, Plan przeciwdziałania skutkom suszy 2021 (warstwy GIS zagrożenia suszą)",
          body: `<p class="gs-st"><i style="background:${c[0]}"></i>Klasa ${esc(c[1])}</p>` +
            `<p>Klasa zagrożenia w siatce heksagonów z planu z 2021 r. Pokazuje, jak często i jak silnie susza występowała w tym miejscu w latach przyjętych do analizy, nie ocenia pojedynczej działki.</p>` +
            `<p class="muted small">W projekcie aktualizacji planu (2026) klasy są podane dla całych gmin i bywają wyższe, zwłaszcza dla suszy hydrologicznej i hydrogeologicznej. <a href="?stat=${t[2]}">Pokaż klasy gmin na mapie</a> · ${link("https://www.gov.pl/web/infrastruktura/konsultacje-spoleczne-projektu-aktualizacji-planu-przeciwdzialania-skutkom-suszy-appss", "projekt aPPSS")}</p>` }; } },
    { id: "wp-zlewnie", box: "terrainLayers", label: "Stan wód w zlewniach", desc: "Zlewnie JCWP: stan, ryzyko, presje (Wody Polskie)", kw: "wody polskie zlewnie zlewnia jcwp stan wód ekologiczny chemiczny ryzyko presje plan gospodarowania wodami apgw dorzecze",
      icon: ["drop", "#1c7ed6"], url: "data/wody/zlewnie.geojson", side: "data/wody/jcwp.json", fillClick: true,
      layers: s => [
        { id: "x-wp-zlewnie-f", type: "fill", source: s, paint: { "fill-color": wpColor(wpT), "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, .55, 12, .3] } },
        { id: "x-wp-zlewnie-l", type: "line", source: s, minzoom: 7, paint: { "line-color": "#1c4f80", "line-opacity": .45, "line-width": ["interpolate", ["linear"], ["zoom"], 7, .4, 12, 1.2] }, noClick: true }],
      legend: wpLegend,
      legendInit: box => box.querySelectorAll("[data-wp]").forEach(b => b.onclick = () => {
        wpT = b.dataset.wp; try { app.store.set("wody.t", wpT); } catch (e) {}
        box.innerHTML = wpLegend(); window.ExtraLayers.LAYERS.find(L => L.id === "wp-zlewnie").legendInit(box);
        if (map.getLayer("x-wp-zlewnie-f")) map.setPaintProperty("x-wp-zlewnie-f", "fill-color", wpColor(wpT));
      }),
      card: (p, d, f, side) => ({ title: "Zlewnia: " + (p.n || p.k), src: WP_SRC, body: jcwpBody(p.k, side) + `<p class="muted small"><a href="?stat=wp_stan_zly">Gminy w zlewniach o złym stanie</a> · <a href="?stat=wp_presja_opadowa">presja wód opadowych</a></p>` }) },
    { id: "wp-rzeki", box: "terrainLayers", label: "Rzeki (jednolite części wód)", desc: "3116 odcinków rzek z planów Wód Polskich", kw: "rzeki rzeka cieki jcwp wody polskie hydrografia",
      icon: ["drop", "#1971c2"], url: "data/wody/rzeki.geojson", side: "data/wody/jcwp.json",
      layers: s => [{ id: "x-wp-rzeki", type: "line", source: s, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#1971c2", "line-opacity": .85, "line-width": ["interpolate", ["linear"], ["zoom"], 5, .6, 10, 1.6, 14, 3] } }],
      legend: () => legendRow([["#1971c2", "rzeka (JCWP)", "line"]]) + note("Linie jednolitych części wód rzecznych. Kliknij, aby zobaczyć stan i presje."),
      card: (p, d, f, side) => ({ title: p.n || "Rzeka", src: WP_SRC, body: jcwpBody(p.k, side) }) },
    { id: "wp-podziemne", box: "terrainLayers", label: "Wody podziemne (JCWPd)", desc: "Stan i ryzyko jednolitych części wód podziemnych", kw: "wody podziemne jcwpd stan chemiczny ilościowy ujęcia wody wody polskie",
      icon: ["drop", "#0b7285"], url: "data/wody/jcwpd.geojson", fillClick: true,
      layers: s => [{ id: "x-wp-pd-f", type: "fill", source: s, paint: { "fill-color": pdColor(), "fill-opacity": .35 } },
        { id: "x-wp-pd-l", type: "line", source: s, paint: { "line-color": "#0b7285", "line-width": 1.2, "line-opacity": .7 }, noClick: true }],
      legend: pdLegend,
      legendInit: box => box.querySelectorAll("[data-pd]").forEach(b => b.onclick = () => {
        pdT = b.dataset.pd; box.innerHTML = pdLegend(); window.ExtraLayers.LAYERS.find(L => L.id === "wp-podziemne").legendInit(box);
        if (map.getLayer("x-wp-pd-f")) map.setPaintProperty("x-wp-pd-f", "fill-color", pdColor());
      }),
      card: p => ({ title: "Wody podziemne " + p.k, src: WP_SRC, body: `<p class="gs-st"><i style="background:${p.s ? "#e8590c" : "#74c0fc"}"></i>Stan ${p.s ? "słaby" : "dobry"}</p>` +
        wpRow("Ryzyko", p.ryz) + wpRow("Presje", p.pres) + `<p class="muted small"><a href="?stat=wp_podziemne_slaby">Pokaż gminy na mapie</a></p>` }) },
    { id: "wp-nadzory", box: "terrainLayers", label: "Administracja wodna", desc: "Nadzory wodne, zarządy zlewni i RZGW Wód Polskich", kw: "wody polskie nadzór wodny zarząd zlewni rzgw regionalny zarząd gospodarki wodnej pozwolenie wodnoprawne urząd kontakt",
      icon: ["buildings", "#1864ab"], url: "data/wody/nadzory.geojson", fillClick: true,
      layers: s => [{ id: "x-wp-nw-f", type: "fill", source: s, paint: { "fill-color": "#1864ab", "fill-opacity": .03 } },
        { id: "x-wp-nw-l", type: "line", source: s, paint: { "line-color": "#1864ab", "line-width": ["interpolate", ["linear"], ["zoom"], 5, .5, 10, 1.6], "line-opacity": .7, "line-dasharray": [3, 2] }, noClick: true }],
      legend: () => legendRow([["#1864ab", "granica nadzoru wodnego", "dash"]]) + note("Kliknij obszar: nadzór wodny, zarząd zlewni i RZGW właściwe dla miejsca (sprawy wodnoprawne, urządzenia wodne, melioracje)."),
      card: p => ({ title: p.nw || "Nadzór wodny", src: "Wody Polskie, granice RZGW, zarządów zlewni i nadzorów wodnych (wersja 1.08, 20.12.2023)",
        body: wpRow("Siedziba nadzoru", p.siedziba) + wpRow("Zarząd zlewni", p.zz) + wpRow("Regionalny zarząd", p.rzgw) +
          `<p class="muted small">${link("https://www.gov.pl/web/wody-polskie/kontakt", "Kontakty Wód Polskich")}</p>` }) },
    { id: "wp-chronione", box: "terrainLayers", label: "Obszary chronione zależne od wód", desc: "Rejestr obszarów chronionych z planów Wód Polskich", kw: "obszary chronione wodozależne natura 2000 rezerwat park użytek ekologiczny wody polskie",
      icon: ["tree", "#2b8a3e"], url: "data/wody/chronione.geojson", fillClick: true,
      layers: s => [{ id: "x-wp-och-f", type: "fill", source: s, paint: { "fill-color": ochColor, "fill-opacity": .35 } },
        { id: "x-wp-och-l", type: "line", source: s, minzoom: 8, paint: { "line-color": ochColor, "line-width": 1 }, noClick: true }],
      legend: () => legendRow(Object.values(OCH).filter(v => !/pomnik|stanowisko/.test(v[0])).map(([l, c]) => [c, l, "box"])) + note("Obszary chronione, których stan zależy od wód (bez otulin; obszary poniżej 10 ha pominięte, poza rezerwatami, parkami narodowymi i pomnikami)."),
      card: p => ({ title: p.n || "Obszar chroniony", src: WP_SRC + ", rejestr obszarów chronionych", body: `<p class="gs-st"><i style="background:${(OCH[p.t] || ["", "#868e96"])[1]}"></i>${esc((OCH[p.t] || [p.t])[0])}</p>` }) },
    { id: "stare-mapy", box: "terrainLayers", label: "Stare mapy", desc: "Messtischblatt, WIG, topograficzna, ortofoto archiwalne, porównanie suwakiem", kw: "stare mapy archiwalne historyczne messtischblatt wig mapa topograficzna przedwojenna niemiecka pruska orzesze mikołów tychy lędziny bieruń igrek amzp ortofotomapa archiwalna zdjęcia lotnicze gugik bdot10k porównanie",
      icon: ["map-trifold", "#8d6e3f"], tiles: () => vUrl(stA), get minz() { return vOpt(stA).minz; }, get maxz() { return vOpt(stA).maxz; }, get bounds() { return vOpt(stA).bb; }, get attr() { return vOpt(stA).src; },
      layers: s => [{ id: "x-stare", type: "raster", source: s, paint: { "raster-opacity": stOp, "raster-fade-duration": 0 } }],
      legend: stLegend,
      onToggle: on => { hookStatus(); if (!on) { cmpClose(); return; }
        const S = vOpt(stA), c = map.getCenter();
        if (S.bb && (map.getZoom() < S.minz || !(c.lng > S.bb[0] && c.lng < S.bb[2] && c.lat > S.bb[1] && c.lat < S.bb[3]))) map.fitBounds([[S.bb[0], S.bb[1]], [S.bb[2], S.bb[3]]], { padding: 30 });
        else if (map.getZoom() < S.minz) map.easeTo({ zoom: S.minz });
        if (stT() === "orto") setTimeout(probeYears, 900); setTimeout(stStatus, 50); },
      legendInit: box => {
        box.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { const k = b.dataset.st; if (k === stT()) return;
          setA(k === "topo" ? "topo:92" : k === "orto" ? "orto:" + (stYears?.length ? stYears[0] : 2003) : k === "p" ? "p:" + (Object.keys(stPI || {})[0] || "") : k); });
        box.querySelectorAll("[data-stp]").forEach(b => b.onclick = () => setA("p:" + b.dataset.stp));
        box.querySelectorAll("[data-stgo]").forEach(a => a.onclick = e => { e.preventDefault(); map.easeTo({ center: a.dataset.stgo.split(",").map(Number), zoom: +(a.dataset.stz || 12.5) }); });
        box.querySelectorAll("[data-sty]").forEach(b => b.onclick = () => setA("orto:" + b.dataset.sty));
        box.querySelectorAll("[data-ste]").forEach(b => b.onclick = () => setA("topo:" + b.dataset.ste));
        const op = box.querySelector("[data-sto]");
        if (op) { const paint = () => op.style.setProperty("--v", op.value + "%"); paint();
          op.oninput = () => { stOp = 1 - op.value / 100; box.querySelector("[data-sto-out]").textContent = op.value + "%"; paint(); if (map.getLayer("x-stare")) map.setPaintProperty("x-stare", "raster-opacity", stOp); }; }
        const cb = box.querySelector("[data-cmp]"); if (cb) cb.onclick = () => { if (cmp) cmpClose(); else cmpOpen(); refreshLegend(); };
        const sel = box.querySelector("[data-cmpb]"); if (sel) sel.onchange = () => { cmpB = sel.value; cmpSetB(); };
        const go = box.querySelector("[data-st-go]"); if (go) go.onclick = e => { e.preventDefault(); const bb = STARE_BB(); map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 30 }); };
        stStatus();
      } },
    { id: "cieniowanie", box: "terrainLayers", label: "Cieniowanie terenu", desc: "Rzeźba terenu z numerycznego modelu terenu", kw: "cieniowanie terenu rzeźba hillshade nmt numeryczny model terenu wysokości ukształtowanie skarpy doliny lidar",
      icon: ["mountains", "#6b6b6b"], tiles: () => wmsT(`${GPW}/PZGIK/NMT/GRID1/WMS/ShadedRelief`, "Raster", "", "image/png"), minz: 9, attr: "GUGiK, cieniowanie numerycznego modelu terenu (geoportal.gov.pl)",
      layers: s => [{ id: "x-cieniowanie", type: "raster", source: s, paint: { "raster-opacity": .45, "raster-fade-duration": 0 } }],
      legend: () => note("Cieniowanie rzeźby terenu z numerycznego modelu terenu GUGiK (lotniczy skaning laserowy). Działa razem ze starymi mapami: włącz obie warstwy, żeby zobaczyć rzeźbę pod dawną mapą. Źródło: GUGiK, geoportal.gov.pl.") },
    { id: "gleby", box: "terrainLayers", label: "Mapa glebowo-rolnicza", desc: "Kompleksy przydatności rolniczej gleb", kw: "gleby gleba mapa glebowo rolnicza kompleksy przydatności rolniczej bonitacja grunty orne pszenny żytni użytki zielone oze fotowoltaika",
      icon: ["leaf", "#8a5a2b"], tiles: () => wmsT(`${GPW}/pub/guest/MapaGlebowoRolnicza/MapServer/WMSServer`, "0", "&TRANSPARENT=TRUE", "image/png"), minz: 11, attr: "GUGiK, mapa glebowo-rolnicza",
      layers: s => [{ id: "x-gleby", type: "raster", source: s, paint: { "raster-opacity": .7, "raster-fade-duration": 0 } }],
      legend: () => legendRow([["#732600","1 pszenny bardzo dobry","box"],["#d3715b","2 pszenny dobry","box"],["#fac1a2","3 pszenny wadliwy","box"],["#fe6b00","4 żytni bardzo dobry","box"],["#febe00","5 żytni dobry","box"],["#fefa00","6 żytni słaby","box"],["#fef680","7 żytni bardzo słaby","box"],["#004c73","8 zbożowo-pastewny mocny","box"],["#1482ff","9 zbożowo-pastewny słaby","box"],["#a80084","10–14 górskie","box"],["#4c7300","1z użytki zielone bardzo dobre i dobre","box"],["#88c31f","2z użytki zielone średnie","box"],["#c7ee98","3z użytki zielone słabe","box"]]) + note("Kompleksy przydatności rolniczej gleb. Białe kropki to tereny leśne lub poza gruntami rolnymi, kreskowanie to zabudowa. Widoczna po przybliżeniu mapy. Źródło: GUGiK, mapa glebowo-rolnicza (usługa WMS, geoportal.gov.pl).") +
        `<p class="small"><a href="${GPW}/pub/guest/MapaGlebowoRolnicza/MapServer/WMSServer?request=GetLegendGraphic&version=1.3.0&format=image/png&layer=0" target="_blank" rel="noopener">Pełna legenda GUGiK (typy i gatunki gleb)</a></p>` },
  ];
  /* Etykiety ciekawostek: [warstwa, filtr, tekst, opcje] dopisywane jako warstwy symboli */
  const LBL = {
    "ulice-dl": [[["==", ["get", "k"], "u"], ["get", "n"], { line: true }], [["==", ["get", "k"], "k"], ["concat", ["get", "n"], " · ", ["to-string", ["get", "d"]], " m"], { minzoom: 10 }]],
    "urzad-daleko": [[["==", ["get", "k"], "w"], ["concat", ["get", "n"], " · ", ["to-string", ["get", "d"]], " km"], { line: true }], [["==", ["get", "k"], "s"], ["get", "n"], {}]],
    "rekordy-granic": [[["==", ["get", "k"], "L"], ["concat", ["get", "a"], " / ", ["get", "b"]], { line: true }], [["==", ["get", "k"], "S"], ["concat", ["get", "a"], " / ", ["get", "b"], " · ", ["to-string", ["get", "m"]], " m"], {}]],
    "granice-bud": [[["has", "a"], ["concat", ["to-string", ["get", "a"]], " m²"], { minzoom: 12 }]],
    "odludzia": [[["!=", ["get", "k"], "s"], ["concat", ["to-string", ["/", ["round", ["/", ["get", "d"], 100]], 10]], " km"], {}], [["==", ["get", "k"], "s"], ["concat", ["to-string", ["get", "d"]], " m"], { minzoom: 9 }]],
    "wezly": [[["has", "g"], ["concat", ["to-string", ["get", "n"]], " gminy"], { minzoom: 9 }]],
    "enklawy": [[["any", ["==", ["get", "e"], "dziwp"], ["all", ["==", ["get", "e"], "dziw"], ["==", ["geometry-type"], "Point"]]], ["concat", ["get", "n"], " w gm. ", ["get", "s"]], {}], [["==", ["get", "e"], "enk"], ["get", "n"], { minzoom: 8 }]],
    "ulice-granica": [[["has", "u"], ["concat", "ul. ", ["get", "u"]], { minzoom: 8 }]],
    "srodki": [[["has", "n"], ["get", "n"], {}]],
    "ksztalty": [[["has", "n"], ["get", "n"], { minzoom: 6.5, off: 1.3 }]],
  };
  for (const L of LAYERS) { const ls = LBL[L.id]; if (!ls) continue; const orig = L.layers;
    L.layers = s => [...orig(s), ...ls.map(([f, txt, o], i) => ({ id: `x-${L.id}-tx${i}`, type: "symbol", source: s, filter: f, minzoom: o.minzoom || 0, noClick: true,
      layout: o.line ? { "symbol-placement": "line", "text-field": txt, "text-size": 12, "text-font": ["Noto Sans Bold"], "text-max-angle": 30 }
        : { "text-field": txt, "text-size": 12, "text-font": ["Noto Sans Bold"], "text-offset": [0, o.off || 1.1], "text-anchor": "top", "text-max-width": 12, "text-optional": true },
      paint: { "text-color": "#212529", "text-halo-color": "#fff", "text-halo-width": 2 } }))]; }
  const BUDM = [["gb", "budynki na km²", "/km²"], ["b", "liczba budynków", ""], ["m", "budynki mieszkalne", ""], ["pm", "udział mieszkalnych (%)", "%"], ["gd", "gospodarcze na 1 dom", ""], ["sa", "średnia powierzchnia budynku (m²)", "m²"], ["sk", "średnia liczba kondygnacji", ""], ["bl", "budynki 5+ kondygnacji", ""], ["le", "domy letniskowe i kempingowe", ""], ["sz", "szklarnie", ""], ["ho", "budynki hodowlane", ""], ["ko", "kościoły i kaplice", ""], ["wb", "budynki w budowie", ""], ["rz", "nieczynne i zniszczone", ""], ["mx", "największy budynek (m²)", "m²"], ["pj", "pozwolenia na domy 2016–2025", ""], ["pjm", "pozwolenia na domy na 100 istniejących", ""], ["pj5", "pozwolenia na domy od 2021", ""], ["ro", "rozbiórki 2016–2025", ""]];
  const BUDC = ["#fff4e6", "#ffd8a8", "#ffa94d", "#fd7e14", "#d9480f", "#862e0f"];
  let budCur = "gb", budData = null, budQ = {};
  const budQuant = k => { if (budQ[k]) return budQ[k]; if (!budData) return null; const v = budData.features.map(f => f.properties[k]).filter(x => x != null).sort((a, b) => a - b); if (!v.length) return null; const q = [1, 2, 3, 4, 5].map(i => v[Math.floor(i * v.length / 6)]); for (let i = 1; i < 5; i++) if (q[i] <= q[i - 1]) q[i] = q[i - 1] + 1e-6; return budQ[k] = q; };
  function BudPaint(k) { const q = budQuant(k) || { gb: [10, 25, 50, 150, 500] }[k] || [1, 2, 3, 4, 5]; return ["step", ["coalesce", ["get", k], -1], BUDC[0], ...q.flatMap((v, i) => [v, BUDC[i + 1]])]; }
  const budLegend = () => { const q = budQuant(budCur) || [10, 25, 50, 150, 500], d = x => fmt(x, x < 10 && x % 1 ? 1 : 0); return legendRow(BUDC.map((c, i) => [c, i ? (i < 5 ? `${d(q[i - 1])} do ${d(q[i])}` : `od ${d(q[4])}`) : `poniżej ${d(q[0])}`])); };
  const NTK = { zw: ["Zwierzęta", "#2b8a3e"], je: ["Jedzenie", "#e8590c"], ko: ["Kolory", "#1971c2"], sw: ["Kraje i miasta świata", "#5f3dc4"], fu: ["Śmieszne nazwy", "#e64980"], li: ["Liczebniki", "#495057"], ns: ["Pary Nowa i Stara", "#0c8599"], bl: ["Ta sama nazwa najbliżej", "#c92a2a"], hu: ["Huta (dawne huty)", "#a61e4d"], wo: ["Wola i Wólka", "#9c36b5"], ol: ["Osady leśne", "#2f9e44"], hi: ["Dawne nazwy", "#866e00"], sa: ["Jedna samogłoska", "#364fc7"], sz: ["Najwięcej ż, ź, ś", "#d9480f"] };
  const NSUF = [["ice", "#c92a2a", "-ice, -owice"], ["owo", "#1971c2", "-owo, -ewo"], ["ów", "#2b8a3e", "-ów, -ew"], ["in", "#7048e8", "-in, -yn"], ["no", "#e67700", "-no, -na"], ["isko", "#0c8599", "-isko, -iska"], ["ki", "#d6336c", "-ki, -ka, -ko"], ["y", "#868e96", "-y, -i"]];
  const UTK = { pt: ["Patroni ulic", "#c2255c"], bo: ["Kwiatowe i owocowe", "#e64980"], mi: ["Miesiące i dni", "#1971c2"], kd: ["Krótka dłuższa niż Długa", "#2b8a3e"], mc: ["Ulica innego miasta, najdalej", "#5f3dc4"], dl: ["Najdłuższe nazwy ulic", "#e8590c"] };
  const UPAT = [["Jana Pawła II", "#fab005"], ["Piłsudskiego", "#495057"], ["Mickiewicza", "#1971c2"], ["Kościuszki", "#2b8a3e"], ["Sienkiewicza", "#e8590c"], ["Kopernika", "#7048e8"], ["Konopnickiej", "#e64980"], ["Chopina", "#0c8599"], ["Słowackiego", "#c92a2a"], ["Żeromskiego", "#a61e4d"], ["Wyszyńskiego", "#f08c00"], ["Reymonta", "#5c940d"]];
  const ntCur = { "x-nazwy-tem": "zw", "x-ulice-tem": "pt" };
  window.NazwySel = (id, k) => { ntCur[id] = k; const m = window.PLOTS?.map; [id, id + "-lbl"].forEach(l => { if (m?.getLayer(l)) m.setFilter(l, ["==", ["get", "k"], k]); }); };
  window.NazwySuf = s => { const m = window.PLOTS?.map; if (m?.getLayer("x-nazwy-suf")) m.setFilter("x-nazwy-suf", s ? ["==", ["get", "s"], s] : null); };
  fetch("data/granice/ulice_popularne.json").then(r => r.json()).then(j => { window.ULPOP = j; }).catch(() => {});
  window.BudMetric = k => { budCur = k; const m = window.PLOTS?.map; if (m?.getLayer("x-bud-gmin")) m.setPaintProperty("x-bud-gmin", "fill-color", BudPaint(k)); const e = document.getElementById("budLeg"); if (e) e.innerHTML = budLegend(); };
  const TITLES = { transportLayers: "Drogi i kolej", limitLayers: "Lotnictwo, wojsko, przesył", heritageLayers: "Zabytki", curioLayers: "Rekordy i ciekawostki", urbexLayers: "Opuszczone miejsca", youtubeLayers: "Z YouTube" };
  window.ExtraLayers = { LAYERS, legendRow, note, row, link, fmt };

  /* ---------- engine ---------- */
  const cache = {};
  const load = L => cache[L.url] || (cache[L.url] = (L.fetch ? L.fetch() : fetch(L.url, { cache: "no-cache" }).then(r => { if (!r.ok) throw Error(r.status); return r.json(); })).catch(e => { delete cache[L.url]; throw e; }));
  const raw = {}, sideData = {};
  const firstSymbol = () => map.getStyle().layers.find(l => l.type === "symbol")?.id;
  const added = new Set();
  let pmOn = false;  /* kafle wektorowe z jednego pliku PMTiles obok strony */
  const vtSource = L => { if (!pmOn && window.pmtiles) { try { maplibregl.addProtocol("pmtiles", new pmtiles.Protocol().tile); } catch (e) {} pmOn = true; }
    return { type: "vector", url: "pmtiles://" + new URL(L.vtiles, location.href).href, attribution: L.attr || "" }; };
  /* Rankingi 4FUN: L.rank(dane) -> [{t: tytuł, c: kolor, items: [[nazwa, liczba, jednostka, [lon, lat], podpis]]}] */
  function renderRank(L, leg, d) {
    let secs; try { secs = L.rank(d) || []; } catch (e) { console.warn(e); return; }
    if (!secs.length) return;
    const box = document.createElement("div"); box.className = "fun-rank";
    box.innerHTML = `<div class="fun-tabs">${secs.map((s, i) => `<button type="button" data-i="${i}" class="${i ? "" : "on"}" style="--c:${s.c || "#7048e8"}">${esc(s.t)}</button>`).join("")}</div><ol class="fun-list"></ol>`;
    const list = box.querySelector("ol");
    const show = i => {
      const s = secs[i], mx = Math.max(...s.items.map(r => Math.abs(r[1]) || 0)) || 1;
      box.querySelectorAll(".fun-tabs button").forEach(b => b.classList.toggle("on", +b.dataset.i === i));
      list.style.setProperty("--c", s.c || "#7048e8");
      list.innerHTML = s.items.map((r, k) => `<li data-k="${k}"><span class="fr-n">${k + 1}</span><span class="fr-t">${esc(r[0])}${r[4] ? `<small>${esc(r[4])}</small>` : ""}</span><span class="fr-v">${typeof r[1] === "number" ? fmt(r[1], Math.abs(r[1]) < 10 && r[1] % 1 ? 1 : 0) : esc(r[1] ?? "")}${r[2] ? " " + esc(r[2]) : ""}</span><i style="width:${Math.max(4, 100 * Math.abs(r[1] || 0) / mx)}%"></i></li>`).join("");
      list.onclick = e => { const li = e.target.closest("li"); if (!li) return; const r = s.items[+li.dataset.k]; if (!r[3]) return;
        list.querySelectorAll("li.on").forEach(x => x.classList.remove("on")); li.classList.add("on");
        const gid = window.MunicipalityContext?.local?.(r[3][0], r[3][1]);
        /* rankingi gmin: jak kliknięcie gminy na mapie (granica, sąsiedzi, panel); pozostałe: przelot i granica gminy w tle */
        if (L.gmina && gid) { window.PLOTS_GMINY.select(gid, true); return; }
        map.flyTo({ center: r[3], zoom: r[5] || 12, speed: 1.6 }); if (L.showGmina && gid) window.MunicipalBoundaries?.show(gid); };
    };
    box.querySelector(".fun-tabs").onclick = e => { const b = e.target.closest("button"); if (b) show(+b.dataset.i); };
    leg.querySelector(".fun-rank")?.remove(); leg.prepend(box); show(0);
  }
  const P = f => f.properties, XY = f => { const g = f.geometry, c = g.coordinates; return g.type === "Point" ? c : g.type === "LineString" ? c[Math.floor(c.length / 2)] : g.type === "Polygon" ? c[0][0] : g.type === "MultiPolygon" ? c[0][0][0] : c[0][0]; };
  const top = (fs, key, n = 10, asc = false) => [...fs].sort((a, b) => asc ? key(a) - key(b) : key(b) - key(a)).slice(0, n);
  async function apply(L, on) {
    const leg = document.getElementById("x-leg-" + L.id);
    if (leg) { leg.hidden = !on; if (on) leg.innerHTML = L.legend(); }
    if (on && !added.has(L.id)) {
      let d = null;
      if (!L.tiles && !L.vtiles) { try { d = await load(L); } catch (e) { app.toast("Nie udało się wczytać warstwy"); return; } }
      raw[L.id] = d;
      if (L.side) fetch(L.side).then(r => r.ok ? r.json() : null).then(x => { sideData[L.id] = x; }).catch(() => {});
      if (L.side2) fetch(L.side2[1]).then(r => r.ok ? r.json() : null).then(x => { sideData[L.side2[0]] = x; }).catch(() => {});
      const src = "x-" + L.id;
      for (let i = 0; i < 100 && !map.isStyleLoaded(); i++) await new Promise(r => setTimeout(r, 150));  /* styl mapy może się jeszcze przeładowywać (zmiana podkładu) */
      try {
        if (!map.getSource(src)) { map.addSource(src, L.vtiles ? vtSource(L) : L.tiles ? { type: "raster", tiles: [L.tiles()], tileSize: 256, minzoom: L.minz || 0, maxzoom: L.maxz || 19, ...(L.bounds ? { bounds: L.bounds } : {}), attribution: L.attr || "" } : { type: "geojson", data: L.toGeo ? L.toGeo(d) : d, attribution: L.attr || "" }); app.registerOverlaySource?.(src); }
        for (const spec of L.layers(src)) if (!map.getLayer(spec.id)) map.addLayer(spec, spec.type === "fill" || spec.type === "line" || spec.type === "raster" ? firstSymbol() : undefined);
        added.add(L.id); L._retry = 0;
      } catch (e) { /* styl jeszcze się przeładowuje: spróbuj ponownie, gdy mapa będzie gotowa */ L._retry = (L._retry || 0) + 1; if (L._retry < 30) setTimeout(() => { if (document.getElementById("x-" + L.id)?.checked && !added.has(L.id)) apply(L, true); }, 400); return; }
    }
    if (!added.has(L.id)) return;
    { const cb = document.getElementById("x-" + L.id); if (cb) on = cb.checked; }  /* stan mógł się zmienić w czasie wczytywania */
    for (const spec of L.layers("x-" + L.id)) if (map.getLayer(spec.id)) map.setLayoutProperty(spec.id, "visibility", on ? "visible" : "none");
    if (on && leg && L.legendInit) L.legendInit(leg);
    if (on && leg && L.rank && raw[L.id]) renderRank(L, leg, raw[L.id]);
    L.onToggle?.(on);
  }
  function mount() {
    const boxes = {};
    const ORDER = ["nazwy-msc", "ksztalty", "proste", "odludzia", "wysokosci", "enklawy", "rekordy-granic", "ulice-dl", "urzad-daleko"], ord = L => { const i = ORDER.indexOf(L.id); return i < 0 ? 99 : i; };
    for (const L of [...LAYERS].sort((a, b) => a.box === "curioLayers" && b.box === "curioLayers" ? ord(a) - ord(b) : 0)) (boxes[L.box] = boxes[L.box] || []).push(L);
    for (const [id, ls] of Object.entries(boxes)) {
      const el = document.getElementById(id); if (!el) continue;
      const html = ls.map(L => `<div class="layer-entry" data-keywords="${esc(L.kw)}"><label class="sw"><input type="checkbox" id="x-${L.id}"/><span></span><div>${esc(L.label)}<small>${esc(L.desc)}</small></div></label><div class="terr-legend-box" id="x-leg-${L.id}" hidden></div></div>`).join("");
      if (!el.querySelector(":scope > h3")) el.insertAdjacentHTML("afterbegin", `<h3>${esc(TITLES[id] || "")}</h3>`);
      const tail = el.querySelector(":scope > p.source-note");
      if (tail) tail.insertAdjacentHTML("beforebegin", html); else el.insertAdjacentHTML("beforeend", html);
    }
    window.LayerLook = Object.assign(window.LayerLook || {}, Object.fromEntries(LAYERS.map(L => ["x-" + L.id, L.icon])));
    window.LayerImg = Object.assign(window.LayerImg || {}, Object.fromEntries(LAYERS.filter(L => L.img).map(L => ["x-" + L.id, L.img])));
    for (const L of LAYERS) {
      const cb = document.getElementById("x-" + L.id); if (!cb) continue;
      cb.checked = app.store.get("extra." + L.id, false);
      cb.onchange = () => { app.store.set("extra." + L.id, cb.checked); apply(L, cb.checked); if (cb.checked && L.minz && map.getZoom() < L.minz) app.toast("Przybliż mapę, aby zobaczyć tę warstwę"); };
    }
  }
  mount();
  function init() { for (const L of LAYERS) if (document.getElementById("x-" + L.id)?.checked) apply(L, true); document.getElementById("layerPanel")?.dispatchEvent(new Event("change", { bubbles: true })); }
  if (map.isStyleLoaded()) init(); else map.once("load", init);
  map.on("styledata", () => { for (const L of LAYERS) if (added.has(L.id) && !map.getLayer(L.layers("x-" + L.id)[0].id)) { added.delete(L.id); if (document.getElementById("x-" + L.id)?.checked) apply(L, true); } });

  function card(L, f, ll) {
    const c = L.card(f.properties || {}, raw[L.id], f, sideData[L.id]); if (!c) return false;
    const [lon, lat] = ll;
    if (L.showGmina) { const gid = window.MunicipalityContext?.local?.(lon, lat); if (gid) window.MunicipalBoundaries?.show(gid); }
    app.showInfo(`<div class="phead"><h2>${esc(c.title || L.label)}</h2></div><div class="en-card">${c.body || ""}<p><small class="muted">Źródło: ${esc(c.src || "")}</small></p>
      <p><a href="https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}" target="_blank" rel="noopener noreferrer">Zobacz w Google Maps</a></p></div>`);
    return true;
  }
  function handleClick(e) {
    const vis = id => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none";
    const r = window.matchMedia("(max-width: 760px)").matches ? 14 : 8;
    const box = [[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]];
    for (const L of LAYERS) {
      if (!added.has(L.id) || !L.card) continue;
      const specs = L.layers("x-" + L.id).filter(s => s.type !== "symbol" && s.type !== "raster" && (s.type !== "fill" || L.fillClick) && !s.noClick && vis(s.id));
      if (!specs.length) continue;
      // points and lines get a finger-sized box; areas only the exact point, so a point inside an area wins
      const near = specs.filter(s => s.type !== "fill").map(s => s.id), areas = specs.filter(s => s.type === "fill").map(s => s.id);
      let hits = near.length ? map.queryRenderedFeatures(box, { layers: near }) : [];
      if (!hits.length && areas.length) hits = map.queryRenderedFeatures(e.point, { layers: areas });
      if (!hits.length) continue;
      const pick = hits.map(f => { const g = f.geometry, c = g.type === "Point" ? g.coordinates : [e.lngLat.lng, e.lngLat.lat], q = map.project(c); return [Math.hypot(q.x - e.point.x, q.y - e.point.y), f, c]; }).sort((a, b) => a[0] - b[0])[0];
      if (card(L, pick[1], pick[2])) return true;
    }
    return false;
  }
  window.ExtraLayers.handleClick = handleClick;
  window.ExtraLayers.data = id => { const L = LAYERS.find(x => x.id === id); return L ? load(L) : Promise.reject(); };
  window.ExtraLayers.show = id => { const cb = document.getElementById("x-" + id); if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); } };

  /* Nearest GIOŚ station in the air quality section of the place card. */
  window.GiosNear = async function (place, box) {
    let d; try { d = await window.ExtraLayers.data("gios"); } catch (e) { return; }
    if (!box.isConnected) return;
    const here = { lon: +place.lon, lat: +place.lat };
    const best = d.stacje.map(s => [dist(here, s), s]).filter(x => Object.keys(x[1].pom).length).sort((a, b) => a[0] - b[0])[0];
    if (!best) return;
    const [m, s] = best, keys = Object.keys(PNAME).filter(k => s.pom[k] != null && s.mod[k] != null).slice(0, 4);
    const dg = k => PUNIT[k] === "ng/m³" ? 2 : PUNIT[k] === "dni" ? 0 : 1;
    box.insertAdjacentHTML("beforeend", `<div class="zas-block gs-near"><div class="zas-head"><span class="zas-ic" style="--c:#34a383">${svg("broadcast")}</span><div><b>Najbliższa stacja pomiarowa</b><small>${esc(s.n)} · ${fmtD(m)} stąd</small></div><button type="button" class="zas-map" data-gios-show="${s.id}">${svg("map-trifold")}Mapa</button></div>
      ${keys.length ? `<div class="zas-chips">${keys.map(k => `<span>${esc(PNAME[k])}: <b>${fmt(s.pom[k], dg(k))}</b> pomiar, ${fmt(s.mod[k], dg(k))} model</span>`).join("")}</div>` : ""}
      <p class="muted small">Średnie roczne ${d.rok} r. ${s.typ ? `Stacja ${esc(s.typ)}${s.obszar ? ", obszar " + esc(s.obszar) : ""}.` : ""} Model GIOŚ jest dopasowany do pomiarów, więc przy stacji obie wartości są zbliżone, a dalej od niej rośnie niepewność. ${link(`https://powietrze.gios.gov.pl/pjp/current/station_details/info/${s.id}`, "Bieżące pomiary")}</p></div>`);
  };
  document.getElementById("card")?.addEventListener("click", e => {
    const b = e.target.closest("[data-gios-show]"); if (!b) return;
    window.ExtraLayers.show("gios");
    window.ExtraLayers.data("gios").then(d => { const s = d.stacje.find(x => x.id === +b.dataset.giosShow); if (s) map.easeTo({ center: [s.lon, s.lat], zoom: Math.max(map.getZoom(), 12), duration: 700 }); });
  });
})();
