"""Selected full-resolution administrative boundaries; all operations are reads."""
import json
import re
import time
import math
from collections import OrderedDict
from threading import Lock
from typing import Any
from flask import Flask, Response, abort, request


def register_admin_api(app: Flask, pool: Any) -> None:
    """Register the selected municipality and its urban part, without generalization."""
    cache = OrderedDict()
    lock = Lock()

    @app.get('/api/gmina-punkt')
    def municipality_at_point() -> dict[str,str | None]:
        """Resolve an unambiguous municipality from its full indexed geometry."""
        try:
            lon=float(request.args['lon'])
            lat=float(request.args['lat'])
        except (KeyError, ValueError):
            abort(400)
        if not math.isfinite(lon) or not math.isfinite(lat) or abs(lon)>180 or abs(lat)>85:
            abort(400)
        if not (13<=lon<=25 and 48<=lat<=56):
            return {'id':None,'source':'administracja.gminypolskie'}
        with pool.connection() as connection:
            rows=connection.execute("""WITH p AS (SELECT ST_Transform(ST_SetSRID(ST_MakePoint(%s,%s),4326),2180) geom)
                SELECT jpt_kod_je FROM administracja.gminypolskie g,p
                WHERE g.geom && p.geom AND ST_Contains(g.geom,p.geom) LIMIT 2""",(lon,lat)).fetchall()
        return {'id':rows[0][0] if len(rows)==1 else None,'source':'administracja.gminypolskie'}

    @app.get('/api/gmina-granice')
    def municipality_boundaries() -> Response:
        """Return full municipality and urban-part geometries with a shared extent."""
        code = request.args.get('id', '')
        if not re.fullmatch(r'\d{6}[123]', code):
            abort(400)
        with lock:
            saved = cache.get(code)
            if saved and time.monotonic() - saved[0] < 600:
                return Response(saved[1], mimetype='application/json')
        city_code = code[:6] + '_4'
        with pool.connection() as connection:
            rows = connection.execute("""
                SELECT jpt_kod_je, 'gmina' AS kind,
                       ST_AsGeoJSON(ST_Transform(geom,4326),9), ST_NPoints(geom)
                FROM administracja.gminypolskie WHERE jpt_kod_je=%s
                UNION ALL
                SELECT jpt_kod_je, 'miasto' AS kind,
                       ST_AsGeoJSON(ST_Transform(geom,4326),9), ST_NPoints(geom)
                FROM administracja.miastapolskie WHERE jpt_kod_je=%s AND %s
                """, (code, city_code, code.endswith('3'))).fetchall()
        if not rows:
            abort(404)
        features = []
        for identifier, kind, geometry, vertices in rows:
            features.append({'type': 'Feature', 'geometry': json.loads(geometry),
                             'properties': {'id': identifier, 'kind': kind, 'vertices': vertices,
                                            'source': 'administracja.' + ('gminypolskie' if kind == 'gmina' else 'miastapolskie')}})
        bounds = [180.0, 90.0, -180.0, -90.0]

        def include(coordinates: list[Any]) -> None:
            """Expand the feature bounds recursively."""
            if isinstance(coordinates[0], (float, int)):
                x, y = coordinates[:2]
                bounds[0] = min(bounds[0], x)
                bounds[1] = min(bounds[1], y)
                bounds[2] = max(bounds[2], x)
                bounds[3] = max(bounds[3], y)
            else:
                for part in coordinates:
                    include(part)

        include(next(f for f in features if f['properties']['kind'] == 'gmina')['geometry']['coordinates'])
        body = json.dumps({'type': 'FeatureCollection', 'features': features, 'bbox': bounds,
                           'municipality': code, 'simplified': False}, ensure_ascii=False)
        with lock:
            cache[code] = (time.monotonic(), body)
            cache.move_to_end(code)
            while len(cache) > 64:
                cache.popitem(last=False)
        return Response(body, mimetype='application/json', headers={'Cache-Control': 'public,max-age=300'})
