# Powierzchnie działek

API działki, wyszukiwanie punktowe i kafelki zawierają `powierzchnia_geom_m2` obliczone przez `ST_Area` z pełnej geometrii `egib.dzialki.geom` w EPSG:2180. Kafelkowanie i przycinanie geometrii nie wpływają na wynik. Hektary to m² / 10000.

Karta pokazuje m² i ha oraz źródło „z geometrii”. Oryginalna powierzchnia ewidencyjna pozostaje w atrybutach; dla starszego API jest wartością zastępczą. Brak geometrii i powierzchni ewidencyjnej pozostaje brakiem danych. Obliczenie geometryczne nie jest urzędową korektą powierzchni ewidencyjnej. Baza nie jest modyfikowana.

Weryfikacja: rzeczywista działka 221201_1.0001.538/6, prawidłowy niepusty MultiPolygon EPSG:2180, powierzchnia 5232,278093216359 m² mimo pustego `pole_ewid`; zgodny wynik API po identyfikatorze i punkcie. Plan zapytania po identyfikatorze używa indeksu. 19 testów jednostkowych i testy przeglądarkowe przy szerokościach 320, 390, 768 i 1440 px przeszły.

Usunięto przycisk „Link do widoku”. Istniejące odnośniki do działek nadal działają.
