"""Minimal OGC WMS 1.3.0 (and 1.1.1) for a few gisss layers: GetCapabilities and GetMap, drawn with Pillow from PostGIS.

Only layers whose licence allows republishing are served:
  siec_wn            high and extra-high voltage lines (OpenStreetMap 2023, ODbL)
  gpz                high-voltage substations (OpenStreetMap 2023, ODbL)
  wiatr_dostepnosc   areas left for wind turbines after statutory exclusions (own analysis, CC BY 4.0)
  oze_miejsca        renewable investment sites in POG zones (own analysis, CC BY 4.0)
Layer names are public identifiers, not database table names.
Supported CRS: EPSG:3857, EPSG:2180, EPSG:4326, CRS:84. In WMS 1.3.0 EPSG:4326 and EPSG:2180 use northing-first axis order.
"""
import io
from xml.sax.saxutils import escape
from flask import Response, request

LAYERS = {
    "siec_wn": {
        "title": "Linie elektroenergetyczne 110 kV i wyższe", "abstract": "Przebieg linii wysokiego i najwyższego napięcia według OpenStreetMap, stan 2023. Kolor: 110 kV, 220 kV, 400 kV.",
        "attr": "© OpenStreetMap contributors, ODbL", "lic": "https://opendatacommons.org/licenses/odbl/",
        "sql": """SELECT ST_AsBinary(ST_Transform(ST_Simplify(geom, %(tol)s), %(srid)s)), kv FROM (SELECT geom,
                    (SELECT max(v::int) FROM unnest(string_to_array(voltage, ';')) v WHERE v ~ '^[0-9]+$') / 1000 AS kv
                  FROM elektro.siec_wysoka_najwyzsza_2023 WHERE geom && ST_Transform(ST_MakeEnvelope(%(x0)s,%(y0)s,%(x1)s,%(y1)s,%(srid)s),2180)) l WHERE kv >= 110""",
        "style": lambda kv: {"line": (124, 58, 237, 255) if (kv or 0) >= 380 else (220, 38, 38, 255) if (kv or 0) >= 200 else (234, 88, 12, 255), "w": 2.2 if (kv or 0) >= 200 else 1.5}},
    "gpz": {
        "title": "Stacje elektroenergetyczne WN (GPZ)", "abstract": "Główne punkty zasilające według OpenStreetMap, stan 2023.",
        "attr": "© OpenStreetMap contributors, ODbL", "lic": "https://opendatacommons.org/licenses/odbl/",
        "sql": """SELECT ST_AsBinary(ST_Transform(ST_PointOnSurface(geom), %(srid)s)), NULL FROM elektro.gpz_2023
                  WHERE geom && ST_Transform(ST_MakeEnvelope(%(x0)s,%(y0)s,%(x1)s,%(y1)s,%(srid)s),2180)""",
        "style": lambda _: {"pt": (17, 24, 39, 255), "fill": (255, 255, 255, 255), "r": 4}},
    "wiatr_dostepnosc": {
        "title": "Obszary dostępne dla elektrowni wiatrowych", "abstract": "Obliczenia własne: obszar poza wyłączeniami ustawy o inwestycjach w elektrownie wiatrowe (t.j. Dz.U. 2024 poz. 317), kolor ciemnozielony: także poza strefami z wytycznych środowiskowych, kolor oliwkowy: dopuszczalne według ustawy, ale w strefie wytycznych (las z pasem 200 m, wody, użytki ekologiczne, zespoły przyrodniczo-krajobrazowe). Dane: BDOT10k, GDOŚ, PSE.",
        "attr": "Obliczenia własne na danych GUGiK (BDOT10k) i GDOŚ", "lic": "https://creativecommons.org/licenses/by/4.0/deed.pl",
        "sql": """SELECT ST_AsBinary(ST_Transform(ST_SimplifyPreserveTopology(geom, %(tol)s), %(srid)s)), klasa FROM wiatr_dostepnosc.dostepne
                  WHERE geom && ST_Transform(ST_MakeEnvelope(%(x0)s,%(y0)s,%(x1)s,%(y1)s,%(srid)s),2180)""",
        "style": lambda k: {"fill": (46, 125, 50, 130) if k == 1 else (192, 202, 51, 130), "line": None}},
    "oze_miejsca": {
        "title": "Miejsca inwestycji OZE w strefach planów ogólnych", "abstract": "Obliczenia własne: części stref planów ogólnych gmin dopuszczających elektrownie wiatrowe lub słoneczne, co najmniej 2 ha. Kolor: wiatr, fotowoltaika.",
        "attr": "Obliczenia własne na danych GUGiK (plany ogólne gmin, BDOT10k)", "lic": "https://creativecommons.org/licenses/by/4.0/deed.pl",
        "sql": """SELECT ST_AsBinary(ST_Transform(ST_SimplifyPreserveTopology(geom, %(tol)s), %(srid)s)), tech FROM oze_analiza.miejsca
                  WHERE geom && ST_Transform(ST_MakeEnvelope(%(x0)s,%(y0)s,%(x1)s,%(y1)s,%(srid)s),2180)""",
        "style": lambda t: {"fill": (234, 179, 8, 150) if t == "pv" else (37, 99, 235, 140), "line": (255, 255, 255, 220), "w": .8}},
}
CRS = {"EPSG:3857": 3857, "EPSG:2180": 2180, "EPSG:4326": 4326, "CRS:84": 4326}
FLIP_130 = {"EPSG:4326", "EPSG:2180"}  # northing first in WMS 1.3.0
PL = (14.07, 49.0, 24.15, 54.84)


def _err(msg, code="InvalidParameterValue"):
    x = f'<?xml version="1.0" encoding="UTF-8"?><ServiceExceptionReport version="1.3.0" xmlns="http://www.opengis.net/ogc"><ServiceException code="{code}">{escape(msg)}</ServiceException></ServiceExceptionReport>'
    return Response(x, status=400, mimetype="text/xml")


def capabilities(base, version):
    lay = "".join(f"""<Layer queryable="0" opaque="0"><Name>{n}</Name><Title>{escape(L['title'])}</Title><Abstract>{escape(L['abstract'] + ' Źródło: ' + L['attr'] + '.')}</Abstract>
<EX_GeographicBoundingBox><westBoundLongitude>{PL[0]}</westBoundLongitude><eastBoundLongitude>{PL[2]}</eastBoundLongitude><southBoundLatitude>{PL[1]}</southBoundLatitude><northBoundLatitude>{PL[3]}</northBoundLatitude></EX_GeographicBoundingBox>
<Attribution><Title>{escape(L['attr'])}</Title><OnlineResource xlink:type="simple" xlink:href="{escape(L['lic'])}"/></Attribution></Layer>""" for n, L in LAYERS.items())
    crs = "".join(f"<CRS>{c}</CRS>" for c in CRS)
    url = escape(base)
    x = f"""<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms" xmlns:xlink="http://www.w3.org/1999/xlink">
<Service><Name>WMS</Name><Title>Plots: energetyka i OZE</Title><Abstract>Usługa przeglądania warstw aplikacji Plots: linie WN i stacje GPZ (OpenStreetMap) oraz analizy własne dla energetyki wiatrowej i słonecznej. Opis zbiorów i licencje: katalog danych aplikacji.</Abstract>
<OnlineResource xlink:type="simple" xlink:href="{url}"/><Fees>brak</Fees><AccessConstraints>Warstwy OpenStreetMap: ODbL 1.0. Analizy własne: CC BY 4.0.</AccessConstraints><MaxWidth>4096</MaxWidth><MaxHeight>4096</MaxHeight></Service>
<Capability><Request>
<GetCapabilities><Format>text/xml</Format><DCPType><HTTP><Get><OnlineResource xlink:type="simple" xlink:href="{url}?"/></Get></HTTP></DCPType></GetCapabilities>
<GetMap><Format>image/png</Format><DCPType><HTTP><Get><OnlineResource xlink:type="simple" xlink:href="{url}?"/></Get></HTTP></DCPType></GetMap>
</Request><Exception><Format>XML</Format></Exception>
<Layer><Title>Plots: energetyka i OZE</Title>{crs}
<EX_GeographicBoundingBox><westBoundLongitude>{PL[0]}</westBoundLongitude><eastBoundLongitude>{PL[2]}</eastBoundLongitude><southBoundLatitude>{PL[1]}</southBoundLatitude><northBoundLatitude>{PL[3]}</northBoundLatitude></EX_GeographicBoundingBox>
{lay}</Layer></Capability></WMS_Capabilities>"""
    return Response(x, mimetype="text/xml; charset=utf-8", headers={"Cache-Control": "public, max-age=86400"})


def getmap(pool, a):
    from PIL import Image, ImageDraw
    from shapely import wkb
    ver = a.get("VERSION", "1.3.0")
    crs_name = (a.get("CRS") or a.get("SRS") or "").upper()
    if crs_name not in CRS:
        return _err("Nieobsługiwany CRS: " + crs_name, "InvalidCRS")
    srid = CRS[crs_name]
    try:
        bb = [float(v) for v in a["BBOX"].split(",")]
        w, h = int(a["WIDTH"]), int(a["HEIGHT"])
    except (KeyError, ValueError):
        return _err("Wymagane BBOX, WIDTH, HEIGHT", "MissingParameterValue")
    if not (0 < w <= 4096 and 0 < h <= 4096):
        return _err("WIDTH i HEIGHT do 4096")
    if ver.startswith("1.3") and crs_name in FLIP_130:
        bb = [bb[1], bb[0], bb[3], bb[2]]
    x0, y0, x1, y1 = bb
    names = [n for n in (a.get("LAYERS") or "").split(",") if n]
    bad = [n for n in names if n not in LAYERS]
    if not names or bad:
        return _err("Nieznana warstwa: " + ",".join(bad or ["(brak)"]), "LayerNotDefined")
    fmt = a.get("FORMAT", "image/png").lower()
    if fmt not in ("image/png", "png"):
        return _err("Obsługiwany format: image/png", "InvalidFormat")
    S = 2  # supersampling for smooth lines
    img = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img, "RGBA")
    sx, sy = w * S / (x1 - x0), h * S / (y1 - y0)
    px = lambda c: [((x - x0) * sx, (y1 - y) * sy) for x, y, *_ in c]
    # simplification tolerance in metres: half a pixel (degrees for EPSG:4326 are converted roughly)
    tol_m = (x1 - x0) / w * (111000 if srid == 4326 else 1) * .5
    with pool.connection() as c:
        for n in names:
            L = LAYERS[n]
            rows = c.execute(L["sql"], {"x0": x0, "y0": y0, "x1": x1, "y1": y1, "srid": srid, "tol": tol_m}).fetchall()
            base, img = img, Image.new("RGBA", img.size, (0, 0, 0, 0))  # each layer is drawn on its own sheet, then stacked
            dr = ImageDraw.Draw(img, "RGBA")
            masks = {}  # polygon fills per colour: drawn into a mask first, so holes stay transparent
            for g, attr in rows:
                if g is None:
                    continue
                st = L["style"](attr); geom = wkb.loads(bytes(g))
                parts = getattr(geom, "geoms", [geom])
                for p in parts:
                    t = p.geom_type
                    if t == "Polygon":
                        if st.get("fill"):
                            m = masks.get(st["fill"])
                            if m is None:
                                m = masks[st["fill"]] = Image.new("L", img.size, 0)
                            md = ImageDraw.Draw(m)
                            md.polygon(px(p.exterior.coords), fill=255)
                            for hole in p.interiors:
                                md.polygon(px(hole.coords), fill=0)
                        if st.get("line"):
                            dr.line(px(p.exterior.coords), fill=st["line"], width=max(1, round(st.get("w", 1) * S)))
                    elif t == "LineString":
                        dr.line(px(p.coords), fill=st["line"], width=max(1, round(st.get("w", 1) * S)), joint="curve")
                    elif t == "Point":
                        (X, Y), r = px(p.coords)[0], st.get("r", 3) * S
                        dr.ellipse([X - r, Y - r, X + r, Y + r], fill=st.get("fill"), outline=st.get("pt"), width=S)
            for col, m in masks.items():
                layer = Image.new("RGBA", img.size, col[:3] + (0,))
                layer.putalpha(m.point(lambda v, a=col[3]: v * a // 255))
                img = Image.alpha_composite(layer, img)  # fills go under the outlines and lines of the same layer
            img = Image.alpha_composite(base, img)
            dr = ImageDraw.Draw(img, "RGBA")
    img = img.resize((w, h), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, "PNG")
    return Response(buf.getvalue(), mimetype="image/png", headers={"Cache-Control": "public, max-age=86400"})


def register(app, pool):
    @app.route("/wms", methods=["GET"])
    def wms():
        a = {k.upper(): v for k, v in request.args.items()}
        req = a.get("REQUEST", "").lower()
        if req == "getcapabilities":
            return capabilities(request.base_url, a.get("VERSION", "1.3.0"))
        if req == "getmap":
            try:
                return getmap(pool, a)
            except Exception as e:
                return _err("Błąd rysowania: " + str(e)[:200], "NoApplicableCode")
        return _err("REQUEST=GetCapabilities lub GetMap", "OperationNotSupported")
