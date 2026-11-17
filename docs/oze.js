/* Arkusz „Gdzie budować OZE”: ranking gmin z wagami, filtrami i eksportem CSV, plus charakterystyka istniejących elektrowni.
   Dane: data/oze-ocena.json (nowe/oze_ocena.py). Składniki to rangi centylowe 0–100 (100 = najlepsza gmina w Polsce). */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v, d = 0) => v == null || Number.isNaN(+v) ? "–" : (+v).toLocaleString("pl-PL", { maximumFractionDigits: d });
  const color = v => v >= 70 ? "#2e7d32" : v >= 45 ? "#f9a825" : "#d32f2f";
  const store = { get(k, d) { try { const v = localStorage.getItem("oze." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("oze." + k, JSON.stringify(v)); } catch (e) {} } };

  const C = { // component labels and descriptions
    teren: ["Teren", "Powierzchnia poza strefami zakazu i ograniczeń"], zasob: ["Zasób", "Wiatr na 100 m lub nasłonecznienie (PVOUT)"],
    siec: ["Sieć", "Linie 110 kV i wyżej, odległość do GPZ, wolna moc u operatora"], plan: ["Plan ogólny", "Strefy planu ogólnego dopuszczające tę technologię"],
    akceptacja: ["Akceptacja", "Działające i planowane wiatraki w gminie"], surowiec: ["Surowiec", "Obsada bydła i świń, fermy"],
    odbiorcy: ["Odbiorcy", "Zakłady, oczyszczalnie i wodociągi: odbiorcy energii i ciepła"], konkurencja: ["Konkurencja", "Mniej biogazowni w gminie to więcej surowca"],
    wytworcy: ["Wytwórcy", "Małe instalacje OZE firm i rolników (URE)"], rolnictwo: ["Rolnictwo", "Liczba gospodarstw rolnych"],
    potencjal: ["Potencjał", "Średnia: słońce, teren pod wiatr i surowiec do biogazu"], korzysci: ["Korzyści", "Ryzyko ubóstwa energetycznego: im wyższe, tym większa korzyść"],
    wspolnota: ["Wspólnota", "Istniejąca spółdzielnia energetyczna lub klaster energii"]
  };
  const TABS = {
    wiatr: { label: "Elektrownie wiatrowe", intro: "Gminy z największym obszarem poza strefami zakazu ustawy wiatrakowej (700 m od budynków mieszkalnych, Natura 2000, parki, rezerwaty) i poza lasami z pasem 200 m, z dobrym wiatrem i blisko sieci 110 kV.",
      facts: f => [["Teren bez ograniczeń", `${fmt(f.wyt_ha)} ha`], ["Teren według ustawy", `${fmt(f.ust_ha)} ha`], ["Wiatr na 100 m", f.wiatr ? `${fmt(f.wiatr, 1)} m/s` : "–"], ["Strefy POG z wiatrem", `${fmt(f.pog_wi)} ha`], ["Działające turbiny", fmt(f.turb)], ["Planowane farmy", fmt(f.farmy)]],
      cols: [["Teren", f => `${fmt(f.wyt_ha)} ha`, f => f.wyt_ha], ["Wiatr", f => f.wiatr ? `${fmt(f.wiatr, 1)} m/s` : "–", f => f.wiatr]],
      flags: f => [f.wyt_ha < 30 && ["warn", "brak miejsca poza ograniczeniami"], f.pog_wi > 0 && ["ok", "plan ogólny dopuszcza wiatr"], f.turb > 0 && ["ok", "wiatraki już działają"]] },
    pv: { label: "Farmy fotowoltaiczne", intro: "Gminy z dobrym nasłonecznieniem, dużą powierzchnią poza lasami i obszarami chronionymi, blisko sieci z wolną mocą i ze strefami planu ogólnego dopuszczającymi elektrownie słoneczne.",
      facts: f => [["PVOUT", f.pvout ? `${fmt(f.pvout)} kWh/kWp rocznie` : "–"], ["Obszary chronione", f.chron != null ? `${fmt(f.chron, 1)}% gminy` : "–"], ["Strefy POG z PV", `${fmt(f.pog_pv)} ha`], ["Działające farmy PV", fmt(f.pv_n)]],
      cols: [["PVOUT", f => fmt(f.pvout), f => f.pvout], ["Strefy POG", f => `${fmt(f.pog_pv)} ha`, f => f.pog_pv]],
      flags: f => [f.pog_pv > 0 && ["ok", "plan ogólny dopuszcza PV"], f.chron > 50 && ["warn", "ponad połowa gminy chroniona"]] },
    biogaz: { label: "Biogazownie", intro: "Gminy z dużą obsadą zwierząt (gnojowica, obornik), fermami i zakładami, które mogą odebrać ciepło lub energię, z miejscem dla nowej biogazowni.",
      facts: f => [["Bydło i świnie na 100 ha UR", fmt(f.zw)], ["Fermy (BDOT10k)", fmt(f.hod)], ["Zakłady i obiekty komunalne", fmt(f.zak)], ["Biogazownie w gminie", fmt(f.bio_n)], ["Strefy POG z biogazownią", `${fmt(f.pog_bio)} ha`]],
      cols: [["Zwierzęta", f => fmt(f.zw), f => f.zw], ["Biogazownie", f => fmt(f.bio_n), f => f.bio_n]],
      flags: f => [f.bio_n > 1 && ["warn", "już kilka biogazowni"], f.pog_bio > 0 && ["ok", "plan ogólny dopuszcza biogazownię"]] },
    spoldzielnia: { label: "Spółdzielnie energetyczne", intro: "Spółdzielnię energetyczną można założyć w gminie wiejskiej lub miejsko-wiejskiej (ustawa o odnawialnych źródłach energii). Najlepsze są gminy z wieloma lokalnymi wytwórcami, gospodarstwami i odbiorcami, którym tania energia pomoże najbardziej.",
      facts: f => [["Małe instalacje OZE (URE)", fmt(f.mioze)], ["Gospodarstwa rolne", fmt(f.gosp)], ["Ryzyko ubóstwa energetycznego", f.ubo != null ? `${fmt(f.ubo)}/100` : "–"], ["Klastry energii", fmt(f.klaster)], ["Spółdzielnie (KOWR)", fmt(f.spoldz)]],
      cols: [["Wytwórcy", f => fmt(f.mioze), f => f.mioze], ["Gospodarstwa", f => fmt(f.gosp), f => f.gosp]],
      flags: f => [f.spoldz > 0 && ["ok", "spółdzielnia już działa"], f.klaster > 0 && ["ok", "gmina w klastrze energii"]] },
    analiza: { label: "Istniejące elektrownie" }
  };
  const common = f => [["Linie 110 kV i wyżej", `${fmt(f.kv110)} km`], ["Najbliższa stacja GPZ", f.gpz_m != null ? `${fmt(f.gpz_m / 1000, 1)} km` : "–"],
    ["Wolna moc najbliższej stacji", f.wolna ? `${fmt(f.wolna[0])} MW (${esc(f.wolna[2] || "")}, ${fmt(f.wolna[1], 1)} km)` : "brak danych operatora"],
    ["Plan ogólny", { uchwalony: "uchwalony", projekt: "w opracowaniu", brak: "brak" }[f.pog] || "–"]];

  let D, tab = store.get("tab", "wiatr"), sort = { c: "score", dir: -1 }, open = new Set();
  const W = () => store.get("w." + tab, D.wagi[tab]);

  function scoreOf(g, w) {
    const s = g.s[tab]; if (!s) return null;
    const keys = D.skladniki[tab]; let a = 0, b = 0;
    keys.forEach((c, i) => { a += (w[c] || 0) * s[i]; b += w[c] || 0; });
    let v = b ? a / b : 0;
    if (tab === "wiatr" && g.f.wyt_ha < 30) v = Math.min(v, 15); // no room for a turbine at all
    return Math.round(v);
  }

  function renderTabs() {
    $("#tabs").innerHTML = Object.entries(TABS).map(([k, t]) => `<button role="tab" aria-selected="${k === tab}" data-t="${k}">${esc(t.label)}</button>`).join("");
    $("#tabs").onclick = e => { const b = e.target.closest("[data-t]"); if (!b) return; tab = b.dataset.t; store.set("tab", tab); open.clear(); renderAll(); };
  }
  function renderWeights() {
    const w = W();
    $("#weights").innerHTML = D.skladniki[tab].map(c => `<label><span>${esc(C[c][0])}</span><b>${w[c] || 0}</b><input type="range" min="0" max="50" step="5" value="${w[c] || 0}" data-c="${c}"/><small>${esc(C[c][1])}</small></label>`).join("");
    $("#weights").oninput = e => { const c = e.target.dataset.c; if (!c) return; const w2 = { ...W(), [c]: +e.target.value }; store.set("w." + tab, w2); e.target.previousElementSibling.textContent = e.target.value; renderList(); };
  }
  function rows() {
    const w = W(), q = $("#q").value.trim().toLowerCase(), wj = $("#woj").value, ty = $("#typ").value;
    let r = D.gminy.map(g => ({ g, v: scoreOf(g, w) })).filter(x => x.v != null);
    r.sort((a, b) => b.v - a.v); r.forEach((x, i) => x.rank = i + 1);
    r = r.filter(x => (!q || x.g.n.toLowerCase().includes(q) || x.g.k.startsWith(q)) && (!wj || x.g.k.startsWith(wj)) && (!ty || x.g.t === ty));
    const col = TABS[tab].cols.findIndex(c => c[0] === sort.c);
    if (sort.c === "n") r.sort((a, b) => a.g.n.localeCompare(b.g.n, "pl") * -sort.dir);
    else if (col >= 0) r.sort((a, b) => ((TABS[tab].cols[col][2](a.g.f) ?? -1e9) - (TABS[tab].cols[col][2](b.g.f) ?? -1e9)) * sort.dir);
    else r.sort((a, b) => (a.v - b.v) * sort.dir);
    return r;
  }
  function renderList() {
    const T = TABS[tab], r = rows(), lim = +$("#lim").value, keys = D.skladniki[tab];
    $("#count").textContent = `${fmt(r.length)} ${tab === "spoldzielnia" ? "gmin wiejskich i miejsko-wiejskich" : "gmin"}${r.length > lim ? `, pokazano ${fmt(lim)}` : ""}. Stuknij gminę, aby zobaczyć szczegóły.`;
    const arrow = c => sort.c === c ? (sort.dir < 0 ? " ▼" : " ▲") : "";
    $("#th").innerHTML = `<tr><th class="num" data-s="score">#</th><th data-s="n">Gmina${arrow("n")}</th><th class="hide-m">Województwo</th><th data-s="score">Ocena${arrow("score")}</th><th>Składniki</th>${T.cols.map(c => `<th class="num" data-s="${esc(c[0])}">${esc(c[0])}${arrow(c[0])}</th>`).join("")}</tr>`;
    $("#tb").innerHTML = r.slice(0, lim).map(({ g, v, rank }) => {
      const f = g.f, fl = (T.flags(f) || []).filter(Boolean);
      const main = `<tr class="main" data-k="${g.k}"><td class="num muted">${rank}</td><td><b>${esc(g.n)}</b><div class="small muted">gmina ${esc(g.t)}</div>${fl.length ? `<div>${fl.map(([c, t]) => `<span class="chip ${c}">${esc(t)}</span>`).join("")}</div>` : ""}</td>
        <td class="hide-m">${esc(D.woj[g.k.slice(0, 2)] || "")}</td><td data-l="Ocena"><div class="score"><b>${v}</b><div class="bar"><i style="width:${v}%;background:${color(v)}"></i></div></div></td>
        <td data-l="Składniki"><div class="mini">${keys.map((c, i) => `<span title="${esc(C[c][0])}: ${g.s[tab][i]}" style="background:${color(g.s[tab][i])}">${esc(C[c][0][0])}</span>`).join("")}</div></td>
        ${T.cols.map(c => `<td class="num" data-l="${esc(c[0])}">${c[1](f)}</td>`).join("")}</tr>`;
      if (!open.has(g.k)) return main;
      const facts = [...T.facts(f), ...common(f)];
      return main + `<tr class="det"><td colspan="${5 + T.cols.length}"><div class="det-grid">${keys.map((c, i) => `<div><span>${esc(C[c][0])} <span class="muted small">${esc(C[c][1])}</span></span><b>${g.s[tab][i]}</b></div>`).join("")}</div>
        <div class="det-grid" style="margin-top:8px">${facts.map(([a, b]) => `<div><span class="muted">${esc(a)}</span><b>${b}</b></div>`).join("")}</div>
        <p class="small"><a href="./?gmina=${g.k}">Otwórz gminę na mapie</a> · ${fmt(g.lud)} mieszkańców</p></td></tr>`;
    }).join("");
  }
  function renderAnalysis() {
    const S = D.statystyki, L = { "wiatr_działająca": "Działające farmy wiatrowe", "wiatr_planowana": "Planowane farmy wiatrowe (decyzje środowiskowe)", "pv_działająca": "Farmy fotowoltaiczne", "biogaz_działająca": "Biogazownie rolnicze" };
    const km = m => m == null ? "–" : m >= 1000 ? `${fmt(m / 1000, 1)} km` : `${fmt(m)} m`;
    $("#analysis").innerHTML = `<div class="stats">${Object.entries(L).filter(([k]) => S[k]).map(([k, l]) => { const s = S[k];
      return `<div class="panel"><h3>${esc(l)}</h3><p class="small muted">${fmt(s.n)} ${k.startsWith("wiatr") ? "farm" : "obiektów"}. Wartości środkowe (mediany).</p>
        <div class="kv"><span>Do stacji GPZ</span><b>${km(s.gpz_m)}</b></div><div class="kv"><span>Do linii 110 kV</span><b>${km(s.kv110_m)}</b></div>
        <div class="kv"><span>Do budynku mieszkalnego</span><b>${km(s.bud_m)}</b></div><div class="kv"><span>Bliżej niż 700 m od domu</span><b>${s.bud700}%</b></div>
        <div class="kv"><span>Do lasu</span><b>${km(s.las_m)}</b></div><div class="kv"><span>Bliżej niż 200 m od lasu</span><b>${s.las200}%</b></div>
        <div class="kv"><span>Do dużego odbiorcy energii</span><b>${km(s.odb_m)}</b></div>
        <div class="kv"><span>W obszarze Natura 2000</span><b>${s.n2k}%</b></div><div class="kv"><span>W parku krajobrazowym</span><b>${s.pk}%</b></div><div class="kv"><span>W obszarze chronionego krajobrazu</span><b>${s.ochk}%</b></div>
        <div class="kv"><span>Pokrycie terenu (BDOT10k)</span><b>${Object.entries(s.pokrycie).slice(0, 3).map(([a, b]) => `${esc(a)} ${Math.round(b / s.n * 100)}%`).join(", ")}</b></div>
        <div class="kv"><span>Zgodne ze strefą planu ogólnego</span><b>${s.pog_zgodne != null ? `${s.pog_zgodne}%` : "–"}</b></div>
        <p class="small muted">Zgodność z planem ogólnym liczona dla ${fmt(s.pog_gmin)} obiektów w gminach, które mają plan ogólny uchwalony lub w projekcie: odsetek leżących w strefie dopuszczającej tę technologię.</p></div>`; }).join("")}</div>
      <div class="panel small"><h3>Co z tego wynika</h3><ul>
        <li><b>Sieć decyduje.</b> Połowa farm wiatrowych stoi nie dalej niż ${km(S["wiatr_działająca"]?.gpz_m)} od GPZ, a połowa farm PV nie dalej niż ${km(S["pv_działająca"]?.gpz_m)}. Dlatego składnik „Sieć” ma dużą wagę.</li>
        <li><b>Starsze wiatraki stoją bliżej domów.</b> ${S["wiatr_działająca"]?.bud700}% działających farm ma dom bliżej niż 700 m, bo powstały przed ustawą z 2016 r. albo na podstawie planów miejscowych. Nowe lokalizacje muszą spełnić 700 m.</li>
        <li><b>Plany ogólne często nie przewidują istniejących instalacji.</b> Tylko ${S["pv_działająca"]?.pog_zgodne ?? "–"}% farm PV i ${S["wiatr_działająca"]?.pog_zgodne ?? "–"}% farm wiatrowych w gminach z planem ogólnym leży w strefie, która je dopuszcza. Przy rozbudowie lub nowej inwestycji warto to sprawdzić w pierwszej kolejności.</li>
        <li><b>Obszary chronione omijane.</b> W Natura 2000 stoi ${S["wiatr_działająca"]?.n2k}% farm wiatrowych i ${S["pv_działająca"]?.n2k}% farm PV.</li>
        <li><b>Plany miejscowe (MPZP).</b> Krajowa Integracja MPZP (Geoportal) zwraca dane o planie tylko dla części gmin, więc zgodności z MPZP nie da się dziś policzyć dla całej Polski. Sprawdź plan w gminie lub na Geoportalu.</li></ul></div>`;
  }
  function renderAll() {
    renderTabs();
    const an = tab === "analiza";
    $("#ctrl").hidden = an; $("#list").hidden = an; $("#analysis").hidden = !an;
    $("#intro").innerHTML = an ? `<p class="lead">Jak wyglądają lokalizacje działających i planowanych elektrowni: odległości od sieci, domów i lasów, formy ochrony przyrody, pokrycie terenu i zgodność z planami ogólnymi gmin.</p>` : `<p class="lead">${esc(TABS[tab].intro)}</p>`;
    if (an) return renderAnalysis();
    renderWeights(); renderList();
  }
  function csv() {
    const T = TABS[tab], keys = D.skladniki[tab], r = rows();
    const head = ["miejsce", "teryt", "gmina", "rodzaj", "województwo", "ocena", ...keys.map(c => C[c][0]), ...T.facts(r[0].g.f).map(x => x[0]), ...common(r[0].g.f).map(x => x[0])];
    const strip = s => String(s).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
    const lines = r.map(x => [x.rank, x.g.k, x.g.n, x.g.t, D.woj[x.g.k.slice(0, 2)], x.v, ...x.g.s[tab], ...T.facts(x.g.f).map(y => strip(y[1])), ...common(x.g.f).map(y => strip(y[1]))]);
    const out = [head, ...lines].map(l => l.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + out], { type: "text/csv;charset=utf-8" })); a.download = `oze-${tab}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  fetch("data/oze-ocena.json").then(r => r.json()).then(d => {
    D = d;
    $("#woj").innerHTML += Object.entries(D.woj).sort((a, b) => a[1].localeCompare(b[1], "pl")).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("");
    const P = new URLSearchParams(location.search);
    if (P.get("t") && TABS[P.get("t")]) tab = P.get("t");
    if (!TABS[tab]) tab = "wiatr";
    if (P.get("k")) { const g = D.gminy.find(x => x.k === P.get("k")); if (g) { $("#q").value = g.n; open.add(g.k); if (tab === "analiza") tab = "wiatr"; } }
    ["#q", "#woj", "#typ", "#lim"].forEach(s => $(s).addEventListener(s === "#q" ? "input" : "change", renderList));
    $("#reset").onclick = () => { store.set("w." + tab, D.wagi[tab]); renderWeights(); renderList(); };
    $("#csv").onclick = csv;
    $("#th").onclick = e => { const th = e.target.closest("[data-s]"); if (!th) return; const c = th.dataset.s; sort = { c, dir: sort.c === c ? -sort.dir : (c === "n" ? 1 : -1) }; renderList(); };
    $("#tb").onclick = e => { if (e.target.closest("a")) return; const tr = e.target.closest("tr.main"); if (!tr) return; const k = tr.dataset.k; open.has(k) ? open.delete(k) : open.add(k); renderList(); };
    $("#method").innerHTML = `<b>Jak liczona jest ocena.</b> Każdy składnik to miejsce gminy na tle wszystkich gmin w Polsce (0 = najsłabsza, 100 = najlepsza), a ocena to średnia ważona składników. Brak danych liczony jest jako 50. Dla wiatru gminy z mniej niż 30 ha terenu bez ograniczeń mają ocenę najwyżej 15. To narzędzie do wstępnego wyboru miejsc: nie zastępuje planu miejscowego, decyzji środowiskowej ani warunków przyłączenia.<br/><br/>
      <b>Źródła:</b> ustawa o inwestycjach w zakresie elektrowni wiatrowych (Dz.U. 2024 poz. 317) i obliczenia własne na BDOT10k (GUGiK) oraz CRFOP (GDOŚ); Global Wind Atlas i Global Solar Atlas; OpenStreetMap (linie i stacje); Energa-Operator (wolne moce, stan 31.08.2026; rejestr wniosków, stan 30.09.2026) i PSE (stan 31.10.2026); strefy planów ogólnych (Rejestr Urbanistyczny, zestawienie bazamocy.pl) i stan planów ogólnych (Geoportal); GUS (Powszechny Spis Rolny 2020, Bank Danych Lokalnych); Prezes URE (MIOZE, klastry energii, koncesje); KOWR (spółdzielnie energetyczne, biogazownie rolnicze); GDOŚ i RDOŚ (decyzje środowiskowe dla farm wiatrowych, zestawienie bazamocy.pl); BDOT10k (kompleksy przemysłowo-gospodarcze). Stan ${esc(D.stan)}.`;
    renderAll();
  }).catch(() => { $("#count").textContent = "Nie udało się wczytać danych."; });
})();
