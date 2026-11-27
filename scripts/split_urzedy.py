"""Dzieli docs/data/urzedy.json na pliki województw docs/data/urzedy/<kod>.json, żeby aplikacja wczytywała tylko jedno (ok. 400 kB zamiast 6,7 MB)."""
import json, os
D = os.path.join(os.path.dirname(__file__), "..", "docs", "data")
src = json.load(open(os.path.join(D, "urzedy.json"), encoding="utf-8"))
os.makedirs(os.path.join(D, "urzedy"), exist_ok=True)
by = {}
for k, u in src["urzedy"].items(): by.setdefault(k[:2], {})[k] = u
for w, u in by.items():
    json.dump({"zrodlo": src["zrodlo"], "zrodloUrl": src["zrodloUrl"], "urzedy": u}, open(os.path.join(D, "urzedy", w + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(by), "województw")
