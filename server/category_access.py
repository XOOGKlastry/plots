"""Read-only multi-source pedestrian reachability on the existing BDOT10k graph."""
import hashlib
import json
import math
import threading
import time
from collections import OrderedDict
from typing import Any
import logging
from psycopg import sql, Connection
from flask import Flask, Response, abort, request

MINUTES = {5, 10, 15, 20, 25, 30, 40, 50, 60}
SUPER_NODE = 9_000_000_000_000


def validate(payload: Any) -> tuple[list[float], int, list[tuple[float, float]]]:
    """Bound graph work and reject malformed coordinates before building SQL."""
    if not isinstance(payload, dict):
        raise ValueError('Nieprawidłowe żądanie')
    bounds, minutes, points = payload.get('bounds'), payload.get('minutes'), payload.get('points')
    if minutes not in MINUTES or not isinstance(bounds, list) or len(bounds) != 4:
        raise ValueError('Nieprawidłowy czas lub obszar')
    if any(not isinstance(v, (int, float)) or isinstance(v, bool) or not math.isfinite(v) for v in bounds):
        raise ValueError('Nieprawidłowe współrzędne')
    west, south, east, north = bounds
    if not (13 <= west < east <= 25 and 48 <= south < north <= 56):
        raise ValueError('Wskaż obszar w Polsce')
    width = (east - west) * 111320 * math.cos(math.radians((south + north) / 2))
    height = (north - south) * 111320
    if width > 60000 or height > 60000 or width * height > 2_000_000_000:
        raise ValueError('Przybliż mapę, aby obliczyć wspólny zasięg kategorii')
    if not isinstance(points, list) or len(points) > 5000:
        raise ValueError('Zbyt wiele obiektów — przybliż mapę')
    unique = set()
    for point in points:
        if not isinstance(point, list) or len(point) != 2 or any(not isinstance(v, (int, float)) or isinstance(v, bool) or not math.isfinite(v) for v in point):
            raise ValueError('Nieprawidłowe współrzędne obiektu')
        if not (13 <= point[0] <= 25 and 48 <= point[1] <= 56):
            raise ValueError('Obiekt poza obsługiwanym obszarem')
        unique.add((float(point[0]),float(point[1])))
    return [float(v) for v in bounds], int(minutes), sorted(unique)


def compute(connection: Connection, bounds: list[float], minutes: int, points: list[tuple[float, float]]) -> dict[str, Any]:
    """Compute shortest distance from any category source, including edge fractions.

    Query extent includes the full maximum walking distance around the view, so a
    source capable of affecting the view is not dropped just because it is offscreen.
    No schemas, temporary tables or persisted graph state are changed.
    """
    budget = minutes * 5000 / 60
    margin = budget + 200
    roi = connection.execute('SELECT ST_AsEWKT(ST_Expand(ST_Transform(ST_MakeEnvelope(%s,%s,%s,%s,4326),2180),%s))', (*bounds, margin)).fetchone()[0]
    edge_count = connection.execute('SELECT count(*) FROM (SELECT 1 FROM analiza_dostepnosci.krawedzie_ok WHERE geom && ST_GeomFromEWKT(%s) LIMIT 200001) e', (roi,)).fetchone()[0]
    if edge_count > 200000:
        raise ValueError('Sieć dróg w tym widoku jest zbyt duża — przybliż mapę')
    if not points:
        return {'type': 'FeatureCollection', 'features': [], 'bounds': bounds, 'minutes': minutes, 'sources': 0, 'connected': 0, 'edges': edge_count}
    values = sql.SQL(',').join(sql.SQL('({},{})').format(sql.Literal(x), sql.Literal(y)) for x, y in points)
    eligible_query=sql.SQL('SELECT count(*) FROM (VALUES {}) AS v(x,y) WHERE ST_Transform(ST_SetSRID(ST_MakePoint(x,y),4326),2180) && ST_GeomFromEWKT(%s)').format(values)
    eligible=connection.execute(eligible_query,(roi,)).fetchone()[0]
    snap_query = sql.SQL("""WITH p AS (SELECT ST_Transform(ST_SetSRID(ST_MakePoint(x,y),4326),2180) AS pt FROM (VALUES {}) AS v(x,y))
      SELECT e.id,e.source,e.target,e.dl,ST_LineLocatePoint(e.geom,p.pt),ST_Distance(e.geom,p.pt)
      FROM p CROSS JOIN LATERAL (SELECT id,source,target,dl,geom FROM analiza_dostepnosci.krawedzie_ok
        WHERE geom && ST_Expand(p.pt,100) AND ST_DWithin(geom,p.pt,100) AND dl>0
        ORDER BY geom <-> p.pt LIMIT 1) e
      WHERE p.pt && ST_GeomFromEWKT(%s)"""
    ).format(values)
    snaps = connection.execute(snap_query, (roi,)).fetchall()
    if not snaps:
        return {'type': 'FeatureCollection', 'features': [], 'bounds': bounds, 'minutes': minutes, 'sources': eligible, 'candidates': len(points), 'connected': 0, 'edges': edge_count}
    connectors = []
    for i, (_, source, target, length, fraction, gap) in enumerate(snaps):
        connectors.extend([(SUPER_NODE + 2*i + 1, SUPER_NODE, source, gap + fraction*length),
                           (SUPER_NODE + 2*i + 2, SUPER_NODE, target, gap + (1-fraction)*length)])
    virtual = sql.SQL(',').join(sql.SQL('({},{},{},{})').format(*(sql.Literal(v) for v in row)) for row in connectors)
    edges_sql = sql.SQL("""SELECT id,source,target,dl AS cost FROM analiza_dostepnosci.krawedzie_ok WHERE geom && ST_GeomFromEWKT({}) AND dl>0
      UNION ALL SELECT 300000000000+lid,v,source,gap+f*dl FROM analiza_dostepnosci.laczniki
      UNION ALL SELECT 400000000000+lid,v,target,gap+(1-f)*dl FROM analiza_dostepnosci.laczniki
      UNION ALL SELECT * FROM (VALUES {}) AS v(id,source,target,cost)"""
    ).format(sql.Literal(roi), virtual).as_string(connection)
    snap_values = sql.SQL(',').join(sql.SQL('({},{},{})').format(sql.Literal(row[0]), sql.Literal(row[4]), sql.Literal(row[5])) for row in snaps)
    query = sql.SQL("""WITH edges AS MATERIALIZED (
        SELECT id,source,target,dl,geom FROM analiza_dostepnosci.krawedzie_ok WHERE geom && ST_GeomFromEWKT(%(roi)s) AND dl>0),
      reached AS MATERIALIZED (SELECT node,agg_cost AS d FROM pgr_drivingDistance(%(graph)s,%(root)s::bigint,%(budget)s::float8,false)),
      starts AS (SELECT * FROM (VALUES {}) AS p(id,f,gap)),
      pieces AS (
        SELECT ST_LineSubstring(e.geom,0,LEAST(1.0,(%(budget)s-r.d)/e.dl)) AS geom FROM edges e JOIN reached r ON r.node=e.source WHERE r.d<%(budget)s
        UNION ALL SELECT ST_LineSubstring(e.geom,GREATEST(0.0,1-(%(budget)s-r.d)/e.dl),1) FROM edges e JOIN reached r ON r.node=e.target WHERE r.d<%(budget)s
        UNION ALL SELECT ST_LineSubstring(e.geom,GREATEST(0.0,s.f-(%(budget)s-s.gap)/e.dl),LEAST(1.0,s.f+(%(budget)s-s.gap)/e.dl)) FROM edges e JOIN starts s ON s.id=e.id WHERE s.gap<%(budget)s),
      area AS (SELECT ST_Buffer(ST_Collect(geom),25,'quad_segs=2') AS geom FROM pieces),
      clipped AS (SELECT ST_CollectionExtract(ST_Intersection(ST_SimplifyPreserveTopology(geom,5),ST_Transform(ST_MakeEnvelope(%(west)s,%(south)s,%(east)s,%(north)s,4326),2180)),3) AS geom FROM area)
      SELECT ST_AsGeoJSON(ST_Transform(geom,4326),7), (SELECT count(*) FROM reached) FROM clipped"""
    ).format(snap_values)
    row = connection.execute(query, {'roi': roi, 'graph': edges_sql, 'root': SUPER_NODE, 'budget': budget,
                                    'west': bounds[0], 'south': bounds[1], 'east': bounds[2], 'north': bounds[3]}).fetchone()
    geometry = json.loads(row[0]) if row and row[0] else None
    features = [] if not geometry or not geometry.get('coordinates') else [{'type': 'Feature', 'geometry': geometry, 'properties': {'minutes': minutes, 'contour': minutes}}]
    return {'type': 'FeatureCollection', 'features': features, 'bounds': bounds, 'minutes': minutes,
            'sources': eligible, 'candidates': len(points), 'connected': len(snaps), 'edges': edge_count,
            'nodes': row[1] if row else 0, 'source': 'BDOT10k / analiza_dostepnosci',
            'walking_kmh': 5, 'corridor_m': 25, 'scope': 'all-category-sources-affecting-view'}


def register_category_api(app: Flask, pool: Any) -> None:
    """Register a bounded, single-concurrency, cached read-only graph service."""
    app.logger.setLevel(logging.INFO)
    if not app.config.get('MAX_CONTENT_LENGTH'):
        app.config['MAX_CONTENT_LENGTH']=250000
    gate = threading.BoundedSemaphore(1)
    lock = threading.Lock()
    cache = OrderedDict()

    @app.route('/api/category-access', methods=['POST', 'OPTIONS'])
    def category_access() -> Response | tuple[dict[str,str],int]:
        """Return cached or newly computed category reachability without database writes."""
        if request.method == 'OPTIONS':
            return Response(status=204)
        if request.content_length and request.content_length > 250000:
            abort(413)
        try:
            bounds, minutes, points = validate(request.get_json(silent=True))
        except (ValueError, TypeError) as error:
            return {'error': str(error)}, 400
        key = hashlib.sha256(json.dumps([bounds, minutes, points]).encode()).hexdigest()
        with lock:
            saved = cache.get(key)
            if saved and time.monotonic() - saved[0] < 1800:
                return Response(saved[1], mimetype='application/json')
        if not gate.acquire(blocking=False):
            return {'error': 'Trwa inne obliczenie zasięgu. Ponawiam za chwilę.'}, 429
        started = time.monotonic()
        try:
            with pool.connection() as connection:
                connection.execute('SET default_transaction_read_only=on')
                result = compute(connection, bounds, minutes, points)
            result['seconds'] = round(time.monotonic()-started, 3)
            body = json.dumps(result, ensure_ascii=False)
            with lock:
                cache[key] = (time.monotonic(), body)
                while len(cache) > 24:
                    cache.popitem(last=False)
            app.logger.info('category_access sources=%s connected=%s edges=%s seconds=%s', result['sources'], result['connected'], result['edges'], result['seconds'])
            return Response(body, mimetype='application/json')
        except ValueError as error:
            return {'error': str(error)}, 400
        except Exception:
            app.logger.exception('category_access failed')
            return {'error': 'Nie udało się obliczyć zasięgu na sieci pieszej. Przybliż mapę lub spróbuj ponownie.'}, 503
        finally:
            gate.release()
