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

## Skala mapy i karta miejsca

Przy z < 13 aplikacja pokazuje zakładkę gminy. Kliknięcie ustala gminę po pełnej geometrii i otwiera jej granice. Z bliska wybierany jest adres lub działka; gdy kafel jeszcze jej nie zawiera, aplikacja próbuje API punktowego. Brak działki pozostawia kartę wskazanego punktu.

Działka ma trzy grupy: dane działki (w tym powierzchnia pełnej geometrii), MPZP i plany ogólne oraz ewidencja/własność. Adres ma analogiczne grupy i działkę pod adresem. MPZP, POG uchwalone i projekty są odpytywane automatycznie dla klikniętego punktu, niezależnie od widoczności rastrów. Informacje nie oznaczają parametrów całej działki; punktowy zakres jest podpisany. HTML jest oczyszczany do list faktów i bezpiecznych linków. Brak odpowiedzi usługi nie potwierdza braku planu. Żądania mają limit czasu, deduplikację i krótki cache; stare odpowiedzi nie nadpisują nowej karty.

## Osobny moduł odległości

Przycisk w karcie i na mapie otwiera oddzielny panel. Działki, adresy i granice gmin są wtedy ukryte, a kategoria obiektów i jej punkty włączane. Powrót przywraca poprzedni widok i ustawienia. Panele nie nakładają się na siebie. Na małym ekranie moduł można zwinąć, aby odsłonić mapę.

Dostępność pokazują punkty reprezentujące budynki mieszkalne BDOT10k, zgodnie z istniejącym indeksem danych. Nie są to obrysy budynków ani powierzchniowe izochrony. Kolor oznacza przybliżony czas do najbliższego obiektu całej kategorii po sieci pieszej przy 5 km/h. Cztery niebieskie przedziały to do 5, 5–15, 15–30 i ponad 30 minut; szary oznacza brak danych. Na progach kolor przechodzi do następnego przedziału. Dla pojedynczego budynku dostępny jest odczyt przybliżonego czasu.

Dane `p/{tile}.bin` przechowują lokalizacje i aktywność; `d/{network}/{tile}.bin` ma kod dla każdego oryginalnego indeksu budynku. Filtrowanie nie zmienia kolejności przed złączeniem. Odległość jest skwantowana co 20 m do 2 km, co 100 m do 10 km i co 500 m dalej. Kod 254 oznacza co najmniej 47 km, 255 brak danych. Filtry „do” i „dalej niż” wykluczają brak danych; dostępne progi to 5, 10, 15, 20, 25, 30, 40, 50 i 60 min. Domyślny widok pokazuje wszystkie budynki, w tym jawnie oznaczone braki.

Źródła są wstępnie przeliczone do najbliższego obiektu kategorii, także poza ekranem. To nie jest odległość tylko od klikniętego obiektu. Widok działa od z=13, ma limit 50 tys. punktów i prosi o przybliżenie po przekroczeniu. Nie pobiera całego kraju. Zmiana widoku lub kategorii unieważnia starszą odpowiedź. Nieudane pobranie jest błędem, a nie pustą dostępnością.

Dla wybranego adresu, działki, punktu lub budynku można osobno pobrać trzy najbliższe dojścia z macierzy pieszej Valhalla/OSM. Ranking używa czasu po drogach; przerywane proste pokazują wyłącznie kierunek. Limit wyszukiwania i niepełny wynik są jawne. Wynik i punkt usług mają odnośnik do Google Maps pod właściwymi współrzędnymi. Macierz na żywo oraz wcześniejsze dane BDOT10k mogą się różnić aktualnością i siecią.

## Kontroler i wskaźniki

Kontroler warstw zawiera trzy podkłady i trzy zwijane grupy: planowanie, ceny oraz wygląd/informacje. Działki, adresy i granice wybranej gminy są domyślnie włączone, zależnie od skali i trybu. Ustawienia techniczne pozostają w ostatniej grupie. Usługi i dojścia mają własny moduł. Oddzielny przycisk kolorów działek przełącza neutralne granice i grupy rejestrowe; legenda znajduje się przy tym wyborze.

Przegląd gminy grupuje sześć głównych wskaźników w ludność/demografię, finanse oraz mieszkanie/infrastrukturę. Każdy wskaźnik i kategoria mają lokalną ikonę Phosphor. Dalsze wskaźniki, źródła i roczniki pozostają w tematycznych zakładkach. Zasady 20/60/20 i braków danych opisano wyżej. Animacje respektują ustawienie ograniczenia ruchu.

## Weryfikacja

Testy jednostkowe obejmują m.in. progi kodowania odległości, brak połączenia, zgodność indeksów budynków, powierzchnie działek, TERYT, rankingi i roczniki GUS. Testy przeglądarkowe sprawdzają zmianę skali, kartę działki z punktowymi planami, niezależność modułu, rzeczywiste pliki budynków, filtry, trzy dojścia, Google Maps, kolory, grupy wskaźników, kontekst gmin i wyszukiwanie. Testy API granic i punktu wykonują wyłącznie odczyt bazy.

Źródła techniczne: https://valhalla.github.io/valhalla/api/matrix/ oraz https://eteryt.stat.gov.pl/ . Ikony: Phosphor regular 2.1.1, lokalne SVG, MIT. Poprzedni generator poligonowych korytarzy i jego endpoint usunięto. Wdrożenie obejmuje `docs/`, `server/public_api.py` i `server/admin_api.py`; zmiana wersji cache aktualizuje PWA.
