/* Module buttons on the right edge of the map (Polska, Odległości, Komunikacja). They show when the place panel is folded
   away: collapsed on a computer, pulled down on a phone. Clicks go through the same data-open-* handlers as the panel buttons. */
(function () {
  "use strict";
  const app = window.PLOTS; if (!app) return;
  const box = document.createElement("nav");
  box.className = "side-mods"; box.setAttribute("aria-label", "Moduły mapy"); box.hidden = true;
  const ic = n => window.Icons?.svg(n) || "";
  box.innerHTML = `<button type="button" data-open-stats>${ic("poland")}<span>Polska</span></button>
    <button type="button" data-open-distance>${ic("person-simple-walk")}<span>Odległości</span></button>
    <button type="button" data-open-transit>${ic("bus")}<span>Komunikacja</span></button>`;
  document.body.append(box);
  const BUSY = /\b(stats-open|distance-mode|transit-module|layers-open)\b/;
  function sync() {
    const b = document.body, folded = app.isMobile() ? /^(peek|hidden)$/.test(b.dataset.snap || "") : b.classList.contains("collapsed");
    box.hidden = !folded || BUSY.test(b.className);
  }
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class", "data-snap"] });
  addEventListener("resize", sync); sync();
})();
