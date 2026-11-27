/* Tryby niezależne: Polska (wskaźniki), Wykresy, Struktura, Odległości i Komunikacja pokazują na mapie tylko własne warstwy.
   Po wejściu w tryb wszystkie inne warstwy tematyczne są ukrywane, a po wyjściu wracają te, które były włączone. */
(function () {
  "use strict";
  const DIST = ["distance-buildings", "address-directions", "adresy", "municipal-boundaries", "near-poi", "near-poi-lines", "poi-all", "poi-all-lines"];
  // kolejność ma znaczenie: pierwszy pasujący tryb decyduje o dozwolonych warstwach
  const MODES = [
    ["struct-open", s => s.startsWith("st-")],
    ["dash-open", () => false],
    ["stats-open", s => s === "stats-gminy"],
    ["transit-module", s => s.startsWith("transit-") || DIST.includes(s)],
    ["distance-mode", s => DIST.includes(s)]
  ];
  const hidden = new Set(); let cur = null, raf = 0;
  const map = () => window.PLOTS?.map;
  function mode() { const c = document.body.classList; return MODES.find(([k]) => c.contains(k)) || null; }
  function apply() {
    raf = 0; const m = map(); if (!m?.getStyle || !m.isStyleLoaded?.() && !m.style?._loaded) return;
    const md = mode();
    if (!md) { // wyjście z trybu: przywróć ukryte
      for (const id of hidden) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "visible");
      hidden.clear(); cur = null; return;
    }
    if (cur && cur !== md[0]) { for (const id of hidden) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "visible"); hidden.clear(); }
    cur = md[0];
    for (const l of m.getStyle().layers) {
      if (!l.source || l.source === "openmaptiles" || md[1](l.source)) continue;
      if ((l.layout?.visibility ?? "visible") === "none") continue;
      hidden.add(l.id); m.setLayoutProperty(l.id, "visibility", "none");
    }
  }
  const later = () => { if (!raf) raf = requestAnimationFrame(apply); };
  new MutationObserver(later).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  // warstwy dodane lub włączone w trakcie trybu też są ukrywane
  const hook = () => { const m = map(); if (!m) return setTimeout(hook, 300); m.on("styledata", () => { if (cur || mode()) later(); }); later(); };
  hook();
  window.SoloMode = { refresh: later, active: () => cur };
})();
