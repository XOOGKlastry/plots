/* PDF report of a gmina: every data tab, the office and all elections in one printable document.
   The tabs are rendered one by one in the data dialog (so charts, maps and Wikipedia fill as usual), copied, and the
   copy is shown as a preview. "Zapisz PDF" prints it; the browser's print dialog saves it as a PDF. */
(function () {
  "use strict";
  const app = window.PLOTS, esc = app.esc, svg = n => window.Icons.svg(n);
  const SKIP = ["Przegląd", "Wybory", "Źródła"]; // drawn separately: Przegląd opens the report, Wybory has every election, Źródła closes it
  const STRIP = ".data-heading,.data-tools,.gus-status,.score-method,.next-cat,.ind-search,.ind-results,.el-tabs,.urz-wl-acts,.urz-wl-links,.urz-map,.urz-actions,.sp-all,.urz-thumbs,.cmp-tools,.cmp-pick,[data-refresh-gus],.cmp-add,.cmp-sugg,.cmp-x,[data-cmp-del],input,select,.urz-cnt,.stat-map-link,[data-wiki-more]";
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let dlg = null, doc = null, bar = null, printBtn = null, root = null, run = 0, title = "";

  function ensure() {
    if (dlg) return;
    dlg = document.createElement("dialog");
    dlg.className = "rep-dialog"; dlg.setAttribute("aria-label", "Raport gminy");
    dlg.innerHTML = `<header class="rep-bar"><button type="button" class="rep-close" data-rep-close aria-label="Zamknij raport">${svg("x")}</button><div class="rep-state"><b>Raport gminy</b><span id="repProg">Przygotowuję…</span><i><s id="repBar"></s></i></div><button type="button" class="rep-print" data-rep-print disabled>${svg("file-text")}Zapisz PDF</button></header><div class="rep-scroll"><article class="report" id="repDoc"></article></div>`;
    document.body.append(dlg);
    root = document.createElement("div"); root.id = "repPrint"; root.className = "report"; document.body.append(root);
    doc = dlg.querySelector("#repDoc"); bar = dlg.querySelector("#repBar"); printBtn = dlg.querySelector("[data-rep-print]");
    dlg.addEventListener("click", e => { if (e.target.closest("[data-rep-close]")) dlg.close(); if (e.target.closest("[data-rep-print]")) print(); });
    dlg.addEventListener("close", () => { run++; window.UIHistory?.dismiss("raport"); });
    addEventListener("afterprint", () => { document.body.classList.remove("rep-printing"); if (title) { document.title = title; title = ""; } root.replaceChildren(); });
  }
  function progress(text, part) { dlg.querySelector("#repProg").textContent = text; bar.style.width = `${Math.round(part * 100)}%`; }

  /* Wait until the tab stops changing (async fills: GUS, Wikipedia, charts) and no "Wczytuję…" placeholder is left. */
  async function settle(el, max = 7000) {
    let last = Date.now(); const mo = new MutationObserver(() => { last = Date.now(); });
    mo.observe(el, { subtree: true, childList: true, characterData: true });
    const t0 = Date.now();
    while (Date.now() - t0 < max) { await wait(120); if (Date.now() - last > 450 && !/Wczytuję|Przygotowuję/.test(el.textContent)) break; }
    mo.disconnect();
  }
  function copy(src) {
    const out = document.createElement("div"); out.innerHTML = src.innerHTML;
    const live = src.querySelectorAll("canvas"), dead = out.querySelectorAll("canvas");
    dead.forEach((c, i) => { try { const img = new Image(); img.src = live[i].toDataURL("image/png"); img.className = "rep-canvas " + c.className; img.width = live[i].clientWidth || live[i].width; c.replaceWith(img); } catch (e) { c.remove(); } });
    out.querySelectorAll(STRIP).forEach(e => e.remove());
    out.querySelectorAll(".indicator-grid").forEach(grid => { const t = table(grid); if (t) grid.outerHTML = t; else grid.remove(); });
    out.querySelectorAll("[id]").forEach(e => e.removeAttribute("id"));
    out.querySelectorAll("img[loading]").forEach(i => i.loading = "eager");
    out.querySelectorAll("details").forEach(d => d.open = true);
    out.querySelectorAll(".wiki-card").forEach(d => d.classList.add("open"));
    out.querySelectorAll("button,a").forEach(b => { b.tabIndex = -1; });
    return out.innerHTML;
  }
  /* Indicator cards become one compact table row each; indicators without a value are left out. */
  const txt = el => (el?.textContent || "").replace(/\s+/g, " ").trim();
  function table(grid) {
    const rows = [...grid.querySelectorAll(".indicator-card")].map(c => {
      const v = c.querySelector(".indicator-value"), unit = txt(v?.querySelector("small")), val = txt(v).slice(0, txt(v).length - unit.length).trim();
      if (!val || /^(—|–|-|brak.*|b\.d\.)$/i.test(val)) return "";
      const tone = (c.className.match(/score-(\w+)/) || [])[1] || "neutral";
      const [pos = "", tr = ""] = [...c.querySelectorAll(".indicator-context span")].map(txt);
      return `<tr class="t-${tone}"><td><b>${esc(txt(c.querySelector(".metric-caption span")))}</b><small>${esc(txt(c.querySelector("footer span")))}</small></td><td class="t-v"><b>${esc(val)}</b> ${esc(unit)}</td><td><span class="t-pill">${esc(txt(c.querySelector(".score-pill")))}</span></td><td class="t-n">${esc(pos.replace(/^Pozycja\s*/, "").replace("—", ""))}</td><td class="t-n">${esc(/brak danych/i.test(tr) ? "" : tr)}</td></tr>`;
    }).join("");
    return rows ? `<table class="rep-tab"><thead><tr><th>Wskaźnik</th><th>Wartość</th><th>Ocena</th><th>Pozycja</th><th>Zmiana</th></tr></thead><tbody>${rows}</tbody></table>` : "";
  }
  const hasData = html => /metric-row|section|<svg|<img|<li/.test(html);
  const section = (c, icon, html) => `<section class="rep-sec data-content"><h1 class="rep-h">${icon ? svg(icon) : ""}${esc(c)}</h1>${html}</section>`;

  async function elections(g) {
    const P = window.GminaProfile; let html = "";
    const u = await window.Urzedy?.get(g.k).catch(() => null);
    if (u) html += window.Urzedy.rulers(u);
    const d = await P?.load(g.k).catch(() => null), w = d?.wyb;
    if (w?.g) for (const e of w.elections.filter(e => w.g[e.id])) html += `<div class="rep-el"><h2 class="rep-el-h">${esc(e.label)}</h2>${P.elections(w, e.id)}</div>`;
    const out = document.createElement("div"); out.innerHTML = html;
    out.querySelectorAll(STRIP).forEach(e => e.remove());
    out.querySelectorAll(".rep-el .metric-section > h2").forEach(h => h.remove());
    return out.innerHTML;
  }

  async function open() {
    const R = window.PLOTS_GMINY?.report, g = R?.gmina(); if (!g) return;
    ensure(); const id = ++run, before = R.category();
    window.Track?.("raport_pdf", { gmina: g.n, teryt: g.k });
    doc.innerHTML = ""; printBtn.disabled = true; dlg.classList.remove("is-ready");
    if (!dlg.open) { dlg.showModal(); window.UIHistory?.open("raport", () => dlg.close()); }
    const cats = R.categories(), steps = cats.length + 1; let step = 0;
    const alive = () => id === run && R.gmina() === g;
    progress("Wczytuję dane GUS…", 0);
    for (let t = 0; t < 80 && !g._gusStatus && alive(); t++) await wait(250);
    const parts = [], toc = [];
    try {
      for (const c of cats) {
        if (!alive()) return;
        progress(`Zbieram: ${c}`, ++step / steps);
        if (c === "Wybory") { const h = await elections(g); if (h) { parts.push(section(c, R.icon(c), h)); toc.push(c); } continue; }
        const el = R.render(c); await settle(el, c === "Przegląd" ? 9000 : 6000);
        if (c === "Źródła") el.querySelectorAll(".indicator-grid").forEach(x => x.remove()); // the tables above already name each source
        const h = copy(el);
        if (c === "Przegląd") {
          parts.push(`<section class="rep-sec rep-first data-content">${h}</section>`);
          const o = await window.Urzedy?.report(g.k).catch(() => null);
          if (o) { const box = document.createElement("div"); box.innerHTML = o.html; box.querySelectorAll(STRIP).forEach(e => e.remove()); parts.push(section("Urząd gminy", "bank", box.innerHTML)); toc.push("Urząd gminy"); }
          continue;
        }
        if (!hasData(h)) continue;
        parts.push(section(c, R.icon(c), h)); toc.push(c);
      }
    } finally { R.restore(before); }
    if (!alive()) return;
    const crest = window.MunicipalityCrests?.render(g) || "", D = window.DawneWoj?.dawne[g.k];
    const today = new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
    const cover = `<header class="rep-cover"><div class="rep-crest">${crest}</div><div><small>Raport gminy</small><h1>${esc(g.n)}</h1><p>${esc(g.typ || "Gmina")} · ${esc(R.region(g))}</p><p>TERYT ${esc(g.k)}${D ? ` · kiedyś stolica województwa ${esc(D[0])} (${D[1]}–1998)` : ""}</p></div></header>
      <nav class="rep-toc"><h2>W raporcie</h2><ol><li>Przegląd</li>${toc.map(c => `<li>${esc(c)}</li>`).join("")}</ol>
      <p class="rep-note">Stan danych na ${esc(today)}. Źródła: GUS Bank Danych Lokalnych, Narodowy Spis Powszechny 2021, PKW, Krajowy Rejestr Sądowy, Katalog Podmiotów Publicznych, rejestr zabytków NID, GDOŚ, Wikipedia i Wikimedia Commons. Rok każdego wskaźnika podano przy wartości. Zielony oznacza najlepsze 20% gmin, czerwony najsłabsze 20%.</p></nav>`;
    doc.innerHTML = cover + parts.join("") + `<footer class="rep-foot">Wygenerowano ${esc(today)} · xoogklastry.github.io/plots</footer>`;
    progress(`Gotowe: ${toc.length + 1} rozdziałów`, 1);
    printBtn.disabled = false; dlg.classList.add("is-ready");
  }
  function print() {
    const g = window.PLOTS_GMINY?.report?.gmina();
    root.innerHTML = doc.innerHTML;
    title = document.title; document.title = `Raport gminy ${g ? g.n + " " + g.k : ""}`.trim();
    document.body.classList.add("rep-printing");
    window.Track?.("raport_pdf_zapis", { gmina: g?.n, teryt: g?.k });
    setTimeout(() => window.print(), 50);
  }
  window.GminaReport = { open };
})();
