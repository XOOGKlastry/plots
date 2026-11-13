/* Gmina compendium: Wikipedia/Wikidata facts (data/wiki/<woj>.json) and national highlights for the gmina dialog. */
(function (root) {
  "use strict";
  const cache = new Map();
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function load(k) {
    const woj = String(k).slice(0, 2);
    if (!cache.has(woj)) cache.set(woj, fetch(`data/wiki/${woj}.json`, { signal: AbortSignal.timeout(20000) })
      .then(r => { if (!r.ok) throw Error("Brak danych Wikipedii"); return r.json(); })
      .catch(e => { cache.delete(woj); throw e; }));
    return cache.get(woj).then(doc => doc.gminy[k] || null);
  }
  function safeUrl(u) { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } }
  function facts(w) {
    const rows = [];
    const add = (label, value, href) => { if (value) rows.push(`<div class="wiki-fact"><dt>${esc(label)}</dt><dd>${href && safeUrl(href) ? `<a href="${esc(safeUrl(href))}" target="_blank" rel="noopener noreferrer">${esc(value)}</a>` : esc(value)}</dd></div>`); };
    add("Siedziba", w.seat);
    const role = (/prezydent|burmistrz|wójt/i.exec(w.headRole || "") || [""])[0].toLowerCase();
    add(role ? role[0].toUpperCase() + role.slice(1) : "Wójt, burmistrz lub prezydent", w.head);
    add("Sołectwa", w.solectwa);
    add("Miejscowości", w.miejscowosci);
    add("Wysokość", Number.isFinite(w.elev) ? `${w.elev.toLocaleString("pl-PL")} m n.p.m.` : "");
    add("Utworzona", w.since);
    add("Prawa miejskie", w.rights);
    add("Urząd", w.office);
    add("Kod pocztowy", w.postal);
    add("Numer kierunkowy", w.phone ? `+48 ${w.phone}` : "");
    add("Tablice rejestracyjne", w.plates);
    if (w.waters?.length) add("Nad wodami", w.waters.join(", "));
    add("Przydomek", w.nick);
    add("Dewiza", w.motto);
    add("Strona", w.www ? w.www.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : "", w.www);
    add("BIP", w.bip ? w.bip.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : "", w.bip);
    if (w.twins?.length) add(w.twins.length > 1 ? "Miasta partnerskie" : "Miasto partnerskie", w.twins.join(", "));
    return rows.join("");
  }
  /* Wikipedia section: photo, intro (collapsed), facts, licence. */
  function render(w, name) {
    if (!w) return `<section class="metric-section wiki-section"><h2><svg class="ic" aria-hidden="true"><use href="icons/phosphor.svg#book-open"></use></svg>O gminie</h2><p class="muted small">Nie znaleziono artykułu o tej gminie w polskiej Wikipedii.</p></section>`;
    const paras = String(w.intro || "").split(/\n+/).filter(Boolean);
    const thumb = safeUrl(w.thumb), url = safeUrl(w.url);
    return `<section class="metric-section wiki-section"><h2><svg class="ic" aria-hidden="true"><use href="icons/phosphor.svg#book-open"></use></svg>O gminie</h2>
      <div class="wiki-card">${thumb ? `<img class="wiki-photo" src="${esc(thumb)}" alt="${esc(name)} – zdjęcie z Wikipedii" loading="lazy" referrerpolicy="no-referrer">` : ""}
      <div class="wiki-text" data-wiki-text>${paras.map(p => `<p>${esc(p)}</p>`).join("")}</div>
      ${paras.join(" ").length > 420 ? `<button type="button" class="wiki-more" data-wiki-more aria-expanded="false">Czytaj dalej</button>` : ""}
      <dl class="wiki-facts">${facts(w)}</dl>
      <p class="wiki-license">Tekst: ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Wikipedia – ${esc(w.title)}</a>` : "Wikipedia"}, licencja <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.pl" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>. Dane: Wikidata (CC0).${safeUrl(w.commons) ? ` <a href="${esc(safeUrl(w.commons))}" target="_blank" rel="noopener noreferrer">Zdjęcia w Wikimedia Commons</a>` : ""}</p></div></section>`;
  }
  /* National highlights: indicators where the gmina is in the top 3% (best direction), from cached sorted values. */
  const dist = new Map();
  function distribution(model, gminy, def) {
    if (!dist.has(def.key)) dist.set(def.key, gminy.map(g => model.metric(g, def).value).filter(Number.isFinite).sort((a, b) => a - b));
    return dist.get(def.key);
  }
  const relative = /_10k|_100km2|proc|_na_|na_1000|_os$|gestosc|udzial|_m2_os/;
  function highlights(model, gminy, g, limit = 8) {
    const out = [];
    for (const def of model.definitions) {
      // Only relative measures (shares, per resident, per km², averages): absolute totals always favour big cities.
      if (!relative.test(def.key) && !/%|‰|\bna\b|\/|średni/i.test((def.unit || "") + " " + def.label)) continue;
      const v = model.metric(g, def).value;
      if (!Number.isFinite(v)) continue;
      const s = distribution(model, gminy, def);
      if (s.length < 200) continue;
      const better = def.lowerBetter ? s.filter(x => x < v).length : s.filter(x => x > v).length;
      const rank = better + 1, pct = rank / s.length;
      if (pct <= 0.03 && !(v === 0 && !def.lowerBetter)) out.push({ def, v, rank, n: s.length, pct });
    }
    return out.sort((a, b) => a.pct - b.pct).slice(0, limit);
  }
  /* Location minimap: Poland with the gmina marked, plus its neighbourhood, drawn on canvas from the shared PRG topology. */
  let base = null;
  function project(bbox, w, h, pad) {
    const kx = Math.cos(((bbox[1] + bbox[3]) / 2) * Math.PI / 180), bw = (bbox[2] - bbox[0]) * kx, bh = bbox[3] - bbox[1];
    const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh), ox = (w - bw * s) / 2, oy = (h - bh * s) / 2;
    return ([x, y]) => [ox + (x - bbox[0]) * kx * s, h - oy - (y - bbox[1]) * s];
  }
  function trace(ctx, f, pr) { ctx.beginPath(); for (const poly of f.polygons) for (const ring of poly) ring.forEach((p, i) => { const [x, y] = pr(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); }
  function canvas(el, w, h) { const c = el, r = Math.min(2, window.devicePixelRatio || 1); c.width = w * r; c.height = h * r; const ctx = c.getContext("2d"); ctx.scale(r, r); return ctx; }
  function colors(el) { const cs = getComputedStyle(el); return { acc: cs.getPropertyValue("--acc").trim() || "#087cfc", land: cs.getPropertyValue("--minimap-land").trim() || "#d9dee6", edge: cs.getPropertyValue("--minimap-edge").trim() || "#ffffff" }; }
  async function minimap(el, k) {
    if (!el || !window.MunicipalityContext) return;
    const shapes = await window.MunicipalityContext.ready(), f = shapes.find(x => x.id === k);
    if (!f || !el.isConnected) { el.hidden = true; return; }
    const [cPl, cNb] = el.querySelectorAll("canvas"), col = colors(el), W = 200, H = 190;
    // Poland: the country fill is drawn once and reused for every gmina.
    const all = shapes.reduce((b, x) => [Math.min(b[0], x.bbox[0]), Math.min(b[1], x.bbox[1]), Math.max(b[2], x.bbox[2]), Math.max(b[3], x.bbox[3])], [Infinity, Infinity, -Infinity, -Infinity]);
    const prPl = project(all, W, H, 6);
    if (!base || base.land !== col.land) {
      const off = document.createElement("canvas"), octx = canvas(off, W, H);
      octx.fillStyle = col.land; for (const x of shapes) { trace(octx, x, prPl); octx.fill(); }
      base = { img: off, land: col.land };
    }
    let ctx = canvas(cPl, W, H); ctx.drawImage(base.img, 0, 0, W, H);
    ctx.fillStyle = col.acc; trace(ctx, f, prPl); ctx.fill();
    const [cx, cy] = prPl([(f.bbox[0] + f.bbox[2]) / 2, (f.bbox[1] + f.bbox[3]) / 2]);
    ctx.strokeStyle = col.acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke();
    // Neighbourhood: the gmina with its surroundings, every gmina outlined.
    const span = Math.max(f.bbox[2] - f.bbox[0], (f.bbox[3] - f.bbox[1]) * 1.6, 0.12), mx = (f.bbox[0] + f.bbox[2]) / 2, my = (f.bbox[1] + f.bbox[3]) / 2;
    const nb = [mx - span * 1.3, my - span * 0.8, mx + span * 1.3, my + span * 0.8], prNb = project(nb, W, H, 0);
    ctx = canvas(cNb, W, H); ctx.lineJoin = "round";
    for (const x of shapes) {
      if (x.bbox[2] < nb[0] || x.bbox[0] > nb[2] || x.bbox[3] < nb[1] || x.bbox[1] > nb[3]) continue;
      trace(ctx, x, prNb); ctx.fillStyle = x === f ? col.acc : col.land; ctx.fill(); ctx.strokeStyle = col.edge; ctx.lineWidth = 1; ctx.stroke();
    }
    el.hidden = false;
  }
  function minimapHtml(name) {
    return `<section class="metric-section minimap-section" id="gminaMinimap" hidden><h2><svg class="ic" aria-hidden="true"><use href="icons/phosphor.svg#map-trifold"></use></svg>Położenie</h2>
      <div class="minimap"><figure><canvas role="img" aria-label="${esc(name)} na mapie Polski"></canvas><figcaption>W Polsce</figcaption></figure>
      <figure><canvas role="img" aria-label="${esc(name)} i sąsiednie gminy"></canvas><figcaption>Sąsiednie gminy</figcaption></figure></div></section>`;
  }
  const api = { load, render, highlights, minimap, minimapHtml };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GminaWiki = api;
})(typeof window !== "undefined" ? window : globalThis);
