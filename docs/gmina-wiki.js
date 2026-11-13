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
      ${paras.length > 1 ? `<button type="button" class="wiki-more" data-wiki-more aria-expanded="false">Czytaj dalej</button>` : ""}
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
      if (!relative.test(def.key) && !/%|‰|\bna\b|\//i.test(def.unit || "") && !/\bna\b|średni|przeciętn/i.test(def.label)) continue;
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
  /* Photo gallery (data/foto/<woj>.json, Wikimedia Commons): thumbnail strip + lightbox with author and licence. */
  const photoCache = new Map();
  function loadPhotos(k) {
    const woj = String(k).slice(0, 2);
    if (!photoCache.has(woj)) photoCache.set(woj, fetch(`data/foto/${woj}.json`, { signal: AbortSignal.timeout(20000) })
      .then(r => r.ok ? r.json() : { gminy: {} }).catch(e => { photoCache.delete(woj); throw e; }));
    return photoCache.get(woj).then(doc => doc.gminy[k] || []);
  }
  const large = u => String(u).replace(/\/(\d+)px-/, "/1280px-");
  function galleryHtml(photos, name) {
    if (!photos.length) return "";
    return `<section class="metric-section gallery-section"><h2><svg class="ic" aria-hidden="true"><use href="icons/phosphor.svg#image"></use></svg>Zdjęcia <span class="muted small">${photos.length}</span></h2>
      <div class="gallery" role="list">${photos.map((p, i) => `<button type="button" class="gallery-item" role="listitem" data-photo="${i}" style="--r:${Number(p.r) || 1.5}" aria-label="Powiększ zdjęcie ${i + 1}: ${esc(p.f.replace(/\.[^.]+$/, ""))}"><img src="${esc(safeUrl(p.t) || "")}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join("")}</div>
      <p class="wiki-license">Zdjęcia: Wikimedia Commons, autorzy i licencje po powiększeniu.</p></section>`;
  }
  function openPhoto(photos, index, name) {
    let box = document.getElementById("photoBox");
    if (!box) {
      box = document.createElement("dialog"); box.id = "photoBox"; box.className = "photo-box";
      box.innerHTML = `<button type="button" class="photo-close" data-photo-close aria-label="Zamknij">×</button><button type="button" class="photo-nav prev" data-photo-step="-1" aria-label="Poprzednie">‹</button><figure><img alt="" referrerpolicy="no-referrer"><figcaption></figcaption></figure><button type="button" class="photo-nav next" data-photo-step="1" aria-label="Następne">›</button>`;
      document.body.append(box);
      box.addEventListener("click", e => { if (e.target === box || e.target.closest("[data-photo-close]")) box.close(); const s = e.target.closest("[data-photo-step]"); if (s) box._show(box._i + Number(s.dataset.photoStep)); });
      box.addEventListener("keydown", e => { if (e.key === "ArrowLeft") box._show(box._i - 1); if (e.key === "ArrowRight") box._show(box._i + 1); });
      let x0 = null; box.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
      box.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) box._show(box._i + (dx < 0 ? 1 : -1)); x0 = null; });
    }
    box._show = i => {
      const list = box._photos; box._i = (i + list.length) % list.length; const p = list[box._i];
      box.querySelector("img").src = safeUrl(large(p.t)) || ""; box.querySelector("img").alt = `${box._name} – ${p.f.replace(/\.[^.]+$/, "")}`;
      box.querySelector("figcaption").innerHTML = `${esc(p.f.replace(/\.[^.]+$/, "").replace(/_/g, " "))}<br><span>${esc(p.a || "autor nieznany")} · ${esc(p.l || "licencja w opisie")} · <a href="${esc(safeUrl(p.u) || "#")}" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> · ${box._i + 1}/${list.length}</span>`;
    };
    box._photos = photos; box._name = name; box._show(index);
    if (!box.open) box.showModal();
  }
  const api = { load, render, highlights, minimap, minimapHtml, loadPhotos, galleryHtml, openPhoto };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GminaWiki = api;
})(typeof window !== "undefined" ? window : globalThis);
