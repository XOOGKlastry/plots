/* Warstwa danych wskaźników dla Statystyk i Dashboardu: wartości wszystkich gmin dla wskaźnika i roku,
   miejsce w rankingu, percentyl oraz mediany szczebli (powiat, województwo, Polska) liczone jako mediana gmin.
   Wyniki są trzymane w pamięci podręcznej (najwyżej 12 zestawów), liczone leniwie dopiero dla wskaźnika w użyciu. */
(function () {
  "use strict";
  const model = window.GminyModel;
  let gminy = null, names = null, ready = null, byK = new Map();
  const cache = new Map(), LIMIT = 60;

  function load() {
    if (!ready) ready = (async () => {
      const [list, raw] = await Promise.all([
        window.PLOTS_GMINY.all(),
        fetch("data/gminy.json").then(r => r.ok ? r.json() : {}).catch(() => ({}))
      ]);
      gminy = list; byK = new Map(list.map(g => [g.k, g]));
      names = { pow: new Map((raw.powiaty || []).map(x => [x.k, x.n])), woj: new Map((raw.wojewodztwa || []).map(x => [x.k, x.n])) };
    })().catch(e => { ready = null; throw e; });
    return ready;
  }

  const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  /* Wartości gmin: Map(kod TERYT -> {value, year}). Bez roku każda gmina ma najnowszy dostępny rok. */
  function values(def, year = null) {
    const id = def.key + ":" + (year || "");
    if (cache.has(id)) { const v = cache.get(id); cache.delete(id); cache.set(id, v); return v; }
    const out = new Map(), years = new Set();
    for (const g of gminy || []) {
      const m = model.metric(year ? { ...g, _selectedYear: year } : g, def);
      (m.history || []).forEach(h => years.add(h.year)); if (m.year) years.add(m.year);
      if (Number.isFinite(m.value)) out.set(g.k, { value: m.value, year: m.year });
    }
    const sorted = [...out.values()].map(o => o.value).sort((a, b) => a - b);
    const entry = { values: out, sorted, years: [...years].sort((a, b) => b - a), levels: new Map() };
    cache.set(id, entry); if (cache.size > LIMIT) cache.delete(cache.keys().next().value);
    return entry;
  }

  /* Miejsce gminy (1 = najlepsza; przy lowerBetter najniższa wartość) i percentyl 0–100 (100 = najwyższa wartość). */
  function position(def, k, year = null) {
    const e = values(def, year), o = e.values.get(k); if (!o) return null;
    const s = e.sorted, n = s.length;
    let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < o.value) lo = m + 1; else hi = m; }
    let up = lo; while (up < n && s[up] === o.value) up++;
    const below = lo, above = n - up;
    return { value: o.value, year: o.year, n, rank: (def.lowerBetter ? below : above) + 1, percentile: n > 1 ? Math.round((below + (up - lo - 1) / 2) / (n - 1) * 100) : 50 };
  }

  /* Miejsce w województwie lub powiecie: ranking w podzbiorze gmin o wspólnym prefiksie kodu TERYT. */
  function rankIn(def, k, prefix, year = null) {
    const e = values(def, year), o = e.values.get(k); if (!o) return null;
    let n = 0, better = 0;
    for (const [kk, x] of e.values) if (kk.startsWith(prefix)) { n++; if (def.lowerBetter ? x.value < o.value : x.value > o.value) better++; }
    return { rank: better + 1, n };
  }

  /* Mediana gmin w powiecie (4 cyfry TERYT), województwie (2 cyfry) i całej Polsce. */
  function levels(def, k, year = null) {
    const e = values(def, year), id = k.slice(0, 4);
    if (!e.levels.has(id)) {
      const pow = [], woj = [];
      for (const [kk, x] of e.values) { if (kk.startsWith(id)) pow.push(x.value); if (kk.startsWith(k.slice(0, 2))) woj.push(x.value); }
      e.levels.set(id, { powiat: { value: median(pow), n: pow.length, name: names?.pow.get(id) || "" }, wojewodztwo: { value: median(woj), n: woj.length, name: names?.woj.get(k.slice(0, 2)) || "" } });
    }
    return { ...e.levels.get(id), polska: { value: median(e.sorted), n: e.sorted.length } };
  }

  /* Pełna nazwa instytucji w podpisie źródła; nigdy nazwy tabel bazy danych. */
  const INST = [
    [/^GUS\b(\s*BDL)?/, "Główny Urząd Statystyczny, Bank Danych Lokalnych"], [/^GIOŚ\b/, "Główny Inspektorat Ochrony Środowiska"],
    [/^GUGiK\b/, "Główny Urząd Geodezji i Kartografii"], [/^GDOŚ\b/, "Generalna Dyrekcja Ochrony Środowiska"], [/^CKE\b/, "Centralna Komisja Egzaminacyjna"],
    [/^PKW\b/, "Państwowa Komisja Wyborcza"], [/^URE\b/, "Urząd Regulacji Energetyki"], [/^GDDKiA\b/, "Generalna Dyrekcja Dróg Krajowych i Autostrad"]
  ];
  function source(def) {
    const s = String(def?.source || "GUS BDL").trim();
    for (const [re, full] of INST) if (re.test(s)) { const rest = s.replace(re, "").replace(/^[\s,:;]+/, ""); return rest ? `${full}, ${rest}` : full; }
    return s;
  }

  /* Sąsiedzi: gminy, które mają wspólny odcinek granicy (wspólny łuk w topologii granic gmin). Liczone raz, w tle. */
  let nb = null;
  function neighbours() {
    if (!nb) nb = fetch("data/municipalities.topojson").then(r => r.json()).then(t => {
      const byArc = new Map(), out = new Map();
      const walk = (a, k) => Array.isArray(a) ? a.forEach(x => walk(x, k)) : (byArc.get(a < 0 ? ~a : a) || byArc.set(a < 0 ? ~a : a, new Set()).get(a < 0 ? ~a : a)).add(k);
      const o = Object.values(t.objects)[0]; // pierwszy obiekt; kolejne to te same gminy w innym uogólnieniu
      for (const g of o?.geometries || []) { const k = g.properties?.k ?? g.id; if (k != null) walk(g.arcs || [], String(k)); }
      for (const set of byArc.values()) if (set.size > 1) for (const a of set) for (const b of set) if (a !== b) (out.get(a) || out.set(a, new Set()).get(a)).add(b);
      return out;
    }).catch(e => { nb = null; throw e; });
    return nb;
  }
  /* Gminy podobne: ten sam rodzaj gminy (ostatnia cyfra TERYT) i najbliższa liczba ludności, w całej Polsce. */
  function similar(k, n = 8) {
    const g = gmina(k); if (!g) return [];
    const pop = x => Number(x.ludnosc) || 0, p0 = pop(g), typ = k.slice(-1);
    return (gminy || []).filter(x => x.k !== k && x.k.slice(-1) === typ && pop(x) > 0)
      .map(x => [x, Math.abs(Math.log(pop(x) / (p0 || 1)))]).sort((a, b) => a[1] - b[1]).slice(0, n).map(([x]) => x.k);
  }
  function gmina(k) { return byK.get(k) || null; }
  window.IndicatorStore = { invalidate: key => { for (const id of [...cache.keys()]) if (id.startsWith(key + ":")) cache.delete(id); }, load, neighbours, similar, values, position, rankIn, levels, source, gmina, gminy: () => gminy || [], powiat: k => names?.pow.get(k.slice(0, 4)) || "", wojewodztwo: k => names?.woj.get(k.slice(0, 2)) || "" };
})();
