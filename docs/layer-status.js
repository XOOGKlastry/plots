/* Layer status next to each switched-on layer: "Wczytuję…" while its tiles are still coming, "Serwer nie odpowiada" when the
   data provider (Geoportal, PIG-PIB, GDOŚ, our tile server) fails, so a layer that is on but empty does not look broken.
   A layer's map layers are learnt when it is switched (capture listener sees the style before and after the switch);
   for layers restored at start-up they are found by naming convention. */
(function () {
  "use strict";
  const app = window.PLOTS, panel = document.getElementById("layerPanel");
  if (!app || !app.map || !panel) return;
  const map = app.map, learnt = {}, errAt = {}, slowSince = {};
  const visible = () => new Set((map.getStyle()?.layers || []).filter(l => (l.layout || {}).visibility !== "none").map(l => l.id));
  const boxes = () => [...panel.querySelectorAll(".layer-entry input[type=checkbox]")];
  let before = null;
  panel.addEventListener("change", e => { if (e.target.matches("input[type=checkbox]")) before = visible(); }, true);
  panel.addEventListener("change", e => {
    const cb = e.target; if (!cb.matches("input[type=checkbox]") || !before || !cb.checked) return;
    const b = before; before = null;
    setTimeout(() => { const added = [...visible()].filter(id => !b.has(id)); if (added.length) learnt[cb.id] = added; render(); }, 60);
  });
  function guess(id) {
    const ids = (map.getStyle()?.layers || []).map(l => l.id);
    if (id.startsWith("plan-")) return ids.filter(x => x === "plan-source-" + id.slice(5));
    const en = window.PLOTS_ENERGY?.layerIds?.[id.slice(3)];
    if (id.startsWith("en-") && en) return en.filter(x => ids.includes(x));
    return ids.filter(x => x === id || x.startsWith(id + "-"));
  }
  map.on("error", e => { if (e.sourceId) errAt[e.sourceId] = Date.now(); });
  map.on("sourcedata", e => { if (e.sourceId && e.isSourceLoaded) delete slowSince[e.sourceId]; });
  function state(cb) {
    const ids = (learnt[cb.id] || guess(cb.id)).filter(id => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none");
    if (!ids.length) return "";
    const z = map.getZoom(), live = ids.filter(id => { const l = map.getLayer(id); return z >= (l.minzoom ?? 0) && z < (l.maxzoom ?? 24); });
    if (!live.length) return "zoom";
    const srcs = [...new Set(live.map(id => map.getLayer(id).source))].filter(s => map.getSource(s));
    const now = Date.now();
    let loading = false, failed = false;
    for (const s of srcs) {
      if (errAt[s] && now - errAt[s] < 20000) { failed = true; continue; }
      let ok = true; try { ok = map.isSourceLoaded(s); } catch (e) {}
      if (ok) { delete slowSince[s]; continue; }
      slowSince[s] = slowSince[s] || now;
      // MapLibre does not always report a failed image tile, so a source still loading after 15 s counts as not answering.
      if (now - slowSince[s] > 15000) failed = true; else loading = true;
    }
    return failed ? "fail" : loading ? "load" : "ok";
  }
  const TXT = { ok: "Włączona, widać ją na mapie", zoom: "Włączona. Przybliż mapę, aby ją zobaczyć", load: "Wczytuję dane…", fail: "Serwer z danymi nie odpowiada, część mapy może być pusta" };
  function render() {
    for (const cb of boxes()) {
      const host = cb.closest("label")?.querySelector("div"); if (!host) continue;
      let el = host.querySelector(".lst");
      const s = cb.checked ? state(cb) : "";
      if (!s) { if (el) el.remove(); continue; }
      if (!el) { el = document.createElement("em"); el.className = "lst"; host.append(el); }
      if (el.dataset.s !== s) { el.dataset.s = s; el.className = "lst lst-" + s; el.textContent = TXT[s]; }
    }
    const busy = boxes().some(cb => cb.checked && cb.closest("label")?.querySelector(".lst-load, .lst-fail"));
    document.documentElement.classList.toggle("layers-busy", busy);
  }
  setInterval(() => { if (!document.hidden) render(); }, 1000);
})();
