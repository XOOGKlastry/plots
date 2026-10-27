# -*- coding: utf-8 -*-
"""Eksport GeoJSON powiatu z gisss.egib.dzialki (do tippecanoe ? PMTiles).
U?ycie: PLOTS_DSN=postgresql://... python export_geojson_powiat.py 2264 out.geojson
Potem: tippecanoe -zg -o out.pmtiles -l dzialki out.geojson
"""
import json, os, sys
import psycopg
teryt, outp = sys.argv[1], sys.argv[2]
dsn = os.environ.get("PLOTS_DSN", "postgresql://postgres@localhost/gisss")
with psycopg.connect(dsn) as c:
    fc = c.execute("""
      SELECT json_build_object('type','FeatureCollection','features', coalesce(json_agg(f),'[]'::json))
      FROM (
        SELECT json_build_object(
          'type','Feature',
          'properties', json_build_object(
            'id_dzialki', id_dzialki, 'numer_dzialki', numer_dzialki, 'obreb', obreb,
            'grupa_rej', grupa_rej,
            'g1', CASE WHEN grupa_rej ~ '^[0-9]{1,2}' THEN (regexp_match(grupa_rej,'^[0-9]{1,2}'))[1] ELSE 'brak' END,
            'klasouzytki', klasouzytki, 'pole_ewid', pole_ewid
          ),
          'geometry', ST_AsGeoJSON(ST_Transform(geom,4326))::json
        ) f FROM egib.dzialki WHERE id_dzialki LIKE %s
      ) s
    """, (teryt + "%",)).fetchone()[0]
open(outp, "w", encoding="utf-8").write(json.dumps(fc, ensure_ascii=False))
print("OK", outp)
