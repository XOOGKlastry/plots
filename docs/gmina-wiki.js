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
  /* Short facts for the top of the overview: seat, head of the gmina, villages. */
  function quick(w) {
    const role = (/prezydent|burmistrz|wójt/i.exec(w.headRole || "") || [""])[0].toLowerCase();
    return [["Siedziba", w.seat], [role ? role[0].toUpperCase() + role.slice(1) : "Wójt, burmistrz lub prezydent", w.head],
      ["Sołectwa", w.solectwa], ["Miejscowości", w.miejscowosci]].filter(x => x[1]).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
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
  /* Location map: the gmina among its neighbours (names, powiat and voivodeship borders, scale) with a Poland
     locator inset. Borders and neighbours come from shared arcs of the PRG topology (data/municipalities.topojson). */
  let topo = null;
  function topology() {
    if (topo) return topo;
    const t = window.MunicipalityContext?.topology();
    if (!t) return null;
    const tr = t.transform, arcs = t.arcs.map(arc => { let x = 0, y = 0; return arc.map(p => { if (!tr) return p; x += p[0]; y += p[1]; return [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]]; }); });
    const owners = new Map(), byKey = new Map(), flat = a => Array.isArray(a) ? a.flatMap(flat) : [a];
    for (const o of Object.values(t.objects)) for (const g of o.geometries || []) {
      const k = g.properties?.k; if (!k || byKey.has(k)) continue;
      const ids = [...new Set(flat(g.arcs).map(i => i < 0 ? ~i : i))]; byKey.set(k, ids);
      for (const i of ids) { const list = owners.get(i) || []; list.push(k); owners.set(i, list); }
    }
    const kinds = { outline: [], woj: [], powiat: [] }, neighbours = new Map();
    for (const [i, ks] of owners) {
      if (ks.length < 2) { kinds.outline.push(i); continue; }
      const [a, b] = ks;
      if (a.slice(0, 2) !== b.slice(0, 2)) kinds.woj.push(i); else if (a.slice(0, 4) !== b.slice(0, 4)) kinds.powiat.push(i);
      for (const x of ks) for (const y of ks) if (x !== y) { const s = neighbours.get(x) || new Set(); s.add(y); neighbours.set(x, s); }
    }
    return topo = { arcs, kinds, neighbours, byKey };
  }
  async function neighbours(k) { await window.MunicipalityContext.ready(); const t = topology(); return t ? [...(t.neighbours.get(k) || [])] : []; }
  const CITIES = [["Warszawa", 21.01, 52.23], ["Kraków", 19.94, 50.06], ["Łódź", 19.46, 51.76], ["Wrocław", 17.03, 51.11], ["Poznań", 16.93, 52.41],
    ["Gdańsk", 18.65, 54.35], ["Szczecin", 14.55, 53.43], ["Bydgoszcz", 18.01, 53.12], ["Lublin", 22.57, 51.25], ["Białystok", 23.16, 53.13],
    ["Katowice", 19.02, 50.26], ["Kielce", 20.63, 50.87], ["Olsztyn", 20.49, 53.78], ["Rzeszów", 22.0, 50.04], ["Opole", 17.93, 50.67],
    ["Zielona Góra", 15.51, 51.94], ["Gorzów Wlkp.", 15.23, 52.73], ["Toruń", 18.6, 53.01]];
  function project(bbox, w, h, pad) {
    const kx = Math.cos(((bbox[1] + bbox[3]) / 2) * Math.PI / 180), bw = (bbox[2] - bbox[0]) * kx, bh = bbox[3] - bbox[1];
    const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh), ox = (w - bw * s) / 2, oy = (h - bh * s) / 2;
    const pr = ([x, y]) => [ox + (x - bbox[0]) * kx * s, h - oy - (y - bbox[1]) * s];
    pr.kmPerPx = 111.32 / s; return pr;
  }
  function trace(ctx, f, pr) { ctx.beginPath(); for (const poly of f.polygons) for (const ring of poly) ring.forEach((p, i) => { const [x, y] = pr(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); }
  function strokeArcs(ctx, t, ids, pr) { ctx.beginPath(); for (const i of ids) t.arcs[i].forEach((p, j) => { const [x, y] = pr(p); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
  function canvas(el, w, h) { const r = Math.min(2, window.devicePixelRatio || 1); el.width = Math.round(w * r); el.height = Math.round(h * r); el.style.aspectRatio = `${w}/${h}`; const ctx = el.getContext("2d"); ctx.scale(r, r); return ctx; }
  function palette(el) {
    const cs = getComputedStyle(el), v = (n, d) => cs.getPropertyValue(n).trim() || d;
    return { acc: v("--acc", "#087cfc"), land: v("--minimap-land", "#dfe3ea"), near: v("--minimap-near", "#c9d0db"), edge: v("--minimap-edge", "#ffffff"),
      border: v("--minimap-border", "#5b6474"), text: v("--minimap-text", "#2b3240"), halo: v("--minimap-halo", "rgba(255,255,255,.9)"), sea: v("--minimap-bg", "#f3f5f8") };
  }
  // Label point: area-weighted centroid of the largest outer ring (good enough for compact gmina shapes).
  function labelPoint(f) {
    let best = null, bestA = 0;
    for (const poly of f.polygons) {
      const ring = poly[0]; let a = 0, cx = 0, cy = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const c = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; a += c; cx += (ring[j][0] + ring[i][0]) * c; cy += (ring[j][1] + ring[i][1]) * c; }
      if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; }
    }
    return best || [(f.bbox[0] + f.bbox[2]) / 2, (f.bbox[1] + f.bbox[3]) / 2];
  }
  function label(ctx, text, x, y, col, bold, size) {
    ctx.font = `${bold ? 700 : 500} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 3; ctx.strokeStyle = col.halo; ctx.lineJoin = "round"; ctx.strokeText(text, x, y); ctx.fillStyle = col.text; ctx.fillText(text, x, y);
  }
  // Apple Maps-like look: warm land, soft admin lines, translucent blue area with a glow, callout label, frosted inset.
  const MAP = { land: "#efede7", near: "#faf9f6", edge: "rgba(150,146,160,.28)", powiat: "#bfb3cf", woj: "#a68fc8", text: "#8a8a90", ink: "#1c1c1e",
    halo: "rgba(255,255,255,.95)", blue: "#0a84ff", blueFill: "rgba(10,132,255,.16)", pl: "#e2e2e7", plEdge: "#c9c9cf" };
  const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif`;
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function callout(ctx, text, x, y) {
    ctx.font = `700 13px ${FONT}`; const w = ctx.measureText(text).width + 22, h = 26;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
    roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.restore();
    ctx.fillStyle = MAP.blue; ctx.beginPath(); ctx.arc(x - w / 2 + 11, y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = MAP.ink; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(text, x - w / 2 + 18, y + .5);
  }
  async function minimap(el, k, names = {}) {
    if (!el || !window.MunicipalityContext) return;
    const shapes = await window.MunicipalityContext.ready(), f = shapes.find(x => x.id === k), t = topology();
    if (!f || !t || !el.isConnected) { if (el) el.hidden = true; return; }
    el.hidden = false;
    const [cMain, cInset] = el.querySelectorAll("canvas");
    const W = Math.max(280, Math.min(620, el.clientWidth || 360)), H = Math.round(W * 0.74);
    const near = new Set([k, ...(t.neighbours.get(k) || [])]);
    let bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const x of shapes) if (near.has(x.id)) bb = [Math.min(bb[0], x.bbox[0]), Math.min(bb[1], x.bbox[1]), Math.max(bb[2], x.bbox[2]), Math.max(bb[3], x.bbox[3])];
    const px = (bb[2] - bb[0]) * 0.05, py = (bb[3] - bb[1]) * 0.05; bb = [bb[0] - px, bb[1] - py, bb[2] + px, bb[3] + py];
    const pr = project(bb, W, H, 0);
    let ctx = canvas(cMain, W, H); ctx.fillStyle = MAP.land; ctx.fillRect(0, 0, W, H); ctx.lineJoin = "round"; ctx.lineCap = "round";
    const inView = shapes.filter(x => !(x.bbox[2] < bb[0] || x.bbox[0] > bb[2] || x.bbox[3] < bb[1] || x.bbox[1] > bb[3]));
    for (const x of inView) { trace(ctx, x, pr); ctx.fillStyle = near.has(x.id) ? MAP.near : MAP.land; ctx.fill(); ctx.strokeStyle = MAP.edge; ctx.lineWidth = .8; ctx.stroke(); }
    ctx.strokeStyle = MAP.powiat; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]); strokeArcs(ctx, t, t.kinds.powiat, pr); ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 5; strokeArcs(ctx, t, [...t.kinds.woj, ...t.kinds.outline], pr);
    ctx.strokeStyle = MAP.woj; ctx.lineWidth = 2; ctx.setLineDash([7, 3, 1.5, 3]); strokeArcs(ctx, t, [...t.kinds.woj, ...t.kinds.outline], pr); ctx.setLineDash([]);
    // The gmina: glow, translucent fill, crisp outline.
    ctx.save(); ctx.shadowColor = "rgba(10,132,255,.45)"; ctx.shadowBlur = 14; trace(ctx, f, pr); ctx.fillStyle = MAP.blueFill; ctx.fill(); ctx.restore();
    trace(ctx, f, pr); ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = MAP.blue; ctx.lineWidth = 2.6; ctx.stroke();
    // Neighbour names (skipped under the inset and at the edges), then the callout.
    const IW = Math.round(Math.min(150, W * 0.3)), IH = Math.round(IW * 0.94);
    ctx.font = `600 10.5px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 3.5; ctx.strokeStyle = MAP.halo; ctx.fillStyle = MAP.text;
    for (const x of inView) if (near.has(x.id) && x !== f) {
      const [lx, ly] = pr(labelPoint(x)), txt = names[x.id] || "", hw = ctx.measureText(txt).width / 2;
      if (lx + hw > W - IW - 18 && ly < IH + 26) continue;
      if (lx - hw < 4 || lx + hw > W - 4 || ly < 10 || ly > H - 34) continue;
      ctx.strokeText(txt, lx, ly); ctx.fillText(txt, lx, ly);
    }
    const [fx, fy] = pr(labelPoint(f)); callout(ctx, names[k] || "", Math.max(70, Math.min(W - 70, fx)), fy);
    // Scale: frosted pill with a two-tone bar.
    const kmPx = pr.kmPerPx, target = W / 5 * kmPx, step = [1, 2, 5, 10, 20, 50].find(s => s >= target / 1.5) || 50, len = step / kmPx;
    ctx.font = `600 10.5px ${FONT}`; const lab = `${step} km`, lw = ctx.measureText(lab).width, bw = len + lw + 26, by = H - 30;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.1)"; ctx.shadowBlur = 6; roundRect(ctx, 10, by, bw, 20, 10); ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.fill(); ctx.restore();
    ctx.fillStyle = MAP.ink; roundRect(ctx, 20, by + 8.5, len, 3, 1.5); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillRect(20 + len / 2, by + 9.3, len / 2 - 1, 1.4);
    ctx.fillStyle = MAP.ink; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(lab, 26 + len, by + 10.5);
    // Poland locator with an iOS location dot.
    const all = shapes.reduce((b, x) => [Math.min(b[0], x.bbox[0]), Math.min(b[1], x.bbox[1]), Math.max(b[2], x.bbox[2]), Math.max(b[3], x.bbox[3])], [Infinity, Infinity, -Infinity, -Infinity]);
    const pl = project(all, IW, IH, 6);
    ctx = canvas(cInset, IW, IH); ctx.lineJoin = "round";
    ctx.fillStyle = MAP.pl; ctx.strokeStyle = MAP.pl; ctx.lineWidth = .8;
    for (const x of shapes) { trace(ctx, x, pl); ctx.fill(); ctx.stroke(); }
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; strokeArcs(ctx, t, t.kinds.woj, pl);
    ctx.strokeStyle = MAP.plEdge; ctx.lineWidth = 1; strokeArcs(ctx, t, t.kinds.outline, pl);
    const [cx, cy] = pl(labelPoint(f));
    ctx.fillStyle = "rgba(10,132,255,.2)"; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 4; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = MAP.blue; ctx.beginPath(); ctx.arc(cx, cy, 4.2, 0, Math.PI * 2); ctx.fill();
  }
  function minimapHtml(name) {
    return `<figure class="locmap" id="gminaMinimap" hidden><canvas class="locmap-main" role="img" aria-label="${esc(name)} i sąsiednie gminy z granicami powiatów i województw"></canvas>
      <canvas class="locmap-inset" role="img" aria-label="${esc(name)} na mapie Polski"></canvas>
      <figcaption>© GUGiK PRG</figcaption></figure>`;
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
  const api = { load, render, quick, highlights, minimap, minimapHtml, neighbours, loadPhotos, galleryHtml, openPhoto };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GminaWiki = api;
})(typeof window !== "undefined" ? window : globalThis);
