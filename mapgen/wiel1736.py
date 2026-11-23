"""Wieland/Schubarth, Principatus Silesiae Rattiboriensis, Homann 1736 (Wikimedia Commons): GCPs from town squares/churches (OSM/Nominatim), poly order 2.
python-qgis.bat wiel1736.py <docs>"""
import json, sys, shutil
from pathlib import Path
from osgeo import gdal, osr
from osgeo_utils import gdal2tiles
gdal.UseExceptions()
SRC = "C:/Users/kompu/Desktop/Dawid/ROBOCZE/Dane/old/igrek_punkty/tychy/WIELAND/Principatus_Silesiae_Rattiboriensis_1736.jpg"
G = [("Gliwice",5377,1016,18.6656,50.2944),("Pilchowice",4561,1952,18.5640,50.2140),("Gierałtowice",5812,1872,18.7360,50.2268),
 ("Zabrze",6175,872,18.7880,50.3048),("Kochłowice",7225,1565,18.9174,50.2496),("Bielszowice",6689,1384,18.8584,50.2788),
 ("Panewniki",7311,1880,18.9478,50.2264),("Mikołów",7156,2624,18.9044,50.1704),("Tychy",7735,3096,18.9818,50.1305),
 ("Lędziny",8679,3184,19.1030,50.1208),("Bieruń",8564,3600,19.0915,50.0930),("Pszczyna",7356,4960,18.9414,49.9777),
 ("Kobiór",7228,3928,18.9428,50.0605),("Żory",5440,4080,18.6984,50.0449),("Suszec",6176,4176,18.7914,50.0296),
 ("Pawłowice",5592,5093,18.7213,49.9645),("Rybnik",4312,3352,18.5419,50.0954),("Wodzisław",3684,4540,18.4619,49.9938),
 ("Marklowice",4065,4324,18.5080,50.0177),("Kuźnia Rac.",2596,2080,18.3060,50.2006)]
H = Path(__file__).resolve().parent; W = H / "work"; W.mkdir(exist_ok=True)
gcps = [gdal.GCP(lo, la, 0, x, y) for _, x, y, lo, la in G]
vrt = W / "wiel1736.vrt"; gdal.Translate(str(vrt), gdal.Open(SRC), format="VRT", GCPs=gcps, outputSRS="EPSG:4326")
ds = gdal.Open(str(vrt)); tr = gdal.Transformer(ds, None, ["METHOD=GCP_POLYNOMIAL", "MAX_GCP_ORDER=2", "DST_SRS=EPSG:4326"])
import math
for n, x, y, lo, la in G:
    _, (plo, pla, _z) = tr.TransformPoint(0, x, y)
    print(f"{n:20s} {math.hypot((plo-lo)*71400,(pla-la)*111200):6.0f} m")
ring = []
X0, Y0, X1, Y1 = 480, 480, 9880, 6725
for t in range(21): ring.append((X0 + (X1 - X0) * t / 20, Y0))
for t in range(21): ring.append((X1, Y0 + (Y1 - Y0) * t / 20))
for t in range(21): ring.append((X1 - (X1 - X0) * t / 20, Y1))
for t in range(21): ring.append((X0, Y1 - (Y1 - Y0) * t / 20))
geo = [list(tr.TransformPoint(0, x, y)[1][:2]) for x, y in ring]; geo.append(geo[0])
cut = W / "wiel1736.geojson"; cut.write_text(json.dumps({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [geo]}}]}))
out = W / "wiel1736.tif"
gdal.Warp(str(out), str(vrt), dstSRS="EPSG:3857", polynomialOrder=2, resampleAlg="cubic", cutlineDSName=str(cut), cropToCutline=True, dstAlpha=True, xRes=9.6, yRes=9.6, creationOptions=["COMPRESS=DEFLATE", "TILED=YES"])
docs = Path(sys.argv[1]); key = "wiel_1736"; dst = docs / "data" / "stare" / "p" / key; shutil.rmtree(dst, ignore_errors=True)
gdal2tiles.main(["gdal2tiles", "--xyz", "-z", "9-13", "-w", "none", "-r", "bilinear", "--tiledriver", "WEBP", "--webp-quality", "75", "--processes", "4", str(out), str(dst)])
xs = [p[0] for p in geo]; ys = [p[1] for p in geo]
ip = docs / "data" / "stare" / "p" / "index.json"; d = json.loads(ip.read_text(encoding="utf-8"))
d[key] = {"z": [9, 13], "bbox": [round(min(xs), 5), round(min(ys), 5), round(max(xs), 5), round(max(ys), 5)], "pliki": [Path(SRC).name]}
ip.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8"); print("ok", d[key]["bbox"])
