/* Thematic groups and icons for gmina indicators, shared by the gmina card and the statistics map. */
(function (root) {
  "use strict";
  const categories = {
    "Przegląd": { icon: "squares-four", color: "#5c6ac4" },
    "Wybory": { icon: "envelope", color: "#1c1c1e" },
    "Ludność": { icon: "users", color: "#7c5cc4" },
    "Finanse i firmy": { icon: "coins", color: "#2f8f6f" },
    "Warunki życia": { icon: "house", color: "#1c8fb0" },
    "Energia i ciepło": { icon: "lightning", color: "#e0573e" },
    "Migracje": { icon: "arrows-left-right", color: "#0f97b0" },
    "Dojazdy": { icon: "car-profile", color: "#1a7f99" },
    "Rodziny": { icon: "house-line", color: "#8e5bd6" },
    "Usługi": { icon: "storefront", color: "#c2185b" },
    "Handel": { icon: "shopping-cart", color: "#c2185b" },
    "Paczki": { icon: "package", color: "#b8641a" },
    "Transport": { icon: "bus", color: "#1a7f99" },
    "Zdrowie i służby": { icon: "first-aid-kit", color: "#d0342c" },
    "Szkoły i rekreacja": { icon: "soccer-ball", color: "#a24bb8" },
    "Turystyka": { icon: "mountains", color: "#2f8f6f" },
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
    "Migracje": [[/nsp_/, "Spis 2021", "users"], [/zagr|cudzoz/, "Zagranica", "arrows-left-right"], [/./, "Zameldowania i saldo", "arrows-left-right"]],
    "Handel": [[/_10k$/, "Na 10 tys. mieszkańców", "users-three"], [/_100km2$/, "Na 100 km²", "ruler"], [/_mieszk$/, "Mieszkańcy na jedną placówkę", "users"], [/./, "Liczba w gminie", "map-pin"]], "Paczki": [[/_10k$/, "Na 10 tys. mieszkańców", "users-three"], [/_100km2$/, "Na 100 km²", "ruler"], [/_mieszk$/, "Mieszkańcy na jedną placówkę", "users"], [/./, "Liczba w gminie", "map-pin"]], "Transport": [[/_10k$/, "Na 10 tys. mieszkańców", "users-three"], [/_100km2$/, "Na 100 km²", "ruler"], [/_mieszk$/, "Mieszkańcy na jedną placówkę", "users"], [/./, "Liczba w gminie", "map-pin"]],
    "Przegląd": [[/powierzch/, "Podstawowe", "ruler"]]
  };
  /* Network brands get their real logo (icons/logos, trademarks of their owners), other places get their own symbol. */
  const LOGOS = new Set(["zabka", "biedronka", "lidl", "dino", "netto", "kaufland", "stokrotka", "rossmann", "hebe", "pepco", "reserved", "hm", "zara", "empik", "inpost", "dpd", "dhl", "orlen", "allegro", "poczta", "gls"]);
  const SYMBOLS = { zabka: "storefront", biedronka: "shopping-cart", lidl: "shopping-cart", dino: "shopping-cart", netto: "shopping-cart", kaufland: "shopping-cart", stokrotka: "shopping-cart", rossmann: "sparkle", hebe: "sparkle", pepco: "t-shirt", reserved: "t-shirt", hm: "t-shirt", zara: "t-shirt", empik: "book-open",
    inpost: "lockers", dpd: "package", dhl: "package", orlen: "package", allegro: "lockers", poczta: "envelope", gls: "package", any_locker: "lockers", any_pickup: "package",
    ksiegarnia: "book-open", targowisko: "basket", bankomat: "hand-coins", bank: "bank", gastronomia: "fork-knife", galeria: "shopping-bag", budowlany: "hammer", piekarnia: "bread",
    grp_dyskonty: "shopping-cart", grp_drogerie: "sparkle", grp_odziez: "t-shirt", przystanek: "bus", przystanek_kolejowy: "train", rower: "bicycle", paliwa: "gas-pump",
    szkola: "chalkboard-teacher", przedszkole: "backpack", zlobek: "baby-carriage", szkola_srednia: "student", uczelnia: "graduation-cap", poz: "stethoscope", apteka: "pill", szpital: "hospital", dentysta: "tooth", weterynarz: "paw-print",
    policja: "police-car", straz: "fire-truck", aed: "heartbeat", biblioteka: "books", dom_kultury: "mask-happy", kino: "film-slate", teatr: "mask-happy", muzeum: "ticket", kosciol: "church", basen: "swimming-pool", plac_zabaw: "pinwheel", silownia: "barbell" };
  const base = key => (String(key || "").match(/^usl_(.+?)(?:_10k|_100km2|_mieszk)?$/) || [])[1];
  function own(def, r) {
    const b = base(def.key);
    if (b && SYMBOLS[b]) r.icon = SYMBOLS[b];
    if (b && LOGOS.has(b)) r.logo = `icons/logos/${b}.png`;
    return r;
  }
  function of(def) {
    const cat = categories[def.category] || categories["Przegląd"];
    if (def.group) return own(def, { group: def.group, icon: def.icon || cat.icon, gicon: def.icon || cat.icon, color: cat.color });
    for (const [re, group, icon] of rules[def.category] || []) if (re.test(def.key)) return own(def, { group, icon, gicon: icon, color: cat.color });
    return own(def, { group: "Inne", icon: cat.icon, gicon: cat.icon, color: cat.color });
  }
  /* Logo or symbol as HTML; the logo falls back to the symbol when the image fails. */
  function html(def, extra = "") {
    const r = of(def), svg = root.Icons ? root.Icons.svg(r.icon, extra) : "";
    if (r.logo) return `<img class="ind-logo ${extra}" src="${r.logo}" alt="" loading="lazy" decoding="async" onerror="this.outerHTML=this.dataset.fb" data-fb='${svg.replace(/'/g, "&#39;")}'>`;
    return extra === "metric-symbol" ? `<span class="ind-sym" style="--c:${r.color}">${svg}</span>` : svg;
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
  const api = { categories, of, group, html };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.IndicatorIcons = api;
})(typeof window !== "undefined" ? window : globalThis);
