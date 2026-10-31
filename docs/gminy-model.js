/* Pure municipality data rules, shared by the browser and node:test. */
(function (root) {
  "use strict";
  const definitions = [
    { key: "ludnosc", label: "Mieszkańcy", unit: "os.", category: "Ludność", digits: 0, base: true },
    { key: "powierzchnia", label: "Powierzchnia", unit: "km²", category: "Przegląd", digits: 2 },
    { key: "przyrost_naturalny", label: "Przyrost naturalny", unit: "na 1000 os.", category: "Ludność", digits: 2 },
    { key: "obciazenie_demograficzne", label: "Osoby w wieku nieprodukcyjnym", unit: "na 100 os. w wieku produkcyjnym", category: "Ludność", digits: 1 },
    { key: "saldo_migracji", label: "Saldo migracji", unit: "na 1000 os.", category: "Ludność", digits: 1, base: true },
    { key: "pit_na_mieszk", label: "PIT na mieszkańca", unit: "zł", category: "Finanse i firmy", digits: 2 },
    { key: "firmy_na_1000", label: "Podmioty REGON", unit: "na 1000 os.", category: "Finanse i firmy", digits: 1 },
    { key: "dochod_na_mieszk", label: "Dochody budżetu na mieszkańca", unit: "zł", category: "Finanse i firmy", digits: 2, base: true },
    { key: "bezrobocie_proc", label: "Udział bezrobotnych w ludności w wieku produkcyjnym", unit: "%", category: "Finanse i firmy", digits: 1, base: true },
    { key: "mieszkanie_m2_os", label: "Powierzchnia mieszkania na osobę", unit: "m²", category: "Warunki życia", digits: 1 },
    { key: "kanalizacja_proc", label: "Korzystający z kanalizacji", unit: "%", category: "Warunki życia", digits: 1, base: true },
    { key: "wodociag_proc", label: "Korzystający z wodociągu", unit: "%", category: "Warunki życia", digits: 1, base: true },
    { key: "lesistosc_proc", label: "Lesistość", unit: "%", category: "Środowisko", digits: 1, base: true }
  ];
  function normalize(value) {
    return String(value ?? "").toLocaleLowerCase("pl-PL").replace(/ł/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }
  function parcelTeryt(id) {
    const match = String(id || "").match(/^(\d{6})_(\d)\./);
    return match ? match[1] + match[2] : null;
  }
  function search(gminy, query, limit = 6) {
    const needle = normalize(query);
    if (needle.length < 2) return [];
    const tokens = needle.split(/\s+/);
    return gminy.map((g) => {
      const name = normalize(g.n), hay = `${name} ${normalize(g.typ)} ${g.k}`;
      if (!tokens.every((t) => hay.includes(t))) return null;
      const rank = g.k === needle ? 0 : name === needle ? 1 : name.startsWith(needle) ? 2 : 3;
      return { g, rank };
    }).filter(Boolean).sort((a, b) => a.rank - b.rank || a.g.n.localeCompare(b.g.n, "pl") || a.g.k.localeCompare(b.g.k)).slice(0, limit).map((item) => item.g);
  }
  function metric(gmina, definition) {
    const direct = gmina._gus?.[definition.key];
    if (direct) {
      const observation = gmina._selectedYear ? direct.history?.find(v => v.year === gmina._selectedYear) : direct;
      return { ...definition, value: observation && Number.isFinite(observation.value) ? observation.value : null, year: observation?.year || gmina._selectedYear || null, source: direct.source, sourceUrl: direct.sourceUrl, variableId: direct.variableId, history: direct.history || [] };
    }
    const extra = gmina.uzupelnienia || {};
    const hasExtra = !definition.base && Number.isFinite(extra[definition.key]);
    const raw = hasExtra ? extra[definition.key] : gmina[definition.key];
    let value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    const rawYear = hasExtra ? extra.lata?.[definition.key] : gmina[definition.key + "_rok"];
    const year = Number.isInteger(rawYear) && rawYear >= 1900 ? rawYear : null;
    if (gmina._selectedYear && year !== gmina._selectedYear) value = null;
    return { ...definition, value, year, source: hasExtra || year ? "GUS BDL" : "Dane referencyjne · rok niepodany", sourceKey: hasExtra ? definition.key : null };
  }
  function addDefinitions(items) {
    for (const item of items) {
      const definition = { key:item.key, label:item.label, unit:item.unit, category:item.category, digits:item.digits };
      const existing = definitions.find(d=>d.key===item.key);
      if(existing)Object.assign(existing,definition);else definitions.push(definition);
    }
  }
  function metrics(gmina) { return definitions.map((d) => metric(gmina, d)); }
  function formatValue(item, withUnit = true) {
    if (item.value === null) return "Brak danych";
    const value = item.value.toLocaleString("pl-PL", { maximumFractionDigits: item.digits });
    return value + (withUnit && item.unit ? " " + item.unit : "");
  }
  const api = { definitions, normalize, parcelTeryt, search, metric, metrics, formatValue, addDefinitions };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GminyModel = api;
})(typeof window !== "undefined" ? window : globalThis);
