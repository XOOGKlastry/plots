# Oceny gmin i wybór punktu

## Uzupełnienie: kontekst, herby i izochrony

Profil gminy aktualizuje się po wskazaniu działki, adresu PRG, obiektu usługowego, pustego punktu mapy, wyniku geokodowania lub własnej lokalizacji. TERYT ma pierwszeństwo przed testem granic. Obsługa nie przełącza samoczynnie na drugą zakładkę: właściwa gmina już na niej czeka. Brak rozpoznania usuwa poprzednią gminę; nie pozostawia starego profilu pod nowym punktem. Ręczny wybór gminy anuluje oczekujące rozpoznanie położenia.

Herby i ich pełne pokrycie opisuje `docs/data/CONTEXT-SOURCES.md`: 2039 przypisań, 979 z lokalnymi obrazami, brak zweryfikowanego pliku dla 440 gmin. Pakiety regionalne mają cache offline po odczycie i ograniczony cache pamięci. Ładowanie odbywa się na żądanie.

Warstwy są zorganizowane w pięć zwijanych grup. W widoku początkowym widoczne są nazwy grup i liczba aktywnych warstw. Wyszukiwanie rozwija pasujące grupy; legenda rozwija odpowiednią grupę ustawień. Filtry, przełączniki i stan podkładu zachowują dotychczasową obsługę.

Wyniki dojścia wyróżniają minuty, z odległością w drugiej linii. Wybór wyniku otwiera taką samą kartę jak kliknięcie punktu na mapie. Google Maps otrzymuje dokładne współrzędne obiektu, nie zapytanie po podobnej nazwie. Podczas oglądania dojść i izochron wypełnienie działek jest tymczasowo przygaszone, po nowym wyborze wraca do ustawionego krycia.

Izochrony: 5, 10, 15, 20, 25, 30, 40, 50 i 60 minut. Są obliczane z `costing=pedestrian`, prędkością modelową 5 km/h, bez promów, `reverse=true` (dojście do obiektu), jako poligony Valhalla. Wybrany czas jest sprawdzany w odpowiedzi — brak lub obcięcie do innego czasu nie jest akceptowane. Jeden czas oznacza jedno opóźnione i anulowalne zapytanie; zmiana „do/dalej niż” wykorzystuje już pobraną geometrię.

„Dalej niż” jest dopełnieniem zasięgu do obiektu, także dla miejsc bez wyznaczonego dojścia. Nie jest kolejną izochroną ani odwróceniem kierunku podróży. Używana operacja różnicy zachowuje otwory, enklawy i wieloczęściowe kontury. Granica dostępnego dojścia pozostaje niebieska; obszar poza zasięgiem jest neutralny. Zasięg jest przybliżony ze względu na sieć OSM i raster obliczeniowy konturu. Błędy usługi czyszczą starą geometrię zamiast pozostawiać pozornie aktualny zasięg.

Ikony aplikacji to lokalne SVG Phosphor regular 2.1.1 (MIT, licencja w `docs/icons/`); symbole tekstowe ocen i trendów zostały zastąpione ikonami. Operacje geometrii: polygon-clipping 0.15.7 (MIT, licencja w `docs/vendor/`).

Weryfikacja: 35 testów jednostkowych; testy kontekstu adres/punkt/działka, herbów, linku Google, wszystkich dziewięciu wyborów czasu, zmiany podkładu, czyszczenia i obu trybów izochron. Rzeczywisty serwer zwrócił poprawne poligony 5, 25 i 60 minut dla szkoły w Ustce. Widok oraz lokalne i zdalne herby sprawdzono w przeglądarce. Dokumentacja API: https://valhalla.github.io/valhalla/api/isochrone/ (sprawdzone 31.10.2026).

## Wskaźniki

`indicator-model.js` ocenia wartości dla tego samego klucza i roku. Zielony oznacza najlepsze 20%, czerwony najsłabsze 20%, szary środek. Pozycje są konkurencyjne (1, 1, 3); remis przecinający próg nie jest arbitralnie rozdzielany. Wymagane jest co najmniej 30 porównywalnych wartości. Dane o nieznanym roku nie trafiają do rankingu. UI pokazuje liczebność faktycznego zbioru, np. 2473, a nie liczbę wszystkich jednostek.

Mniej jest korzystniejsze dla bezrobocia, zgonów, obciążenia demograficznego i odpadów. Ludność, powierzchnia, gęstość i nieprzeliczone wielkości opisowe pozostają szare: pozycja według wielkości nie jest oceną jakości gminy. Pozostałe wskaźniki stosują kierunek rosnący. Jest to jawna konwencja prezentacji, a nie całościowy ranking gmin. Karty mają opis, ikonę i kolor; odczyt nie wymaga rozpoznawania zieleni i czerwieni.

Porównania korzystają z istniejącego krajowego zestawu referencyjnego z podanym rokiem. Dla zmiennych, dla których nie ma krajowego zbioru o tym samym roczniku, pozycja pozostaje niedostępna. Nowsza wartość jednej gminy nie jest porównywana ze starszym rocznikiem innych. Trend jest różnicą z poprzednim rokiem w historii GUS; dla udziałów procentowych jest podany w punktach procentowych. Brak poprzedniego roku nie oznacza zera.

Przegląd pokazuje sześć istotnych wskaźników; wszystkie pozostałe są dostępne w kategoriach. Nie dodano eksportu ani porównywarki gmin.

## Obiekty i dojścia

Warstwa pokazuje same obiekty. W karcie punktu PRG użytkownik wybiera kategorię. `address-access.js` ładuje obiekty w promieniu 25 km, a następnie macierz `sources_to_targets` z `costing=pedestrian`, jednostką kilometrów i wyszukiwaniem drogi do 100 m od punktu. Domyślna usługa to publiczna Valhalla FOSSGIS; można skonfigurować własną przez `PLOTS_CONFIG.routingUrl` (HTTPS).

Kandydaci są przeglądani partiami po 30. Macierz ustala kolejność według długości dojścia po sieci. Trzy najbliższe geometrycznie obiekty nie są automatycznie uznawane za najbliższe pieszo. Sprawdzenie kolejnych kończy się dopiero, gdy dolne ograniczenie geometryczne kolejnego obiektu (z zapasem 200 m na przypięcie do sieci) przekracza trzeci wynik. Limit 120 kandydatów jest jawnie oznaczony, jeśli nie można zagwarantować kompletności w promieniu 25 km. Braki połączeń nie są zamieniane na odległość w linii prostej.

Wynik ma trzy proste przerywane kierunki i numerowane obiekty. Linie nie udają przebiegu trasy; dystans z macierzy jest oznaczony jako przybliżony. Sieć pieszego routingu to OSM/Valhalla, odrębna od dawnych skwantowanych odległości budynków BDOT10k. Nie przenosimy odległości sąsiedniego budynku na adres.

Żądania uruchamiane są po wyborze kategorii; wyniki i pliki POI mają ograniczony cache. Zmiana wyboru anuluje poprzednie obliczenia i usuwa linie. Przekroczenie czasu lub limitu usługi pokazuje możliwość ponowienia, bez fałszywego dystansu. Usługa publiczna wymaga dostępu do internetu i ma ograniczenia dostępności; dla dużego ruchu należy ustawić własny endpoint Valhalla.

Dokumentacja: https://valhalla.github.io/valhalla/api/matrix/ i https://valhalla.github.io/valhalla/start/introduction/ (sprawdzone 31.10.2026).

## Plany i panele

Priorytet kliknięcia: jawny tryb planów → adres → obiekt POI → działka → planowanie w pustym punkcie. W ostatnim przypadku sprawdzane są MPZP, POG uchwalone i projekty POG, także gdy ich rysunki są wyłączone. Punkt dostaje znacznik. Pola i dokumenty odpowiedzi WMS są listami; treść HTML jest zamieniana na tekst, a linki ograniczone do HTTPS. Nie dopowiadamy wysokości lub intensywności, jeśli usługa nie zwraca tych danych. Brak odpowiedzi nie jest potwierdzeniem braku planu.

Na telefonie warstwy zastępują widoczność karty dolnej, zamiast ją zasłaniać. Przy małej przestrzeni nad kartą chowają się kontrolki mapy. Wybranie kategorii dojścia upraszcza kartę adresu, aby zmieścić listę trzech wyników. Przyciski mają płaskie powierzchnie, a formularze i nawigacja korzystają z bezpiecznych marginesów ekranu.

## Weryfikacja

27 testów jednostkowych: progi, remisy, kierunek oceny, braki i lata, trend, jednostki, powierzchnie, dekodowanie danych, ranking sieciowy i nieosiągalne punkty. Testy przeglądarkowe obejmują prawdziwe MapLibre, szerokości 320/390/768/1440, oba motywy, obsługę planów i wstrzykniętej treści, zmianę podkładu, PWA offline oraz brak nakładania panelu i widocznych kontrolek.

Adres PRG Marynarki Polskiej 1 w Ustce: rzeczywista macierz piesza zwróciła 1,400 / 1,410 / 1,600 km do trzech szkół. Osobne zapytania trasy Valhalla dla tych par dały 1,551 / 1,580 / 1,824 km — rozbieżności 10–14% między macierzą a wyznaczoną trasą uzasadniają symbol przybliżenia. Testy regresji korzystają z kontrolowanych odpowiedzi, aby nie obciążać publicznego serwera.
