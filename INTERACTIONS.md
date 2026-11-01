# Mapa, kontekst gminy i dostępność piesza

## Wyszukiwanie i wybór

Enter lub wybór podpowiedzi przenosi do adresu, działki albo gminy. Pojedyncze dopasowanie gminy można zatwierdzić Enterem; przy kilku jednostkach o tej samej nazwie użytkownik wybiera właściwy typ i powiat. Ramkowanie mapy uwzględnia dolną kartę telefonu i panel komputera. Działka jest ramkowana po pokazaniu karty, a gmina po jej rzeczywistych granicach, również gdy nie ma zapisanych współrzędnych centrum.

Nowy tekst natychmiast usuwa starą aktywną podpowiedź. Odpowiedzi wcześniejszych wyszukiwań nie mogą nadpisać późniejszego wyboru. Wybór na mapie również unieważnia oczekującą odpowiedź wyszukiwarki.

Adresy mają większe, niebiesko-białe znaczniki, czytelne numery i osobną niewidoczną warstwę trafienia. Kliknięty napis ma pierwszeństwo; przy kilku punktach blisko wybierany jest najbliższy w pikselach, po usunięciu duplikatów kafelkowych. Aktywny znacznik jest spójny z kolorem adresów. Wyłączenie adresów wyłącza także warstwę trafienia.

## Kontekst i pełne granice

Zakładka gminy jest aktualizowana po wybraniu działki, adresu, obiektu lub pustego punktu. TERYT ma pierwszeństwo. Rodzaje 4/5 są przypisywane do całej gminy miejsko-wiejskiej (3), a dzielnice/delegatury 8/9 do miasta. Ręczny wybór gminy unieważnia oczekujące rozpoznanie punktu.

`GET /api/gmina-punkt` używa indeksowanego testu zawierania w `administracja.gminypolskie`, EPSG:2180. Punkt na niejednoznacznej granicy lub poza Polską nie dostaje gminy na podstawie najbliższego centrum. Przy niedostępnym API pozostaje zapisany krajowy zestaw topologiczny do kontekstu offline.

`GET /api/gmina-granice?id=...` zwraca pełną, nieupraszczaną geometrię z `administracja.gminypolskie`. Dla gmin miejsko-wiejskich dodaje obszar miasta z `administracja.miastapolskie` (kod `WWPPGG_4`). Transformacja do EPSG:4326 zachowuje wszystkie wierzchołki; liczba wierzchołków i źródło są podane w atrybutach. Granica gminy jest niebieska, miasta fioletowa i przerywana. Nie zastępujemy granicy całej gminy samym miastem. Geometrie są widoczne w zakładce/profilu gminy i przeżywają zmianę podkładu.

Sprawdzono wszystkie geometrie źródłowe: 2479 gmin i 1050 miast, bez pustych lub nieprawidłowych geometrii. Przeciętna gmina ma około 2098 wierzchołków, największa 9303. W próbach wybranych jednostek pełne odpowiedzi miały 16–144 kB i zajmowały około 0,05 s; uproszczenie nie było potrzebne. Odczyt punktu korzysta z GiST (próba: 0,475 ms w planie SQL). Baza nie jest modyfikowana.

Herby: 2039 przypisań, w tym 979 lokalnych obrazów w pakietach regionalnych. Brak zweryfikowanego pliku dla 440 gmin jest oznaczony. Szczegóły i pochodzenie zapisano w `docs/data/CONTEXT-SOURCES.md`.

## Wskaźniki gmin

Pozycje i kolory 20/60/20 porównują ten sam wskaźnik i rocznik. Wymagane jest co najmniej 30 wartości. Remisy nie są arbitralnie rozdzielane na progu. Brak rocznika i brak danych nie są zerem. Wielkości opisowe, np. ludność i powierzchnia, pozostają neutralne; niższa wartość jest korzystniejsza dla bezrobocia, zgonów, obciążenia demograficznego i odpadów. To jawna konwencja wskaźników, nie łączny ranking gmin.

Trend oznacza różnicę z poprzednim rokiem w historii GUS; udziały procentowe używają punktów procentowych. Każda karta pokazuje źródło i rok. Przegląd ma sześć głównych wskaźników; pozostałe są w kategoriach. Nie dodano eksportu ani porównywarki.

## Adres i trzy najbliższe obiekty

W karcie adresu można wybrać kategorię i trzy najbliższe dojścia. Ranking korzysta z macierzy pieszej Valhalla/OSM, nie z odległości w linii prostej. Minuty są wyróżnione, kilometry drugorzędne. Przerywane proste na mapie oznaczają kierunek, nie przebieg trasy. Wyniki są przybliżone i ograniczone do 25 km; limit kandydatów jest jawny, jeśli nie można potwierdzić kompletności.

Kliknięcie wyniku lub punktu usług otwiera kartę z Google Maps pod dokładnymi współrzędnymi. Z tej karty można włączyć wspólną dostępność całej kategorii; nie jest to już izochrona tylko jednego klikniętego obiektu.

## Wspólny zasięg kategorii

`docs/category-access.js` pobiera wszystkie lokalizacje danej kategorii mogące wpływać na analizowany widok, także spoza ekranu. Zasięg jest niezależny od wybranego pojedynczego punktu. Dostępne czasy: 5, 10, 15, 20, 25, 30, 40, 50 i 60 minut; tryby „do” i „dalej niż”. Wspólna geometria jest sumą dostępności od wszystkich źródeł, a nie przecięciem zasięgów ani odległością od jednego obiektu.

`POST /api/category-access` działa na istniejącym grafie `analiza_dostepnosci.krawedzie_ok` i jego łącznikach. Graf ma około 6,6 mln krawędzi, nie zawiera autostrad ani dróg ekspresowych. Zbadane łączniki mają długość nie większą niż 1 m. Punkty są przypinane do najbliższej krawędzi w promieniu 100 m. Frakcja położenia na krawędzi i długość dojścia są uwzględniane w kosztach połączenia z początkiem i końcem odcinka. Wirtualny wspólny korzeń pozwala liczyć jeden Dijkstra z kosztem do najbliższego źródła. Uwzględniane są również osiągalne fragmenty krawędzi, których oba końce leżą poza progiem.

Model zakłada 5 km/h. Zasięg jest przedstawiany jako pas 25 m przy osiągalnych drogach i ciągach pieszych, z generalizacją wyniku 5 m; nie jest kołem ani otoczką wypukłą przez bariery. To przybliżony korytarz dostępności po sieci, nie dowód dostępności każdego terenu w otoczeniu dróg. „Dalej niż” pokazuje dopełnienie wewnątrz analizowanego obszaru; obejmuje też miejsca bez wyznaczonego dojścia. Liczba lokalizacji przypiętych do sieci jest podana, braki nie są zastępowane odległością prostą.

Pobierany graf obejmuje widok powiększony o maksymalny dystans marszu i margines. Dzięki temu obiekt poza ekranem, który może wpłynąć na widok, nie jest pominięty. Geometria jest przycinana do analizowanego widoku; niewyliczony obszar poza nim nie jest kolorowany jako „dalej niż”. Po przesunięciu mapy stare wyniki są czyszczone i przeliczane. Analiza korzysta z odsłoniętej części mapy, a nie z obszaru schowanego za kartą telefonu.

Ochrona pracy serwera: maksymalny obszar 2000 km², bok 60 km, do 200 tys. krawędzi i 5000 kandydatów w żądaniu. Przy przekroczeniu aplikacja prosi o przybliżenie; nie publikuje wyniku z pominiętymi źródłami. Nie wyznacza całej Polski jednym żądaniem. Jeden job jest wykonywany naraz, wyniki mają ograniczony cache, zapytania są tylko do odczytu i mają limit czasu. Zmiana widoku/kategorii/czasu unieważnia stare odpowiedzi. W próbie czterech szkół Ustki obliczenie trwało około 0,4–0,55 s.

## Kontroler i pozostałe warstwy

Kontroler ma dwa widoki: „Mapa” i „Obiekty i dojście”. Pierwszy zawiera podkłady i cztery zwijane grupy: granice/działki/adresy, planowanie, ceny, wygląd/informacje. Drugi skupia jedną kategorię, punkty, wspólny zasięg, tryb i czasy. Źródła są zwijane. Plakietka na mapie pozwala wrócić do sterowania analizą lub ją wyłączyć; rozróżnia liczenie, potrzebę przybliżenia i błąd od gotowego wyniku.

MPZP, POG uchwalone i projekty są osobne. Kliknięcie pustego punktu sprawdza usługi i pokazuje oczyszczone listy informacji. Brak odpowiedzi nie potwierdza braku planu. RCN pozostaje medianą cen lokali w siatce z co najmniej 5 transakcjami, nie wyceną budynku.

Ikony: Phosphor regular 2.1.1, lokalne SVG, MIT. Operacje poligonowe: polygon-clipping 0.15.7, MIT. Licencje są w katalogach `docs/icons/` i `docs/vendor/`.

## Weryfikacja i źródła techniczne

37 testów jednostkowych JavaScript oraz 5 testów Python API/danych. Testy przeglądarkowe obejmują cztery szerokości, oba motywy, wyszukiwanie i wyścigi odpowiedzi, geometrię paneli, granice gmin i miast, adresy, herby, plany, punkty i RCN, zmianę podkładu oraz PWA offline. Testy bazy wyłącznie odczytują dane. Porównanie wieloźródłowego wyniku z pojedynczym źródłem potwierdza zawieranie, obsługę źródła spoza ekranu i brak fałszywego koła dla punktu bez połączenia.

- https://access.crunchydata.com/documentation/pgrouting/latest/pgr_drivingDistance.html
- https://valhalla.github.io/valhalla/api/matrix/
- https://eteryt.stat.gov.pl/eTeryt/rejestr_teryt/udostepnianie_danych/zasady_implementacji_slownikow/zasady_implementacji_slownikow.aspx

Źródła sprawdzone 01.11.2026. Cofnięcie wdrożenia wymaga odtworzenia zarówno plików `docs/`, jak i wszystkich trzech modułów `server/public_api.py`, `server/admin_api.py`, `server/category_access.py`, oraz zmiany wersji cache PWA.
