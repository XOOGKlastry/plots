# Planowanie, GUS, otoczenie i aplikacja mobilna

## Interfejs i źródła

- Usunięto kontrolkę i źródło cieniowania rzeźby.
- `Topo` korzysta z kompozycji BDOT10k GUGiK zamiast dawnej mapy rastrowej TOPO. Od mniejszych przybliżeń pozostaje czytelny podkład wektorowy; BDOT10k jest nakładany od z=11. Układ wyjściowy GetMap EPSG:3857 sprawdzono na rzeczywistym obrazie usługi, a nie jedynie na deklaracji capabilities.
- MPZP, uchwalone POG i projektowane POG są oddzielnymi warstwami. Karta działki, adresu lub pustego punktu automatycznie identyfikuje wszystkie trzy usługi w wybranym punkcie. Wyniki są punktowanymi listami. HTML z usług jest zamieniany na zwykły tekst, skrypty usuwane, a linki ograniczone do HTTPS. Nieudane zapytanie nie jest traktowane jako brak planu.
- Usługi planistyczne GUGiK są nadal dostępne w oficjalnym wykazie i zostały sprawdzone 31.10.2026. Zasięg i aktualność zależą od usług źródłowych. Interfejs odsyła również do Rejestru Urbanistycznego; jego publiczny endpoint listowania zwracał podczas wdrożenia błąd systemu i nie jest ukrytym zamiennikiem danych.

Oficjalne źródła:

- https://www.geoportal.gov.pl/pl/usluga/uslugi-przegladania-wms-i-wmts/
- https://www.geoportal.gov.pl/pl/dane/baza-danych-obiektow-topograficznych-bdot10k/
- https://rejestr-urbanistyczny.gov.pl/published
- https://api.stat.gov.pl/home/bdlapi

## Dane GUS

`bdl-units.json` i `gus-population.json` zostały pobrane bezpośrednio z BDL: zmienna 72305, rok 2025, wszystkie 40 stron. Zachowano 2479 gmin, wykluczając 1455 części miejskich/wiejskich jednostek. TERYT jest ciągiem siedmiu znaków, z zachowaniem zer wiodących.

`gus-catalog.json` przechowuje sprawdzone identyfikatory i metadane zmiennych. Dwie zmienne historyczne dotyczące gazu są odfiltrowane, ponieważ ich szeregi kończą się w latach 90. Dla wybranej gminy jednym zapytaniem pobierane są 19 bieżących zmiennych i trzy lata obserwacji. PIT na mieszkańca i gęstość zaludnienia są wyliczane tylko przy zgodnych latach licznika i mianownika. REGON na 10 tys. mieszkańców przeliczany jest na 1000 dokładnie raz, a hektary na km² przez podzielenie przez 100.

Dane 20 ostatnio odczytanych gmin są przechowywane lokalnie przez aplikację. Po 7 dniach następuje próba odświeżenia. Błąd lub limit GUS pozostawia dostępne zapisane wartości i jawny komunikat. Daty i braki pozostają widoczne. Kolory kart oznaczają ocenę 20/60/20; szczegóły w `INTERACTIONS.md`.

Odświeżenie katalogu i indeksu wszystkich jednostek: `node scripts/refresh-gus.cjs`. Skrypt respektuje tempo żądań, weryfikuje jednostki i pokrycie oraz zapisuje pliki dopiero po poprawnym pobraniu. Opcjonalny klucz GUS może być przekazany w zmiennej środowiskowej `GUS_API_KEY`; nie trafia do strony ani repozytorium.

## Otoczenie z Jakdaleko

- 63 kategorie usług z zachowaniem nazw źródeł, typu źródła i daty.
- Punkty ładowane kaflami, a mniejsze zbiory jako jeden plik; renderowane są punkty w aktualnym widoku.
- Usunięto widok odległości budynków i filtry blisko/daleko. Dojścia piesze dostępne są wyłącznie po wybraniu kategorii w karcie adresu; trzy kierunki na mapie są prostymi przerywanymi liniami. Odległości oblicza macierz piesza Valhalla/OSM, nie geometria linii.
- RCN pokazuje mediany cen lokali mieszkalnych w siatkach około 1 i 5 km, min. 5 transakcji. Okres 01.09.2024–31.08.2026 i liczba transakcji są widoczne. Mediana okolicy nie jest wyceną budynku.

Pliki punktów, budynków i cen pozostają w `https://xoogklastry.github.io/jakdaleko/`; katalog źródeł jest zapisany lokalnie. Źródła pierwotne: GUGiK, GUS, rejestry publiczne, operatorzy i OpenStreetMap zgodnie z metadanymi danej warstwy.

## Instalacja na telefonie

To PWA działająca przez HTTPS. Android/Chrome: „Zainstaluj aplikację”. iPhone/iPad/Safari: „Udostępnij” → „Dodaj do ekranu początkowego”. Ikony 192/512 px i osobna maskowalna ikona są dołączone. Manifest nie nadaje nowej marki produktowi.

Service worker zapisuje interfejs, katalogi i dane referencyjne. Zapisane profile są dostępne offline. Kafle map i usług WMS nie są buforowane jako mapa offline. Aktualizacja wymaga świadomego odświeżenia przyciskiem, a nie przeładowania w trakcie pracy.

## Walidacja i wdrożenie

`pnpm test` uruchamia 27 testów danych, jednostek, lat i formatów binarnych. `node tests/browser.cjs` obejmuje 4 szerokości i 2 motywy. `node tests/features-browser.cjs` sprawdza nowe warstwy, prawdziwe punkty i siatki RCN, zachowanie źródeł po zmianie podkładu, wybór roku i tryb offline po instalacji service workera. `node tests/interactions-browser.cjs` sprawdza odległości tylko w adresie, ranking po sieci, trzy kierunki, listy planów, anulowanie starego wyboru i brak kolizji paneli. Odpowiedź GUS w testach przeglądarkowych pochodzi z zapisanej rzeczywistej odpowiedzi Ustki, aby nie zużywać limitów przy każdej regresji.

GitHub Pages nadal publikuje `docs/`. Przy wdrożeniu lokalnego API skopiuj wszystkie nowe pliki z `docs/` oraz `server/public_api.py` i uruchom ponownie proces API. Nie podmieniaj aktualnego `config.js`. Cofnięcie commita odtwarza poprzedni interfejs; service worker ma wersjonowany cache i powinien zostać zaktualizowany przy rollbacku.

Aktualna organizacja karty miejsca, osobnego modułu odległości i dostępności na budynkach jest opisana w `INTERACTIONS.md`; zastępuje wcześniejszy panel dojść i poligony zasięgu.
