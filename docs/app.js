/* global maplibregl, PLOTS_CONFIG, GRUPY_REJ, GRUPY_COLORS */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const CFG = window.PLOTS_CONFIG || {};
  const BASE = (params.get("tiles") || CFG.TILES_URL || "http://127.0.0.1:5001").replace(/\/$/, "");
  const MINZ = +(params.get("minzoom") || CFG.MIN_ZOOM || 13);
  const ADR_MINZ = +(CFG.ADR_MIN_ZOOM || 16);
  window.PLOTS_CFG_MINZ = MINZ;
  const GR = window.GRUPY_REJ || {};
  const COL = window.GRUPY_COLORS || {};
  const isMobile = () => matchMedia("(max-width:767px)").matches;
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem("plots." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem("plots." + k, JSON.stringify(v)); } catch (e) {} }
  };
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Basemaps (verified EPSG:3857 endpoints) ---------- */
  const GP = "https://mapy.geoportal.gov.pl/wss/service";
  const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
  const BASEMAPS = [
    { id: "map", name: "Mapa", style: true, url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`, max: 19, attr: "© Esri" },
    { id: "gp-orto", name: "Ortofoto", url: `${GP}/PZGIK/ORTO/WMTS/StandardResolution?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}`, max: 19, attr: "© GUGiK geoportal.gov.pl" },
  ];
  const overlaySourceIds = new Set(["dzialki", "adresy"]);
  let bmId = store.get("basemap", "map");
  if (!BASEMAPS.some((b) => b.id === bmId)) bmId = /img|orto|hr/.test(bmId) ? "gp-orto" : "map";

  /* ---------- Map ---------- */
  const view = store.get("view", { center: [19.2, 52.1], zoom: 6 });
  const linkView = [Number(params.get("lon")), Number(params.get("lat")), Number(params.get("z"))];
  if (params.has("lon") && params.has("lat") && params.has("z") && linkView.every(Number.isFinite) && Math.abs(linkView[0]) <= 180 && Math.abs(linkView[1]) <= 85 && linkView[2] >= 0 && linkView[2] <= 21) {
    view.center = linkView.slice(0, 2); view.zoom = linkView[2];
  }
  const map = new maplibregl.Map({
    container: "map",
    style: { version: 8, sources: {}, layers: [], glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf" },
    center: view.center, zoom: view.zoom, maxZoom: 21, attributionControl: { compact: true }, dragRotate: false
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

  let basemapRequest = 0;
  async function setBasemap(id, save) {
    const requestId = ++basemapRequest;
    const b = BASEMAPS.find((x) => x.id === id) || BASEMAPS[0];
    let baseStyle;
    if (b.style) {
      try {
        const response = await fetch("styles/map-light.json", { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error("Map style unavailable");
        baseStyle = await response.json();

      } catch (error) {
        if (requestId !== basemapRequest) return;
        toast("Wczytano zapasowy podkład mapy. Spróbuj ponownie później.");
      }
    }
    // Imagery gets street and place names from the vector map (OpenFreeMap / OSM), restyled for photos.
    let labels = null;
    if (!b.style) {
      try {
        const response = await fetch("styles/map-light.json", { signal: AbortSignal.timeout(10000) });
        if (response.ok) {
          const vector = await response.json(), keep = /^(highway-name-(path|minor|major)|label_(village|town|city|city_capital|other)|water_name_(point|line)_label|waterway_line_label)$/;
          const name = ["coalesce", ["get", "name:pl"], ["get", "name"]], show = store.get("orthoLabels", true) ? "visible" : "none";
          labels = { sources: { openmaptiles: vector.sources.openmaptiles }, layers: vector.layers.filter(l => keep.test(l.id)).map(l => ({ ...l, id: "ortho-" + l.id,
            layout: { ...l.layout, "text-field": name, visibility: show },
            paint: { ...l.paint, "text-color": /water/.test(l.id) ? "#cfe8ff" : "#ffffff", "text-halo-color": "rgba(0,0,0,.82)", "text-halo-width": 1.6, "text-halo-blur": 0.4 } })),
            glyphs: vector.glyphs };
        }
      } catch { /* Labels are optional on imagery. */ }
    }
    if (requestId !== basemapRequest) return;
    if (!baseStyle) baseStyle = {
      version: 8, glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      sources: { base: { type: "raster", tiles: [b.url || BASEMAPS[0].url], tileSize: 256, maxzoom: b.max, attribution: b.attr } },
      layers: [{ id: "base", type: "raster", source: "base", paint: { "raster-fade-duration": 200 } }]
    };
    if (labels) { baseStyle.sources = { ...baseStyle.sources, ...labels.sources }; baseStyle.layers = [...baseStyle.layers, ...labels.layers]; baseStyle.glyphs = labels.glyphs || baseStyle.glyphs; }
    const current = map.getStyle(), overlaySources = {};
    overlaySourceIds.forEach((key) => { if (current.sources[key]) overlaySources[key] = current.sources[key]; });
    const overlays = current.layers.filter((layer) => Object.prototype.hasOwnProperty.call(overlaySources, layer.source));
    const isLabel = (l) => l.id.startsWith("ortho-");
    map.setStyle({ ...baseStyle, sources: { ...baseStyle.sources, ...overlaySources }, layers: [...baseStyle.layers.filter((l) => !isLabel(l)), ...overlays, ...baseStyle.layers.filter(isLabel)] });
    bmId = b.id; if (save !== false) store.set("basemap", b.id);
    document.querySelectorAll(".bm").forEach((el) => el.setAttribute("aria-pressed", el.dataset.id === b.id));
    // lighter outlines on imagery / dark maps
    if (map.getLayer("dz-line")) map.setPaintProperty("dz-line", "line-color", /img|orto|hr|dark/.test(b.id) ? "#ffffff" : "#1b1e24");
  }
  const bmBox = $("#basemaps");
  BASEMAPS.forEach((b) => {
    const el = document.createElement("button");
    el.className = "bm"; el.dataset.id = b.id; el.type = "button"; el.setAttribute("aria-pressed", "false");
    el.innerHTML = `<span>${esc(b.name)}</span>`;
    el.onclick = () => setBasemap(b.id);
    bmBox.appendChild(el);
  });

  /* ---------- Legend ---------- */
  const leg = $("#legend");
  Object.keys(GR).forEach((k) => {
    leg.insertAdjacentHTML("beforeend", `<div class="row"><i style="background:${COL[k] || "#999"}"></i><div><b>${k}</b>${esc(GR[k])}</div></div>`);
  });
  leg.insertAdjacentHTML("beforeend", `<div class="row"><i style="background:${COL.brak || "#ccc"}"></i><div><b>–</b>brak / nieustalone</div></div>`);

  const matchExpr = ["match", ["to-string", ["get", "g1"]]];
  Object.keys(COL).forEach((k) => { if (k !== "brak") matchExpr.push(k, COL[k]); });
  matchExpr.push(COL.brak || "#bdc3c7");

  /* ---------- Panel / tabs / bottom sheet ---------- */
  const panel = $("#panel");
  const tbar = $("#tabbar");
  let curTab = "info";
  function openLayers(legend) {
    window.PlaceUI?.closePalette();document.body.classList.add("layers-open");
    window.UIHistory?.open("layers",closeLayers);$("#layerPanel").hidden = false; $("#layersFab").setAttribute("aria-expanded", "true");
    if (legend) { window.LayerControls?.show("map");$("#legendDetails").open = true; const parent=$("#legendDetails").closest(".layer-section");if(parent)parent.open=true; $("#legendDetails").scrollIntoView({ block: "nearest" }); }
  }
  function closeLayers() { window.UIHistory?.dismiss("layers"); document.body.classList.remove("layers-open"); $("#layerPanel").hidden = true; $("#layersFab").setAttribute("aria-expanded", "false"); }
  function tab(name) {
    if (name === "layers" || name === "legend") { openLayers(name === "legend"); return; }
    curTab = name;
    document.querySelectorAll(".tabs button, #tabbar button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === name));
    document.querySelectorAll(".pane").forEach((p) => { p.classList.toggle("on", p.dataset.pane === name); p.hidden = p.dataset.pane !== name; });
    panel.querySelector(".tabbody").scrollTop = 0;
    document.dispatchEvent(new CustomEvent("plots:tab",{detail:name}));
  }
  document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => { tab(b.dataset.tab); if (isMobile()) snap("half"); }));
  $(".tabs").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault(); const buttons = [...document.querySelectorAll(".tabs button")];
    const current = buttons.indexOf(document.activeElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (current + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].click(); buttons[next].focus();
  });
  document.querySelectorAll("#tabbar button").forEach((b) => (b.onclick = () => {
    const t = b.dataset.tab;
    if (t === "search") { snap("hidden"); b.setAttribute("aria-selected", "true"); $("#q").focus(); return; }
    if (curTab === t && panel.dataset.snap !== "hidden") { snap("hidden"); return; }
    tab(t); snap(t === "info" ? (card.classList.contains("empty") ? "peek" : "half") : "half");
  }));
  $("#layersFab").onclick = () => { $("#layerPanel").hidden ? openLayers() : closeLayers(); };
  document.querySelectorAll("[data-open-layers]").forEach((b) => b.onclick = () => openLayers());
  document.querySelectorAll("[data-open-legend]").forEach((b) => b.onclick = () => openLayers(true));
  $("[data-close-layers]").onclick = closeLayers;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLayers(); if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !$("#gminaDialog").open) { e.preventDefault(); $("#q").focus(); } });
  $("#layerFilter").addEventListener("input", (e) => {
    const needle = window.GminyModel.normalize(e.target.value); let count = 0;
    document.querySelectorAll(".layer-entry").forEach((row) => { row.hidden = !window.GminyModel.normalize(row.dataset.keywords).includes(needle); if (!row.hidden) count++; });
    $("#noLayers").hidden = count > 0;
  });
  // snap positions (px from top of sheet, i.e. translateY)
  function sheetH() { return panel.getBoundingClientRect().height; }
  function snapY() {
    const h = sheetH(), vh = window.innerHeight;
    const peek = 170, half = Math.min(h, Math.max(320, Math.min(480, vh * 0.62)));
    return { hidden: h + 20, peek: h - peek, half: h - half, full: 0 };
  }
  function visibleSheet() { if (!isMobile()) return 0; const y = snapY()[panel.dataset.snap] || 0; return Math.max(0, sheetH() - y); }
  function snap(s) {
    panel.dataset.snap = s;
    document.body.classList.toggle("map-tight", isMobile() && window.innerHeight-visibleSheet()<300);
    if (isMobile()) panel.style.transform = `translateY(${snapY()[s]}px)`; else panel.style.transform = "";
    document.body.dataset.snap = s;
    $("#collapse").setAttribute("aria-expanded", String(isMobile() ? s !== "hidden" : !document.body.classList.contains("collapsed")));
    $("#collapse").setAttribute("aria-label", s === "hidden" && isMobile() ? "Otwórz panel" : "Zwiń panel");
    if (isMobile()) document.documentElement.style.setProperty("--sheetvis", visibleSheet() + "px");
    if (s === "hidden") document.querySelectorAll("#tabbar button").forEach((b) => b.dataset.tab !== "search" && b.setAttribute("aria-selected", "false"));
    else document.querySelectorAll("#tabbar button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === curTab));
  }
  window.addEventListener("resize", () => snap(panel.dataset.snap || "hidden"));
  snap("peek");
  $("#collapse").onclick = () => {
    if (isMobile()) { snap(panel.dataset.snap === "hidden" ? "half" : "hidden"); return; }
    document.body.classList.toggle("collapsed");
    $("#collapse").setAttribute("aria-expanded", String(!document.body.classList.contains("collapsed")));
    $("#collapse").setAttribute("aria-label", document.body.classList.contains("collapsed") ? "Otwórz panel" : "Zwiń panel");
    setTimeout(() => map.resize(), 360);
  };

  // drag handling for sheet
  (function () {
    let y0 = 0, t0 = 0, start = 0, dragging = false, moved = false;
    const scrollEl = panel.querySelector(".tabbody");
    panel.addEventListener("touchstart", (e) => {
      if (!isMobile()) return;
      if (scrollEl.contains(e.target) && panel.dataset.snap === "full" && scrollEl.scrollTop > 0) return;
      y0 = e.touches[0].clientY; t0 = Date.now(); start = snapY()[panel.dataset.snap]; dragging = true; moved = false;
    }, { passive: true });
    panel.addEventListener("touchmove", (e) => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - y0;
      if (!moved && Math.abs(dy) < 6) return;
      if (!moved && scrollEl.contains(e.target) && panel.dataset.snap === "full" && dy < 0) { dragging = false; return; }
      moved = true; panel.classList.add("drag");
      const S = snapY();
      panel.style.transform = `translateY(${Math.max(0, Math.min(S.hidden, start + dy))}px)`;
      e.cancelable && e.preventDefault();
    }, { passive: false });
    panel.addEventListener("touchend", (e) => {
      if (!dragging) return; dragging = false;
      if (!moved) return;
      panel.classList.remove("drag");
      const dy = e.changedTouches[0].clientY - y0, v = dy / Math.max(1, Date.now() - t0);
      const S = snapY(), cur = start + dy, order = ["full", "half", "peek", "hidden"];
      let i = order.indexOf(panel.dataset.snap), s;
      if (v < -0.5) s = order[Math.max(0, i - 1)];
      else if (v > 0.5) s = order[Math.min(3, i + 1)];
      else s = order.reduce((a, k) => (Math.abs(S[k] - cur) < Math.abs(S[a] - cur) ? k : a), "peek");
      snap(s);
    });
    $("#handle").addEventListener("click", () => snap(panel.dataset.snap === "half" ? "full" : "half"));
  })();

  /* ---------- Toast / status ---------- */
  let toastT;
  function toast(msg, ms) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms || 2600);
  }
  const status = $("#status");
  function updStatus() {
    const z = map.getZoom();
    status.textContent = z < MINZ ? "Przybliż mapę, aby zobaczyć działki · EGiB / PRG" : "Działki: EGiB · adresy: PRG";
    $("#dzZoomHint").textContent = z < MINZ ? "Przybliż mapę, aby zobaczyć granice" : "Widoczne w tym przybliżeniu";
    $("#adrZoomHint").textContent = z < ADR_MINZ ? "Widoczne przy większym przybliżeniu" : "Widoczne w tym przybliżeniu";
  }

  /* ---------- Cards ---------- */
  function groupsOf(p) {
    if (Array.isArray(p.grupy) && p.grupy.length) return p.grupy.map((g) => String(g.nr));
    const nums = String(p.grupa_rej || p.g1 || "").match(/[0-9]{1,2}/g) || [];
    return nums.filter((n) => GR[n]);
  }
  const fmtHa = (v) => (v == null || v === "" ? "—" : `${Number(v).toLocaleString("pl-PL", { maximumFractionDigits: 4 })} ha`);
  const copyBtn = (txt) => `<button class="copy" type="button" data-copy="${esc(txt)}">${Icons.svg('copy')}Kopiuj</button>`;
  const IC=Object.fromEntries(Object.entries({map:'map-trifold',leaf:'leaf',area:'ruler',clock:'clock',users:'users',doc:'file-text',chev:'caret-right'}).map(([key,name])=>[key,Icons.svg(name)]));
  const fmtDate = (d) => { if (!d) return "—"; const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1]}` : esc(d); };
  function parcelCard(p,embedded=false) {
    const area = window.ParcelModel.area(p);
    const gs = groupsOf(p);
    const chips = gs.length
      ? gs.map((g) => { const c = COL[g] || "#888"; return `<div class="chip" style="--c:${c}">${IC.users}<span><b>Grupa ${esc(g)}</b> · ${esc(GR[g] || "")}</span></div>`; }).join("")
      : `<div class="chip" style="--c:#8b93a1">${IC.users}<span>Grupa rejestrowa · brak danych</span></div>`;
    const cell = (ic, k, v) => `<div class="cell">${ic}<div><small>${k}</small><b>${v}</b></div></div>`;
    return `<div class="phead"><div><h2>Działka ${esc(p.numer_dzialki || "—")}</h2><code>${esc(p.id_dzialki || "")}</code></div>${p.id_dzialki ? copyBtn(p.id_dzialki) : ""}</div>
      <div class="parcel-register">${chips}</div><details class="place-section" open><summary>${Icons.svg('ruler')}Dane działki</summary><div class="grid4">
        ${cell(IC.map, "Obręb", `${esc(p.obreb || "—")}${p.nazwa_obrebu ? " · " + esc(String(p.nazwa_obrebu).replace(/-\d+$/, "")) : ""}`)}
        ${cell(IC.leaf, "Użytki", esc(p.klasouzytki || "—"))}
        ${cell(IC.area, "Powierzchnia · " + area.source.toLowerCase(), esc(window.ParcelModel.format(area.m2, "m²")) + `<span class="area-secondary">${esc(window.ParcelModel.format(area.ha, "ha"))}</span>`)}
        ${cell(IC.clock, "Aktualność", fmtDate(p.data_zrodla))}
      </div>
      </details>${embedded?'':`<details class="place-section"><summary>${Icons.svg('map-trifold')}MPZP i plany ogólne</summary><div id="placePlans"></div></details>`}${embedded?'':`<button type="button" class="place-distance-action" data-open-distance>${Icons.svg('person-simple-walk')}Otwórz moduł odległości${Icons.svg('caret-right')}</button>`}`;
  }
  function adrText(p) {
    const a = [p.ulica, p.numer].filter(Boolean).join(" ");
    const b = [p.kod, p.miejscowosc].filter(Boolean).join(" ");
    return [a, b].filter(Boolean).join(", ") || p.adres || "(adres)";
  }
  const GMAPS_LOGO='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.6c-4.2 0-7.6 3.3-7.6 7.5 0 5.4 6.3 12 7 12.7a.8.8 0 0 0 1.2 0c.7-.7 7-7.3 7-12.7 0-4.2-3.4-7.5-7.6-7.5z" fill="#34a853"/><path d="M5.2 5.6 9.3 9.9 12 7a2.4 2.4 0 0 1 3 .2l4.2-4.4A7.6 7.6 0 0 0 12 1.6a7.6 7.6 0 0 0-6.8 4z" fill="#1a73e8"/><path d="M4.4 9.1c0 1.4.4 2.8 1 4.2L9.3 9.9 5.2 5.6a7.4 7.4 0 0 0-.8 3.5z" fill="#ea4335"/><path d="M19.2 2.8 15 7.2c.4.4.6 1.1.6 1.7 0 .7-.3 1.3-.8 1.8l-9.4 2.6c.3.7.7 1.5 1.1 2.2l12.3-6.5c.3-.6.3-1.3.3-1.9a7.4 7.4 0 0 0-1.9-4.3z" fill="#fbbc04"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>';
  const AMAPS_LOGO='<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="amg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a4e37a"/><stop offset=".55" stop-color="#6fcf62"/><stop offset="1" stop-color="#f4efe2"/></linearGradient></defs><rect x="1" y="1" width="22" height="22" rx="5.4" fill="url(#amg)"/><path d="M1 15.5 23 6.5V10L1 19z" fill="#fff" opacity=".95"/><path d="M14.5 1h3L9 23H6z" fill="#ffd34d" opacity=".95"/><circle cx="16.8" cy="16.2" r="4.4" fill="#0a84ff" stroke="#fff" stroke-width="1.4"/><path d="m16.8 13.6 2 4.7-2-1-2 1z" fill="#fff"/></svg>';
  function navButtons(p){
    const lat=+p.lat,lon=+p.lon,txt=adrText(p),ll=Number.isFinite(lat)&&Number.isFinite(lon)?`${lat.toFixed(6)},${lon.toFixed(6)}`:"";
    const g=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ll||txt)}`;
    const a=`https://maps.apple.com/?q=${encodeURIComponent(txt)}${ll?`&ll=${ll}`:""}`;
    return `<div class="nav-apps"><a class="nav-app" href="${g}" target="_blank" rel="noopener">${GMAPS_LOGO}<span><small>Otwórz w</small>Google Maps</span></a><a class="nav-app" href="${a}" target="_blank" rel="noopener">${AMAPS_LOGO}<span><small>Otwórz w</small>Apple Maps</span></a></div>`;
  }
  function adrCard(p) {
    return `<div class="kicker"><i style="background:#d81b60;border-radius:50%"></i>Punkt adresowy</div>
      <div class="idrow"><code style="font-family:var(--ui);font-weight:700;font-size:17px;word-break:normal">${esc(adrText(p))}</code>${copyBtn(adrText(p))}</div>
      ${navButtons(p)}
      <details class="place-section" open><summary>${Icons.svg('ruler')}Działka pod adresem</summary><div id="adrParcel"><p class="muted small">Wczytuję działkę…</p></div></details><details class="place-section"><summary>${Icons.svg('map-trifold')}MPZP i plany ogólne</summary><div id="placePlans"></div></details><button type="button" class="place-distance-action" data-open-distance>${Icons.svg('person-simple-walk')}Otwórz moduł odległości${Icons.svg('caret-right')}</button>`;
  }
  const card = $("#card");
  function clearPlace(){addressRequest++;selectedParcelId=null;currentPlace=null;highlight(null);if(selMarker){selMarker.remove();selMarker=null;}card.innerHTML='<div class="emptymsg"><h1>Wybierz miejsce</h1><p>Wskaż punkt na mapie lub użyj wyszukiwarki.</p></div>';card.classList.add("empty");document.dispatchEvent(new Event("plots:selection"));snap("hidden");document.body.classList.add("collapsed");}
  function showCard(html) {
    const distanceOpen=window.DistanceModule?.isOpen();if(distanceOpen)window.DistanceModule.close({history:false});window.UIHistory?.open("place",clearPlace,distanceOpen);
    closeLayers();
    document.dispatchEvent(new Event("plots:selection"));
    card.classList.remove("empty"); card.innerHTML = html;card.classList.remove("card-enter");void card.offsetWidth;card.classList.add("card-enter"); tab("info");
    if (isMobile()) snap("half");
    else document.body.classList.remove("collapsed");
  }
  card.addEventListener("click", async (e) => {
    const m = e.target.closest("[data-more]");
    if (m) { const f = m.nextElementSibling; const open = f.hidden; f.hidden = !open; m.classList.toggle("open", open); if (open && isMobile()) snap("full"); if (open) f.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const b = e.target.closest("[data-copy]"); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); }
    catch (err) { const ta = document.createElement("textarea"); ta.value = b.dataset.copy; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
    b.classList.add("ok"); b.lastChild.textContent = "Skopiowano"; setTimeout(() => { b.classList.remove("ok"); b.lastChild.textContent = "Kopiuj"; }, 1600);
  });

  function highlight(id) {
    if (map.getLayer("dz-sel")) map.setFilter("dz-sel", ["==", ["get", "id_dzialki"], id || "__none__"]);
  }
  let parcelColors=store.get('parcelColors','outline');
  let mapFocused=false;
  function applyParcelColors(){if(map.getLayer('dz-fill')){map.setPaintProperty('dz-fill','fill-color',parcelColors==='groups'?matchExpr:'#8da1b5');map.setPaintProperty('dz-fill','fill-opacity',parcelColors==='groups'?(mapFocused?Math.min(store.get('opac',45)/100,.09):store.get('opac',45)/100):.025);}}
  function focusMap(active){mapFocused=active;applyParcelColors();}
  function setDistanceMode(on){document.body.classList.toggle('distance-mode',on);for(const [ids,checked]of [[['dz-fill','dz-line','dz-sel'],$('#lyrDz').checked],[['adr-pt','adr-lbl','adr-hit'],$('#lyrAdr').checked]])ids.forEach(id=>{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',checked&&(!on||id.startsWith('adr-'))?'visible':'none');});if(!on)snap(panel.dataset.snap||'half');document.dispatchEvent(new CustomEvent('plots:mode',{detail:on?'distance':'place'}));}

  document.addEventListener('plots:selection',()=>focusMap(false));
  let currentPlace=null;
  let selectedParcelId = null;
  function selectParcel(p,point=null) { if(window.DistanceModule?.isOpen()){const at=point||(p.bbox?{lon:(p.bbox[0][0]+p.bbox[1][0])/2,lat:(p.bbox[0][1]+p.bbox[1][1])/2}:null);if(at)window.DistanceModule.setOrigin({...at,label:"Działka "+p.numer_dzialki});return;}selectedParcelId = p.id_dzialki; highlight(p.id_dzialki); showCard(parcelCard(p)); document.dispatchEvent(new CustomEvent("plots:parcel", { detail: p }));currentPlace=point|| (p.bbox?{lon:(p.bbox[0][0]+p.bbox[1][0])/2,lat:(p.bbox[0][1]+p.bbox[1][1])/2}:currentPlace);if(currentPlace)window.PLOTS_PLANNING?.loadInto(currentPlace,document.getElementById('placePlans')); }

  /* ---------- API ---------- */
  async function api(path,options={}) {
    const r = await fetch(BASE + path, { signal: AbortSignal.timeout(12000),...options });
    if (!r.ok) {const detail=await r.json().catch(()=>({}));const error=new Error(detail.error||(r.status === 404 ? "Nie znaleziono" : "Błąd API " + r.status));error.status=r.status;throw error;}
    return r.json();
  }
  const fetchAt = (lon, lat) => api(`/api/at?lon=${lon}&lat=${lat}`);
  let selMarker = null, addressRequest = 0;
  function mark(lnglat) {
    if (!selMarker) { const el = document.createElement("div"); el.className="selected-location-marker"; selMarker = new maplibregl.Marker({ element: el }); }
    selMarker.setLngLat(lnglat).addTo(map);
  }
  function addressAt(e){const r=isMobile()?18:9,box=[[e.point.x-r,e.point.y-r],[e.point.x+r,e.point.y+r]],layers=['adr-pt','adr-hit','adr-lbl'].filter(id=>map.getLayer(id));if(!layers.length)return null;const hit=AddressPicking.closest(map.queryRenderedFeatures(box,{layers}),e.point,c=>map.project(c));if(!hit)return null;const p={...hit.properties,lon:hit.geometry.coordinates[0],lat:hit.geometry.coordinates[1]};return {...p,label:adrText(p)};}
  function padding() { const distance=window.DistanceModule?.isOpen();return isMobile() ? { top: distance?150:140, bottom: distance?window.DistanceModule.height()+35:visibleSheet()+80, left:24,right:65 } : { top:90,bottom:40,left:distance?380:document.body.classList.contains("collapsed")?40:380,right:70 }; }

  function frame(bounds,maxZoom=18,opts={}) {if(isMobile()&&visibleSheet()>window.innerHeight*.6)snap('peek');map.stop();map.setPadding({top:0,bottom:0,left:0,right:0});map.fitBounds([[bounds[0],bounds[1]],[bounds[2],bounds[3]]],{padding:padding(),maxZoom,duration:opts.duration||650,retainPadding:false});}
  function framePoint(lon,lat,zoom=18){frame([lon-.00003,lat-.00003,lon+.00003,lat+.00003],zoom);}
  async function showAddress(p) {
    if(window.DistanceModule?.isOpen()){window.DistanceModule.setOrigin({...p,label:adrText(p)});framePoint(+p.lon,+p.lat,16);return;}
    const requestId = ++addressRequest; selectedParcelId = null;
    const lon = +p.lon, lat = +p.lat;currentPlace={lon,lat};
    mark([lon, lat]);
    showCard(adrCard(p));
    document.dispatchEvent(new CustomEvent("plots:address", {detail:p}));
    window.PLOTS_PLANNING?.loadInto({lon,lat},document.getElementById("placePlans"));
    framePoint(lon,lat);
    try {
      const d = await fetchAt(lon, lat);
      if (requestId !== addressRequest) return;
      highlight(d.id_dzialki);
      selectedParcelId = d.id_dzialki;
      document.dispatchEvent(new CustomEvent("plots:parcel", { detail: d }));
      const box = $("#adrParcel");
      if (box) box.innerHTML = `<h4 style="margin-top:22px">Działka pod adresem</h4>` + parcelCard(d,true);
    } catch (e) {const box=$("#adrParcel");if(box)box.innerHTML='<p class="muted small">Brak działki w tym punkcie.</p>';}
  }
  function showParcelFull(d) {
    selectParcel(d);
    if (d.bbox) frame([...d.bbox[0],...d.bbox[1]],18);
  }

  /* ---------- Search ---------- */
  const q = $("#q"), sugg = $("#sugg"), qClear = $("#qClear");
  const isId = (s) => /^\d{6}_\d\.\d{4}\./.test(s) || (/_/.test(s) && /\./.test(s) && !/\s/.test(s));
  let items = [], active = -1, seq = 0, deb;
  document.addEventListener("plots:selection",()=>seq++);
  function renderSugg() {
    sugg.hidden = !items.length;
    q.setAttribute("aria-expanded", String(items.length > 0));
    if (active >= 0) q.setAttribute("aria-activedescendant", "suggestion-" + active); else q.removeAttribute("aria-activedescendant");
    sugg.innerHTML = items.map((it, i) => `<li id="suggestion-${i}" role="option" data-i="${i}" aria-selected="${i === active}">${esc(it.title)}<small>${esc(it.sub || "")}</small></li>`).join("");
  }
  async function suggest(s) {
    const my = ++seq;
    if (s.length < 2 || isId(s)) { items = []; renderSugg(); return; }
    const gminy = await window.PLOTS_GMINY.search(s).catch(() => []);
    if (my !== seq) return;
    items = gminy; active = -1; renderSugg();
    if (s.length < 3) return;
    try {
      const j = await api(`/api/adres?q=${encodeURIComponent(s)}`);
      if (my !== seq) return;
      items = gminy.concat((j.wyniki || []).slice(0, 4).map((w) => ({ kind: "adr", data: w, title: [w.ulica || w.miejscowosc, w.numer].filter(Boolean).join(" "), sub: [w.kod, w.miejscowosc, w.gmina && w.gmina !== w.miejscowosc ? "gm. " + w.gmina : ""].filter(Boolean).join(" · ") })));
      active = -1; renderSugg();
    } catch (e) { if (my === seq) { items = gminy; renderSugg(); } }
  }
  q.addEventListener("input", () => { seq++;items=[];active=-1;renderSugg(); qClear.hidden = !q.value; clearTimeout(deb); deb = setTimeout(() => suggest(q.value.trim()), 250); });
  q.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { if (!items.length) return; e.preventDefault(); active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; renderSugg(); }
    if (e.key === "Escape") { seq++; clearTimeout(deb); items = []; renderSugg(); }
  });
  sugg.addEventListener("mousedown", (e) => e.preventDefault());
  sugg.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) pick(items[+li.dataset.i]); });
  q.addEventListener("blur", () => setTimeout(() => { items = []; renderSugg(); }, 150));
  qClear.onclick = () => { seq++; clearTimeout(deb); q.value = ""; qClear.hidden = true; items = []; renderSugg(); q.focus(); };
  function pick(it) {
    seq++; items = []; renderSugg(); q.blur();
    if (it.kind === "adr") { q.value = adrText(it.data); showAddress(it.data); }
    if (it.kind === "gmina") { q.value = it.title; window.PLOTS_GMINY.select(it.data.k, true); }
  }
  $("#search").addEventListener("submit", async (e) => {
    e.preventDefault();
    const requestId=++seq; clearTimeout(deb);
    const s = q.value.trim(); if (!s) return;
    if (active >= 0 && items[active]) return pick(items[active]);
    items = []; renderSugg(); q.blur();
    try {
      if (isId(s)) { const d=await api(`/api/dzialka?id=${encodeURIComponent(s)}`);if(requestId===seq)showParcelFull(d);return; }
      const gminy = await window.PLOTS_GMINY.search(s).catch(() => []);
      if(requestId!==seq)return;
      const exact = gminy.find((it) => it.data.k === s || window.GminyModel.normalize(it.data.n) === window.GminyModel.normalize(s));
      if (exact && gminy.filter((it) => window.GminyModel.normalize(it.data.n) === window.GminyModel.normalize(s)).length <= 1) { pick(exact); return; }
      if(gminy.length===1&&!/\d/.test(s)){pick(gminy[0]);return;}
      if (gminy.length && !/\d.*\s|\s.*\d/.test(s)) { items = gminy; active = -1; renderSugg(); q.focus(); return; }
      const j = await api(`/api/adres?q=${encodeURIComponent(s)}`).catch(() => ({}));
      if(requestId!==seq)return;
      if (j.wyniki && j.wyniki.length) { showAddress(j.wyniki[0]); return; }
      const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&countrycodes=pl&limit=1&q=" + encodeURIComponent(s));
      const arr = await r.json();
      if(requestId!==seq)return;
      if (!arr.length) throw new Error("Nie znaleziono: " + s);
      const lon = +arr[0].lon, lat = +arr[0].lat;
      mark([lon, lat]);
      document.dispatchEvent(new CustomEvent("plots:point",{detail:{lon,lat}}));
      framePoint(lon,lat,17);
      toast(arr[0].display_name.split(",").slice(0, 3).join(","));
      try { const d=await fetchAt(lon,lat);if(requestId===seq)selectParcel(d); } catch (er) {}
    } catch (err) { if(requestId===seq)toast(err.message || String(err)); }
  });

  /* ---------- Geolocation ---------- */
  $("#locate").onclick = () => {
    if (!navigator.geolocation) return toast("Geolokalizacja niedostępna");
    toast("Ustalam położenie…");
    navigator.geolocation.getCurrentPosition(
      (pos) => { const c = [pos.coords.longitude, pos.coords.latitude]; if(window.DistanceModule?.isOpen()){window.DistanceModule.setOrigin({lon:c[0],lat:c[1],label:"Moja lokalizacja"});framePoint(c[0],c[1],17);return;}mark(c); document.dispatchEvent(new CustomEvent("plots:point",{detail:{lon:c[0],lat:c[1]}})); framePoint(c[0],c[1],17); },
      () => toast("Brak zgody na lokalizację"), { enableHighAccuracy: true, timeout: 10000 });
  };

  /* ---------- Layers ---------- */
  map.on("load", () => {
    map.addSource("dzialki", { type: "vector", tiles: [BASE + "/tiles/{z}/{x}/{y}.pbf"], minzoom: MINZ, maxzoom: 16 });
    const op = parcelColors==='groups'?store.get("opac", 45) / 100:.025;
    map.addLayer({ id: "dz-fill", type: "fill", source: "dzialki", "source-layer": "dzialki", paint: { "fill-color": parcelColors==='groups'?matchExpr:'#8da1b5', "fill-opacity": op } });
    map.addLayer({ id: "dz-line", type: "line", source: "dzialki", "source-layer": "dzialki", paint: { "line-color": "#1b1e24", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.3, 18, 1.2], "line-opacity": 0.75 } });
    map.addLayer({ id: "dz-sel", type: "line", source: "dzialki", "source-layer": "dzialki", filter: ["==", ["get", "id_dzialki"], "__none__"], paint: { "line-color": "#2f6bff", "line-width": 3.5 } });
    map.addSource("adresy", { type: "vector", tiles: [BASE + "/tiles/adresy/{z}/{x}/{y}.pbf"], minzoom: ADR_MINZ, maxzoom: 18 });
    map.addLayer({ id: "adr-pt", type: "circle", source: "adresy", "source-layer": "adresy", minzoom: ADR_MINZ, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 16, 5, 19, 7], "circle-color": "#087cfc", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
    map.addLayer({id:"adr-hit",type:"circle",source:"adresy","source-layer":"adresy",minzoom:ADR_MINZ,paint:{"circle-radius":18,"circle-opacity":.001}});
    map.addLayer({ id: "adr-lbl", type: "symbol", source: "adresy", "source-layer": "adresy", minzoom: 17,
      layout: { "text-field": ["coalesce", ["get", "numer"], ""], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 17, 12, 19, 15], "text-offset": [0, -1.1], "text-anchor": "bottom" },
      paint: { "text-color": "#16497b", "text-halo-color": "#fff", "text-halo-width": 2.5 } });
    setBasemap(bmId, false);

    const setVis = (ids, on) => ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
    const bind = (el, key, ids, def) => { el.checked = store.get(key, def); setVis(ids, el.checked); el.onchange = () => { store.set(key, el.checked); setVis(ids, el.checked); }; };
    bind($("#lyrDz"), "dz", ["dz-fill", "dz-line", "dz-sel"], true);
    bind($("#lyrAdr"), "adr2", ["adr-pt", "adr-lbl", "adr-hit"], true);
    const o = $("#opac"); o.value = store.get("opac", 45); $("#opacValue").textContent = o.value + "%";
    o.oninput = () => { store.set("opac", +o.value);applyParcelColors(); $("#opacValue").textContent = o.value + "%"; };
    const countLayers = () => { $("#layerCount").textContent = document.querySelectorAll("#layerPanel .layer-entry input[type=checkbox]:checked").length; };
    $("#layerPanel").addEventListener("change", countLayers); countLayers();

    // tap: address point has priority, with a touch-friendly hit box
    let clickRevision=0;
    map.on("click", async (e) => {
      const click=++clickRevision;
      if(window.DistanceModule?.handleClick(e))return;
      if(window.PLOTS_TERRAIN?.handleClick(e))return;
      const point={lon:e.lngLat.lng,lat:e.lngLat.lat};
      if(map.getZoom()<MINZ){addressRequest++;await window.MunicipalityContext.update(point);if(click!==clickRevision)return;const id=window.PLOTS_GMINY.current();if(id)window.PLOTS_GMINY.select(id,true);else {tab("gmina");snap("half");}return;}
      if (window.PLOTS_PLANNING?.inspecting()) return;
      const r = isMobile() ? 18 : 9;
      const box = [[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]];
      const labels=map.getLayer('adr-lbl')?map.queryRenderedFeatures(e.point,{layers:['adr-lbl']}):[];
      const hits=labels.length?labels:map.getLayer('adr-hit')?[...map.queryRenderedFeatures(box,{layers:['adr-pt']}),...map.queryRenderedFeatures(e.point,{layers:['adr-hit']})]:[];
      const a=AddressPicking.closest(hits,e.point,c=>map.project(c));
      if (a) {
        const p = Object.assign({}, a.properties, { lon: a.geometry.coordinates[0], lat: a.geometry.coordinates[1] });
        showAddress(p);
        return;
      }
      if (window.PLOTS_SURROUNDINGS?.handleClick(e)) return;
      const f = map.queryRenderedFeatures(e.point, { layers: ["dz-fill"] });
      if (f.length) {
        addressRequest++;
        if (selMarker) selMarker.remove();
        selectParcel(f[0].properties,point);
        fetchAt(e.lngLat.lng, e.lngLat.lat).then((d) => { if (d.id_dzialki === selectedParcelId){card.innerHTML = parcelCard(d);window.PLOTS_PLANNING?.loadInto(point,document.getElementById("placePlans"));} }).catch(() => {});
      } else {
        addressRequest++; selectedParcelId=null; highlight(null); if(selMarker)selMarker.remove();
        currentPlace=point;mark([point.lon,point.lat]);
        try{const d=await fetchAt(point.lon,point.lat);if(click===clickRevision)selectParcel(d,point);}catch{if(click!==clickRevision)return;showCard(`<div class="phead"><h2>Wskazane miejsce</h2></div><p class="muted small">${point.lat.toFixed(5)}, ${point.lon.toFixed(5)} · Brak działki w źródle.</p><details class="place-section" open><summary>${Icons.svg('map-trifold')}MPZP i plany ogólne</summary><div id="placePlans"></div></details><button class="place-distance-action" data-open-distance>${Icons.svg('person-simple-walk')}Moduł odległości</button>`);document.dispatchEvent(new CustomEvent('plots:point',{detail:point}));window.PLOTS_PLANNING?.loadInto(point,document.getElementById('placePlans'));}
      }
    });
    if (matchMedia("(hover:hover)").matches) {
      map.on("mousemove", (e) => {
        const h = map.queryRenderedFeatures(e.point, { layers: ["adr-hit", "adr-lbl", "dz-fill"].filter((l) => map.getLayer(l)) });
        map.getCanvas().style.cursor = h.length ? "pointer" : "";
      });
    }
    updStatus();
  });
  function syncMapScale(){const far=map.getZoom()<MINZ;document.body.classList.toggle("municipality-scale",far);if(far&&curTab!=="gmina"&&!window.DistanceModule?.isOpen())tab("gmina");}
  map.on("load",syncMapScale);map.on("zoomend",syncMapScale);
  map.on("dragstart", () => { if (isMobile() && (panel.dataset.snap === "half" || panel.dataset.snap === "full")) snap("peek"); });
  map.on("moveend", () => { updStatus(); const c = map.getCenter(); store.set("view", { center: [c.lng, c.lat], zoom: map.getZoom() }); });
  // Parcel/address tiles that failed are retried; repeated failures check whether the tunnel got a new address.
  let tileErrors = 0, retryTimer = 0, lastRetry = 0, checkedTunnel = false;
  function retryTiles() {
    lastRetry = Date.now();
    for (const id of ["dzialki", "adresy"]) { const src = map.getSource(id); if (src?.setTiles && src.tiles) src.setTiles([...src.tiles]); }
  }
  async function checkTunnel() {
    if (checkedTunnel || params.get("tiles")) return; checkedTunnel = true;
    try {
      const txt = await fetch("config.js?x=" + Date.now(), { cache: "no-store" }).then(r => r.text());
      const url = (txt.match(/TILES_URL:\s*"([^"]+)"/) || [])[1]?.replace(/\/$/, "");
      if (url && url !== BASE && !sessionStorage.getItem("plots.tunnelReload")) { sessionStorage.setItem("plots.tunnelReload", "1"); location.reload(); return; }
    } catch { /* offline */ }
    if (!window.__dzErr) { window.__dzErr = 1; toast("Dane działek są chwilowo niedostępne. Mapa i dane gmin pozostają dostępne.", 5000); }
  }
  map.on("error", (e) => {
    if (!e || (e.sourceId !== "dzialki" && e.sourceId !== "adresy")) return;
    tileErrors++;
    if (tileErrors >= 6) checkTunnel();
    clearTimeout(retryTimer); retryTimer = setTimeout(() => { if (Date.now() - lastRetry > 8000) retryTiles(); }, 2500);
  });
  map.on("sourcedata", (e) => { if (e.sourceId === "dzialki" && e.isSourceLoaded && e.tile) { tileErrors = 0; try { sessionStorage.removeItem("plots.tunnelReload"); } catch {} } });
  window.PLOTS = { map, base: BASE, store, esc, toast, tab, snap, isMobile, padding, openLayers, closeLayers, showAddress, markPoint:mark, currentTab:()=>curTab, focusMap, api, frame, framePoint, setDistanceMode, clearPlace, addressAt, currentPlace:()=>currentPlace, setCurrentPlace:p=>{currentPlace=p;}, setParcelColors(mode){parcelColors=mode;store.set('parcelColors',mode);applyParcelColors();document.dispatchEvent(new CustomEvent('plots:parcel-colors',{detail:mode}));},
    registerOverlaySource(id) { overlaySourceIds.add(id); },
    showInfo(html) { showCard(html); },
    showGmina() { tab("gmina"); document.body.classList.remove("collapsed"); if (isMobile()) snap("half"); } };

  // deep link: ?id=... or ?q=...
  if (params.get("id")) map.once("load", () => { q.value = params.get("id"); $("#search").requestSubmit(); });
  else if (params.get("q")) map.once("load", () => { q.value = params.get("q"); $("#search").requestSubmit(); });
})();
