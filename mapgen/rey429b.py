"""Reymann 429 Ratibor ca 1850 (GCPs moved from the 1830 sheet by phase correlation) + mosaic with 192 Krakau: GCPs from town squares/churches (OSM/Nominatim), poly order 2.
python-qgis.bat rey429b.py <docs>"""
import json, sys, shutil
from pathlib import Path
from osgeo import gdal, osr
from osgeo_utils import gdal2tiles
gdal.UseExceptions()
SRC = "C:/Users/kompu/Desktop/Dawid/ROBOCZE/Dane/old/igrek_punkty/tychy/REYMANN200/Reymanns_Special-Karte_429_(191)_Ratibor_ca_1850_nHSd7sh_BN_Sygn._ZZK_S-5_177_A.jpg"
G = [("Racibórz", 2522, 3285, 18.2193, 50.0919), ("Rybnik", 5361, 3054, 18.5419, 50.0954), ("Żory", 6731, 3694, 18.6984, 50.0449),
     ("Mikołów", 8366, 1907, 18.9044, 50.1704), ("Wodzisław", 4793, 4403, 18.4619, 49.9938), ("Hlučín", 2483, 6016, 18.1914, 49.8968),
     ("Kietrz", 673, 3649, 18.0062, 50.0811), ("Sośnicowice", 5037, 722, 18.5379, 50.2725), ("Bohumín", 3731, 5610, 18.3350, 49.9180)]
H = Path(__file__).resolve().parent; W = H / "work"; W.mkdir(exist_ok=True)
gcps = [gdal.GCP(lo, la, 0, x, y) for _, x, y, lo, la in G]
vrt = W / "rey429b.vrt"; gdal.Translate(str(vrt), gdal.Open(SRC), format="VRT", GCPs=gcps, outputSRS="EPSG:4326")
ds = gdal.Open(str(vrt)); tr = gdal.Transformer(ds, None, ["METHOD=GCP_POLYNOMIAL", "MAX_GCP_ORDER=2", "DST_SRS=EPSG:4326"])
import math
for n, x, y, lo, la in G:
    _, (plo, pla, _z) = tr.TransformPoint(0, x, y)
    print(f"{n:20s} {math.hypot((plo-lo)*71400,(pla-la)*111200):6.0f} m")
ring = []
X0, Y0, X1, Y1 = 669, 644, 8807, 6249
for t in range(21): ring.append((X0 + (X1 - X0) * t / 20, Y0))
for t in range(21): ring.append((X1, Y0 + (Y1 - Y0) * t / 20))
for t in range(21): ring.append((X1 - (X1 - X0) * t / 20, Y1))
for t in range(21): ring.append((X0, Y1 - (Y1 - Y0) * t / 20))
geo = [list(tr.TransformPoint(0, x, y)[1][:2]) for x, y in ring]; geo.append(geo[0])
cut = W / "rey429b.geojson"; cut.write_text(json.dumps({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [geo]}}]}))
out = W / "rey429b.tif"
gdal.Warp(str(out), str(vrt), dstSRS="EPSG:3857", polynomialOrder=2, resampleAlg="cubic", cutlineDSName=str(cut), cropToCutline=True, dstAlpha=True, xRes=9.6, yRes=9.6, creationOptions=["COMPRESS=DEFLATE", "TILED=YES"])
docs = Path(sys.argv[1]); key = "rey200_1850"; dst = docs / "data" / "stare" / "p" / key; shutil.rmtree(dst, ignore_errors=True)
mos = W / "rey1850.vrt"; gdal.BuildVRT(str(mos), [str(out), str(W / "rey430.tif")])
gdal2tiles.main(["gdal2tiles", "--xyz", "-z", "9-13", "-w", "none", "-r", "bilinear", "--tiledriver", "WEBP", "--webp-quality", "75", "--processes", "4", str(mos), str(dst)])
ip = docs / "data" / "stare" / "p" / "index.json"; d = json.loads(ip.read_text(encoding="utf-8")); b0 = d[key]["bbox"]
xs = [p[0] for p in geo]; ys = [p[1] for p in geo]
d[key] = {"z": [9, 13], "bbox": [round(min(min(xs), b0[0]), 5), round(min(min(ys), b0[1]), 5), round(max(max(xs), b0[2]), 5), round(max(max(ys), b0[3]), 5)], "pliki": [Path(SRC).name, "Reymanns_Special-Karte_192_Krakau.jpg"]}
ip.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8"); print("ok", d[key]["bbox"])
