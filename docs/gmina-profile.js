/* Gmina profile: population over time, age pyramid, budget, elections, heritage and nature with names.
   Data: data/profil/<woj>.json (GUS BDL), data/dziedzictwo/<woj>.json (NID, GDOŚ/BDOT10k, Wikidata/Commons), data/wybory.json (PKW). */
(function () {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v, d = 0) => Number(v).toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
  const cache = new Map();
  function json(url) {
    if (!cache.has(url)) cache.set(url, fetch(url).then(r => r.ok ? r.json() : null).catch(() => null));
    return cache.get(url);
  }
  async function load(k) {
    const woj = k.slice(0, 2);
    const [p, d, w] = await Promise.all([json(`data/profil/${woj}.json`), json(`data/dziedzictwo/${woj}.json`), json("data/wybory.json")]);
    return { profil: p?.gminy?.[k] || null, ages: p?.ages || [], dz: d?.gminy?.[k] || null, wyb: w ? { elections: w.elections, g: w.g?.[k] } : null };
  }
  const section = (icon, title, body, note = "") => `<section class="metric-section profile-section"><h2>${Icons.svg(icon)}${esc(title)}</h2>${body}${note ? `<p class="profile-note">${note}</p>` : ""}</section>`;

  /* Population over time: area + line, hover/tap shows the year. */
  function popChart(p) {
    if (!p?.lud) return "";
    const [y0, vals] = p.lud, pts = vals.map((v, i) => [y0 + i, v]).filter(x => Number.isFinite(x[1]));
    if (pts.length < 3) return "";
    const min = Math.min(...pts.map(x => x[1])), max = Math.max(...pts.map(x => x[1])), pad = (max - min) * .12 || max * .05;
    const lo = min - pad, hi = max + pad, X = y => (y - pts[0][0]) / (pts.at(-1)[0] - pts[0][0]) * 100, Y = v => 100 - (v - lo) / (hi - lo) * 100;
    const line = pts.map(([y, v], i) => `${i ? "L" : "M"}${X(y).toFixed(2)},${Y(v).toFixed(2)}`).join("");
    const first = pts[0], last = pts.at(-1), ch = last[1] - first[1], chp = ch / first[1] * 100;
    const peak = pts.reduce((a, b) => b[1] > a[1] ? b : a);
    return section("chart-line", "Liczba mieszkańców w czasie", `<div class="pop-chart" data-pop='${esc(JSON.stringify(pts))}'>
      <div class="pop-summary"><strong>${ch >= 0 ? "+" : ""}${fmt(ch)}</strong> <span>(${ch >= 0 ? "+" : ""}${fmt(chp, 1)}%) od ${first[0]} r.</span>${peak[0] !== last[0] ? `<span class="pop-peak">najwięcej w ${peak[0]} r.: ${fmt(peak[1])}</span>` : ""}</div>
      <div class="pop-plot"><div class="pop-axis"><span>${fmt(max)}</span><span>${fmt(min)}</span></div>
      <div class="pop-area"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="popg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a84ff" stop-opacity=".28"/><stop offset="1" stop-color="#0a84ff" stop-opacity="0"/></linearGradient></defs>
        <path d="${line}L100,100L0,100Z" fill="url(#popg)"/><path d="${line}" fill="none" stroke="#0a84ff" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>
        <span class="pop-dot" hidden></span><span class="pop-tip" hidden></span></div></div>
      <div class="pop-years"><span>${first[0]}</span><span>${last[0]}</span></div></div>`, "GUS, Bank Danych Lokalnych, stan na 31 grudnia.");
  }
  function bindPop(root) {
    root.querySelectorAll(".pop-chart").forEach(el => {
      const pts = JSON.parse(el.dataset.pop), area = el.querySelector(".pop-area"), dot = el.querySelector(".pop-dot"), tip = el.querySelector(".pop-tip");
      const min = Math.min(...pts.map(x => x[1])), max = Math.max(...pts.map(x => x[1])), pad = (max - min) * .12 || max * .05, lo = min - pad, hi = max + pad;
      const show = e => {
        const r = area.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), i = Math.round(f * (pts.length - 1)), [y, v] = pts[i];
        const x = i / (pts.length - 1) * 100, yy = 100 - (v - lo) / (hi - lo) * 100;
        dot.hidden = tip.hidden = false; dot.style.left = tip.style.left = x + "%"; dot.style.top = yy + "%";
        tip.textContent = `${y}: ${fmt(v)}`; tip.style.transform = `translateX(${x > 75 ? "-100%" : x < 25 ? "0" : "-50%"})`;
      };
      area.onpointermove = show; area.onpointerdown = show; area.onpointerleave = () => { dot.hidden = tip.hidden = true; };
    });
  }

  /* Age pyramid: men left, women right, share of the population. */
  function pyramid(p, ages) {
    const pr = p?.pir;
    if (!pr) return "";
    const tot = pr.m.reduce((a, b) => a + b, 0) + pr.k.reduce((a, b) => a + b, 0), mx = Math.max(...pr.m, ...pr.k) / tot * 100;
    const rows = ages.map((a, i) => ({ a, m: pr.m[i] / tot * 100, k: pr.k[i] / tot * 100 })).reverse();
    const sm = pr.m.reduce((a, b) => a + b, 0), sk = tot - sm;
    return section("users", `Piramida wieku (${pr.y})`, `<div class="pyramid"><div class="pyr-head"><span class="pyr-m">Mężczyźni ${fmt(sm)}</span><span class="pyr-k">Kobiety ${fmt(sk)}</span></div>
      ${rows.map(r => `<div class="pyr-row"><span class="pyr-bar m"><i style="width:${(r.m / mx * 100).toFixed(1)}%" title="${fmt(r.m, 1)}%"></i></span><span class="pyr-age">${esc(r.a)}</span><span class="pyr-bar k"><i style="width:${(r.k / mx * 100).toFixed(1)}%" title="${fmt(r.k, 1)}%"></i></span></div>`).join("")}</div>`,
      "Udział grupy wieku w liczbie mieszkańców. GUS, Bank Danych Lokalnych.");
  }

  /* Budget: where the money comes from and what it is spent on (latest year). */
  const PAL = ["#0a84ff", "#30b0c7", "#34c759", "#ffcc00", "#ff9500", "#ff2d55", "#af52de", "#5856d6", "#a2845e", "#8e8e93"];
  function stack(parts, total, pop) {
    parts = parts.filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    const rest = parts.slice(9), top = parts.slice(0, 9);
    if (rest.length) top.push({ n: "Pozostałe", v: rest.reduce((a, b) => a + b.v, 0) });
    return `<div class="bud-bar">${top.map((x, i) => `<i style="flex:${x.v};background:${PAL[i]}" title="${esc(x.n)}"></i>`).join("")}</div>
      <ul class="bud-list">${top.map((x, i) => `<li><span class="bud-sw" style="background:${PAL[i]}"></span><span class="bud-n">${esc(x.n)}</span><span class="bud-v"><b>${fmt(x.v / total * 100, 1)}%</b><small>${fmt(x.v / 1e6, 1)} mln zł${pop ? ` · ${fmt(x.v / pop)} zł/os.` : ""}</small></span></li>`).join("")}</ul>`;
  }
  function budget(p) {
    const b = p?.bud;
    if (!b?.doch?.ogolem && !b?.wyd?.ogolem) return "";
    const pop = p.lud ? p.lud[1].filter(Number.isFinite).at(-1) : null;
    let html = "";
    if (b.doch?.ogolem) {
      const d = b.doch, own = d["Dochody własne razem"] || 0, named = ["PIT", "CIT", "Podatek od nieruchomości", "Podatek rolny"];
      const parts = [{ n: "Udział w PIT", v: d.PIT }, { n: "Udział w CIT", v: d.CIT }, { n: "Podatek od nieruchomości", v: d["Podatek od nieruchomości"] }, { n: "Podatek rolny", v: d["Podatek rolny"] },
        { n: "Inne dochody własne", v: own - named.reduce((a, k) => a + (d[k] || 0), 0) }, { n: "Subwencja ogólna", v: d["Subwencja ogólna"] }, { n: "Dotacje", v: d.Dotacje }];
      const known = own + (d["Subwencja ogólna"] || 0) + (d.Dotacje || 0);
      if (d.ogolem - known > 0) parts.push({ n: "Pozostałe dochody", v: d.ogolem - known });
      html += `<div class="bud-block"><h3>Skąd pieniądze <span>${fmt(d.ogolem / 1e6, 1)} mln zł · ${d.y}</span></h3>${stack(parts.map(x => ({ ...x, v: x.v || 0 })), d.ogolem, pop)}</div>`;
    }
    if (b.wyd?.ogolem) {
      const w = b.wyd, parts = Object.entries(w).filter(([k]) => k !== "ogolem" && k !== "y").map(([n, v]) => ({ n, v }));
      const sum = parts.reduce((a, x) => a + x.v, 0);
      if (w.ogolem - sum > 0) parts.push({ n: "Pozostałe działy", v: w.ogolem - sum });
      html += `<div class="bud-block"><h3>Na co wydaje <span>${fmt(w.ogolem / 1e6, 1)} mln zł · ${w.y}</span></h3>${stack(parts, w.ogolem, pop)}</div>`;
    }
    return section("coins", "Budżet gminy", `<div class="bud">${html}</div>`, "Dochody wg źródeł i wydatki wg działów klasyfikacji budżetowej. GUS, Bank Danych Lokalnych.");
  }

  /* Elections: gmina vs country for each candidate or list. */
  function elections(w, pick) {
    if (!w?.g) return "";
    const list = w.elections.filter(e => w.g[e.id]), e = list.find(x => x.id === pick) || list[0];
    if (!e) return "";
    const v = w.g[e.id], mx = Math.max(...v.slice(1), ...e.kraj.slice(1));
    const rows = e.names.map((n, i) => ({ n, g: v[i + 1], k: e.kraj[i + 1] })).sort((a, b) => b.g - a.g);
    const win = rows[0];
    return section("envelope", "Wybory", `<div class="el-tabs" role="tablist">${list.map(x => `<button type="button" role="tab" data-election="${x.id}" aria-selected="${x === e}">${esc(x.label)}</button>`).join("")}</div>
      <div class="el-head"><div class="el-turnout"><span>Frekwencja</span><strong>${fmt(v[0], 1)}%</strong><small>kraj ${fmt(e.kraj[0], 1)}%</small></div><div class="el-turnout"><span>Wygrywa w gminie</span><strong class="el-win">${esc(win.n)}</strong><small>${fmt(win.g, 1)}% głosów</small></div></div>
      <ul class="el-list">${rows.map(r => `<li><span class="el-n">${esc(r.n)}</span><span class="el-bar"><i style="width:${(r.g / mx * 100).toFixed(1)}%"></i><b style="left:${(r.k / mx * 100).toFixed(1)}%" title="Kraj ${fmt(r.k, 1)}%"></b></span><span class="el-v"><strong>${fmt(r.g, 1)}%</strong><small>kraj ${fmt(r.k, 1)}%</small></span></li>`).join("")}</ul>`,
      `Kreska na pasku to wynik w kraju. Pominięto komitety i kandydatów poniżej 1% w kraju. Źródło: Państwowa Komisja Wyborcza, <a href="https://wybory.gov.pl" target="_blank" rel="noopener noreferrer">wybory.gov.pl</a>.`);
  }

  const thumb = (f, w = 360) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=${w}`;
  const commons = f => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.replace(/ /g, "_"))}`;
  const typ = z => { const f = (z.f || "").replace(/^zesp[oó]ł\/\s*/i, "").replace(/\s*\/\s*/g, ", ").trim(); return f && !z.n.toLowerCase().includes(f.split(/[ ,]/)[0].toLowerCase()) ? f : ""; };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function heritage(dz) {
    if (!dz?.z?.length) return "";
    return section("church", `Zabytki z rejestru${dz.zn ? ` (${fmt(dz.zn)})` : ""}`, `<ul class="heritage">${dz.z.map(z => `<li>${z.img ? `<a class="her-img" href="${commons(z.img)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${thumb(z.img, 240)}" alt="${esc(z.n)}"/></a>` : `<span class="her-img her-none">${Icons.svg("buildings")}</span>`}
        <${z.c ? `button type="button" class="her-t goto" data-goto-pt="${z.c.join(",")}" data-goto-name="${esc(cap(z.n))}" title="Pokaż na mapie"` : `span class="her-t"`}><strong>${esc(cap(z.n))}</strong>${typ(z) ? `<small>${esc(typ(z))}</small>` : ""}<small>${esc([z.m, z.a].filter(Boolean).join(", "))}</small>${z.d ? `<small class="her-d">${esc(z.d)}</small>` : ""}</${z.c ? "button" : "span"}>${z.c ? `<span class="goto-ic" aria-hidden="true">${Icons.svg("map-pin")}</span>` : ""}</li>`).join("")}</ul>`,
      `Najważniejsze obiekty: układy urbanistyczne, zamki, kościoły, pałace, dwory. ${dz.zn > dz.z.length ? `Pokazano ${dz.z.length} z ${fmt(dz.zn)}. ` : ""}Rejestr zabytków nieruchomych NID. Zdjęcia: Wikimedia Commons.`);
  }
  function nature(dz) {
    if (!dz?.p?.length && !dz?.u) return "";
    const types = [...new Set((dz.p || []).map(x => x.t))];
    return section("tree", "Przyroda chroniona", `${types.map(t => `<h3 class="nat-type">${esc(t)}</h3><ul class="nature">${dz.p.filter(x => x.t === t).map(x => `<li>${x.img ? `<a class="nat-img" href="${commons(x.img)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${thumb(x.img, 160)}" alt=""/></a>` : ""}${x.b ? `<button type="button" class="nat-n goto" data-goto-box="${x.b.join(",")}" data-goto-type="${esc(x.t)}" data-goto-name="${esc(x.n)}" title="Pokaż na mapie">${esc(x.n)}${Icons.svg("map-pin")}</button>` : `<span class="nat-n">${esc(x.n)}</span>`}<span class="nat-p"><span class="nat-bar"><i style="width:${Math.min(100, x.p)}%"></i></span>${fmt(x.p, x.p < 10 ? 1 : 0)}% gminy</span></li>`).join("")}</ul>`).join("")}
      ${dz.u ? `<p class="nat-u">Użytki ekologiczne: <b>${fmt(dz.u)}</b></p>` : ""}`, "Udział w powierzchni gminy. GDOŚ, Centralny Rejestr Form Ochrony Przyrody, przez BDOT10k (GUGiK).");
  }
  /* Go to a monument or protected area on the main map: close the gmina panel, frame it and label it; areas get the GDOŚ WMS outline. */
  const GDOS = { "Park narodowy": "GDOS:ParkiNarodowe", "Park krajobrazowy": "GDOS:ParkiKrajobrazowe", "Rezerwat przyrody": "GDOS:Rezerwaty",
    "Natura 2000": "GDOS:ObszarySpecjalnejOchrony,GDOS:SpecjalneObszaryOchrony", "Obszar chronionego krajobrazu": "GDOS:ObszaryChronionegoKrajobrazu",
    "Zespół przyrodniczo-krajobrazowy": "GDOS:ZespolyPrzyrodniczoKrajobrazowe" };
  let gotoMarker = null;
  function clearGoto() {
    const map = window.PLOTS?.map; if (gotoMarker) { gotoMarker.remove(); gotoMarker = null; }
    if (map?.getLayer("gdos-wms")) map.removeLayer("gdos-wms"); if (map?.getSource("gdos-wms")) map.removeSource("gdos-wms");
  }
  function gotoPlace(b) {
    const P = window.PLOTS, map = P?.map; if (!map) return;
    document.getElementById("gminaDialog")?.close?.();
    if (P.isMobile?.()) P.snap("peek");
    clearGoto();
    let at;
    if (b.dataset.gotoPt) { at = b.dataset.gotoPt.split(",").map(Number); P.framePoint(at[0], at[1], 17); }
    else {
      const [w, s, e, n] = b.dataset.gotoBox.split(",").map(Number); at = [(w + e) / 2, (s + n) / 2];
      P.frame([w, s, e, n], 15);
      const layers = GDOS[b.dataset.gotoType];
      if (layers) {
        map.addSource("gdos-wms", { type: "raster", tileSize: 256, attribution: "GDOŚ",
          tiles: [`https://sdi.gdos.gov.pl/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layers}&STYLES=&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`] });
        const before = map.getStyle().layers.find(l => l.type === "symbol")?.id;
        map.addLayer({ id: "gdos-wms", type: "raster", source: "gdos-wms", paint: { "raster-opacity": .7 } }, before);
      }
    }
    const el = document.createElement("div");
    el.className = "goto-label" + (b.dataset.gotoPt ? " pt" : "");
    el.innerHTML = `<span>${esc(b.dataset.gotoName)}</span><button type="button" aria-label="Ukryj">×</button>`;
    el.querySelector("button").onclick = ev => { ev.stopPropagation(); clearGoto(); };
    gotoMarker = new maplibregl.Marker({ element: el, anchor: b.dataset.gotoPt ? "bottom" : "center" }).setLngLat(at).addTo(map);
  }
  document.addEventListener("click", e => { const b = e.target.closest?.("[data-goto-pt],[data-goto-box]"); if (b) { e.preventDefault(); gotoPlace(b); } });
  window.GminaProfile = { load, popChart, bindPop, pyramid, budget, elections, heritage, nature };
})();
