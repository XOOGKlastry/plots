# Oceny gmin i wybór punktu

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
