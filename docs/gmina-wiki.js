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
    add("Strona", w.www ? w.www.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : "", w.www);
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
  const api = { load, render, highlights };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GminaWiki = api;
})(typeof window !== "undefined" ? window : globalThis);
