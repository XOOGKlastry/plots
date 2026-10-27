/* global maplibregl, PLOTS_CONFIG, GRUPY_REJ, GRUPY_COLORS */
(function () {
  const CFG = window.PLOTS_CONFIG || {};
  const BASE = (CFG.TILES_URL || "").replace(/\/$/, "");
  const MINZ = CFG.MIN_ZOOM || 13;
  const GR = window.GRUPY_REJ || {};
  const COL = window.GRUPY_COLORS || {};

  const leg = document.getElementById("legend");
  Object.keys(GR).forEach((k) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<i style="background:${COL[k]||'#999'}"></i><span><b>${k}</b> ${GR[k]}</span>`;
    leg.appendChild(row);
  });
  const rowB = document.createElement("div");
  rowB.className = "row";
  rowB.innerHTML = `<i style="background:${COL.brak||'#ccc'}"></i><span>brak / nieustalone</span>`;
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
          attribution: "? OpenStreetMap"
        }
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }]
    },
    center: [19.2, 52.1],
    zoom: 6,
    maxZoom: 19
  });
  map.addControl(new maplibregl.NavigationControl(), "top-right");

  const matchExpr = ["match", ["get", "g1"]];
  Object.keys(COL).forEach((k) => { if (k !== "brak") { matchExpr.push(k, COL[k]); } });
  matchExpr.push(COL.brak || "#bdc3c7");

  function opisGrupy(g) {
    if (!g) return "brak danych";
    const nums = String(g).match(/[0-9]{1,2}/g) || [];
    const parts = nums.filter((n) => GR[n]).map((n) => `Grupa ${n}: ${GR[n]}`);
    return parts.length ? parts.join("; ") : `Grupa ${g}`;
  }

  function popupHtml(p) {
    const pole = p.pole_ewid != null ? Number(p.pole_ewid).toLocaleString("pl-PL") + " m?" : "?";
    return `<b>${p.id_dzialki || "?"}</b>
      Numer: ${p.numer_dzialki || "?"}<br/>
      Obr?b: ${p.obreb || "?"} ${p.nazwa_obrebu ? "(" + p.nazwa_obrebu + ")" : ""}<br/>
      Pole ewid.: ${pole}<br/>
      <b style="margin-top:6px">${opisGrupy(p.grupa_rej)}</b>
      <div style="margin-top:4px;color:#555">U?ytki: ${p.klasouzytki || "?"}</div>`;
  }

  map.on("load", () => {
    if (!BASE) {
      document.getElementById("hint").textContent = "Brak TILES_URL w config.js ? ustaw adres API kafli.";
      return;
    }
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

    map.on("click", "dz-fill", (e) => {
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

  async function fetchAt(lon, lat) {
    const r = await fetch(`${BASE}/api/at?lon=${lon}&lat=${lat}`);
    if (!r.ok) throw new Error("Brak dzia?ki w tym punkcie");
    return r.json();
  }
  async function fetchId(id) {
    const r = await fetch(`${BASE}/api/dzialka?id=${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error("Nie znaleziono dzia?ki");
    return r.json();
  }
  function showParcel(d) {
    if (d.bbox) {
      map.fitBounds(d.bbox, { padding: 60, maxZoom: 17 });
    }
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
    document.getElementById("hint").textContent = "Szukam adresu?";
    try {
      const url = "https://nominatim.openstreetmap.org/search?format=json&countrycodes=pl&limit=1&q=" + encodeURIComponent(q);
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
    document.getElementById("hint").textContent = "Szukam ID?";
    try {
      const d = await fetchId(id);
      showParcel(d);
      document.getElementById("hint").textContent = d.id_dzialki;
    } catch (err) {
      document.getElementById("hint").textContent = String(err.message || err);
    }
  };
  document.getElementById("addr").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("btnAddr").click(); });
  document.getElementById("pid").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("btnId").click(); });
})();
