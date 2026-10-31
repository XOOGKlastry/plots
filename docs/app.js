/* global maplibregl, PLOTS_CONFIG, GRUPY_REJ, GRUPY_COLORS */
(function () {
  const params = new URLSearchParams(location.search);
  const CFG = window.PLOTS_CONFIG || {};
  const BASE = (params.get("tiles") || CFG.TILES_URL || "http://127.0.0.1:5001").replace(/\/$/, "");
  const MINZ = +(params.get("minzoom") || CFG.MIN_ZOOM || 13);
  const GR = window.GRUPY_REJ || {};
  const COL = window.GRUPY_COLORS || {};

  const leg = document.getElementById("legend");
  Object.keys(GR).forEach((k) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<i style="background:${COL[k] || "#999"}"></i><span><b>${k}</b> ${GR[k]}</span>`;
    leg.appendChild(row);
  });
  const rowB = document.createElement("div");
  rowB.className = "row";
  rowB.innerHTML = `<i style="background:${COL.brak || "#ccc"}"></i><span>brak / nieustalone</span>`;
  leg.appendChild(rowB);

  const map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap"
        }
      },
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      layers: [{ id: "osm", type: "raster", source: "osm" }]
    },
    center: [19.2, 52.1],
    zoom: 6,
    maxZoom: 19
  });
  map.addControl(new maplibregl.NavigationControl(), "top-right");

  const matchExpr = ["match", ["get", "g1"]];
  Object.keys(COL).forEach((k) => {
    if (k !== "brak") matchExpr.push(k, COL[k]);
  });
  matchExpr.push(COL.brak || "#bdc3c7");

  function opisGrupy(g) {
    if (!g) return "brak danych";
    const nums = String(g).match(/[0-9]{1,2}/g) || [];
    const parts = nums.filter((n) => GR[n]).map((n) => `Grupa ${n}: ${GR[n]}`);
    return parts.length ? parts.join("; ") : `Grupa ${g}`;
  }

  function popupHtml(p) {
    const pole = p.pole_ewid != null ? Number(p.pole_ewid).toLocaleString("pl-PL") + " m²" : "—";
    return `<b>${p.id_dzialki || "—"}</b>
      Numer: ${p.numer_dzialki || "—"}<br/>
      Obręb: ${p.obreb || "—"} ${p.nazwa_obrebu ? "(" + p.nazwa_obrebu + ")" : ""}<br/>
      Pole ewid.: ${pole}<br/>
      <b style="margin-top:6px">${opisGrupy(p.grupa_rej || p.grupa_opis)}</b>
      <div style="margin-top:4px;color:#555">Użytki: ${p.klasouzytki || "—"}</div>`;
  }

  map.on("load", () => {
    document.getElementById("hint").textContent =
      `API: ${BASE} — przybliż mapę (z≥${MINZ}), kliknij działkę. Kolor = grupa rejestrowa (EGiB §14).`;
    map.addSource("dzialki", {
      type: "vector",
      tiles: [BASE + "/tiles/{z}/{x}/{y}.pbf"],
      minzoom: MINZ,
      maxzoom: 16
    });
    map.addLayer({
      id: "dz-fill",
      type: "fill",
      source: "dzialki",
      "source-layer": "dzialki",
      paint: { "fill-color": matchExpr, "fill-opacity": 0.45 }
    });
    map.addLayer({
      id: "dz-line",
      type: "line",
      source: "dzialki",
      "source-layer": "dzialki",
      paint: { "line-color": "#222", "line-width": 0.8, "line-opacity": 0.7 }
    });

    // --- Punkty adresowe ---
    const ADR_MINZ = +(CFG.ADR_MIN_ZOOM || 16);
    map.addSource("adresy", {
      type: "vector",
      tiles: [BASE + "/tiles/adresy/{z}/{x}/{y}.pbf"],
      minzoom: ADR_MINZ,
      maxzoom: 18
    });
    map.addLayer({
      id: "adr-pt", type: "circle", source: "adresy", "source-layer": "adresy", minzoom: ADR_MINZ,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 16, 3.5, 19, 7],
        "circle-color": "#d81b60",
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.95
      }
    });
    map.addLayer({
      id: "adr-lbl", type: "symbol", source: "adresy", "source-layer": "adresy", minzoom: 17,
      layout: {
        "text-field": ["coalesce", ["get", "numer"], ""],
        "text-font": ["Open Sans Semibold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 17, 11, 19, 14],
        "text-offset": [0, -1.1],
        "text-anchor": "bottom",
        "text-allow-overlap": false
      },
      paint: { "text-color": "#880e4f", "text-halo-color": "#fff", "text-halo-width": 1.8, "text-halo-blur": 0.3 }
    });
    map.on("click", "adr-pt", (e) => {
      const f = e.features && e.features[0];
      if (!f) return;
      e.originalEvent.cancelBubble = true;
      e.preventDefault && e.preventDefault();
      new maplibregl.Popup({ maxWidth: "360px" }).setLngLat(e.lngLat).setHTML(adrPopup(f.properties)).addTo(map);
    });
    map.on("mouseenter", "adr-pt", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "adr-pt", () => { map.getCanvas().style.cursor = ""; });

    function setVis(ids, on) { ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none")); }
    const cbD = document.getElementById("lyrDz"), cbA = document.getElementById("lyrAdr");
    if (cbD) cbD.onchange = () => setVis(["dz-fill", "dz-line"], cbD.checked);
    if (cbA) cbA.onchange = () => setVis(["adr-pt", "adr-lbl"], cbA.checked);

    map.on("click", "dz-fill", (e) => {
      if (e.defaultPrevented) return;
      const hit = map.queryRenderedFeatures(e.point, { layers: ["adr-pt"] });
      if (hit.length) return;
      const f = e.features && e.features[0];
      if (!f) return;
      new maplibregl.Popup({ maxWidth: "360px" })
        .setLngLat(e.lngLat)
        .setHTML(popupHtml(f.properties))
        .addTo(map);
    });
    map.on("mouseenter", "dz-fill", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "dz-fill", () => { map.getCanvas().style.cursor = ""; });
  });

  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function adrText(p) {
    const a = [p.ulica, p.numer].filter(Boolean).join(" ");
    const b = [p.kod, p.miejscowosc].filter(Boolean).join(" ");
    return [a, b].filter(Boolean).join(", ") || p.adres || "(adres)";
  }
  function adrPopup(p) {
    const skip = new Set(["ulica", "numer", "kod", "miejscowosc", "lon", "lat", "adres"]);
    const rest = Object.keys(p).filter((k) => !skip.has(k) && p[k] !== null && p[k] !== "")
      .map((k) => `<tr><td style="color:#777;padding-right:6px">${esc(k)}</td><td>${esc(p[k])}</td></tr>`).join("");
    return `<b>${esc(adrText(p))}</b>${p.gmina ? "Gmina: " + esc(p.gmina) + "<br/>" : ""}
      <table style="font-size:11px;margin-top:4px">${rest}</table>`;
  }
  async function searchOwnAddr(q) {
    try {
      const r = await fetch(`${BASE}/api/adres?q=${encodeURIComponent(q)}`);
      if (!r.ok) return null;
      const j = await r.json();
      return (j.wyniki && j.wyniki.length) ? j.wyniki[0] : null;
    } catch (e) { return null; }
  }

  async function fetchAt(lon, lat) {
    const r = await fetch(`${BASE}/api/at?lon=${lon}&lat=${lat}`);
    if (!r.ok) throw new Error("Brak działki w tym punkcie (czy działa lokalne API?)");
    return r.json();
  }
  async function fetchId(id) {
    const r = await fetch(`${BASE}/api/dzialka?id=${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error("Nie znaleziono działki");
    return r.json();
  }
  function showParcel(d) {
    if (d.bbox) map.fitBounds(d.bbox, { padding: 60, maxZoom: 17 });
    const c = d.bbox
      ? [(d.bbox[0][0] + d.bbox[1][0]) / 2, (d.bbox[0][1] + d.bbox[1][1]) / 2]
      : map.getCenter().toArray();
    new maplibregl.Popup({ maxWidth: "360px" })
      .setLngLat(c)
      .setHTML(popupHtml(d))
      .addTo(map);
  }

  document.getElementById("btnAddr").onclick = async () => {
    const q = document.getElementById("addr").value.trim();
    if (!q) return;
    document.getElementById("hint").textContent = "Szukam adresu…";
    try {
      const own = await searchOwnAddr(q);
      if (own && own.lon != null) {
        const lon = +own.lon, lat = +own.lat;
        map.flyTo({ center: [lon, lat], zoom: 18 });
        new maplibregl.Popup({ maxWidth: "360px" }).setLngLat([lon, lat]).setHTML(adrPopup(own)).addTo(map);
        document.getElementById("hint").textContent = "Punkt adresowy (PRG): " + adrText(own);
        try { await fetchAt(lon, lat); } catch (e) {}
        return;
      }
      const url =
        "https://nominatim.openstreetmap.org/search?format=json&countrycodes=pl&limit=1&q=" +
        encodeURIComponent(q);
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      const arr = await r.json();
      if (!arr.length) throw new Error("Adres nie znaleziony");
      const lon = +arr[0].lon, lat = +arr[0].lat;
      map.flyTo({ center: [lon, lat], zoom: 17 });
      const d = await fetchAt(lon, lat);
      showParcel(d);
      document.getElementById("hint").textContent = arr[0].display_name;
    } catch (err) {
      document.getElementById("hint").textContent = String(err.message || err);
    }
  };
  document.getElementById("btnId").onclick = async () => {
    const id = document.getElementById("pid").value.trim();
    if (!id) return;
    document.getElementById("hint").textContent = "Szukam ID…";
    try {
      const d = await fetchId(id);
      showParcel(d);
      document.getElementById("hint").textContent = d.id_dzialki;
    } catch (err) {
      document.getElementById("hint").textContent = String(err.message || err);
    }
  };
  document.getElementById("addr").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnAddr").click();
  });
  document.getElementById("pid").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnId").click();
  });
})();
