/* Nowy układ panelu warstw (test). Przenosi gotowe wpisy warstw do nowych grup po tym, jak layer-ui.js zbuduje panel.
   Powrót do starego układu: przycisk na dole panelu (zapamiętany w przeglądarce) albo ?uklad=stary w adresie.
   Usunięcie tego pliku z index.html przywraca stary układ w całości. */
(function () {
  "use strict";
  const KEY = "plots.layoutV2", params = new URLSearchParams(location.search);
  let on = true; try { on = localStorage.getItem(KEY) !== "0"; } catch (e) {}
  if (params.get("uklad") === "stary") on = false; if (params.get("uklad") === "nowy") on = true;
  const GROUPS = [
    ["Ludzie i okolica", "users-three", "", ["terr-spis", "terr-gunb", "terr-internet", "x-noc", "surPrices", "poiAll"], "gestosc_ludnosci"],
    ["Zagrożenia", "warning", "", ["terr-powodz", "x-susza", "terr-osuwiska", "terr-egms", "terr-gornicze"], "powodz_1_proc"],
    ["Woda", "drop", "", ["x-wp-zlewnie", "x-wp-rzeki", "x-wp-podziemne", "x-wp-nadzory", "x-wp-chronione"], "wodociag_proc"],
    ["Przyroda i grunt", "tree", "", ["terr-lasy", "x-gleby", "x-cieniowanie", "x-wysokosci"], "lesistosc_proc"],
    ["Energetyka", "lightning", "", ["en-wn", "x-przesyl", "en-moce", "en-sn", "en-wiatr", "x-wiatr-domy", "en-pv", "en-inne", "en-magazyny", "en-ladowanie", "en-odb"], "turbiny_100km2"],
    ["OZE i klimat", "wind", "", ["zas-wind", "zas-power", "zas-pvout", "zas-ghi", "zas-temp", "x-klimat-st", "en-miejsca", "en-wdost", "en-pog", "terr-geotermia", "x-cieplo"], "wiatr_dost2_proc"],
    ["Powietrze", "cloud", "", ["zas-air", "x-gios", "x-eprtr"], "ceeb_kociol_pozakl_proc"],
    ["Drogi i kolej", "road-horizon", "", ["x-canard", "x-msbd", "x-mapa-drogowa", "x-drogi", "x-zrid", "terr-ruch", "x-kolej", "x-kdp"], "sewik_zabici_100k"],
    ["Lotnictwo i wojsko", "airplane-tilt", "", ["x-lotniska", "x-wojsko"]],
    ["Historia", "castle-turret", "hist-section", ["x-stare-mapy", "x-zabytki", "x-archeo", "x-grodziska", "x-pomniki"], "nid_rejestr_100km2"],
    ["Przygoda", "warning", "adv-section", ["x-urbex", "x-bunkry", "x-zanikle", "x-odludzia"]]
  ];
  /* Warstwy, które można łączyć z innymi. Pozostałe włączają się pojedynczo: nowa wyłącza poprzednią. */
  const COMBINE = new Set(["plan-mpzp", "plan-pog", "plan-pog-draft", "lyrDz", "lyrParcelColors", "lyrAdr", "lyrOrthoLabels", "lyrAnim", "en-wn", "en-sn", "en-moce", "x-przesyl", "poiAll"]);
  const solo = i => i && i.type === "checkbox" && i.id && !COMBINE.has(i.id) && i.closest("#layerPanel .layer-entry") && !i.closest("#poiCats");
  function exclusive() {
    const panel = document.getElementById("layerPanel"); if (!panel || panel.dataset.solo) return; panel.dataset.solo = "1";
    const others = keep => [...panel.querySelectorAll(".layer-entry input[type=checkbox]:checked")].filter(i => i !== keep && solo(i));
    panel.addEventListener("change", e => { const t = e.target; if (!solo(t) || !t.checked) return;
      others(t).forEach(i => { i.checked = false; i.dispatchEvent(new Event("change", { bubbles: true })); }); }, true);
    const on = others(null); on.slice(0, -1).forEach(i => { i.checked = false; i.dispatchEvent(new Event("change", { bubbles: true })); });
  }
  function section(label, iconName, cls) {
    const d = document.createElement("details"); d.className = "layer-section v2-section " + cls;
    d.innerHTML = `<summary>${Icons.svg(iconName)}<span>${label}</span><small class="group-count"></small>${Icons.svg("caret-down", "section-chevron")}</summary><div class="layer-section-body"><div class="layer-group"></div></div>`;
    d.addEventListener("toggle", () => { if (d.open && !document.getElementById("layerFilter")?.value.trim()) document.querySelectorAll("#layerPanel .layer-section").forEach(x => { if (x !== d) x.open = false; }); });
    return d;
  }
  function regroup() {
    const panel = document.getElementById("layerPanel"), fun = document.querySelector("#layerPanel .fun-section");
    if (!panel || panel.dataset.v2 || !panel.dataset.grouped || !fun || !document.getElementById("x-srodki") || (!document.getElementById("poiLayers") && tries < 40)) return false;
    panel.dataset.v2 = "1";
    const planning = document.getElementById("planningLayers")?.closest(".layer-section");
    let anchor = planning || fun;
    for (const [label, ic, cls, ids, stat] of GROUPS) {
      const sec = section(label, ic, cls), box = sec.querySelector(".layer-group");
      for (const id of ids) {
        if (id === "poiAll") { const pl = document.getElementById("poiLayers"); if (pl) { pl.querySelector("h3")?.remove(); box.append(...pl.children); } continue; }
        const e = document.getElementById(id)?.closest(".layer-entry"); if (!e) continue;
        const next = e.nextElementSibling, extra = next && !next.classList.contains("layer-entry") && !next.matches("h3,p.source-note,.layer-entry") ? next : null;
        box.append(e); if (extra) box.append(extra);
      }
      if (!box.children.length) continue;
      if (stat) { const b = document.createElement("button"); b.type = "button"; b.className = "to-stats"; b.innerHTML = `${Icons.svg("chart-bar")}<span>Gminy na tle Polski</span>${Icons.svg("caret-right")}`; b.onclick = () => window.StatsMap?.open(stat); sec.querySelector(".layer-section-body").append(b); }
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
  const tick = () => { switcher(); if (!on) return exclusive(); if (regroup() || ++tries > 80) return exclusive(); setTimeout(tick, 150); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick); else tick();
})();
