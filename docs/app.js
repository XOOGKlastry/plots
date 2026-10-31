/* global maplibregl, PLOTS_CONFIG, GRUPY_REJ, GRUPY_COLORS */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const CFG = window.PLOTS_CONFIG || {};
  const BASE = (params.get("tiles") || CFG.TILES_URL || "http://127.0.0.1:5001").replace(/\/$/, "");
  const MINZ = +(params.get("minzoom") || CFG.MIN_ZOOM || 13);
  const ADR_MINZ = +(CFG.ADR_MIN_ZOOM || 16);
  const GR = window.GRUPY_REJ || {};
  const COL = window.GRUPY_COLORS || {};
  const isMobile = () => matchMedia("(max-width:767px)").matches;
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem("plots." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem("plots." + k, JSON.stringify(v)); } catch (e) {} }
  };
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Basemaps (verified EPSG:3857 endpoints) ---------- */
  const GP = "https://mapy.geoportal.gov.pl/wss/service";
  const wms = (u, lyr, fmt) => `${u}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${lyr}&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=${fmt}`;
  const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
  const BASEMAPS = [
    { id: "map", name: "Mapa", style: true, url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`, max: 19, attr: "© Esri" },
    { id: "gp-orto", name: "Ortofoto", url: `${GP}/PZGIK/ORTO/WMTS/StandardResolution?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}`, max: 19, attr: "© GUGiK geoportal.gov.pl" },
    { id: "gp-topo", name: "Topo", url: wms(`${GP}/img/guest/TOPO/MapServer/WMSServer`, "Raster", "image/png"), max: 19, attr: "© GUGiK geoportal.gov.pl" }
  ];
  const HILL = `${ESRI}/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}`;
  function tileUrl(t, z, x, y) {
    const R = 20037508.342789244, s = (2 * R) / Math.pow(2, z);
    const bb = [-R + x * s, R - (y + 1) * s, -R + (x + 1) * s, R - y * s].join(",");
    return t.replace("{z}", z).replace("{x}", x).replace("{y}", y).replace("{bbox-epsg-3857}", bb);
  }
  let bmId = store.get("basemap", "map");
  if (!BASEMAPS.some((b) => b.id === bmId)) bmId = /img|orto|hr/.test(bmId) ? "gp-orto" : /topo/.test(bmId) ? "gp-topo" : "map";

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
        const response = await fetch(`styles/map-${dark.matches ? "dark" : "light"}.json`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error("Map style unavailable");
        baseStyle = await response.json();
      } catch (error) {
        if (requestId !== basemapRequest) return;
        toast("Wczytano zapasowy podkład mapy. Spróbuj ponownie później.");
      }
    }
    if (requestId !== basemapRequest) return;
    if (!baseStyle) baseStyle = {
      version: 8, glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      sources: { base: { type: "raster", tiles: [b.url], tileSize: 256, maxzoom: b.max, attribution: b.attr } },
      layers: [{ id: "base", type: "raster", source: "base", paint: { "raster-fade-duration": 200 } }]
    };
    const current = map.getStyle(), overlaySources = {};
    ["hill", "dzialki", "adresy"].forEach((key) => { if (current.sources[key]) overlaySources[key] = current.sources[key]; });
    const overlays = current.layers.filter((layer) => Object.prototype.hasOwnProperty.call(overlaySources, layer.source));
    map.setStyle({ ...baseStyle, sources: { ...baseStyle.sources, ...overlaySources }, layers: [...baseStyle.layers, ...overlays] });
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
    $("#layerPanel").hidden = false; $("#layersFab").setAttribute("aria-expanded", "true");
    if (legend) { $("#legendDetails").open = true; $("#legendDetails").scrollIntoView({ block: "nearest" }); }
  }
  function closeLayers() { $("#layerPanel").hidden = true; $("#layersFab").setAttribute("aria-expanded", "false"); }
  function tab(name) {
    if (name === "layers" || name === "legend") { openLayers(name === "legend"); return; }
    curTab = name;
    document.querySelectorAll(".tabs button, #tabbar button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === name));
    document.querySelectorAll(".pane").forEach((p) => { p.classList.toggle("on", p.dataset.pane === name); p.hidden = p.dataset.pane !== name; });
    panel.querySelector(".tabbody").scrollTop = 0;
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
  const copyBtn = (txt) => `<button class="copy" type="button" data-copy="${esc(txt)}"><svg class="ic" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>Kopiuj</button>`;
  const IC = {
    map: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>',
    leaf: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 21v-8M12 13c0-4 3-7 8-7 0 5-3 7-8 7zM12 15c0-3-2-6-7-6 0 4 2 6 7 6z"/></svg>',
    area: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 20h18M3 20V4M6 16l4-5 4 3 6-7"/></svg>',
    clock: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    users: '<svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.3 2.5 3.5 5.5"/></svg>',
    doc: '<svg class="ic" viewBox="0 0 24 24"><path d="M14 3H6v18h12V7zM14 3v4h4M9 12h6M9 16h6"/></svg>',
    chev: '<svg class="ic" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>'
  };
  const fmtDate = (d) => { if (!d) return "—"; const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1]}` : esc(d); };
  function parcelCard(p) {
    const gs = groupsOf(p);
    const chips = gs.length
      ? gs.map((g) => { const c = COL[g] || "#888"; return `<div class="chip" style="--c:${c}">${IC.users}<span><b>Grupa ${esc(g)}</b> · ${esc(GR[g] || "")}</span></div>`; }).join("")
      : `<div class="chip" style="--c:#8b93a1">${IC.users}<span>Grupa rejestrowa · brak danych</span></div>`;
    const cell = (ic, k, v) => `<div class="cell">${ic}<div><small>${k}</small><b>${v}</b></div></div>`;
    const skip = new Set(["bbox", "grupy", "g1"]);
    const all = Object.keys(p).filter((k) => !skip.has(k) && p[k] != null && p[k] !== "").map((k) => `<dt>${esc(k)}</dt><dd class="num">${esc(p[k])}</dd>`).join("");
    return `<div class="phead"><div><h2>Działka ${esc(p.numer_dzialki || "—")}</h2><code>${esc(p.id_dzialki || "")}</code></div>${p.id_dzialki ? copyBtn(p.id_dzialki) : ""}</div>
      ${chips}
      <div class="grid4">
        ${cell(IC.map, "Obręb", `${esc(p.obreb || "—")}${p.nazwa_obrebu ? " · " + esc(String(p.nazwa_obrebu).replace(/-\d+$/, "")) : ""}`)}
        ${cell(IC.leaf, "Użytki", esc(p.klasouzytki || "—"))}
        ${cell(IC.area, "Powierzchnia", fmtHa(p.pole_ewid))}
        ${cell(IC.clock, "Aktualność", fmtDate(p.data_zrodla))}
      </div>
      <button class="more" type="button" data-more>${IC.doc}<span>Pełne informacje</span>${IC.chev}</button>
      <div class="full" hidden><h4>Wszystkie atrybuty</h4><dl class="kv">${all}</dl></div>`;
  }
  function adrText(p) {
    const a = [p.ulica, p.numer].filter(Boolean).join(" ");
    const b = [p.kod, p.miejscowosc].filter(Boolean).join(" ");
    return [a, b].filter(Boolean).join(", ") || p.adres || "(adres)";
  }
  function adrCard(p) {
    const skip = new Set(["ulica", "numer", "kod", "miejscowosc", "lon", "lat", "adres", "gmina"]);
    const rest = Object.keys(p).filter((k) => !skip.has(k) && p[k] !== null && p[k] !== "")
      .map((k) => `<dt>${esc(k)}</dt><dd class="num">${esc(p[k])}</dd>`).join("");
    return `<div class="kicker"><i style="background:#d81b60;border-radius:50%"></i>Punkt adresowy</div>
      <div class="idrow"><code style="font-family:var(--ui);font-weight:700;font-size:17px;word-break:normal">${esc(adrText(p))}</code>${copyBtn(adrText(p))}</div>
      <dl class="kv">${p.gmina ? `<dt>Gmina</dt><dd>${esc(p.gmina)}</dd>` : ""}</dl>
      ${rest ? `<details><summary>Atrybuty PRG</summary><dl class="kv">${rest}</dl></details>` : ""}
      <div id="adrParcel"></div>`;
  }
  const card = $("#card");
  function showCard(html) {
    card.classList.remove("empty"); card.innerHTML = html; tab("info");
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
  let selectedParcelId = null;
  function selectParcel(p) { selectedParcelId = p.id_dzialki; highlight(p.id_dzialki); showCard(parcelCard(p)); document.dispatchEvent(new CustomEvent("plots:parcel", { detail: p })); }

  /* ---------- API ---------- */
  async function api(path) {
    const r = await fetch(BASE + path, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(r.status === 404 ? "Nie znaleziono" : "Błąd API " + r.status);
    return r.json();
  }
  const fetchAt = (lon, lat) => api(`/api/at?lon=${lon}&lat=${lat}`);
  let selMarker = null, addressRequest = 0;
  function mark(lnglat) {
    if (!selMarker) { const el = document.createElement("div"); el.style.cssText = "width:18px;height:18px;border-radius:50%;background:#d81b60;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"; selMarker = new maplibregl.Marker({ element: el }); }
    selMarker.setLngLat(lnglat).addTo(map);
  }
  function padding() { return isMobile() ? { top: 90, bottom: Math.min(visibleSheet() + 24, window.innerHeight * .55), left: 24, right: 65 } : { top: 90, bottom: 40, left: document.body.classList.contains("collapsed") ? 40 : 380, right: 70 }; }

  async function showAddress(p) {
    const requestId = ++addressRequest; selectedParcelId = null;
    const lon = +p.lon, lat = +p.lat;
    mark([lon, lat]);
    showCard(adrCard(p));
    map.flyTo({ center: [lon, lat], zoom: 18, padding: padding(), speed: 1.6 });
    try {
      const d = await fetchAt(lon, lat);
      if (requestId !== addressRequest) return;
      highlight(d.id_dzialki);
      selectedParcelId = d.id_dzialki;
      document.dispatchEvent(new CustomEvent("plots:parcel", { detail: d }));
      const box = $("#adrParcel");
      if (box) box.innerHTML = `<h4 style="margin-top:22px">Działka pod adresem</h4>` + parcelCard(d);
    } catch (e) {}
  }
  function showParcelFull(d) {
    if (d.bbox) map.fitBounds(d.bbox, { padding: padding(), maxZoom: 18 });
    selectParcel(d);
  }

  /* ---------- Search ---------- */
  const q = $("#q"), sugg = $("#sugg"), qClear = $("#qClear");
  const isId = (s) => /^\d{6}_\d\.\d{4}\./.test(s) || (/_/.test(s) && /\./.test(s) && !/\s/.test(s));
  let items = [], active = -1, seq = 0, deb;
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
  q.addEventListener("input", () => { seq++; qClear.hidden = !q.value; clearTimeout(deb); deb = setTimeout(() => suggest(q.value.trim()), 250); });
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
    seq++; clearTimeout(deb);
    const s = q.value.trim(); if (!s) return;
    if (active >= 0 && items[active]) return pick(items[active]);
    items = []; renderSugg(); q.blur();
    try {
      if (isId(s)) { showParcelFull(await api(`/api/dzialka?id=${encodeURIComponent(s)}`)); return; }
      const gminy = await window.PLOTS_GMINY.search(s).catch(() => []);
      const exact = gminy.find((it) => it.data.k === s || window.GminyModel.normalize(it.data.n) === window.GminyModel.normalize(s));
      if (exact && gminy.filter((it) => window.GminyModel.normalize(it.data.n) === window.GminyModel.normalize(s)).length <= 1) { pick(exact); return; }
      if (gminy.length && !/\d.*\s|\s.*\d/.test(s)) { items = gminy; active = -1; renderSugg(); q.focus(); return; }
      const j = await api(`/api/adres?q=${encodeURIComponent(s)}`).catch(() => ({}));
      if (j.wyniki && j.wyniki.length) { showAddress(j.wyniki[0]); return; }
      const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&countrycodes=pl&limit=1&q=" + encodeURIComponent(s));
      const arr = await r.json();
      if (!arr.length) throw new Error("Nie znaleziono: " + s);
      const lon = +arr[0].lon, lat = +arr[0].lat;
      mark([lon, lat]);
      map.flyTo({ center: [lon, lat], zoom: 17, padding: padding() });
      toast(arr[0].display_name.split(",").slice(0, 3).join(","));
      try { selectParcel(await fetchAt(lon, lat)); } catch (er) {}
    } catch (err) { toast(err.message || String(err)); }
  });

  /* ---------- Geolocation ---------- */
  $("#locate").onclick = () => {
    if (!navigator.geolocation) return toast("Geolokalizacja niedostępna");
    toast("Ustalam położenie…");
    navigator.geolocation.getCurrentPosition(
      (pos) => { const c = [pos.coords.longitude, pos.coords.latitude]; mark(c); map.flyTo({ center: c, zoom: 17, padding: padding() }); },
      () => toast("Brak zgody na lokalizację"), { enableHighAccuracy: true, timeout: 10000 });
  };

  /* ---------- Layers ---------- */
  map.on("load", () => {
    map.addSource("hill", { type: "raster", tiles: [HILL], tileSize: 256, maxzoom: 16, attribution: "© Esri" });
    map.addLayer({ id: "hill", type: "raster", source: "hill", layout: { visibility: store.get("hill", false) ? "visible" : "none" }, paint: { "raster-opacity": 0.35 } });
    map.addSource("dzialki", { type: "vector", tiles: [BASE + "/tiles/{z}/{x}/{y}.pbf"], minzoom: MINZ, maxzoom: 16 });
    const op = store.get("opac", 45) / 100;
    map.addLayer({ id: "dz-fill", type: "fill", source: "dzialki", "source-layer": "dzialki", paint: { "fill-color": matchExpr, "fill-opacity": op } });
    map.addLayer({ id: "dz-line", type: "line", source: "dzialki", "source-layer": "dzialki", paint: { "line-color": "#1b1e24", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.3, 18, 1.2], "line-opacity": 0.75 } });
    map.addLayer({ id: "dz-sel", type: "line", source: "dzialki", "source-layer": "dzialki", filter: ["==", ["get", "id_dzialki"], "__none__"], paint: { "line-color": "#2f6bff", "line-width": 3.5 } });
    map.addSource("adresy", { type: "vector", tiles: [BASE + "/tiles/adresy/{z}/{x}/{y}.pbf"], minzoom: ADR_MINZ, maxzoom: 18 });
    map.addLayer({ id: "adr-pt", type: "circle", source: "adresy", "source-layer": "adresy", minzoom: ADR_MINZ, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 16, 3, 19, 6.5], "circle-color": "#d81b60", "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
    map.addLayer({ id: "adr-lbl", type: "symbol", source: "adresy", "source-layer": "adresy", minzoom: 17,
      layout: { "text-field": ["coalesce", ["get", "numer"], ""], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 17, 11, 19, 14], "text-offset": [0, -1.1], "text-anchor": "bottom" },
      paint: { "text-color": "#880e4f", "text-halo-color": "#fff", "text-halo-width": 1.8 } });
    setBasemap(bmId, false);

    const setVis = (ids, on) => ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
    const bind = (el, key, ids, def) => { el.checked = store.get(key, def); setVis(ids, el.checked); el.onchange = () => { store.set(key, el.checked); setVis(ids, el.checked); }; };
    bind($("#lyrDz"), "dz", ["dz-fill", "dz-line", "dz-sel"], true);
    bind($("#lyrAdr"), "adr", ["adr-pt", "adr-lbl"], true);
    bind($("#lyrHill"), "hill", ["hill"], false);
    const o = $("#opac"); o.value = store.get("opac", 45); $("#opacValue").textContent = o.value + "%";
    o.oninput = () => { map.setPaintProperty("dz-fill", "fill-opacity", o.value / 100); store.set("opac", +o.value); $("#opacValue").textContent = o.value + "%"; };
    const countLayers = () => { $("#layerCount").textContent = ["#lyrDz", "#lyrAdr", "#lyrHill"].filter((id) => $(id).checked).length; };
    ["#lyrDz", "#lyrAdr", "#lyrHill"].forEach((id) => $(id).addEventListener("change", countLayers)); countLayers();

    // tap: address point has priority, with a touch-friendly hit box
    map.on("click", (e) => {
      const r = isMobile() ? 14 : 6;
      const box = [[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]];
      const a = map.getLayer("adr-pt") ? map.queryRenderedFeatures(box, { layers: ["adr-pt"] }) : [];
      if (a.length) {
        const p = Object.assign({}, a[0].properties, { lon: a[0].geometry.coordinates[0], lat: a[0].geometry.coordinates[1] });
        showAddress(p);
        return;
      }
      const f = map.queryRenderedFeatures(e.point, { layers: ["dz-fill"] });
      if (f.length) {
        addressRequest++;
        if (selMarker) selMarker.remove();
        selectParcel(f[0].properties);
        fetchAt(e.lngLat.lng, e.lngLat.lat).then((d) => { if (d.id_dzialki === selectedParcelId) card.innerHTML = parcelCard(d); }).catch(() => {});
      } else {
        if (isMobile() && panel.dataset.snap !== "hidden") snap(card.classList.contains("empty") ? "hidden" : "peek");
        if (map.getZoom() < MINZ) toast(`Przybliż mapę (z ≥ ${MINZ}), aby zobaczyć działki`);
      }
    });
    if (matchMedia("(hover:hover)").matches) {
      map.on("mousemove", (e) => {
        const h = map.queryRenderedFeatures(e.point, { layers: ["adr-pt", "dz-fill"].filter((l) => map.getLayer(l)) });
        map.getCanvas().style.cursor = h.length ? "pointer" : "";
      });
    }
    updStatus();
  });
  map.on("dragstart", () => { if (isMobile() && (panel.dataset.snap === "half" || panel.dataset.snap === "full")) snap("peek"); });
  map.on("moveend", () => { updStatus(); const c = map.getCenter(); store.set("view", { center: [c.lng, c.lat], zoom: map.getZoom() }); });
  map.on("error", (e) => { if (e && e.sourceId === "dzialki" && !window.__dzErr) { window.__dzErr = 1; toast("Dane działek są chwilowo niedostępne. Mapa i dane gmin pozostają dostępne.", 5000); } });
  dark.addEventListener("change", () => { if (bmId === "map" && map.isStyleLoaded()) setBasemap("map", false); });
  $("#shareView").onclick = async () => {
    const c = map.getCenter(), url = new URL(location.href); url.search = "";
    url.searchParams.set("lon", c.lng.toFixed(6)); url.searchParams.set("lat", c.lat.toFixed(6)); url.searchParams.set("z", map.getZoom().toFixed(2));
    if (selectedParcelId && curTab === "info") url.searchParams.set("id", selectedParcelId);
    if (curTab === "gmina" && window.PLOTS_GMINY.current()) url.searchParams.set("gmina", window.PLOTS_GMINY.current());
    try { await navigator.clipboard.writeText(url.href); toast("Link do widoku skopiowany"); } catch (err) { toast("Nie udało się skopiować linku. Sprawdź uprawnienia schowka."); }
  };
  window.PLOTS = { map, store, esc, toast, tab, snap, isMobile, padding, showGmina() { tab("gmina"); document.body.classList.remove("collapsed"); if (isMobile()) snap("half"); } };

  // deep link: ?id=... or ?q=...
  if (params.get("id")) map.once("load", () => { q.value = params.get("id"); $("#search").requestSubmit(); });
  else if (params.get("q")) map.once("load", () => { q.value = params.get("q"); $("#search").requestSubmit(); });
})();
