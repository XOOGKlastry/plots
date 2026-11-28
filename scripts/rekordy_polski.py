"""Rekordy całej Polski z warstw ciekawostek (docs/data/granice/*.geojson) do jednego małego pliku docs/data/rekordy-polski.json.
Każda lista: tytuł, jednostka i do 10 pozycji [nazwa, wartość, opis, [lon, lat]]."""
import json, os, collections
D = os.path.join(os.path.dirname(__file__), "..", "docs", "data")
def F(name): return json.load(open(os.path.join(D, "granice", name + ".geojson"), encoding="utf-8"))["features"]
def pt(f):
    g = f.get("geometry") or {}; c = g.get("coordinates")
    if not c: return None
    t = g["type"]
    if t == "Point": return [round(c[0], 5), round(c[1], 5)]
    if t == "LineString": c = c[len(c) // 2]; return [round(c[0], 5), round(c[1], 5)]
    if t == "MultiLineString": l = max(c, key=len); c = l[len(l) // 2]; return [round(c[0], 5), round(c[1], 5)]
    if t in ("Polygon", "MultiPolygon"):
        ring = c[0] if t == "Polygon" else max((p[0] for p in c), key=len)
        return [round(sum(x for x, _ in ring) / len(ring), 5), round(sum(y for _, y in ring) / len(ring), 5)]
    return None
def nf(v, d=0): s = f"{v:,.{d}f}".replace(",", " ").replace(".", ","); return s
def top(feats, k, key, n=10, rev=False, sortkey=None):
    xs = [f for f in feats if f["properties"].get("k") == k]
    if sortkey: xs.sort(key=lambda f: f["properties"].get(sortkey) or 0, reverse=not rev)
    elif xs and "r" in xs[0]["properties"]: xs.sort(key=lambda f: f["properties"]["r"])
    return xs[:n]
S = []
def sec(id, title, icon, color, lists): S.append({"id": id, "title": title, "icon": icon, "color": color, "lists": lists})
def L(title, rows, note=""): return {"title": title, "rows": rows, "note": note}

# Nazwy miejscowości
nz = F("nazwy"); P = lambda f: f["properties"]
sec("nazwy", "Nazwy miejscowości", "map-pin", ["#ff375f", "#ff9f0a"], [
    L("Najdłuższe nazwy", [[P(f)["n"], f'{P(f)["c"]} znaków', f'{P(f)["o"]}, gm. {P(f)["g"]}', pt(f)] for f in top(nz, "dl", "r")]),
    L("Najkrótsze nazwy", [[P(f)["n"], f'{P(f)["c"]} znaki' if P(f)["c"] < 5 else f'{P(f)["c"]} znaków', f'{P(f)["o"]}, gm. {P(f)["g"]}', pt(f)] for f in top(nz, "kr", "r")]),
    L("Najczęstsze nazwy", [[P(f)["n"], f'{P(f)["x"]} razy', "w całej Polsce", pt(f)] for f in sorted({P(f)["n"]: f for f in nz if P(f)["k"] == "cz10"}.values(), key=lambda f: -P(f)["x"])[:10]]),
])
# Końcówki nazw wsi
suf = collections.Counter(f["properties"]["s"] for f in F("nazwy_sufiksy"))
sec("koncowki", "Końcówki nazw wsi", "list-bullets", ["#5e5ce6", "#bf5af2"], [
    L("Najpopularniejsze końcówki", [["-" + s, nf(c), "miejscowości", None] for s, c in suf.most_common(10)], "Liczba wsi z daną końcówką nazwy")])
# Budynki
br = F("bud_rekordy")
sec("budynki", "Rekordy budynków", "buildings", ["#ff9f0a", "#ff375f"], [
    L("Najwyższe budynki", [[P(f)["nz"] or P(f)["f"], f'{int(P(f)["v"])} kondygnacji', P(f)["g"], pt(f)] for f in top(br, "N", "v", sortkey="v")]),
    L("Największe budynki", [[P(f)["nz"] or P(f)["f"], f'{nf(P(f)["v"] / 1e4, 1)} ha', P(f)["g"], pt(f)] for f in top(br, "A", "v", sortkey="v")]),
    L("Najdłuższe budynki", [[P(f)["nz"] or P(f)["f"], f'{nf(P(f)["v"])} m', P(f)["g"], pt(f)] for f in top(br, "L", "v", sortkey="v")]),
    L("Najmniejsze budynki mieszkalne", [[P(f)["nz"] or P(f)["f"], f'{nf(P(f)["v"])} m²', P(f)["g"], pt(f)] for f in top(br, "S", "v", sortkey="v", rev=True)]),
])
# Ulice
ut = F("ulice_tem"); uw = F("ulice_woj")
pat = collections.Counter(P(f)["n"] for f in ut if P(f)["k"] == "pt")
sec("ulice", "Ulice", "road-horizon", ["#0a84ff", "#64d2ff"], [
    L("Najczęstsi patroni ulic", [[n, f"{nf(c)} ulic", "w całej Polsce", None] for n, c in pat.most_common(10)]),
    L("Ulica typowa dla województwa", [[P(f)["u"], P(f)["w"], f'{P(f)["l"][0][1]} ulic w województwie', pt(f)] for f in sorted(uw, key=lambda f: P(f)["w"])], "Nazwa częsta w województwie, a rzadka w reszcie Polski"),
    L("Najdłuższe nazwy ulic", [[P(f)["n"], f'{P(f)["l"]} znaków' if P(f)["l"] < 400 else "", P(f)["m"], pt(f)] for f in top(ut, "dl", "r", sortkey="l")[:6]]),
    L("Krótka dłuższa niż Długa", [[f'{P(f)["n"]}, {P(f)["m"]}', f'{nf(P(f)["l"])} m', f'gm. {P(f)["g"]}', pt(f)] for f in top(ut, "kd", "l", sortkey="l")]),
    L("Nazwa miasta najdalej od tego miasta", [[f'ul. {P(f)["n"]}', f'{nf(P(f)["d"])} km', f'{P(f)["m"]}, do {P(f)["t"]}', pt(f)] for f in top(ut, "mc", "d", sortkey="d")]),
])
# Geografia i granice
ge = F("geografia"); rk = F("rekordy"); ks = F("ksztalty")
sec("geografia", "Geografia i granice", "poland", ["#30d158", "#0a84ff"], [
    L("Najdłuższe granice dwóch gmin", [[f'{P(f)["a"]} i {P(f)["b"]}', f'{nf(P(f)["m"] / 1000, 1)} km', "wspólna granica", pt(f)] for f in top(rk, "L", "m", sortkey="m")]),
    L("Najkrótsze granice dwóch gmin", [[f'{P(f)["a"]} i {P(f)["b"]}', f'{nf(P(f)["m"], 1)} m', "wspólna granica", pt(f)] for f in top(rk, "S", "m", sortkey="m", rev=True)]),
    L("Najwięcej sąsiadów", [[P(f)["a"], f'{P(f)["c"]} gmin', "sąsiaduje z", pt(f)] for f in top(rk, "N", "c", sortkey="c")]),
    L("Największe jeziora w województwach", [[P(f)["n"], f'{nf(P(f)["d"] / 1e6, 1)} km²', P(f)["w"], pt(f)] for f in top(ge, "jw", "d", sortkey="d")]),
    L("Przecięcia pełnych stopni", [[P(f)["n"], "", f'gm. {P(f)["g"]}', pt(f)] for f in [x for x in ge if P(x)["k"] == "cf"][:10]]),
])
sec("ksztalty", "Kształty gmin", "target", ["#bf5af2", "#ff375f"], [
    L("Najbardziej okrągłe", [[P(f)["n"], nf(P(f)["pp"], 2), P(f)["t"], pt(f)] for f in top(ks, "zw", "r")], "Wskaźnik zwartości: 1 to idealne koło"),
    L("Najbardziej poszarpane", [[P(f)["n"], nf(P(f)["pp"], 2), P(f)["t"], pt(f)] for f in top(ks, "po", "r")]),
    L("Najbardziej wydłużone", [[P(f)["n"], f'{nf(P(f)["el"], 1)} : 1', P(f)["t"], pt(f)] for f in top(ks, "wy", "r")]),
])
# Drogi proste, odludzia, daleko
pr = F("proste"); od = F("odludzia"); dl = F("daleko")
sec("odludzia", "Odludzia i odległości", "path", ["#636366", "#0a84ff"], [
    L("Najdłuższe proste drogi i tory", [[P(f).get("s") or P(f).get("n") or P(f).get("c"), f'{nf(P(f)["km"], 1)} km', P(f).get("c", ""), pt(f)] for f in sorted(pr, key=lambda f: -P(f)["km"])[:10]]),
    L("Najbardziej samotne domy", [[P(f)["m"], f'{nf(P(f)["d"])} m', f'do najbliższego budynku, gm. {P(f)["g"]}', pt(f)] for f in top(od, "s", "r")]),
    L("Najdalej od urzędu gminy", [[P(f)["n"], f'{nf(P(f)["d"], 1)} km', f'do: {P(f)["u"]}', pt(f)] for f in top(dl, "w", "d", sortkey="d")]),
])
# Przyroda
ls = F("lasy_stare"); wy = F("wysokosci")
SP = {"SO": "sosna", "DB": "dąb", "BK": "buk", "JD": "jodła", "ŚW": "świerk", "OL": "olsza", "MD": "modrzew", "JS": "jesion", "BRZ": "brzoza", "LP": "lipa", "WZ": "wiąz", "TP": "topola"}
sec("przyroda", "Przyroda i wysokości", "tree", ["#248a3d", "#30d158"], [
    L("Najstarsze drzewostany", [[SP.get(P(f)["s"], P(f)["s"]), f'{P(f)["a"]} lat', f'okolice: {P(f)["m"]}', pt(f)] for f in sorted(ls, key=lambda f: -P(f)["a"])[:10]]),
    L("Gminy z najwyższym punktem", [[P(f)["n"], f'{nf(P(f)["h"])} m n.p.m.', "najwyższy punkt gminy", pt(f)] for f in sorted([x for x in wy if P(x)["k"] == "max"], key=lambda f: -P(f)["h"])[:10]]),
    L("Najniższe miejsca", [[P(f)["n"], f'{nf(P(f)["h"], 1)} m', "najniższy punkt gminy", pt(f)] for f in sorted([x for x in wy if P(x)["k"] == "min"], key=lambda f: P(f)["h"])[:10]]),
])
json.dump({"zrodla": "Główny Urząd Geodezji i Kartografii (PRG, PRNG, BDOT10k, Numeryczny Model Terenu), Bank Danych o Lasach (Lasy Państwowe); obliczenia własne", "sections": S},
          open(os.path.join(D, "rekordy-polski.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
for s in S: print(s["id"], [(l["title"], len(l["rows"]), l["rows"][0][:2] if l["rows"] else None) for l in s["lists"]])
