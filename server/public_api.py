# -*- coding: utf-8 -*-
"""Publiczny serwer MVT/API + frontend docs/. Dane: gisss.egib.dzialki.
Start: start.bat
Mapa: http://127.0.0.1:5001/
"""
import json, os, threading, contextlib, re
from pathlib import Path
import psycopg
from flask import Flask, Response, request, abort

DSN = os.environ.get("PLOTS_DSN", "postgresql://postgres@localhost/gisss")
MINZ = int(os.environ.get("PLOTS_MINZ", "13"))
PORT = int(os.environ.get("PLOTS_PORT", "5001"))
_SEM = threading.BoundedSemaphore(int(os.environ.get("PLOTS_CONCURRENCY", "6")))
GRUPY = json.loads("""{
    "1": "Skarb Pa\u0144stwa (bez u\u017cytkownik\u00f3w wieczystych)",
    "2": "Skarb Pa\u0144stwa (ze zbiegiem u\u017cytkownik\u00f3w wieczystych)",
    "3": "Jednoosobowe sp\u00f3\u0142ki Skarbu Pa\u0144stwa, przedsi\u0119biorstwa pa\u0144stwowe i pa\u0144stwowe osoby prawne",
    "4": "Gminy i zwi\u0105zki mi\u0119dzygminne lub metropolitalne (bez u\u017cytkownik\u00f3w wieczystych)",
    "5": "Gminy i zwi\u0105zki mi\u0119dzygminne lub metropolitalne (ze zbiegiem u\u017cytkownik\u00f3w wieczystych)",
    "6": "Jednoosobowe sp\u00f3\u0142ki jednostek samorz\u0105du terytorialnego oraz inne osoby prawne samorz\u0105du",
    "7": "Osoby fizyczne",
    "8": "Sp\u00f3\u0142dzielnie",
    "9": "Ko\u015bcio\u0142y i zwi\u0105zki wyznaniowe",
    "10": "Wsp\u00f3lnoty gruntowe",
    "11": "Powiaty i zwi\u0105zki powiat\u00f3w (bez u\u017cytkownik\u00f3w wieczystych)",
    "12": "Powiaty i zwi\u0105zki powiat\u00f3w (ze zbiegiem u\u017cytkownik\u00f3w wieczystych)",
    "13": "Wojew\u00f3dztwa (bez u\u017cytkownik\u00f3w wieczystych)",
    "14": "Wojew\u00f3dztwa (ze zbiegiem u\u017cytkownik\u00f3w wieczystych)",
    "15": "Sp\u00f3\u0142ki prawa handlowego",
    "16": "Inne podmioty niewymienione w grupach 1\u201315"
}""")

TILE_SQL = """
WITH b AS (SELECT ST_TileEnvelope(%(z)s,%(x)s,%(y)s) e)
SELECT ST_AsMVT(q, 'dzialki', 4096, 'g') FROM (
  SELECT d.id_dzialki, d.numer_dzialki, d.obreb, d.nazwa_obrebu, d.pole_ewid,
         d.grupa_rej, d.klasouzytki, d.data_zrodla,
         CASE WHEN d.grupa_rej ~ '^[0-9]{1,2}' THEN (regexp_match(d.grupa_rej, '^[0-9]{1,2}'))[1] ELSE 'brak' END AS g1,
         ST_AsMVTGeom(ST_Transform(d.geom,3857), b.e, 4096, 64, true) g
  FROM egib.dzialki d, b
  WHERE d.geom && ST_Transform(b.e, 2180)
) q WHERE g IS NOT NULL
"""

app = Flask(__name__)
_DOCS = Path(__file__).resolve().parent.parent / "docs"

class Pool:
    @contextlib.contextmanager
    def connection(self):
        with _SEM, psycopg.connect(DSN, autocommit=True, options="-c statement_timeout=20000") as c:
            yield c
POOL = Pool()

@app.after_request
def after(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp

@app.route("/tiles/<int:z>/<int:x>/<int:y>.pbf", methods=["GET", "OPTIONS"])
def tile(z, x, y):
    if request.method == "OPTIONS":
        return Response(status=204)
    if z < MINZ or z > 22:
        return Response(b"", mimetype="application/x-protobuf")
    with POOL.connection() as c:
        b = c.execute(TILE_SQL, {"z": z, "x": x, "y": y}).fetchone()[0]
    return Response(bytes(b or b""), mimetype="application/x-protobuf",
                    headers={"Cache-Control": "public, max-age=300"})

def enrich(d):
    g = d.get("grupa_rej") or ""
    nums = re.findall(r"[0-9]{1,2}", g)
    labels = ["Grupa %s: %s" % (n, GRUPY[n]) for n in nums if n in GRUPY]
    d["grupa_opis"] = "; ".join(labels) if labels else (None if not g else "Grupa %s" % g)
    d["grupy"] = [{"nr": n, "opis": GRUPY[n]} for n in nums if n in GRUPY]
    return d

@app.get("/api/grupy")
def grupy():
    return Response(json.dumps({"zrodlo": "rozporzadzenie EGiB §14", "grupy": GRUPY}, ensure_ascii=False),
                    mimetype="application/json; charset=utf-8")

@app.get("/api/dzialka")
def dzialka():
    i = request.args.get("id", "").strip()
    if not i:
        abort(400)
    with POOL.connection() as c:
        r = c.execute("""SELECT id_dzialki, numer_dzialki, obreb, nazwa_obrebu, pole_ewid, grupa_rej, klasouzytki, data_zrodla,
            ST_XMin(e), ST_YMin(e), ST_XMax(e), ST_YMax(e)
            FROM egib.dzialki, LATERAL (SELECT ST_Transform(geom,4326)::box2d e) x
            WHERE id_dzialki=%s""", (i,)).fetchone()
    if not r:
        abort(404)
    k = ["id_dzialki","numer_dzialki","obreb","nazwa_obrebu","pole_ewid","grupa_rej","klasouzytki","data_zrodla"]
    d = dict(zip(k, r[:8])); d["bbox"] = [[r[8], r[9]], [r[10], r[11]]]
    return Response(json.dumps(enrich(d), default=str, ensure_ascii=False), mimetype="application/json; charset=utf-8")

@app.get("/api/at")
def at_point():
    try:
        lon = float(request.args["lon"]); lat = float(request.args["lat"])
    except (KeyError, ValueError):
        abort(400)
    with POOL.connection() as c:
        r = c.execute("""SELECT id_dzialki, numer_dzialki, obreb, nazwa_obrebu, pole_ewid, grupa_rej, klasouzytki, data_zrodla,
            ST_XMin(e), ST_YMin(e), ST_XMax(e), ST_YMax(e)
            FROM egib.dzialki, LATERAL (SELECT ST_Transform(geom,4326)::box2d e) x
            WHERE ST_Intersects(geom, ST_Transform(ST_SetSRID(ST_MakePoint(%s,%s),4326),2180))
            ORDER BY ST_Area(geom) ASC LIMIT 1""", (lon, lat)).fetchone()
    if not r:
        abort(404)
    k = ["id_dzialki","numer_dzialki","obreb","nazwa_obrebu","pole_ewid","grupa_rej","klasouzytki","data_zrodla"]
    d = dict(zip(k, r[:8])); d["bbox"] = [[r[8], r[9]], [r[10], r[11]]]
    return Response(json.dumps(enrich(d), default=str, ensure_ascii=False), mimetype="application/json; charset=utf-8")

@app.get("/health")
def health():
    return {"ok": True, "minzoom": MINZ, "port": PORT}

@app.get("/")
def index():
    p = _DOCS / "index.html"
    if not p.is_file():
        return {"ok": True, "port": PORT, "hint": "Brak docs/"}
    return Response(p.read_bytes(), mimetype="text/html; charset=utf-8")

@app.get("/config.js")
@app.get("/grupy.js")
@app.get("/app.js")
@app.get("/index.html")
def frontend_asset():
    name = request.path.rsplit("/", 1)[-1]
    p = _DOCS / name
    if not p.is_file():
        abort(404)
    mime = "text/html; charset=utf-8" if name.endswith(".html") else "application/javascript; charset=utf-8"
    return Response(p.read_bytes(), mimetype=mime)

if __name__ == "__main__":
    print("PLOTS mapa+API  http://127.0.0.1:%s/  (PostGIS %s)" % (PORT, DSN.split("@")[-1]))
    app.run(host="0.0.0.0", port=PORT, threaded=True)
