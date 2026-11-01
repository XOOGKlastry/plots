"""Run with the project Python; integration cases only read the existing GIS database."""
import json
import sys
import unittest
from pathlib import Path
import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from category_access import compute, validate
import public_api


class InputTests(unittest.TestCase):
    def test_bounds_and_sources_are_validated_before_sql(self):
        with self.assertRaises(ValueError):
            validate({'bounds': [0, 0, 180, 85], 'minutes': 15, 'points': []})
        with self.assertRaises(ValueError):
            validate({'bounds': [16.8, 54.5, 16.9, 54.6], 'minutes': 12, 'points': []})
        with self.assertRaises(ValueError):
            validate({'bounds': [16.8, 54.5, 16.9, 54.6], 'minutes': 15, 'points': [[float('nan'), 54]]})
        self.assertEqual(len(validate({'bounds': [16.8, 54.5, 16.9, 54.6], 'minutes': 15, 'points': [[16.85,54.58],[16.85,54.58]]})[2]),1)

    def test_api_rejects_invalid_input_and_explicitly_allows_cors_post(self):
        client=public_api.app.test_client()
        self.assertEqual(client.post('/api/category-access',json={'minutes':15}).status_code,400)
        self.assertIn('POST',client.options('/api/category-access').headers['Access-Control-Allow-Methods'])


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.connection=psycopg.connect('dbname=gisss user=postgres host=localhost',options='-c default_transaction_read_only=on -c statement_timeout=20000')

    def tearDown(self):
        self.connection.rollback()
        self.connection.close()

    def test_full_mixed_municipality_contains_the_exact_city_layer(self):
        result=public_api.app.test_client().get('/api/gmina-granice?id=1007013').get_json()
        self.assertFalse(result['simplified'])
        self.assertEqual([f['properties']['source'] for f in result['features']],['administracja.gminypolskie','administracja.miastapolskie'])
        expected=self.connection.execute("SELECT ST_NPoints(geom) FROM administracja.gminypolskie WHERE jpt_kod_je='1007013'").fetchone()[0]
        self.assertEqual(result['features'][0]['properties']['vertices'],expected)

    def test_multi_source_reach_includes_each_source_and_offscreen_origins(self):
        bounds=[16.86,54.575,16.88,54.586]
        points=[[16.86769,54.580098],[16.868089,54.578116],[16.854,54.584]]
        one=compute(self.connection,bounds,15,points[:1])
        all_sources=compute(self.connection,bounds,15,points)
        self.assertEqual(all_sources['sources'],3)
        self.assertGreaterEqual(all_sources['connected'],2)
        self.assertTrue(all_sources['features'])
        a=json.dumps(one['features'][0]['geometry']);b=json.dumps(all_sources['features'][0]['geometry'])
        missing=self.connection.execute('SELECT ST_Area(ST_Difference(ST_Transform(ST_GeomFromGeoJSON(%s),2180),ST_Buffer(ST_Transform(ST_GeomFromGeoJSON(%s),2180),10)))',(a,b)).fetchone()[0]
        self.assertLess(missing,1)
        offscreen=compute(self.connection,[16.8685,54.579,16.874,54.584],15,points[:1])
        self.assertTrue(offscreen['features'])

    def test_unconnected_point_is_not_replaced_with_a_circle(self):
        result=compute(self.connection,[16.84,54.61,16.86,54.63],5,[[16.85,54.62]])
        self.assertEqual(result['connected'],0)
        self.assertEqual(result['features'],[])


if __name__=='__main__':
    unittest.main()
