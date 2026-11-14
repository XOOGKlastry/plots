/* More about the gmina population: GUS projection to 2060 (powiat level), commuting to work (NSP 2021 flow matrix, with arrows on
   the map), registered migration over the years and NSP 2021 details (education, households, families, dwellings, work).
   Data: data/pirhist/<teryt>.json, data/prognoza/<woj>.json, data/dojazdy/<woj>.json, data/gminy-centra.json, data/nsp/<woj>.json. */
(function () {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v, d = 0) => Number(v).toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
  const pp = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v), d);
  const sum = a => a.reduce((x, y) => x + y, 0);
  const cache = new Map();
  const json = url => { if (!cache.has(url)) cache.set(url, fetch(url).then(r => r.ok ? r.json() : null).catch(() => null)); return cache.get(url); };
  const section = (icon, title, body, note = "") => `<section class="metric-section profile-section">${title ? `<h2>${Icons.svg(icon)}${esc(title)}</h2>` : ""}${body}${note ? `<p class="profile-note">${note}</p>` : ""}</section>`;
  let names = null;
  async function nameOf(k) {
    if (!names) {
      const all = (await (window.PLOTS_GMINY?.all?.() || Promise.resolve([]))) || [], cnt = {};
      all.forEach(g => { cnt[g.n] = (cnt[g.n] || 0) + 1; });
      // Same name for a town and the rural gmina around it (Oleśnica, Oleśnica): add the type.
      names = new Map(all.map(g => [g.k, cnt[g.n] > 1 ? `${g.n} (${g.k[6] === "1" ? "miasto" : g.k[6] === "2" ? "gm. wiejska" : g.k[6] === "3" ? "gm. miejsko-wiejska" : "gmina"})` : g.n]));
    }
    return names.get(k) || k;
  }
  const seg = (attr, opts, on) => `<div class="stats-seg ext-seg" role="group">${opts.map(([k, l]) => `<button type="button" ${attr}="${k}" aria-pressed="${k === on}">${esc(l)}</button>`).join("")}</div>`;
  function line(vals, x0, opts = {}) {
    const pts = vals.map((v, i) => [i, v]).filter(p => Number.isFinite(p[1]));
    if (pts.length < 2) return "";
    const ref = opts.ref || [], all = [...pts.map(p => p[1]), ...ref.filter(Number.isFinite)], lo = Math.min(...all, opts.zero ? 0 : Infinity), hi = Math.max(...all, opts.zero ? 0 : -Infinity), pad = (hi - lo) * .1 || 1;
    const X = i => i / (vals.length - 1) * 100, Y = v => 100 - (v - lo + pad) / (hi - lo + 2 * pad) * 100;
    const path = arr => arr.map((v, i) => Number.isFinite(v) ? `${i && Number.isFinite(arr[i - 1]) ? "L" : "M"}${X(i).toFixed(2)},${Y(v).toFixed(2)}` : "").join("");
    return `<div class="ext-line" data-line='${esc(JSON.stringify({ v: vals, x0, r: ref, u: opts.unit || "" }))}'><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      ${opts.zero && lo < 0 ? `<line x1="0" x2="100" y1="${Y(0)}" y2="${Y(0)}" stroke="#c7c7cc" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="3 3"/>` : ""}
      ${ref.length ? `<path d="${path(ref)}" fill="none" stroke="#8e8e93" stroke-width="1.5" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>` : ""}
      <path d="${path(vals)}" fill="none" stroke="${opts.color || "#0a84ff"}" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>
      <span class="ext-dot" hidden></span><span class="ext-tip" hidden></span><div class="ext-years"><span>${x0}</span><span>${x0 + vals.length - 1}</span></div></div>`;
  }
  function bindLines(root) {
    root.querySelectorAll(".ext-line[data-line]").forEach(el => {
      if (el.dataset.bound) return; el.dataset.bound = 1;
      const d = JSON.parse(el.dataset.line), svg = el.querySelector("svg"), dot = el.querySelector(".ext-dot"), tip = el.querySelector(".ext-tip");
      const all = [...d.v, ...d.r].filter(Number.isFinite), lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * .1 || 1;
      const show = e => {
        const r = svg.getBoundingClientRect(), i = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (d.v.length - 1)), v = d.v[i];
        if (!Number.isFinite(v)) return;
        const x = i / (d.v.length - 1) * 100; dot.hidden = tip.hidden = false; dot.style.left = tip.style.left = x + "%";
        dot.style.top = (100 - (v - lo + pad) / (hi - lo + 2 * pad) * 100) + "%";
        tip.textContent = `${d.x0 + i}: ${fmt(v, Math.abs(v) < 20 && v % 1 ? 1 : 0)}${d.u}${d.r.length && Number.isFinite(d.r[i]) ? ` (Polska ${fmt(d.r[i], 1)})` : ""}`;
        tip.style.transform = `translateX(${x > 70 ? "-100%" : x < 30 ? "0" : "-50%"})`;
      };
      svg.onpointermove = show; svg.onpointerdown = show; svg.onpointerleave = () => { dot.hidden = tip.hidden = true; };
    });
  }

  /* ---------- Prognoza ludności (GUS, powiaty) ---------- */
  function medianAge(m, k) {
    const all = m.map((v, i) => v + k[i]), t = sum(all); let acc = 0;
    for (let i = 0; i < all.length; i++) { if (acc + all[i] >= t / 2) return i * 5 + (t / 2 - acc) / all[i] * 5; acc += all[i]; }
  }
  const share65 = p => (sum(p.m.slice(13)) + sum(p.k.slice(13))) / (sum(p.m) + sum(p.k)) * 100;
  function forecastPyr(P, y, ages) {
    const p = P.p[y], b = P.p["2023"], t = sum(p.m) + sum(p.k), tb = sum(b.m) + sum(b.k);
    const mx = Math.max(...p.m.map(v => v / t), ...p.k.map(v => v / t), ...b.m.map(v => v / tb), ...b.k.map(v => v / tb));
    const w = v => (v / mx * 100).toFixed(1) + "%";
    return ages.map((a, i) => ({ a, i })).reverse().map(({ a, i }) => `<div class="pyr-row ext-prow"><span class="pyr-bar m"><i class="base" style="width:${w(p.m[i] / t)}"></i><b class="ref" style="width:${w(b.m[i] / tb)}"></b></span><span class="pyr-age">${esc(a)}</span><span class="pyr-bar k"><i class="base" style="width:${w(p.k[i] / t)}"></i><b class="ref" style="width:${w(b.k[i] / tb)}"></b></span></div>`).join("");
  }
  function forecastInfo(D, P, y) {
    const p = P.p[y], b = P.p["2023"], i = D.lata.indexOf(+y), ch = (P.t[i] - P.t[0]) / P.t[0] * 100, chPl = (D.pl.t[i] - D.pl.t[0]) / D.pl.t[0] * 100;
    return `<p class="pyr-big"><b>${fmt(P.t[i])}</b> mieszkańców w ${y} r. <small>(${pp(ch)}% od 2023, Polska ${pp(chPl)}%)</small></p>
      <p>Osoby 65+: <b>${fmt(share65(p), 1)}%</b> <small class="muted">(2023: ${fmt(share65(b), 1)}%)</small> · mediana wieku <b>${fmt(medianAge(p.m, p.k), 1)}</b> lat <small class="muted">(2023: ${fmt(medianAge(b.m, b.k), 1)})</small></p>`;
  }
  async function forecast(g) {
    const D = await json(`data/prognoza/${g.k.slice(0, 2)}.json`);
    const P = D?.pow?.[g.k.slice(0, 4)];
    if (!P) return "";
    const years = Object.keys(P.p), ages = D.ages, last = P.t.length - 1;
    const ch40 = (P.t[D.lata.indexOf(2040)] - P.t[0]) / P.t[0] * 100, ch60 = (P.t[last] - P.t[0]) / P.t[0] * 100;
    const pl60 = (D.pl.t[last] - D.pl.t[0]) / D.pl.t[0] * 100;
    const city = /^\d{4}01$/.test(g.k.slice(0, 6)) && g.k[6] === "1" && +g.k.slice(2, 4) >= 61;
    const plNorm = D.pl.t.map(v => v / D.pl.t[0] * P.t[0]);
    return section("chart-line", `Prognoza ludności do 2060`, `<div class="pop-chart ext-fc" data-fc='${esc(JSON.stringify({ k: g.k.slice(0, 4) }))}'>
      <div class="pop-summary"><strong>${pp(ch60)}%</strong> <span>do 2060 r. (${fmt(P.t[0])} → ${fmt(P.t[last])})</span><span class="pop-peak">Do 2040 r.: ${pp(ch40)}%. Polska do 2060 r.: ${pp(pl60)}%.</span></div>
      ${line(P.t, D.lata[0], { ref: plNorm })}
      <p class="ext-legend"><span class="ext-sw"></span>${esc(P.n.replace(/^Powiat /i, "powiat "))}<span class="ext-sw dash"></span>Polska w tej samej skali</p></div>`,
      `Prognoza GUS jest liczona dla ${city ? "miasta na prawach powiatu" : `całego powiatu (${esc(P.n)}), nie dla pojedynczych gmin`}. GUS, Prognoza ludności rezydującej na lata 2023–2060.`);
  }
  function bindForecast(root, g) {
    root.querySelectorAll(".ext-fc").forEach(el => {
      if (el.dataset.bound) return; el.dataset.bound = 1;
      el.addEventListener("click", async e => {
        const b = e.target.closest("[data-fy]"); if (!b) return;
        const D = await json(`data/prognoza/${g.k.slice(0, 2)}.json`), P = D.pow[g.k.slice(0, 4)];
        el.querySelectorAll("[data-fy]").forEach(x => x.setAttribute("aria-pressed", x === b));
        el.querySelector(".ext-fbars").innerHTML = forecastPyr(P, b.dataset.fy, D.ages);
        el.querySelector(".ext-finfo").innerHTML = forecastInfo(D, P, b.dataset.fy);
      });
    });
  }

  /* ---------- Piramida w czasie: GUS rok po roku od 2002, potem szacunek z prognozy powiatu do 2060 ---------- */
  const TL = new Map();
  function interpForecast(P, y) {
    const ys = Object.keys(P.p).map(Number).sort((a, b) => a - b);
    if (y <= ys[0]) return P.p[ys[0]];
    const hi = ys.find(v => v >= y), lo = ys[ys.indexOf(hi) - 1];
    if (hi === y) return P.p[hi];
    const t = (y - lo) / (hi - lo), A = P.p[lo], B = P.p[hi], f = (a, b) => a.map((v, i) => v + (b[i] - v) * t);
    return { m: f(A.m, B.m), k: f(A.k, B.k) };
  }
  async function timeline(g) {
    const [H, D] = await Promise.all([json(`data/pirhist/${g.k}.json`), json(`data/prognoza/${g.k.slice(0, 2)}.json`)]);
    if (!H?.r?.length) return "";
    const frames = H.r.map((r, i) => r && { y: H.y0 + i, m: r.slice(0, 18), k: r.slice(18) }).filter(Boolean);
    const L = frames[frames.length - 1], P = D?.pow?.[g.k.slice(0, 4)];
    if (P) {
      const base = interpForecast(P, Math.max(L.y, 2023)), r = (v, a, b) => b > 0 ? v * a / b : v;
      for (let y = L.y + 1; y <= 2060; y++) {
        const f = interpForecast(P, y);
        frames.push({ y, m: L.m.map((v, i) => r(v, f.m[i], base.m[i])), k: L.k.map((v, i) => r(v, f.k[i], base.k[i])), est: true });
      }
    }
    frames.forEach(f => { f.t = sum(f.m) + sum(f.k); });
    const now = frames.indexOf(L), ages = D?.ages || ["0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65-69", "70-74", "75-79", "80-84", "85+"];
    TL.set(g.k, { frames, now, ages, mx: Math.max(...frames.flatMap(f => [...f.m, ...f.k])) });
    const tmin = Math.min(...frames.map(f => f.t)), tmax = Math.max(...frames.map(f => f.t)), pad = (tmax - tmin) * .15 || 1;
    const X = i => i / (frames.length - 1) * 100, Y = v => 28 - (v - tmin + pad) / (tmax - tmin + 2 * pad) * 26;
    const pts = (a, b) => frames.slice(a, b + 1).map((f, j) => `${j ? "L" : "M"}${X(a + j).toFixed(2)},${Y(f.t).toFixed(2)}`).join("");
    const rows = ages.map((a, i) => ({ a, i })).reverse().map(({ a, i }) => `<button type="button" class="pyr-row tl-row" data-i="${i}" aria-label="${esc(a)} lat"><span class="pyr-bar m"><i class="base"></i><b class="ref"></b></span><span class="pyr-age">${esc(a)}</span><span class="pyr-bar k"><i class="base"></i><b class="ref"></b></span></button>`).join("");
    return section("users", "Piramida wieku w czasie", `<div class="pyramid tl" data-k="${esc(g.k)}">
      <div class="tl-ctl"><button type="button" class="tl-play" aria-label="Odtwórz">${Icons.svg("play")}</button>
        <input type="range" class="tl-range" min="0" max="${frames.length - 1}" value="${now}" aria-label="Rok"><span class="tl-ylab">${L.y}</span></div>
      <div class="tl-spark"><svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="${pts(0, now)}" fill="none" stroke="#0a84ff" stroke-width="2" vector-effect="non-scaling-stroke"/>${frames.length - 1 > now ? `<path d="${pts(now, frames.length - 1)}" fill="none" stroke="#0a84ff" stroke-width="2" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>` : ""}<line class="tl-mark" x1="${X(now)}" x2="${X(now)}" y1="0" y2="30" stroke="#1c1c1e" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>
        <div class="ext-years"><span>${frames[0].y}</span><span>${L.y}</span><span>${frames[frames.length - 1].y}</span></div></div>
      <div class="pyr-head"><span class="pyr-m">Mężczyźni</span><span class="pyr-k">Kobiety</span></div>
      <div class="tl-bars"><span class="tl-big" aria-hidden="true"></span>${rows}</div>
      <div class="pyr-legend"><span><i class="m"></i><i class="k"></i>wybrany rok</span><span><i class="ref"></i>${L.y} (ostatnie dane)</span></div>
      <div class="pyr-info tl-info" aria-live="polite"></div></div>`,
      `Lata ${frames[0].y}–${L.y}: GUS, Bank Danych Lokalnych, stan na 31 XII.${P ? ` Lata ${L.y + 1}–2060: szacunek, struktura gminy z ${L.y} r. zmieniana tak jak w prognozie GUS dla całego powiatu.` : ""} Stuknij grupę wieku, aby śledzić rocznik.`);
  }
  function bindTimeline(root) {
    root.querySelectorAll(".tl[data-k]").forEach(el => {
      if (el.dataset.bound) return; el.dataset.bound = 1;
      const T = TL.get(el.dataset.k); if (!T) return;
      const { frames, now, mx } = T, range = el.querySelector(".tl-range"), info = el.querySelector(".tl-info"), big = el.querySelector(".tl-big");
      const ylab = el.querySelector(".tl-ylab"), mark = el.querySelector(".tl-mark"), play = el.querySelector(".tl-play"), N = frames[now];
      const rowEl = [...el.querySelectorAll(".tl-row")].sort((a, b) => a.dataset.i - b.dataset.i);
      const bars = rowEl.map(r => ({ m: r.querySelector(".m .base"), k: r.querySelector(".k .base"), rm: r.querySelector(".m .ref"), rk: r.querySelector(".k .ref") }));
      const w = v => (v / mx * 100).toFixed(2) + "%";
      bars.forEach((b, i) => { b.rm.style.width = w(N.m[i]); b.rk.style.width = w(N.k[i]); });
      let idx = now, cohort = null, timer = null;
      const groupOf = (born, y) => { const a = y - born; return a < 0 ? -1 : Math.min(17, Math.floor(a / 5)); };
      const paint = () => {
        const f = frames[idx];
        bars.forEach((b, i) => { b.m.style.width = w(f.m[i]); b.k.style.width = w(f.k[i]); });
        el.classList.toggle("est", !!f.est);
        big.textContent = ylab.textContent = f.y; range.value = idx;
        const x = idx / (frames.length - 1) * 100; mark.setAttribute("x1", x); mark.setAttribute("x2", x);
        const g = cohort == null ? -1 : groupOf(cohort, f.y);
        rowEl.forEach((r, i) => r.classList.toggle("on", i === g));
        el.classList.toggle("has-sel", g >= 0);
        const ch = (f.t - N.t) / N.t * 100, s65 = (sum(f.m.slice(13)) + sum(f.k.slice(13))) / f.t * 100, fem = sum(f.k) / sum(f.m) * 100;
        let html = `<p class="pyr-big"><b>${f.est ? "ok. " + fmt(Math.round(f.t / 100) * 100) : fmt(f.t)}</b> mieszkańców w ${f.y} r. ${idx !== now ? `<small>(${pp(ch)}% wobec ${N.y})</small>` : ""}</p>
          <p><span class="tl-tag${f.est ? " est" : ""}">${f.est ? "szacunek z prognozy GUS" : "dane GUS"}</span> Osoby 65+: <b>${fmt(s65, 1)}%</b> · mediana wieku <b>${fmt(medianAge(f.m, f.k), 1)}</b> lat · ${fmt(fem)} kobiet na 100 mężczyzn</p>`;
        if (cohort != null) {
          const lbl = `Rocznik ${cohort}–${cohort + 4}`;
          if (g < 0) html += `<p class="pyr-cmp">${lbl}: w ${f.y} r. jeszcze nie urodzony.</p>`;
          else {
            const n = f.m[g] + f.k[g], g0 = groupOf(cohort, N.y), n0 = g0 >= 0 ? N.m[g0] + N.k[g0] : null;
            html += `<p class="pyr-cmp">${lbl}: w ${f.y} r. ${g === 17 ? "85 lat i więcej" : `w wieku ${T.ages[g]} lat`}, <b>${f.est ? "ok. " + fmt(Math.round(n / 10) * 10) : fmt(n)}</b> ${window.GminaProfile?.plural ? window.GminaProfile.plural(Math.round(n), "osoba", "osoby", "osób") : "osób"}${n0 != null && f.y !== N.y ? ` <small>(w ${N.y} r. ${fmt(n0)})</small>` : ""}${g === 17 && groupOf(cohort, f.y - 5) === 17 ? "<br><small>Grupa 85+ obejmuje też starsze roczniki.</small>" : ""}</p>`;
          }
        } else html += `<p class="pyr-hint">Stuknij grupę wieku, aby śledzić rocznik przez lata.</p>`;
        info.innerHTML = html;
      };
      const stop = () => { clearInterval(timer); timer = null; play.innerHTML = Icons.svg("play"); play.setAttribute("aria-label", "Odtwórz"); el.classList.remove("playing"); };
      const start = () => {
        if (idx >= frames.length - 1) idx = 0;
        play.innerHTML = Icons.svg("pause"); play.setAttribute("aria-label", "Zatrzymaj"); el.classList.add("playing");
        timer = setInterval(() => {
          if (!el.isConnected) return stop();
          if (idx >= frames.length - 1) return stop();
          idx++; paint();
        }, 280);
        paint();
      };
      play.onclick = () => timer ? stop() : start();
      range.oninput = () => { stop(); idx = +range.value; paint(); };
      el.querySelector(".tl-spark svg").onpointerdown = e => { const r = e.currentTarget.getBoundingClientRect(); stop(); idx = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (frames.length - 1)); paint(); };
      el.querySelector(".tl-bars").addEventListener("click", e => {
        const b = e.target.closest(".tl-row"); if (!b) return;
        const i = +b.dataset.i, f = frames[idx], born = f.y - i * 5 - 4;
        cohort = cohort != null && groupOf(cohort, f.y) === i ? null : born; paint();
      });
      paint();
    });
  }

  /* ---------- Dojazdy do pracy (NSP 2021) ---------- */
  async function commute(g, lud) {
    const D = await json(`data/dojazdy/${g.k.slice(0, 2)}.json`), c = D?.gminy?.[g.k];
    if (!c) return "";
    const list = async (arr, total) => {
      const top = arr.slice(0, 8), mx = top[0]?.[1] || 1, nm = await Promise.all(top.map(x => nameOf(x[0])));
      return `<ul class="ext-flow">${top.map((x, i) => `<li><span class="ext-fn">${esc(nm[i])}</span><span class="ext-fb"><i style="width:${(x[1] / mx * 100).toFixed(1)}%"></i></span><b>${fmt(x[1])}</b><small>${fmt(x[1] / total * 100, 0)}%</small></li>`).join("")}</ul>`;
    };
    const [lo, li] = await Promise.all([list(c.do, c.o), list(c.z, c.i)]);
    const bal = c.i - c.o;
    return section("car-profile", "Dojazdy do pracy (Spis 2021)", `<div class="ext-card ext-commute" data-k="${g.k}">
      <p><span class="terr-chip"><b>${fmt(c.o)}</b> wyjeżdża do pracy</span><span class="terr-chip"><b>${fmt(c.i)}</b> przyjeżdża</span></p>
      <p class="ext-bal">${bal >= 0 ? `Gmina przyciąga pracowników: przyjeżdża o <b>${fmt(bal)}</b> więcej osób, niż wyjeżdża.` : `Gmina „oddaje” pracowników: wyjeżdża o <b>${fmt(-bal)}</b> więcej osób, niż przyjeżdża.`}${lud ? ` Wyjeżdżający to ${fmt(c.o / lud * 100, 1)}% mieszkańców.` : ""}</p>
      ${seg("data-cdir", [["do", "Dokąd jeżdżą"], ["z", "Skąd przyjeżdżają"]], "do")}
      <div data-cl="do">${lo}</div><div data-cl="z" hidden>${li}</div>
      <button type="button" class="place-distance-action ext-map-btn" data-cmap>${Icons.svg("map-trifold")}Pokaż na mapie</button></div>`,
      "Pracownicy najemni dojeżdżający do pracy w innej gminie. GUS, NSP 2021: macierz przepływów ludności związanych z zatrudnieniem (bez przepływów poniżej 3 osób).");
  }
  function bindCommute(root) {
    root.querySelectorAll(".ext-commute").forEach(el => {
      if (el.dataset.bound) return; el.dataset.bound = 1;
      let dir = "do";
      el.addEventListener("click", e => {
        const b = e.target.closest("[data-cdir]");
        if (b) { dir = b.dataset.cdir; el.querySelectorAll("[data-cdir]").forEach(x => x.setAttribute("aria-pressed", x === b)); el.querySelectorAll("[data-cl]").forEach(x => { x.hidden = x.dataset.cl !== dir; }); return; }
        if (e.target.closest("[data-cmap]")) showFlows(el.dataset.k, dir);
      });
    });
  }
  let dotRaf = 0, dotLines = null;
  function stopDots() { cancelAnimationFrame(dotRaf); dotRaf = 0; }
  function runDots(map) {
    stopDots(); if (!dotLines) return;
    const src = map.getSource("ext-flow-dots"); if (!src) return;
    const t0 = performance.now(); let last = 0;
    const tick = now => {
      if (!map.getSource("ext-flow-dots")) return;
      dotRaf = requestAnimationFrame(tick);
      if (now - last < 33) return; last = now;
      const feats = [];
      for (const L of dotLines) {
        const ph = ((now - t0) / L.ms) % 1;
        for (let j = 0; j < L.n; j++) {
          const t = (ph + j / L.n) % 1, x = t * (L.c.length - 1), i = Math.min(L.c.length - 2, Math.floor(x)), f = x - i, a = L.c[i], b = L.c[i + 1];
          feats.push({ type: "Feature", properties: { r: L.r, o: Math.min(1, t * 6, (1 - t) * 6) }, geometry: { type: "Point", coordinates: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] } });
        }
      }
      src.setData({ type: "FeatureCollection", features: feats });
    };
    dotRaf = requestAnimationFrame(tick);
  }
  async function showFlows(k, dir) {
    const app = window.PLOTS; if (!app) return;
    const [D, C] = await Promise.all([json(`data/dojazdy/${k.slice(0, 2)}.json`), json("data/gminy-centra.json")]);
    const c = D?.gminy?.[k]; if (!c || !C?.[k]) return;
    const arr = c[dir].slice(0, 25).filter(x => C[x[0]]), mx = arr[0]?.[1] || 1, home = C[k];
    const nm = await Promise.all(arr.map(x => nameOf(x[0]))), hn = await nameOf(k);
    const arc = (a, b) => { const mx_ = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], cx = mx_ - dy * .18, cy = my + dx * .18, pts = [];
      for (let t = 0; t <= 1.0001; t += 1 / 24) pts.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * cx + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * cy + t * t * b[1]]); return pts; };
    const feats = arr.map((x, i) => ({ type: "Feature", properties: { n: x[1], w: 1.2 + 9 * x[1] / mx, label: `${nm[i]} ${fmt(x[1])}` },
      geometry: { type: "LineString", coordinates: dir === "do" ? arc(home, C[x[0]]) : arc(C[x[0]], home) } }));
    const pts = arr.map((x, i) => ({ type: "Feature", properties: { label: `${nm[i]}\n${fmt(x[1])}`, r: 3 + 7 * Math.sqrt(x[1] / mx) }, geometry: { type: "Point", coordinates: C[x[0]] } }));
    pts.push({ type: "Feature", properties: { label: hn, r: 8, home: 1 }, geometry: { type: "Point", coordinates: home } });
    const map = app.map;
    const data = { type: "FeatureCollection", features: feats }, pdata = { type: "FeatureCollection", features: pts };
    if (map.getSource("ext-flows")) { map.getSource("ext-flows").setData(data); map.getSource("ext-flow-pts").setData(pdata); }
    else {
      map.addSource("ext-flows", { type: "geojson", data }); map.addSource("ext-flow-pts", { type: "geojson", data: pdata });
      map.addLayer({ id: "ext-flows", type: "line", source: "ext-flows", layout: { "line-cap": "round" }, paint: { "line-color": dir === "do" ? "#ff6b00" : "#0a84ff", "line-width": ["get", "w"], "line-opacity": .75 } });
      map.addLayer({ id: "ext-flow-pts", type: "circle", source: "ext-flow-pts", paint: { "circle-radius": ["get", "r"], "circle-color": ["case", ["has", "home"], "#1c1c1e", "#fff"], "circle-stroke-color": "#1c1c1e", "circle-stroke-width": 1.5 } });
      map.addLayer({ id: "ext-flow-lbl", type: "symbol", source: "ext-flow-pts", layout: { "text-field": ["get", "label"], "text-size": 11.5, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 12 }, paint: { "text-color": "#1c1c1e", "text-halo-color": "#fff", "text-halo-width": 1.6 } });
    }
    map.setPaintProperty("ext-flows", "line-color", dir === "do" ? "#ff6b00" : "#0a84ff");
    // Flowing dots: more and bigger dots on the stronger flows, one trip in about 3-5 s.
    dotLines = feats.map(f => ({ c: f.geometry.coordinates, n: Math.max(2, Math.round(1 + f.properties.w / 1.6)), r: 2.2 + f.properties.w * .35, ms: 5200 - f.properties.w * 180 }));
    const empty = { type: "FeatureCollection", features: [] };
    if (!map.getSource("ext-flow-dots")) {
      map.addSource("ext-flow-dots", { type: "geojson", data: empty });
      map.addLayer({ id: "ext-flow-dots", type: "circle", source: "ext-flow-dots", paint: { "circle-radius": ["get", "r"], "circle-color": "#fff", "circle-opacity": ["get", "o"], "circle-stroke-width": 1.4, "circle-stroke-color": dir === "do" ? "#c24e00" : "#005bc4", "circle-stroke-opacity": ["get", "o"] } }, "ext-flow-pts");
    } else { map.getSource("ext-flow-dots").setData(empty); map.setPaintProperty("ext-flow-dots", "circle-stroke-color", dir === "do" ? "#c24e00" : "#005bc4"); }
    const moving = !!window.Motion?.on();
    if (moving) runDots(map); else stopDots();
    // Frame the places that take 85% of these commuters (at least 3), so one far city does not zoom out to the whole country.
    const b = new maplibregl.LngLatBounds(home, home), totN = arr.reduce((t, x) => t + x[1], 0); let acc = 0;
    arr.forEach((x, i) => { if (i < 3 || acc < totN * .85) b.extend(C[x[0]]); acc += x[1]; });
    document.querySelectorAll("dialog[open]").forEach(d => d.close());
    if (app.isMobile()) app.snap("peek");
    map.fitBounds(b, { padding: app.isMobile() ? { top: 120, bottom: 200, left: 40, right: 40 } : 80, maxZoom: 10, duration: 600 });
    let chip = document.getElementById("extFlowChip");
    if (!chip) { chip = document.createElement("div"); chip.id = "extFlowChip"; chip.className = "ext-chip"; document.body.appendChild(chip); }
    chip.innerHTML = `<span><b>${esc(hn)}</b>: ${dir === "do" ? "dokąd jeżdżą do pracy" : "skąd przyjeżdżają do pracy"}</span><button type="button" class="ext-chip-play" aria-label="${moving ? "Zatrzymaj ruch" : "Pokaż ruch"}">${Icons.svg(moving ? "pause" : "play")}</button><button type="button" class="ext-chip-x" aria-label="Zamknij">${Icons.svg("x")}</button>`;
    chip.hidden = false;
    chip.querySelector(".ext-chip-play").onclick = e => {
      const b = e.currentTarget, run = !dotRaf;
      if (run) runDots(map); else { stopDots(); map.getSource("ext-flow-dots")?.setData(empty); }
      b.innerHTML = Icons.svg(run ? "pause" : "play"); b.setAttribute("aria-label", run ? "Zatrzymaj ruch" : "Pokaż ruch");
    };
    chip.querySelector(".ext-chip-x").onclick = () => { stopDots(); dotLines = null; chip.hidden = true; ["ext-flow-dots", "ext-flow-lbl", "ext-flow-pts", "ext-flows"].forEach(id => map.getLayer(id) && map.removeLayer(id)); ["ext-flows", "ext-flow-pts", "ext-flow-dots"].forEach(id => map.getSource(id) && map.removeSource(id)); };
  }

  /* ---------- Migracje i Spis 2021 ---------- */
  const pctOf = (a, b) => b ? a / b * 100 : NaN;
  function stackBar(parts, total) {
    const PAL = ["#0a84ff", "#30b0c7", "#34c759", "#ffcc00", "#ff9500", "#ff2d55", "#af52de", "#5856d6", "#a2845e", "#8e8e93"];
    return `<div class="bud-bar">${parts.map((x, i) => `<i style="flex:${x.v};background:${x.c || PAL[i % PAL.length]}" title="${esc(x.n)}"></i>`).join("")}</div>
      <ul class="bud-list ext-list">${parts.map((x, i) => `<li><span class="bud-sw" style="background:${x.c || PAL[i % PAL.length]}"></span><span class="bud-n">${esc(x.n)}</span><span class="bud-v"><b>${fmt(pctOf(x.v, total), 1)}%</b>${x.pl != null ? `<small>Polska ${fmt(x.pl, 1)}%</small>` : `<small>${fmt(x.v)}</small>`}</span></li>`).join("")}</ul>`;
  }
  /* Rok po roku: zameldowania w górę, wymeldowania w dół; odtwarzanie przechodzi przez lata i pokazuje skąd i dokąd. */
  function migYears(m) {
    const n = (m.zw || []).length; if (n < 3) return "";
    const A = i => (m.zw[i] ?? NaN) + (m.zz?.[i] ?? 0), Dp = i => (m.ww?.[i] ?? NaN) + (m.wz?.[i] ?? 0);
    const idx = [...Array(n).keys()].filter(i => Number.isFinite(A(i)) && Number.isFinite(Dp(i)));
    if (idx.length < 3) return "";
    const mx = Math.max(...idx.map(i => Math.max(A(i), Dp(i)))) || 1, last = idx[idx.length - 1];
    const cols = idx.map(i => `<button type="button" class="mg-col" data-i="${i}" aria-label="${m.y0 + i}"><span class="mg-up"><i style="height:${(A(i) / mx * 100).toFixed(1)}%"></i></span><span class="mg-dn"><i style="height:${(Dp(i) / mx * 100).toFixed(1)}%"></i></span></button>`).join("");
    return `<div class="ext-mg" data-mg='${esc(JSON.stringify({ y0: m.y0, idx, zw: m.zw, zz: m.zz, ww: m.ww, wz: m.wz, zm: m.zm, zwies: m.zwies, wm: m.wm, wwies: m.wwies }))}'>
      <p class="ext-sub"><b>Rok po roku</b></p>
      <div class="tl-ctl"><button type="button" class="tl-play mg-play" aria-label="Odtwórz lata">${Icons.svg("play")}</button><input type="range" class="tl-range mg-range" min="0" max="${idx.length - 1}" value="${idx.length - 1}" aria-label="Rok"><span class="tl-ylab mg-ylab">${m.y0 + last}</span></div>
      <div class="mg-bars">${cols}</div>
      <div class="mg-axis"><span>${m.y0 + idx[0]}</span><span class="mg-key"><i class="up"></i>zameldowania <i class="dn"></i>wymeldowania</span><span>${m.y0 + last}</span></div>
      <div class="mg-info" aria-live="polite"></div></div>`;
  }
  function bindMig(root) {
    root.querySelectorAll(".ext-mg[data-mg]").forEach(el => {
      if (el.dataset.bound) return; el.dataset.bound = 1;
      const d = JSON.parse(el.dataset.mg), range = el.querySelector(".mg-range"), play = el.querySelector(".mg-play"), info = el.querySelector(".mg-info"), ylab = el.querySelector(".mg-ylab");
      const cols = [...el.querySelectorAll(".mg-col")];
      let k = d.idx.length - 1, timer = 0;
      const v = (a, i) => Number.isFinite(d[a]?.[i]) ? d[a][i] : null;
      const part = (label, x, tot) => x == null ? "" : `<li><span>${label}</span><b>${fmt(x)}</b><small>${tot ? fmt(x / tot * 100) + "%" : ""}</small></li>`;
      const paint = () => {
        const i = d.idx[k], y = d.y0 + i, a = (v("zw", i) || 0) + (v("zz", i) || 0), o = (v("ww", i) || 0) + (v("wz", i) || 0), bal = a - o;
        cols.forEach((c, j) => c.classList.toggle("on", j === k));
        range.value = k; ylab.textContent = y;
        info.innerHTML = `<p class="pyr-big"><b>${pp(bal, 0)}</b> <small>saldo w ${y} r.: ${fmt(a)} zameldowań, ${fmt(o)} wymeldowań</small></p>
          <div class="mg-lists"><ul><li class="h">Skąd przybyli</li>${part("z miast", v("zm", i), a)}${part("ze wsi", v("zwies", i), a)}${part("z zagranicy", v("zz", i), a)}</ul>
          <ul><li class="h">Dokąd wyjechali</li>${part("do miast", v("wm", i), o)}${part("na wieś", v("wwies", i), o)}${part("za granicę", v("wz", i), o)}</ul></div>`;
      };
      const stop = () => { clearInterval(timer); timer = 0; play.innerHTML = Icons.svg("play"); play.setAttribute("aria-label", "Odtwórz lata"); };
      play.onclick = () => {
        if (timer) return stop();
        if (k >= d.idx.length - 1) k = 0;
        play.innerHTML = Icons.svg("pause"); play.setAttribute("aria-label", "Zatrzymaj"); paint();
        timer = setInterval(() => { if (!el.isConnected || k >= d.idx.length - 1) return stop(); k++; paint(); }, 650);
      };
      range.oninput = () => { stop(); k = +range.value; paint(); };
      el.querySelector(".mg-bars").addEventListener("click", e => { const c = e.target.closest(".mg-col"); if (!c) return; stop(); k = cols.indexOf(c); paint(); });
      paint();
    });
  }
  async function migration(g, N, PL) {
    const m = N?.migr; if (!m) return "";
    const s = m.s1000 || [], y0 = m.y0, last = s.length - 1;
    const sumN = a => sum((a || []).filter(Number.isFinite).slice(-5));
    const zm = sumN(m.zm), zw = sumN(m.zwies), wm = sumN(m.wm), ww = sumN(m.wwies), zz = sumN(m.zz), wz = sumN(m.wz);
    let html = `<div class="ext-card">`;
    if (s.some(Number.isFinite)) html += `<p class="pop-summary"><strong>${pp(s[last])}</strong> <span>osób na 1000 mieszkańców w ${y0 + last} r. (saldo migracji, na plusie = więcej osób się melduje, niż wymeldowuje)</span></p>${line(s, y0, { zero: true, ref: PL?.migr?.s1000 || [], unit: "‰" })}<p class="ext-legend"><span class="ext-sw"></span>gmina<span class="ext-sw dash"></span>Polska</p>`;
    if (zm + zw + wm + ww) html += `<div class="ext-mig"><div><b>Skąd przybywają</b><small>ostatnie 5 lat</small>${stackBar([{ n: "z miast", v: zm, c: "#0a84ff" }, { n: "ze wsi", v: zw, c: "#34c759" }, { n: "z zagranicy", v: zz, c: "#af52de" }], zm + zw + zz)}</div>
      <div><b>Dokąd wyjeżdżają</b><small>ostatnie 5 lat</small>${stackBar([{ n: "do miast", v: wm, c: "#0a84ff" }, { n: "na wieś", v: ww, c: "#34c759" }, { n: "za granicę", v: wz, c: "#af52de" }], wm + ww + wz)}</div></div>`;
    html += migYears(m);
    const z = N.zam;
    if (z && z[0]) {
      const zp = PL?.zam;
      html += `<p class="ext-sub">Według Spisu 2021: <b>${fmt(pctOf(z[1], z[0]), 1)}%</b> mieszkańców mieszka tu od urodzenia${zp ? ` (Polska ${fmt(pctOf(zp[1], zp[0]), 1)}%)` : ""}, <b>${fmt(pctOf(z[3] + z[4], z[0]), 1)}%</b> przybyło w latach 2011–2021${zp ? ` (Polska ${fmt(pctOf(zp[3] + zp[4], zp[0]), 1)}%)` : ""}, w tym ${fmt(z[4])} z zagranicy.</p>`;
    }
    html += `</div>`;
    return section("arrows-left-right", "Migracje", html, "Zameldowania i wymeldowania na pobyt stały (GUS, Bank Danych Lokalnych) oraz okres zamieszkiwania (GUS, NSP 2021). GUS nie publikuje, z której gminy do której ktoś się przeprowadził; przepływy między gminami pokazuje sekcja dojazdów do pracy.");
  }
  function nspSections(g, N, PL) {
    if (!N) return "";
    const out = [], P = (a, i) => PL?.[a] ? pctOf(PL[a][i], PL[a][0]) : null;
    if (N.wyksz?.[0]) {
      const w = N.wyksz, L = ["wyższe", "średnie i policealne", "zasadnicze zawodowe/branżowe", "gimnazjalne", "podstawowe", "niepełne podstawowe i bez"];
      const idx = [1, 2, 5, 6, 7, 8];
      const fem = w[11] && w[13] ? pctOf(w[11], w[13]) : null, male = w[10] && w[12] ? pctOf(w[10], w[12]) : null;
      out.push(section("graduation-cap", "Wykształcenie (Spis 2021)", `<div class="ext-card">${stackBar(idx.map((j, i) => ({ n: L[i], v: w[j], pl: P("wyksz", j) })), w[0])}
        ${fem != null ? `<p class="ext-sub">Wyższe wykształcenie ma <b>${fmt(fem, 1)}%</b> kobiet i <b>${fmt(male, 1)}%</b> mężczyzn w wieku 13+${PL?.wyksz ? ` (Polska: ${fmt(pctOf(PL.wyksz[11], PL.wyksz[13]), 1)}% i ${fmt(pctOf(PL.wyksz[10], PL.wyksz[12]), 1)}%)` : ""}.</p>` : ""}</div>`, "Ludność w wieku 13 lat i więcej. GUS, NSP 2021."));
    }
    if (N.gosp?.[0]) {
      const h = N.gosp, r = N.rodz;
      let body = `<div class="ext-card"><p class="pop-summary"><strong>${fmt(h[7], 2)}</strong> <span>osoby w przeciętnym gospodarstwie domowym${PL?.gosp ? ` (Polska ${fmt(PL.gosp[6] / PL.gosp[0], 2)})` : ""}</span></p>
        ${stackBar(["1 osoba", "2 osoby", "3 osoby", "4 osoby", "5 i więcej"].map((n, i) => ({ n, v: h[i + 1], pl: P("gosp", i + 1) })), h[0])}`;
      if (r?.[0]) body += `<p class="ext-sub"><b>Rodziny</b></p>${stackBar([["małżeństwa bez dzieci", 2], ["małżeństwa z dziećmi", 3], ["związki niesformalizowane", 4], ["matki z dziećmi", 5], ["ojcowie z dziećmi", 6]].map(([n, i]) => ({ n, v: r[i], pl: P("rodz", i) })), r[0])}
        ${N.dzieci ? `<p class="ext-sub">Przeciętnie <b>${fmt(N.dzieci[6], 2)}</b> dziecka w rodzinie z dziećmi; ${fmt(pctOf(N.dzieci[4] + N.dzieci[5], N.dzieci[0] - N.dzieci[1]), 1)}% rodzin z dziećmi ma troje lub więcej${PL?.dzieci ? ` (Polska ${fmt(pctOf(PL.dzieci[4] + PL.dzieci[5], PL.dzieci[0] - PL.dzieci[1]), 1)}%)` : ""}.</p>` : ""}`;
      out.push(section("house-line", "Gospodarstwa domowe i rodziny (Spis 2021)", body + `</div>`, "GUS, NSP 2021."));
    }
    if (N.akt?.[0]) {
      const a = N.akt;
      out.push(section("briefcase", "Praca (Spis 2021)", `<div class="ext-card"><p><span class="terr-chip">wskaźnik zatrudnienia <b>${fmt(a[6], 1)}%</b>${PL?.akt ? ` <small>Polska ${fmt(PL.akt[6], 1)}%</small>` : ""}</span><span class="terr-chip">stopa bezrobocia <b>${fmt(a[7], 1)}%</b>${PL?.akt ? ` <small>Polska ${fmt(PL.akt[7], 1)}%</small>` : ""}</span><span class="terr-chip">aktywni zawodowo <b>${fmt(a[5], 1)}%</b></span></p>
        <p class="ext-sub">Pracuje <b>${fmt(a[8], 1)}%</b> mężczyzn i <b>${fmt(a[9], 1)}%</b> kobiet w wieku 15+.</p>
        ${N.obyw?.[0] ? `<p class="ext-sub">Cudzoziemcy: <b>${fmt(N.obyw[2])}</b> osób, ${fmt(pctOf(N.obyw[2], N.obyw[0]), 2)}% mieszkańców${PL?.obyw ? ` (Polska ${fmt(pctOf(PL.obyw[2], PL.obyw[0]), 2)}%)` : ""}.</p>` : ""}
        ${N.niep ? `<p class="ext-sub">Osoby z niepełnosprawnością: <b>${fmt(N.niep)}</b>.</p>` : ""}</div>`, "Ludność w wieku 15 lat i więcej. GUS, NSP 2021."));
    }
    if (N.cyw?.[0]) {
      const c = N.cyw;
      out.push(section("heart", "Stan cywilny (Spis 2021)", `<div class="ext-card">${stackBar([["kawalerowie i panny", 1], ["w małżeństwie", 2], ["wdowcy i wdowy", 3], ["rozwiedzeni", 4]].map(([n, i]) => ({ n, v: c[i], pl: P("cyw", i) })), c[0])}</div>`, "Ludność w wieku 15 lat i więcej. GUS, NSP 2021."));
    }
    return out.join("");
  }
  function housing(g, N, PL) {
    if (!N?.okres?.[0]) return "";
    const o = N.okres, L = ["przed 1918", "1918–1944", "1945–1970", "1971–1978", "1979–1988", "1989–2002", "2003–2011", "2012–2016", "2017–2021"];
    const pl = PL?.okres, m2 = o[1] / o[2], plm2 = pl ? pl[1] / pl[2] : null, w = N.wyp;
    const old = pctOf(o[3] + o[4] + o[5], o[0]), oldPl = pl ? pctOf(pl[3] + pl[4] + pl[5], pl[0]) : null;
    return section("buildings", "Mieszkania (Spis 2021)", `<div class="ext-card">
      <p class="pop-summary"><strong>${fmt(m2, 1)} m²</strong> <span>na osobę${plm2 ? ` (Polska ${fmt(plm2, 1)} m²)` : ""}</span></p>
      <p class="ext-sub"><b>Kiedy zbudowano budynki z mieszkaniami</b></p>${stackBar(L.map((n, i) => ({ n, v: o[3 + i], pl: pl ? pctOf(pl[3 + i], pl[0]) : null, c: ["#5e3c99", "#7b5ba6", "#998ec3", "#b2abd2", "#d8daeb", "#fee0b6", "#fdb863", "#e66101", "#b35806"][i] })), o[0])}
      <p class="ext-sub">${fmt(old, 1)}% mieszkań jest w budynkach sprzed 1971 r.${oldPl != null ? ` (Polska ${fmt(oldPl, 1)}%)` : ""}.${w?.[0] ? ` Łazienka: ${fmt(pctOf(w[1], w[0]), 1)}%, gaz z sieci: ${fmt(pctOf(w[3], w[0]), 1)}% mieszkań${PL?.wyp ? ` (Polska ${fmt(pctOf(PL.wyp[1], PL.wyp[0]), 1)}% i ${fmt(pctOf(PL.wyp[3], PL.wyp[0]), 1)}%)` : ""}.` : ""}</p></div>`,
      "Mieszkania zamieszkane. GUS, NSP 2021.");
  }

  async function fill(g, el, category, lud) {
    if (!el || !g) return;
    const woj = g.k.slice(0, 2);
    const nspDoc = await json(`data/nsp/${woj}.json`);
    const N = nspDoc?.gminy?.[g.k] || null, PL = nspDoc?.pl || null;
    let html = "";
    if (category === "Ludność") html = (await timeline(g)) + (await forecast(g)) + (await migration(g, N, PL)) + (await commute(g, lud)) + nspSections(g, N, PL);
    else if (category === "Warunki życia") html = housing(g, N, PL);
    if (!el.isConnected) return;
    el.insertAdjacentHTML("beforeend", html);
    bindLines(el); bindForecast(el, g); bindTimeline(el); bindMig(el); bindCommute(el);
  }
  window.GminaExtra = { fill, showFlows };
})();
