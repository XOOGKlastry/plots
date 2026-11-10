import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
import public_api

class AdministrationTests(unittest.TestCase):
    def test_exact_address_and_unrelated_point(self):
        client=public_api.app.test_client()
        self.assertEqual(client.get('/api/adres-punkt?lon=16.8545485&lat=54.5879904').get_json()['address'],'Marynarki Polskiej 1, Ustka')
        self.assertIsNone(client.get('/api/adres-punkt?lon=0&lat=0').get_json()['address'])
        self.assertEqual(client.get('/api/adres-punkt?lon=nan&lat=0').status_code,400)

    def test_full_municipality_and_city_sources(self):
        response=public_api.app.test_client().get('/api/gmina-granice?id=1007013')
        self.assertEqual(response.status_code,200)
        value=response.get_json()
        self.assertFalse(value['simplified'])
        self.assertEqual([f['properties']['source'] for f in value['features']],['administracja.gminypolskie','administracja.miastapolskie'])
        self.assertEqual(value['features'][0]['properties']['vertices'],4085)

    def test_point_lookup_separates_city_and_rural_municipality(self):
        client=public_api.app.test_client()
        for lon,lat,expected in [(16.85455,54.58799,'2212011'),(16.90,54.55,'2212102'),(0,0,None)]:
            self.assertEqual(client.get('/api/gmina-punkt',query_string={'lon':lon,'lat':lat}).get_json()['id'],expected)

if __name__=='__main__':unittest.main()
