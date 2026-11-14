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
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
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

@app.get("/api/adres-punkt")
def api_adres_punkt():
    try:
        lon, lat = float(request.args["lon"]), float(request.args["lat"])
        if not (-180 <= lon <= 180 and -85 <= lat <= 85):
            abort(400)
    except (KeyError, ValueError):
        abort(400)
    meta = _adr_meta()
    geom = _sql.Identifier(meta["geom"])
    g2180 = _adr_geom(meta, 2180)
    stmt = _sql.SQL("""WITH p AS (SELECT ST_Transform(ST_SetSRID(ST_MakePoint(%s,%s),4326),2180) g)
        SELECT {sel}, ST_X({out}) lon, ST_Y({out}) lat
        FROM {table},p WHERE {geom} && ST_Transform(ST_Expand(p.g,3),{srid})
        AND ST_DWithin({g2180},p.g,3) ORDER BY ST_Distance({g2180},p.g) LIMIT 1""").format(
        sel=_adr_select_list(meta),out=_adr_geom(meta,4326),table=_sql.Identifier(ADR_SCHEMA,ADR_TABLE),
        geom=geom,srid=_sql.Literal(meta["srid"]),g2180=g2180)
    with POOL.connection() as c:
        cursor=c.execute(stmt,(lon,lat));row=cursor.fetchone()
        value=dict(zip([col.name for col in cursor.description],row)) if row else None
    address=", ".join(filter(None,[" ".join(str(value.get(k) or "") for k in ("ulica","numer")).strip(),str(value.get("miejscowosc") or "")])) if value else None
    return Response(json.dumps({"address":address,"point":value},default=str,ensure_ascii=False),mimetype="application/json")

@app.get("/api/adresy/meta")
def api_adresy_meta():
    try:
        return _adr_meta()
    except Exception as e:
        return {"error": str(e)}, 503

# ---------- Spis 2021: obwody spisowe (gisss spis.obwody_2021) ----------
SPIS_TILE_SQL = """
WITH b AS (SELECT ST_TileEnvelope(%(z)s,%(x)s,%(y)s) e), b2 AS (SELECT ST_Transform(e,2180) e2 FROM b)
SELECT ST_AsMVT(q, 'spis', 4096, 'g') FROM (
  SELECT o.id, o.lud, round(o.gestosc)::int AS gest, o.p_senior, o.p_dzieci, o.p_70,
         ST_AsMVTGeom(ST_Transform(ST_SimplifyPreserveTopology(o.geom, %(tol)s),3857), b.e, 4096, 16, true) g
  FROM spis.obwody_2021 o, b, b2
  WHERE o.geom && b2.e2 AND o.lud IS NOT NULL
) q WHERE g IS NOT NULL
"""

@app.route("/tiles/spis/<int:z>/<int:x>/<int:y>.pbf", methods=["GET", "OPTIONS"])
def tile_spis(z, x, y):
    if request.method == "OPTIONS":
        return Response(status=204)
    if z < 8 or z > 22:
        return Response(b"", mimetype="application/x-protobuf")
    tol = max(0.0, 40075016 / (4096 * 2 ** z) * 0.5)
    with POOL.connection() as c:
        b = c.execute(SPIS_TILE_SQL, {"z": z, "x": x, "y": y, "tol": tol}).fetchone()[0]
    return Response(bytes(b or b""), mimetype="application/x-protobuf",
                    headers={"Cache-Control": "public, max-age=86400"})

@app.get("/api/ludnosc")
def api_ludnosc():
    """Residents around a point: census districts weighted by the share of their area inside each circle."""
    try:
        lon, lat = float(request.args["lon"]), float(request.args["lat"])
    except (KeyError, ValueError):
        return {"error": "lon, lat"}, 400
    out = {}
    with POOL.connection() as c:
        for r in (500, 1000, 3000):
            row = c.execute("""
              WITH p AS (SELECT ST_Buffer(ST_Transform(ST_SetSRID(ST_MakePoint(%(lon)s,%(lat)s),4326),2180), %(r)s, 32) g)
              SELECT sum(o.lud * f), sum(o.w0*f), sum(o.w10*f), sum(o.w20*f), sum(o.w30*f), sum(o.w40*f), sum(o.w50*f), sum(o.w60*f), sum(o.w70*f), sum(o.w80*f)
              FROM (SELECT o.*, ST_Area(ST_Intersection(o.geom, p.g)) / NULLIF(ST_Area(o.geom),0) f FROM spis.obwody_2021 o, p WHERE o.geom && p.g AND ST_Intersects(o.geom, p.g) AND o.lud IS NOT NULL) o
            """, {"lon": lon, "lat": lat, "r": r}).fetchone()
            out[str(r)] = {"lud": round(float(row[0] or 0)), "wiek": [round(float(v or 0)) for v in row[1:]]}
    return {"r": out, "source": "GUS, Narodowy Spis Powszechny 2021 (obwody spisowe)"}

# ---------- Lasy (Bank Danych o Lasach), pozwolenia (GUNB RWDZ), teren w punkcie ----------
LASY_TILE_SQL = """
WITH b AS (SELECT ST_TileEnvelope(%(z)s,%(x)s,%(y)s) e), b2 AS (SELECT ST_Transform(e,2180) e2 FROM b)
SELECT ST_AsMVT(q, 'lasy', 4096, 'g') FROM (
  SELECT split_part(coalesce(w.species_cd,''),'.',1) AS gat, w.spec_age AS wiek, w.forest_fun AS fun,
         ST_AsMVTGeom(ST_Transform(ST_SimplifyPreserveTopology(w.geom, %(tol)s),3857), b.e, 4096, 16, true) g
  FROM lasy.wydzielenia w, b, b2
  WHERE w.geom && b2.e2 AND w.area_type = 'D-STAN'
) q WHERE g IS NOT NULL
"""
GUNB_TILE_SQL = """
WITH b AS (SELECT ST_TileEnvelope(%(z)s,%(x)s,%(y)s) e), b2 AS (SELECT ST_Transform(e,2180) e2 FROM b)
SELECT ST_AsMVT(q, 'gunb', 4096, 'g') FROM (
  SELECT w.typ, w.kategoria AS kat, extract(year from w.data_wplywu)::int AS rok, w.zamierzenie AS zam,
         left(w.opis, 140) AS opis,
         ST_AsMVTGeom(ST_Transform(w.geom,3857), b.e, 4096, 16, true) g
  FROM gunb.wnioski w, b, b2
  WHERE w.geom && b2.e2 AND w.data_wplywu >= %(od)s
    AND (w.zamierzenie ILIKE 'budowa%%' OR w.zamierzenie ILIKE 'rozbudowa%%' OR w.zamierzenie ILIKE 'nadbudowa%%')
    AND w.kategoria NOT IN ('XXVI','XXV','VIII')
) q WHERE g IS NOT NULL
"""

def _mvt(sql, params, name_cache=3600):
    with POOL.connection() as c:
        b = c.execute(sql, params).fetchone()[0]
    return Response(bytes(b or b""), mimetype="application/x-protobuf", headers={"Cache-Control": f"public, max-age={name_cache}"})

@app.route("/tiles/lasy/<int:z>/<int:x>/<int:y>.pbf", methods=["GET", "OPTIONS"])
def tile_lasy(z, x, y):
    if request.method == "OPTIONS": return Response(status=204)
    if z < 11 or z > 22: return Response(b"", mimetype="application/x-protobuf")
    return _mvt(LASY_TILE_SQL, {"z": z, "x": x, "y": y, "tol": 40075016 / (4096 * 2 ** z) * 0.5}, 86400)

@app.route("/tiles/gunb/<int:z>/<int:x>/<int:y>.pbf", methods=["GET", "OPTIONS"])
def tile_gunb(z, x, y):
    if request.method == "OPTIONS": return Response(status=204)
    if z < 12 or z > 22: return Response(b"", mimetype="application/x-protobuf")
    od = request.args.get("od", "2021-01-01")
    if not re.match(r"^\d{4}-\d\d-\d\d$", od): od = "2021-01-01"
    return _mvt(GUNB_TILE_SQL, {"z": z, "x": x, "y": y, "od": od}, 3600)

def _pig_identify(url, lon, lat, extra):
    import urllib.request, urllib.parse
    sr = extra.pop("sr", 4326)
    q = {"geometry": json.dumps({"x": lon, "y": lat, "spatialReference": {"wkid": sr}}), "geometryType": "esriGeometryPoint", "sr": sr, "f": "json"}
    q.update(extra)
    try:
        with urllib.request.urlopen(urllib.request.Request(url + "?" + urllib.parse.urlencode(q), headers={"User-Agent": "plots/1.0"}), timeout=8) as r:
            return json.loads(r.read())
    except Exception:
        return None

@app.get("/api/teren")
def api_teren():
    """Everything known about the ground at a point: forest stand, mining area / deposit, ground motion, landslides,
    shallow geothermal conditions, traffic on the nearest national road and recent building permits nearby."""
    try:
        lon, lat = float(request.args["lon"]), float(request.args["lat"])
    except (KeyError, ValueError):
        return {"error": "lon, lat"}, 400
    out = {}
    P = {"lon": lon, "lat": lat}
    pt = "ST_Transform(ST_SetSRID(ST_MakePoint(%(lon)s,%(lat)s),4326),2180)"
    with POOL.connection() as c:
        r = c.execute(f"""SELECT species_cd, spec_age, forest_fun, site_type, prot_categ, sub_area, adr_for, a_year, nazwa FROM lasy.wydzielenia
                          WHERE geom && {pt} AND ST_Intersects(geom, {pt}) ORDER BY sub_area LIMIT 1""", P).fetchone()
        if r: out["las"] = dict(zip(["gatunek", "wiek", "funkcja", "siedlisko", "ochronnosc", "pow_ha", "adres", "rok", "nadlesnictwo"], [str(v) if v is not None else None for v in r]))
        r = c.execute(f"""SELECT species_cd, spec_age, ST_Distance(geom, {pt}) FROM lasy.wydzielenia WHERE area_type='D-STAN' AND ST_DWithin(geom, {pt}, 3000) ORDER BY geom <-> {pt} LIMIT 1""", P).fetchone()
        if r: out["las_najblizszy"] = {"gatunek": r[0], "wiek": r[1], "m": round(r[2])}
        out["tereny_gornicze"] = [dict(zip(["nazwa", "kopalina", "status", "zloze"], r)) for r in c.execute(
            f"SELECT nazwa_tg, kopalina, status, nazwa_zloza FROM pig.midas_tereny WHERE geom && {pt} AND ST_Intersects(geom, {pt}) LIMIT 3", P).fetchall()]
        out["zloza"] = [dict(zip(["nazwa", "kopalina"], r)) for r in c.execute(
            f"SELECT nazwa_zl, kopalina FROM pig.midas_zloza WHERE geom && {pt} AND ST_Intersects(geom, {pt}) LIMIT 3", P).fetchall()]
        r = c.execute(f"""SELECT nrdrogi, nazwa_odc, sdrr2025, ST_Distance(geom, {pt}) FROM gpr.dk2025 WHERE ST_DWithin(geom, {pt}, 1500)
                          ORDER BY geom <-> {pt} LIMIT 1""", P).fetchone()
        if r: out["ruch"] = {"droga": r[0], "odcinek": r[1], "sdrr": r[2], "m": round(r[3]), "rok": 2025}
        rows = c.execute(f"""SELECT typ, kategoria, zamierzenie, left(opis,160), data_wplywu, round(ST_Distance(geom, {pt})) FROM gunb.wnioski
                             WHERE ST_DWithin(geom, {pt}, 500) AND data_wplywu >= now() - interval '3 years'
                               AND (zamierzenie ILIKE 'budowa%%' OR zamierzenie ILIKE 'rozbudowa%%' OR zamierzenie ILIKE 'nadbudowa%%') AND kategoria NOT IN ('XXVI','XXV','VIII')
                             ORDER BY data_wplywu DESC LIMIT 60""", P).fetchall()
        out["pozwolenia"] = [{"typ": r[0], "kat": r[1], "zam": r[2], "opis": r[3], "data": r[4].isoformat() if r[4] else None, "m": int(r[5])} for r in rows]
    B = "https://cbdgmapa.pgi.gov.pl/arcgis/rest/services"
    import math
    mx, my = lon * 20037508.34 / 180, math.log(math.tan((90 + lat) * math.pi / 360)) * 6378137
    e = _pig_identify(B + "/geozagrozenia/egms_2016_2020_pion_interpol/ImageServer/identify", mx, my, {"returnGeometry": "false", "sr": 3857})
    try: out["egms"] = float(e["value"])
    except Exception: out["egms"] = None
    o = _pig_identify(B + "/geozagrozenia/sopo_obszary/MapServer/identify", lon, lat,
                      {"layers": "all:14,12", "tolerance": 2, "mapExtent": f"{lon-0.01},{lat-0.01},{lon+0.01},{lat+0.01}", "imageDisplay": "400,400,96", "returnGeometry": "false"})
    out["osuwiska"] = [{"warstwa": x.get("layerName"), "aktywnosc": (x.get("attributes") or {}).get("Stopień aktywności")} for x in (o or {}).get("results", [])][:3]
    g = _pig_identify(B + "/geotermia/mpgn/MapServer/identify", lon, lat,
                      {"layers": "all:7", "tolerance": 0, "mapExtent": f"{lon-0.01},{lat-0.01},{lon+0.01},{lat+0.01}", "imageDisplay": "400,400,96", "returnGeometry": "false"})
    out["geotermia"] = [{k: v for k, v in (x.get("attributes") or {}).items() if k not in ("OBJECTID", "Shape", "SHAPE", "Shape.STArea()", "Shape.STLength()")} for x in (g or {}).get("results", [])][:1]
    return out

# ---------- EGMS: ruch pionowy 2016-2020 (Copernicus, raster 150 m z PIG-PIB) jako kafelki PNG ----------
_EGMS = {}
def _egms():
    if "a" not in _EGMS:
        import numpy as np
        from pyproj import Transformer
        path = os.environ.get("PLOTS_EGMS", r"C:\Users\kompu\Documents\mapgen\egms\egms_pion_150m.npy")
        a = np.load(path)
        # colour lookup: index = value + 128
        lut = np.zeros((256, 4), np.uint8)
        for v in range(-128, 128):
            if v == -128: continue
            c = ((127,0,0) if v <= -20 else (179,0,0) if v <= -10 else (215,48,31) if v <= -5 else (252,141,89) if v <= -3 else
                 (253,204,138) if v <= -2 else None if v < 2 else (158,202,225) if v < 3 else (33,113,181))
            if c: lut[v + 128] = (*c, 215)
        _EGMS.update(a=a, lut=lut, tr=Transformer.from_crs(3857, 2180, always_xy=True), np=np)
    return _EGMS

@app.route("/tiles/egms/<int:z>/<int:x>/<int:y>.png", methods=["GET", "OPTIONS"])
def tile_egms(z, x, y):
    if request.method == "OPTIONS": return Response(status=204)
    import io as _io
    from PIL import Image
    E = _egms(); np = E["np"]; a = E["a"]
    n = 2 ** z; R = 20037508.342789244; size = 2 * R / n
    xs = -R + (x + (np.arange(256) + .5) / 256) * size; ys = R - (y + (np.arange(256) + .5) / 256) * size
    X, Y = np.meshgrid(xs, ys)
    ex, ey = E["tr"].transform(X.ravel(), Y.ravel())
    c = ((np.asarray(ex) - 140000) // 150).astype(int); r = ((800000 - np.asarray(ey)) // 150).astype(int)
    ok = (c >= 0) & (c < a.shape[1]) & (r >= 0) & (r < a.shape[0])
    v = np.full(c.shape, -128, np.int16); v[ok] = a[r[ok], c[ok]]
    rgba = E["lut"][(v + 128).clip(0, 255)].reshape(256, 256, 4)
    buf = _io.BytesIO(); Image.fromarray(rgba, "RGBA").save(buf, "PNG", optimize=False)
    return Response(buf.getvalue(), mimetype="image/png", headers={"Cache-Control": "public, max-age=604800"})

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
    "address-picking.js", "municipal-boundaries.js", "building-distance-model.js", "distance-module.js", "place-ui.js", "ui-history.js", "icons.js", "icons/phosphor.svg", "icons/PHOSPHOR-LICENSE.txt", "municipality-model.js", "municipality-context.js", "municipality-crests.js",
    "service-places.js", "layer-ui.js",
    "data/municipality-crests.json", "data/municipalities.topojson",

}

_EXTRA_ASSETS.update({"data/crests-extra-20261110.bin","data/crest-verification.json"})
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

from admin_api import register_admin_api
register_admin_api(app, POOL)

if __name__ == "__main__":
    print("PLOTS mapa+API  http://127.0.0.1:%s/  (PostGIS %s)" % (PORT, DSN.split("@")[-1]))
    app.run(host="0.0.0.0", port=PORT, threaded=True)
