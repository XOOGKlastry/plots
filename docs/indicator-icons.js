/* Thematic groups and icons for gmina indicators, shared by the gmina card and the statistics map. */
(function (root) {
  "use strict";
  const categories = {
    "Przegląd": { icon: "squares-four", color: "#5c6ac4" },
    "Ludność": { icon: "users", color: "#7c5cc4" },
    "Finanse i firmy": { icon: "coins", color: "#2f8f6f" },
    "Warunki życia": { icon: "house", color: "#1c8fb0" },
    "Energia i ciepło": { icon: "lightning", color: "#e0573e" },
    "Infrastruktura": { icon: "road-horizon", color: "#1a7f99" },
    "Planowanie": { icon: "map-trifold", color: "#e8803a" },
    "Edukacja i kultura": { icon: "books", color: "#a24bb8" },
    "Środowisko": { icon: "tree", color: "#2f9461" }
  };
  // [key pattern, group, icon] - first match wins inside a category.
  const rules = {
    "Ludność": [[/gestosc/, "Liczba i gęstość", "users-three"], [/ludnosc/, "Liczba i gęstość", "users"], [/urodzenia/, "Ruch naturalny i migracje", "baby"], [/zgony/, "Ruch naturalny i migracje", "heartbeat"], [/przyrost/, "Ruch naturalny i migracje", "trend-up"], [/saldo|migr/, "Ruch naturalny i migracje", "arrows-left-right"], [/obciazenie|wiek/, "Struktura wieku", "wheelchair"]],
    "Finanse i firmy": [[/pit|dochod/, "Dochody", "money"], [/firmy|regon/, "Przedsiębiorczość", "storefront"], [/bezroboc|prac/, "Rynek pracy", "briefcase"]],
    "Warunki życia": [[/kanal|wodoc/, "Woda i kanalizacja", "drop"], [/mieszk/, "Mieszkania", "house"]],
    "Energia i ciepło": [[/^gaz|_gaz/, "Gaz", "flame"], [/ciepl|kotlown|_co_/, "Ciepło", "thermometer-hot"], [/prad/, "Prąd", "lightning"], [/turbin|wiatr/, "OZE i elektromobilność", "wind"], [/ladowar/, "OZE i elektromobilność", "charging-station"], [/^ep_/, "Energooszczędność budynków", "leaf"]],
    "Infrastruktura": [[/kanal|wodoc/, "Woda i kanalizacja", "drop"], [/drogi/, "Drogi", "road-horizon"], [/przem/, "Zagospodarowanie terenu", "factory"], [/tereny|zabud|zurban/, "Zagospodarowanie terenu", "buildings"]],
    "Planowanie": [[/odroln|rolne/, "Plany miejscowe", "plant"], [/mpzp|studium/, "Plany miejscowe", "map-trifold"], [/decyzj|wz/, "Decyzje lokalizacyjne", "stamp"], [/nowe_bud/, "Budownictwo", "crane"]],
    "Edukacja i kultura": [[/zlob/, "Opieka nad dziećmi", "baby-carriage"], [/przedszk/, "Opieka nad dziećmi", "backpack"], [/czytel|bibliot/, "Kultura", "books"], [/nid_arch/, "Archeologia", "shovel"], [/nid_sakral/, "Zabytki", "church"], [/nid_rezyd/, "Zabytki", "castle-turret"], [/nid_park/, "Zabytki", "park"], [/nid_cment/, "Zabytki", "cross"], [/nid_techn/, "Zabytki", "factory"], [/^nid_/, "Zabytki", "castle-turret"], [/muzea/, "Muzea i twierdze", "bank"], [/twierdz/, "Muzea i twierdze", "castle-turret"]],
    "Środowisko": [[/zielen/, "Lasy i zieleń", "park"], [/las|lesn|lesist/, "Lasy i zieleń", "tree"], [/chron|natura|rezerw|ochk|parki_proc|ochrona/, "Ochrona przyrody", "shield-check"], [/odpad/, "Odpady", "recycle"], [/wody|oczyszcz/, "Woda", "waves"], [/orne|rolne|nieuzyt/, "Rolnictwo i grunty", "plant"]],
    "Przegląd": [[/powierzch/, "Podstawowe", "ruler"]]
  };
  function of(def) {
    const cat = categories[def.category] || categories["Przegląd"];
    for (const [re, group, icon] of rules[def.category] || []) if (re.test(def.key)) return { group, icon, color: cat.color };
    return { group: "Inne", icon: cat.icon, color: cat.color };
  }
  /* Groups definitions: [{category, icon, color, groups:[{label, items}]}] in the given category order. */
  function group(defs, order) {
    const out = new Map();
    for (const d of defs) {
      if (!out.has(d.category)) out.set(d.category, new Map());
      const g = of(d).group, m = out.get(d.category);
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(d);
    }
    const cats = [...out.keys()].sort((a, b) => ((order || []).indexOf(a) + 1 || 99) - ((order || []).indexOf(b) + 1 || 99));
    return cats.map(c => ({ category: c, icon: (categories[c] || categories["Przegląd"]).icon, color: (categories[c] || categories["Przegląd"]).color, groups: [...out.get(c)].map(([label, items]) => ({ label, items })) }));
  }
  const api = { categories, of, group };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.IndicatorIcons = api;
})(typeof window !== "undefined" ? window : globalThis);
