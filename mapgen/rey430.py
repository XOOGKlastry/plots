"""Reymann Special-Karte 192 (430) Krakau, ca 1850: GCPs from town squares/churches (OSM/Nominatim), poly order 2.
python-qgis.bat rey430.py <docs>"""
import json, sys, shutil
from pathlib import Path
from osgeo import gdal, osr
from osgeo_utils import gdal2tiles
gdal.UseExceptions()
SRC = r"C:\Users\kompu\Desktop\Dawid\ROBOCZE\Dane\old\igrek_punkty\tychy\REYMANN200\Reymanns_Special-Karte_192_Krakau.jpg"
G = [("Tychy kościół", 232, 1136, 18.98183, 50.13045), ("Pszczyna rynek", 134, 2566, 18.94135, 49.97770),
     ("Bieruń rynek", 966, 1427, 19.09154, 50.09295), ("Lędziny kościół", 902, 1160, 19.10305, 50.12075),
     ("Oświęcim rynek", 1667, 1827, 19.22139, 50.03815), ("Chrzanów rynek", 2435, 736, 19.40537, 50.14231),
     ("Krzeszowice rynek", 3745, 681, 19.63331, 50.13634), ("Kęty rynek", 1502, 3094, 19.22160, 49.88310),
     ("Andrychów rynek", 2172, 3176, 19.34131, 49.85422), ("Wadowice rynek", 3011, 2912, 19.49310, 49.88360),
     ("Zator rynek", 2838, 2019, 19.43651, 49.99599), ("Skawina rynek", 5012, 1993, 19.82263, 49.97729)]
H = Path(__file__).resolve().parent; W = H / "work"; W.mkdir(exist_ok=True)
gcps = [gdal.GCP(lo, la, 0, x, y) for _, x, y, lo, la in G]
vrt = W / "rey430.vrt"; gdal.Translate(str(vrt), gdal.Open(SRC), format="VRT", GCPs=gcps, outputSRS="EPSG:4326")
ds = gdal.Open(str(vrt)); tr = gdal.Transformer(ds, None, ["METHOD=GCP_POLYNOMIAL", "MAX_GCP_ORDER=2", "DST_SRS=EPSG:4326"])
import math
for n, x, y, lo, la in G:
    _, (plo, pla, _z) = tr.TransformPoint(0, x, y)
    print(f"{n:20s} {math.hypot((plo-lo)*71400,(pla-la)*111200):6.0f} m")
ring = []
X0, Y0, X1, Y1 = 30, 40, 5080, 3790
for t in range(21): ring.append((X0 + (X1 - X0) * t / 20, Y0))
for t in range(21): ring.append((X1, Y0 + (Y1 - Y0) * t / 20))
for t in range(21): ring.append((X1 - (X1 - X0) * t / 20, Y1))
for t in range(21): ring.append((X0, Y1 - (Y1 - Y0) * t / 20))
geo = [list(tr.TransformPoint(0, x, y)[1][:2]) for x, y in ring]; geo.append(geo[0])
cut = W / "rey430.geojson"; cut.write_text(json.dumps({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [geo]}}]}))
out = W / "rey430.tif"
gdal.Warp(str(out), str(vrt), dstSRS="EPSG:3857", polynomialOrder=2, resampleAlg="cubic", cutlineDSName=str(cut), cropToCutline=True, dstAlpha=True, xRes=9.6, yRes=9.6, creationOptions=["COMPRESS=DEFLATE", "TILED=YES"])
docs = Path(sys.argv[1]); key = "rey200_1850"; dst = docs / "data" / "stare" / "p" / key; shutil.rmtree(dst, ignore_errors=True)
gdal2tiles.main(["gdal2tiles", "--xyz", "-z", "9-13", "-w", "none", "-r", "bilinear", "--tiledriver", "WEBP", "--webp-quality", "75", "--processes", "4", str(out), str(dst)])
xs = [p[0] for p in geo]; ys = [p[1] for p in geo]
ip = docs / "data" / "stare" / "p" / "index.json"; d = json.loads(ip.read_text(encoding="utf-8"))
d[key] = {"z": [9, 13], "bbox": [round(min(xs), 5), round(min(ys), 5), round(max(xs), 5), round(max(ys), 5)], "pliki": [Path(SRC).name]}
ip.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8"); print("ok", d[key]["bbox"])
