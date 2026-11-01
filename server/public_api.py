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
         ST_Area(d.geom)::float8 AS powierzchnia_geom_m2,
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
    area = d.get("powierzchnia_geom_m2")
    if area is not None:
        d["powierzchnia_geom_ha"] = area / 10000
        d["powierzchnia_zrodlo"] = "Geometria EGiB, EPSG:2180"
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
            ST_XMin(e), ST_YMin(e), ST_XMax(e), ST_YMax(e),
            ST_Area(geom)::float8
            FROM egib.dzialki, LATERAL (SELECT ST_Transform(geom,4326)::box2d e) x
            WHERE id_dzialki=%s""", (i,)).fetchone()
    if not r:
        abort(404)
    k = ["id_dzialki","numer_dzialki","obreb","nazwa_obrebu","pole_ewid","grupa_rej","klasouzytki","data_zrodla"]
    d = dict(zip(k, r[:8])); d["bbox"] = [[r[8], r[9]], [r[10], r[11]]]
    d["powierzchnia_geom_m2"] = r[12]
    return Response(json.dumps(enrich(d), default=str, ensure_ascii=False), mimetype="application/json; charset=utf-8")

@app.get("/api/at")
def at_point():
    try:
        lon = float(request.args["lon"]); lat = float(request.args["lat"])
    except (KeyError, ValueError):
        abort(400)
    with POOL.connection() as c:
        r = c.execute("""SELECT id_dzialki, numer_dzialki, obreb, nazwa_obrebu, pole_ewid, grupa_rej, klasouzytki, data_zrodla,
            ST_XMin(e), ST_YMin(e), ST_XMax(e), ST_YMax(e),
            ST_Area(geom)::float8
            FROM egib.dzialki, LATERAL (SELECT ST_Transform(geom,4326)::box2d e) x
            WHERE ST_Intersects(geom, ST_Transform(ST_SetSRID(ST_MakePoint(%s,%s),4326),2180))
            ORDER BY ST_Area(geom) ASC LIMIT 1""", (lon, lat)).fetchone()
    if not r:
        abort(404)
    k = ["id_dzialki","numer_dzialki","obreb","nazwa_obrebu","pole_ewid","grupa_rej","klasouzytki","data_zrodla"]
    d = dict(zip(k, r[:8])); d["bbox"] = [[r[8], r[9]], [r[10], r[11]]]
    d["powierzchnia_geom_m2"] = r[12]
    return Response(json.dumps(enrich(d), default=str, ensure_ascii=False), mimetype="application/json; charset=utf-8")


# ---------------- Punkty adresowe (administracja."punktyAdresowe") ----------------
# Introspekcja przy pierwszym uzyciu (DB moze nie byc gotowa przy starcie).
from psycopg import sql as _sql
ADR_SCHEMA = os.environ.get("PLOTS_ADR_SCHEMA", "administracja")
ADR_TABLE = os.environ.get("PLOTS_ADR_TABLE", "punktyAdresowe")
ADR_MINZ = int(os.environ.get("PLOTS_ADR_MINZ", "16"))
_ADR = {"meta": None, "err": None}
_ADR_LOCK = threading.Lock()
_ADR_CANDS = {
    "numer": ["numerporz", "numer", "numerporzadkowy", "numer_porzadkowy", "nr", "numer_adr", "pa_numer", "numerdomu", "numer_domu"],
    "ulica": ["nazwaulc", "ulica", "nazwaulicy", "nazwa_ulicy", "ul_nazwa", "ulica_nazwa", "nazwaglownaczesc", "ul"],
    "miejscowosc": ["nazwamsc", "miejscowosc", "nazwamiejscowosci", "nazwa_miejscowosci", "msc", "miejscowosc_nazwa", "simc_nazwa"],
    "kod": ["kodpoczt", "kodpocztowy", "kod_pocztowy", "kod", "pna"],
    "gmina": ["nazwagmi", "gmina", "nazwagminy", "gmina_nazwa"],
}

def _norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())

def _adr_meta():
    if _ADR["meta"] is not None:
        return _ADR["meta"]
    with _ADR_LOCK:
        if _ADR["meta"] is not None:
            return _ADR["meta"]
        with POOL.connection() as c:
            cols = c.execute("""SELECT column_name, udt_name FROM information_schema.columns
                WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position""",
                (ADR_SCHEMA, ADR_TABLE)).fetchall()
            if not cols:
                raise RuntimeError("Brak tabeli %s.%s" % (ADR_SCHEMA, ADR_TABLE))
            g = c.execute("""SELECT f_geometry_column, srid FROM geometry_columns
                WHERE f_table_schema=%s AND f_table_name=%s LIMIT 1""", (ADR_SCHEMA, ADR_TABLE)).fetchone()
            if g:
                gcol, srid = g[0], int(g[1] or 0)
            else:
                gc = [n for n, u in cols if u == "geometry"]
                if not gc:
                    raise RuntimeError("Brak kolumny geometry w %s.%s" % (ADR_SCHEMA, ADR_TABLE))
                gcol, srid = gc[0], 0
            if not srid:
                try:
                    srid = int(c.execute("SELECT Find_SRID(%s,%s,%s)", (ADR_SCHEMA, ADR_TABLE, gcol)).fetchone()[0] or 0)
                except Exception:
                    srid = 0
            if not srid:
                r = c.execute(_sql.SQL("SELECT ST_SRID({g}) FROM {t} WHERE {g} IS NOT NULL LIMIT 1").format(
                    g=_sql.Identifier(gcol), t=_sql.Identifier(ADR_SCHEMA, ADR_TABLE))).fetchone()
                srid = int(r[0]) if r and r[0] else 2180
        names = [n for n, u in cols if n != gcol and u not in ("geometry", "geography", "bytea")]
        by_norm = {_norm(n): n for n in names}
        mapped = {}
        for key, cands in _ADR_CANDS.items():
            for cnd in cands:
                if cnd in by_norm:
                    mapped[key] = by_norm[cnd]; break
        meta = {"geom": gcol, "srid": srid, "cols": names, "map": mapped}
        _ADR["meta"] = meta
        print("punktyAdresowe:", meta)
        return meta

def _adr_select_list(meta):
    parts = []
    used = set()
    for key, col in meta["map"].items():
        parts.append(_sql.SQL("{c}::text AS {a}").format(c=_sql.Identifier(col), a=_sql.Identifier(key)))
        used.add(key)
    for col in meta["cols"]:
        alias = col if col not in used else col + "_src"
        parts.append(_sql.SQL("{c}::text AS {a}").format(c=_sql.Identifier(col), a=_sql.Identifier(alias)))
        used.add(alias)
    return _sql.SQL(", ").join(parts) if parts else _sql.SQL("NULL::text AS numer")

def _adr_geom(meta, to):
    g = _sql.Identifier(meta["geom"])
    if meta["srid"] == to:
        return g
    return _sql.SQL("ST_Transform({g}, {s})").format(g=g, s=_sql.Literal(to))

@app.route("/tiles/adresy/<int:z>/<int:x>/<int:y>.pbf", methods=["GET", "OPTIONS"])
def tile_adresy(z, x, y):
    if request.method == "OPTIONS":
        return Response(status=204)
    if z < ADR_MINZ or z > 22:
        return Response(b"", mimetype="application/x-protobuf")
    try:
        meta = _adr_meta()
    except Exception as e:
        _ADR["err"] = str(e)
        return Response(b"", mimetype="application/x-protobuf", headers={"X-Adresy-Error": str(e)[:200]})
    q = _sql.SQL("""WITH b AS (SELECT ST_TileEnvelope(%(z)s,%(x)s,%(y)s) e)
        SELECT ST_AsMVT(q, 'adresy', 4096, 'g') FROM (
          SELECT {sel}, ST_AsMVTGeom({g3857}, b.e, 4096, 16, true) g
          FROM {t}, b
          WHERE {g} && ST_Transform(b.e, {srid})
        ) q WHERE g IS NOT NULL""").format(
        sel=_adr_select_list(meta), g3857=_adr_geom(meta, 3857),
        t=_sql.Identifier(ADR_SCHEMA, ADR_TABLE), g=_sql.Identifier(meta["geom"]),
        srid=_sql.Literal(meta["srid"]))
    with POOL.connection() as c:
        b = c.execute(q, {"z": z, "x": x, "y": y}).fetchone()[0]
    return Response(bytes(b or b""), mimetype="application/x-protobuf",
                    headers={"Cache-Control": "public, max-age=600"})

@app.get("/api/adres")
def api_adres():
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        abort(400)
    try:
        meta = _adr_meta()
    except Exception as e:
        return Response(json.dumps({"wyniki": [], "error": str(e)}, ensure_ascii=False),
                        mimetype="application/json; charset=utf-8")
    m = meta["map"]
    fields = [m[k] for k in ("ulica", "numer", "kod", "miejscowosc") if k in m]
    if not fields:
        return Response(json.dumps({"wyniki": [], "error": "brak kolumn adresowych"}, ensure_ascii=False),
                        mimetype="application/json; charset=utf-8")
    hay = _sql.SQL("concat_ws(' ', {})").format(_sql.SQL(", ").join(_sql.Identifier(f) for f in fields))
    toks = [t for t in re.split(r"[\s,]+", q) if t][:6]
    conds = _sql.SQL(" AND ").join(
        _sql.SQL("(") + _sql.SQL(" OR ").join(_sql.SQL("lower({f}) LIKE {p}").format(f=_sql.Identifier(f), p=_sql.Literal("%" + t.lower() + "%")) for f in fields) + _sql.SQL(")")
        for t in toks)
    numcol = m.get("numer")
    order = _sql.SQL("length({h})").format(h=hay)
    g4326 = _adr_geom(meta, 4326)
    stmt = _sql.SQL("""SELECT {sel}, ST_X({g}) lon, ST_Y({g}) lat FROM {t}
        WHERE {conds} ORDER BY {order} LIMIT 10""").format(
        sel=_adr_select_list(meta), g=g4326, t=_sql.Identifier(ADR_SCHEMA, ADR_TABLE),
        conds=conds, order=order)
    with POOL.connection() as c:
        cur = c.execute(stmt)
        names = [d.name for d in cur.description]
        rows = [dict(zip(names, r)) for r in cur.fetchall()]
    for r in rows:
        r["adres"] = " ".join(x for x in [r.get("ulica"), r.get("numer")] if x) + \
            ((", " + " ".join(x for x in [r.get("kod"), r.get("miejscowosc")] if x)) if (r.get("kod") or r.get("miejscowosc")) else "")
    return Response(json.dumps({"wyniki": rows}, default=str, ensure_ascii=False),
                    mimetype="application/json; charset=utf-8")

@app.get("/api/adresy/meta")
def api_adresy_meta():
    try:
        return _adr_meta()
    except Exception as e:
        return {"error": str(e)}, 503

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
@app.get("/gminy.js")
@app.get("/gminy-model.js")
@app.get("/style.css")
@app.get("/design.css")
@app.get("/index.html")
def frontend_asset():
    name = request.path.rsplit("/", 1)[-1]
    p = _DOCS / name
    if not p.is_file():
        abort(404)
    mime = "text/html; charset=utf-8" if name.endswith(".html") else "text/css; charset=utf-8" if name.endswith(".css") else "application/javascript; charset=utf-8"
    return Response(p.read_bytes(), content_type=mime)


@app.get("/data/gminy.json")
def municipality_data() -> Response:
    """Serve the pinned municipality snapshot without opening a database connection."""
    path = _DOCS / "data" / "gminy.json"
    if not path.is_file():
        abort(404)
    return Response(path.read_bytes(), content_type="application/json; charset=utf-8",
                    headers={"Cache-Control": "public, max-age=3600"})


@app.get("/styles/map-light.json")
@app.get("/styles/map-dark.json")
def map_style_asset() -> Response:
    """Serve only the two reviewed map styles, never arbitrary filesystem paths."""
    path = _DOCS / "styles" / request.path.rsplit("/", 1)[-1]
    if not path.is_file():
        abort(404)
    return Response(path.read_bytes(), content_type="application/json; charset=utf-8")


# Closed asset list: new mobile/data modules are served without exposing arbitrary paths.
_EXTRA_ASSETS = {
    "planning.js", "surroundings-model.js", "surroundings.js", "gus-client.js", "mobile.js", "sw.js", "parcel-model.js", "indicator-model.js", "access-model.js", "address-access.js",
    "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable.png",
    "data/map-services.json", "data/surroundings.json", "data/gus-catalog.json", "data/bdl-units.json", "data/gus-population.json",
    "icons.js", "icons/phosphor.svg", "icons/PHOSPHOR-LICENSE.txt", "municipality-model.js", "municipality-context.js", "municipality-crests.js",
    "isochrone-model.js", "service-places.js", "layer-ui.js", "vendor/polygon-clipping.js", "vendor/POLYGON-CLIPPING-LICENSE.md",
    "data/municipality-crests.json", "data/municipalities.topojson",

}

_EXTRA_ASSETS.update("data/crests-" + code + ".bin" for code in ["02","04","06","08","10","12","14","16","18","20","22","24","26","28","30","32"])

@app.get("/<path:asset_path>")
def extra_frontend_asset(asset_path: str) -> Response:
    """Serve reviewed PWA and catalog assets; reject all other paths."""
    if asset_path not in _EXTRA_ASSETS:
        abort(404)
    path = _DOCS / asset_path
    if not path.is_file():
        abort(404)
    suffix = path.suffix
    content_type = {".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
                    ".webmanifest": "application/manifest+json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".bin": "application/octet-stream", ".topojson": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8"}[suffix]
    headers = {"Cache-Control": "no-cache"} if asset_path == "sw.js" else {}
    return Response(path.read_bytes(), content_type=content_type, headers=headers)

if __name__ == "__main__":
    print("PLOTS mapa+API  http://127.0.0.1:%s/  (PostGIS %s)" % (PORT, DSN.split("@")[-1]))
    app.run(host="0.0.0.0", port=PORT, threaded=True)
