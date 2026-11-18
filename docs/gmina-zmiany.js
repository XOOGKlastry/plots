/* Gmina card, overview: how the gmina changed in 10 years (data/zmiany/<woj>.json, built by mapgen/gus_bdl/zmiany_podobne.py)
   and the five most similar gminy in Poland. */
(function () {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const cache = new Map();
  const load = w => { if (!cache.has(w)) cache.set(w, fetch(`data/zmiany/${w}.json`).then(r => { if (!r.ok) throw Error("zmiany"); return r.json(); }).catch(e => { cache.delete(w); throw e; })); return cache.get(w); };
  const num = (v, d = 1) => v.toLocaleString("pl-PL", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const LOWER = new Set(["bezrobocie_proc", "pomoc_spol_10k", "udzial_65", "mediana_wieku"]);
  const NEUTRAL = new Set(["udzial_65", "mediana_wieku"]);

  function change(m, v) {
    const s = v > 0 ? "+" : v < 0 ? "−" : "";
    const a = Math.abs(v);
    return m.kind === "pp" ? `${s}${num(a)} pkt proc.` : m.kind === "rel" ? `${s}${num(a)}%` : `${s}${num(a, 1)} ${m.key === "mediana_wieku" ? "roku" : esc(m.unit || "")}`;
  }

  async function fill(g, ctx) {
    const w = g.k.slice(0, 2);
    let doc; try { doc = await load(w); } catch { return; }
    if (ctx.current() !== g) return;
    const d = doc.g[g.k]; if (!d) return;
    const woj = ctx.wojName(g);
    const zm = ctx.zm(), pod = ctx.pod();
    if (zm && zm.isConnected) {
      const rows = doc.meta.filter(m => d.z[m.key]).map(m => {
        const [v, pl, wr] = d.z[m.key];
        // Tone: an increase is good unless lower is better; age structure stays neutral.
        const better = NEUTRAL.has(m.key) ? 0 : (LOWER.has(m.key) ? -v : v);
        const tone = !better ? "neutral" : better > 0 ? "good" : "bad";
        const top = Math.min(pl, m.n - pl + 1) <= m.n * 0.1;
        return { m, v, pl, wr, tone, top };
      });
      if (rows.length) {
        const y0 = rows[0].m.y0, y1 = rows[0].m.y1;
        zm.innerHTML = `<section class="metric-section zm-section"><h2>${window.Icons ? Icons.svg("clock-counter-clockwise") : ""}Jak się zmieniła w 10 lat <span class="muted small">${y0}–${y1}</span></h2>
          <ul class="zm-list">${rows.map(r => `<li class="zm-${r.tone}${r.top ? " zm-top" : ""}"><span class="zm-l">${esc(r.m.label)}</span><span class="zm-v">${change(r.m, r.v)}</span><span class="zm-r" title="Miejsce według wzrostu: ${r.pl}. na ${r.m.n.toLocaleString("pl-PL")} gmin w Polsce, ${r.wr}. na ${r.m.nw[g.k.slice(0, 2)]} w województwie">${r.wr}. w woj. · ${r.pl.toLocaleString("pl-PL")}. w kraju · mediana Polski ${change(r.m, r.m.med)}${r.m.key === "pit_na_mieszk" ? " (od 2025 r. nowe zasady udziału gmin w PIT)" : ""}</span><button type="button" class="stat-map-link" data-stat-map="${esc(r.m.key)}" aria-label="Pokaż na mapie Polski">${window.Icons ? Icons.svg("map-trifold") : "Mapa"}</button></li>`).join("")}</ul>
          <p class="muted small">Miejsce liczone od największego wzrostu. Kolor mówi, czy zmiana jest korzystna, a nie czy gmina wypada lepiej od mediany. Źródło: GUS BDL, obliczenia własne.</p></section>`;
      }
    }
    if (pod && pod.isConnected && d.p?.length) {
      const list = d.p.map(k => ctx.gminy.find(x => x.k === k)).filter(Boolean);
      pod.innerHTML = `<section class="metric-section"><h2>${window.Icons ? Icons.svg("users-three") : ""}Gminy podobne <span class="muted small">w całej Polsce</span></h2>
        <div class="neighbor-list">${list.map(x => `<button type="button" class="neighbor" data-neighbor="${esc(x.k)}">${esc(x.n)}<small>${esc(x.typ || "gmina")} · ${esc(ctx.region(x))}</small></button>`).join("")}</div>
        <p class="muted small">Najbliższe pod względem liczby mieszkańców, gęstości zaludnienia, udziału seniorów, PIT na mieszkańca, firm, bezrobocia, sieci gazowej i kanalizacji, mieszkań, migracji i dochodów własnych (najnowszy rok, GUS BDL).</p></section>`;
    }
  }
  window.GminaZmiany = { fill, load };
})();
