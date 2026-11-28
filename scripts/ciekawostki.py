"""Zbiera ciekawostki gmin z warstw docs/data/granice (wysokości, budynki, przyroda) do jednego małego pliku docs/data/ciekawostki.json."""
import json, os
D = os.path.join(os.path.dirname(__file__), "..", "docs", "data")
G = lambda f: json.load(open(os.path.join(D, "granice", f + ".geojson"), encoding="utf-8"))["features"]
out = {}
for f in G("wysokosci"):
    p = f["properties"]; o = out.setdefault(p["t"], {})
    o["h" + p["k"]] = p["h"]; o["c" + p["k"]] = [round(x, 5) for x in f["geometry"]["coordinates"]]
for f in G("budynki_gmin"):
    p = f["properties"]; o = out.setdefault(p["t"], {})
    for k in ("b", "m", "jd", "wr", "mx", "mxf", "sk", "sa"): o[k] = p.get(k)
for f in G("przyroda_gmin"):
    p = f["properties"]; o = out.setdefault(p["t"], {})
    for k in ("o", "n2", "ok", "pk", "la", "l100", "ls", "lso", "ldb", "lbk", "lh"): o[k] = p.get(k)
json.dump({"zrodla": "Główny Urząd Geodezji i Kartografii (Numeryczny Model Terenu, BDOT10k), Generalna Dyrekcja Ochrony Środowiska (formy ochrony przyrody), Bank Danych o Lasach (Lasy Państwowe)", "g": out},
          open(os.path.join(D, "ciekawostki.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(out))
