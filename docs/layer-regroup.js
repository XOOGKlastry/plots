/* Nowy układ panelu warstw (test). Przenosi gotowe wpisy warstw do nowych grup po tym, jak layer-ui.js zbuduje panel.
   Powrót do starego układu: przycisk na dole panelu (zapamiętany w przeglądarce) albo ?uklad=stary w adresie.
   Usunięcie tego pliku z index.html przywraca stary układ w całości. */
(function () {
  "use strict";
  const KEY = "plots.layoutV2", params = new URLSearchParams(location.search);
  let on = true; try { on = localStorage.getItem(KEY) !== "0"; } catch (e) {}
  if (params.get("uklad") === "stary") on = false; if (params.get("uklad") === "nowy") on = true;
  const GROUPS = [
    ["Ludzie i okolica", "users-three", "", ["terr-spis", "terr-gunb", "terr-internet", "x-bud-gmin", "x-bud-mieszk", "x-noc", "surPrices", "poiAll"]],
    ["Zagrożenia", "warning", "", ["terr-powodz", "x-susza", "terr-osuwiska", "terr-egms", "terr-gornicze", "x-halas-ldwn", "x-halas-ln"]],
    ["Woda", "drop", "", ["x-wp-zlewnie", "x-wp-rzeki", "x-wp-podziemne", "x-wp-nadzory", "x-wp-chronione"]],
    ["Przyroda i grunt", "tree", "", ["terr-lasy", "x-przyr-gmin", "x-gleby", "x-cieniowanie", "x-wysokosci"]],
    ["Energetyka", "lightning", "", ["en-wn", "en-moce", "en-sn", "en-wiatr", "en-pv", "en-inne", "en-magazyny", "en-ladowanie", "en-odb"]],
    ["OZE i klimat", "wind", "", ["zas-wind", "zas-power", "zas-pvout", "zas-ghi", "zas-temp", "en-miejsca", "en-wdost", "en-pog", "terr-geotermia", "x-cieplo"]],
    ["Powietrze", "cloud", "", ["zas-air", "x-gios", "x-eprtr"]],
    ["Drogi i kolej", "road-horizon", "", ["x-canard", "x-msbd", "x-mapa-drogowa", "x-drogi", "x-zrid", "terr-ruch", "x-kolej", "x-kdp"]],
    ["Lotnictwo, wojsko, przesył", "airplane-tilt", "", ["x-lotniska", "x-wojsko", "x-przesyl"]],
    ["Historia", "castle-turret", "hist-section", ["x-stare-mapy", "x-zabytki", "x-archeo", "x-grodziska", "x-pomniki"]],
    ["Przygoda", "warning", "adv-section", ["x-urbex", "x-bunkry", "x-zanikle", "x-odludzia"]]
  ];
  function section(label, iconName, cls) {
    const d = document.createElement("details"); d.className = "layer-section v2-section " + cls;
    d.innerHTML = `<summary>${Icons.svg(iconName)}<span>${label}</span><small class="group-count"></small>${Icons.svg("caret-down", "section-chevron")}</summary><div class="layer-section-body"><div class="layer-group"></div></div>`;
    d.addEventListener("toggle", () => { if (d.open && !document.getElementById("layerFilter")?.value.trim()) document.querySelectorAll("#layerPanel .layer-section").forEach(x => { if (x !== d) x.open = false; }); });
    return d;
  }
  function regroup() {
    const panel = document.getElementById("layerPanel"), fun = document.querySelector("#layerPanel .fun-section");
    if (!panel || panel.dataset.v2 || !panel.dataset.grouped || !fun || !document.getElementById("x-srodki")) return false;
    panel.dataset.v2 = "1";
    const planning = document.getElementById("planningLayers")?.closest(".layer-section");
    let anchor = planning || fun;
    for (const [label, ic, cls, ids] of GROUPS) {
      const sec = section(label, ic, cls), box = sec.querySelector(".layer-group");
      for (const id of ids) {
        const e = document.getElementById(id)?.closest(".layer-entry"); if (!e) continue;
        const next = e.nextElementSibling, extra = next && !next.classList.contains("layer-entry") && !next.matches("h3,p.source-note,.layer-entry") ? next : null;
        box.append(e); if (extra) box.append(extra);
      }
      if (!box.children.length) continue;
      if (cls) fun.before(sec); else { anchor.after(sec); anchor = sec; }
    }
    /* stare grupy, z których wszystko wyjechało, znikają */
    panel.querySelectorAll(".layer-section:not(.v2-section):not(.fun-section)").forEach(s => { if (!s.querySelector(".layer-entry")) s.hidden = true; });
    panel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function switcher() {
    const panel = document.getElementById("layerPanel"); if (!panel || document.getElementById("layoutSwitch")) return;
    const b = document.createElement("button"); b.type = "button"; b.id = "layoutSwitch"; b.className = "layout-switch";
    b.textContent = on ? "Wróć do starego układu warstw" : "Wypróbuj nowy układ warstw";
    b.onclick = () => { try { localStorage.setItem(KEY, on ? "0" : "1"); } catch (e) {} const u = new URL(location.href); if (u.searchParams.has("uklad")) { u.searchParams.delete("uklad"); location.href = u.href; } else location.reload(); };
    panel.append(b);
  }
  let tries = 0;
  const tick = () => { switcher(); if (!on || regroup() || ++tries > 80) return; setTimeout(tick, 150); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick); else tick();
})();
