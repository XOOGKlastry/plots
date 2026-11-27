# Plots: tryb „Dashboard” (koncepcja, bez wdrożenia)

Trzecia odnoga aplikacji obok **Mapy** (warstwy, karta gminy) i **Statystyk** (`window.StatsMap`, kartogram całej Polski). Dashboard pokazuje te same wskaźniki jako wykresy i rankingi dla jednej wybranej gminy i jej otoczenia. Motyw wyłącznie jasny, zgodny z `design.css`.

## 1. Co już mamy i z czego korzystamy

| Element | Co daje dashboardowi |
|---|---|
| `stats-map.js` | `state` (key, year, mode value/change/change10, metoda klas, paleta), `current.values` (Map kod TERYT → wartość), `series(def)` z latami, odtwarzanie lat (`time`), ranking `rankList`, synchronizacja URL `?stat=&rok=`, `UIHistory.open("stats")`. Publicznie: `open, close, isOpen, defs, gminy, series`. |
| `gminy-model.js` / `stats-model.js` | `model.definitions` i `model.metric(g, d)`: jedno źródło prawdy o wskaźnikach i ich wartościach. Filtr „co najmniej 50 gmin z wartością”. |
| `data/wskazniki-inne.json` | 308 zmiennych (Środowisko 94, Energia i ciepło 51, Wybory 39, Ludność 36, Finanse i firmy 32, Planowanie 18, inne). Format kolumnowy: `units[]` + `values[rok][indeks gminy]`. 229 zmiennych ma jeden rok, 70 trzy lata, 9 dwa lata. Pole `source` już zawiera nazwę instytucji (GUS, GIOŚ, GUGiK, CKE, GDOŚ, Eurostat). |
| `gus-energia.json` (8,5 MB), `gus-population.json` | Szeregi wieloletnie GUS (BDL): tu są właściwe trendy w czasie. |
| `ind-history.js` | Gotowy wzorzec wykresu „gmina na tle mediany Polski” w karcie gminy. Do uogólnienia. |
| `gminy.js` (`window.PLOTS_GMINY`) | `all()`, `current()`: wybrana gmina, lista z kodami, nazwami, powiatem. |
| `surroundings.json`, `gminy-centra.json` | Sąsiedztwo i centroidy: zbiór „sąsiadów” bez liczenia topologii w przeglądarce. |
| `motion.js` (`window.Motion`) | `countUp`, przełącznik ograniczenia ruchu: bazujemy na nim przy animacjach. |
| `layer-regroup.js` | Wzorzec bezpiecznego wdrażania: nowy układ jako nakładka, przełącznik w `localStorage` i `?uklad=stary`. Dashboard wprowadzamy tak samo (`?dash=0`). |

Wniosek: dashboard nie potrzebuje nowych danych na start. Potrzebuje wydzielenia wspólnego stanu i warstwy dostępu do wartości, które dziś siedzą wewnątrz domknięcia `stats-map.js`.

## 2. Wspólny stan trzech trybów

Nowy moduł `plots-state.js` (`window.PlotsState`), mały magazyn ze zdarzeniami:

```
{ tryb: "mapa" | "statystyki" | "dashboard",
  gmina: "0201011",          // kod TERYT, źródło: PLOTS_GMINY.current()
  wskaznik: "gaz_proc",      // klucz definicji
  rok: 2023 | null,          // null = najnowszy
  miara: "value" | "change" | "change10",
  porownanie: ["sasiedzi", "powiat", "wojewodztwo", "polska", "typ"],
  koszyk: ["gaz_proc", ...]  // przypięte wskaźniki dashboardu (localStorage)
}
```

* `PlotsState.set(patch)` emituje `plots:state` z listą zmienionych pól; każdy tryb słucha i aktualizuje tylko to, co go dotyczy.
* `stats-map.js` przestaje trzymać własne `state.key/year/mode`, czyta je z `PlotsState` (zmiana mechaniczna, interfejs `StatsMap` zostaje).
* Jeden zapis URL: `?tryb=dash&gmina=0201011&stat=gaz_proc&rok=2023`. Obecne `?stat=&rok=` nadal działają (zgodność linków).
* Historia: każde przejście trybu to wpis `UIHistory`, więc „wstecz” na telefonie wraca do poprzedniego trybu, nie zamyka aplikacji.

## 3. Płynne przejścia między trybami

Zasada: **ten sam obiekt wizualny zmienia formę, a nie znika**.

1. **Mapa → Statystyki**: działa dziś (`fitBounds(POLAND)`). Dodajemy: kafelek wskaźnika w karcie gminy „leci” do nagłówka panelu Statystyk (FLIP: zapamiętaj prostokąt, przenieś element, animuj `transform`).
2. **Statystyki → Dashboard**: kartogram zostaje w tle, przyciemnia się do 35% i kurczy do „minimapy” w rogu dashboardu (animacja kontenera mapy przez `transform: scale`, mapa nie jest przeładowywana). Kolor wybranej gminy z kartogramu staje się kolorem akcentu jej słupka w rankingu. Wiersz rankingu z panelu Statystyk przechodzi w pierwszy wykres dashboardu (FLIP).
3. **Dashboard → Mapa**: klik w gminę na dowolnym wykresie: `PlotsState.set({gmina})`, minimapa rozszerza się do pełnego ekranu, `flyTo` na gminę, otwiera się karta gminy.
4. **Zmiana wskaźnika lub roku** w dowolnym trybie: kartogram przełącza kolory przez `fill-color-transition` (MapLibre, 400 ms), słupki dashboardu animują wysokość, liczby używają `Motion.countUp`.
5. Przy włączonym ograniczeniu ruchu (`Motion.on() === false` lub `prefers-reduced-motion`) wszystkie przejścia stają się natychmiastowe, z krótkim przenikaniem 120 ms.
6. Technicznie: View Transitions API (`document.startViewTransition`) tam, gdzie jest dostępne (Chrome, Edge, Safari 18), w pozostałych ręczny FLIP. Mapa MapLibre nie bierze udziału w migawce view transition (wykluczona `view-transition-name: none`), animujemy tylko jej kontener.

Przełącznik trybów: segmentowy pasek „Mapa | Statystyki | Dashboard” u góry (desktop) lub dolny pasek z trzema ikonami (telefon). Skróty klawiszowe 1, 2, 3.

## 4. Układ ekranów

### Desktop (od 1024 px)

```
+---------------------------------------------------------------+
| [Mapa|Statystyki|Dashboard]  Gmina: Elbląg ▾  Wskaźnik ▾  Rok ▾|
+-------------------+-------------------------------------------+
| Minimapa (kartogram| KPI: wartość | miejsce w Polsce | percentyl|
| całej Polski,      |  | zmiana 10 lat | vs mediana powiatu     |
| klik = wybór gminy)+-------------------------------------------+
|                    | Wykres A: gmina na tle sąsiadów (słupki)  |
| Koszyk wskaźników  +---------------------+---------------------+
| (przypięte, drag)  | Wykres B: trend      | Wykres C: rozkład   |
|                    | gmina/powiat/woj/PL  | Polski (beeswarm)   |
|                    +---------------------+---------------------+
|                    | Ranking (tabela, sortowanie, filtr woj.)  |
+-------------------+-------------------------------------------+
```

Siatka CSS 12 kolumn, karty wykresów przestawialne i zwijane, lewy pas 320 px. Szerokość wykresów liczona z kontenera (`ResizeObserver`).

### Telefon (poniżej 768 px)

* Górny pasek: nazwa gminy i wskaźnik jako dwa „chipy” otwierające arkusz wyboru (ten sam `sheet` co w Statystykach).
* Treść: pionowy stos kart, jedna karta = jeden wykres, przewijanie z `scroll-snap`. Pierwsza karta to KPI i minimapa (120 px wysokości).
* Poziome przesunięcie palcem na karcie zmienia wskaźnik w obrębie koszyka; zmiana roku suwakiem przy dolnej krawędzi.
* Ranking jako lista z przypiętą na górze wybraną gminą („Twoja gmina: 412. z 2477”), reszta ładowana porcjami.
* Dolny pasek trybów 56 px, ikony z `icons.js`.

### Tablet (768 do 1023 px)

Minimapa nad kartami, karty w dwóch kolumnach.

## 5. Typy wykresów i rankingów

### Porównania (dla jednego wskaźnika i roku)

1. **Kafle KPI**: wartość, miejsce w Polsce i w województwie, percentyl, odchylenie od mediany powiatu, zmiana r/r i 10 lat. Każdy kafel ma ikonę źródła i podpis instytucji.
2. **Gmina na tle sąsiadów**: poziome słupki, gmina wyróżniona akcentem, linia mediany Polski. Sąsiedzi z `surroundings.json`.
3. **Drabinka szczebli**: punktowy wykres „gmina, powiat, województwo, Polska” na jednej osi (dot plot). Wartości wyższych szczebli liczone jako mediana gmin lub, gdzie ma sens, suma licznika przez sumę mianownika (do oznaczenia w definicji wskaźnika: `agg: "median" | "sum" | "weighted"`).
4. **Gminy podobne**: 10 gmin tego samego typu (miejska, wiejska, miejsko-wiejska, ostatnia cyfra TERYT) i podobnej liczby ludności (±20%). Uczciwsze niż porównanie z miastem wojewódzkim.
5. **Rozkład Polski**: beeswarm lub histogram 2477 gmin z zaznaczoną wybraną gminą i sąsiadami; najechanie pokazuje nazwę.

### Trendy w czasie

6. **Linia gminy na tle szczebli**: gmina, mediana powiatu, województwa, Polski, z pasmem 25 do 75 percentyla Polski (uogólnienie `ind-history.js`).
7. **Mała seria (small multiples)**: wszystkie wskaźniki z koszyka jako sparkliny w siatce, wspólny zakres lat.
8. **Wykres slope**: początek i koniec okresu dla gminy i sąsiadów, kto rośnie, kto spada. Dobry dla zmiennych z 2 lub 3 latami, których jest 79.
9. **Wyścig rankingów (bump chart)**: miejsce w powiecie w kolejnych latach; jednocześnie odpowiednik animacji lat z kartogramu (ten sam suwak `time`).

Dla 229 zmiennych jednorocznych trendy są ukryte, a karta pokazuje porównania zamiast pustego wykresu.

### Rankingi

10. **Tabela rankingowa**: sortowanie, filtr województwa, powiatu i typu gminy, wyszukiwarka, kolumna zmiany miejsca od poprzedniego roku (strzałki).
11. **Najwięksi wzrostowi i spadkowi** w Polsce i w województwie (miara `change10`).
12. **Profil gminy w percentylach**: dla całego koszyka jeden wiersz na wskaźnik, kropka na skali 0 do 100 percentyla. Najszybszy obraz mocnych i słabych stron.

### Nietypowe formy (etap późniejszy)

13. **Kartogram heksagonalny lub kafelkowy powiatu**: gminy jako równe kafle, bez dominacji dużych gmin wiejskich.
14. **Wykres rozrzutu dwóch wskaźników** (np. udział OZE a dochody własne na mieszkańca), z linią trendu i wyróżnioną gminą; kolor z trzeciego wskaźnika lub województwa.
15. **Wykres radarowy jest odrzucony** (trudny do odczytu); zamiast niego profil percentylowy (pkt 12).
16. **Mapa korelacji**: macierz współczynników Spearmana dla wskaźników koszyka, liczona w Web Workerze.
17. **Opowieść gminy**: automatyczne zdania z danych („Gmina jest w 10% gmin o najwyższym udziale ogrzewania gazowego w województwie”), generowane regułami, bez modelu językowego.

## 6. Źródła na wykresach

* Podpis pod każdym wykresem: nazwa instytucji i rok, np. „Źródło: Główny Urząd Statystyczny, Bank Danych Lokalnych, 2023”. Wartości z pola `source` definicji, z mapowaniem skrótów na pełne nazwy (GUS → Główny Urząd Statystyczny, GIOŚ → Główny Inspektorat Ochrony Środowiska, GUGiK, GDOŚ, CKE, PKW, URE, Eurostat).
* Nigdy nazwy tabel ani kluczy bazy danych. Klucze typu `pkw_p25_2_frek` tylko w URL.
* Eksport wykresu (PNG/SVG) i tabeli (CSV) zawiera ten sam podpis źródła.

## 7. Technologia wykresów

* Bez ciężkiej biblioteki: własne SVG generowane w JS (jak `ind-history.js`), wspólny moduł `charts.js` z 6 prymitywami: słupki, linia, punkty, beeswarm, rozrzut, sparklina. Szacunek: 15 do 20 kB.
* Kolory: paleta kartogramu Statystyk (ta sama skala klas co mapa, żeby słupek miał kolor gminy na mapie) oraz jeden akcent dla wybranej gminy. Szare tło dla pozostałych gmin.
* Dostępność: każdy wykres ma tabelę zastępczą (`<details>`), etykiety ARIA, obsługa klawiatury w rankingu.

## 8. Plan wdrożenia etapami

| Etap | Zakres | Ryzyko dla obecnej aplikacji |
|---|---|---|
| 0. Wydzielenie | `plots-state.js`, warstwa danych `indicator-store.js` (wartości, percentyle, mediany szczebli z cache), `stats-map.js` czyta z nich. Bez zmian w UI. | Średnie; testy linków `?stat=&rok=` i animacji lat. |
| 1. Szkielet | Przełącznik trybów, pusty dashboard z KPI i rankingiem, flaga `?dash=1` i `localStorage` jak w `layer-regroup.js`. | Niskie (wyłączone domyślnie). |
| 2. Porównania | Wykresy 2, 3, 4, 5; podpisy źródeł; telefon. | Niskie. |
| 3. Przejścia | View Transitions i FLIP, minimapa, `fill-color-transition`, wspólny suwak roku. | Średnie (wydajność telefonów). |
| 4. Trendy | Wykresy 6 do 9 na danych GUS wieloletnich i 3-letnich zmiennych. | Niskie. |
| 5. Koszyk i profil | Przypinanie wskaźników, profil percentylowy, small multiples, eksport. | Niskie. |
| 6. Formy nietypowe | Rozrzut, kafle powiatu, korelacje, opowieść gminy. | Niskie. |
| 7. Domyślne włączenie | Po okresie testów flaga domyślnie włączona, `?dash=0` jako wyjście. | |

## 9. Ryzyka wydajności i odpowiedzi

1. **Wielkość danych**: `wskazniki-inne.json` 5,4 MB i `gus-energia.json` 8,5 MB. Dashboard ładuje je leniwie dopiero przy pierwszym wejściu; docelowo podział na pliki per kategoria lub per wskaźnik (format kolumnowy, gzip, cache w Service Workerze `sw.js`). Wskaźnik wybrany = jeden plik kilkadziesiąt kB.
2. **Percentyle i mediany szczebli** dla 308 zmiennych × lata × 2477 gmin: liczyć leniwie dla wskaźnika w użyciu, w Web Workerze, z cache `Map`. Opcjonalnie prekompilacja median powiatów i województw przy budowie danych.
3. **Beeswarm 2477 punktów**: SVG z tyloma węzłami tnie animacje na telefonach. Rysować na `<canvas>`, a SVG tylko dla wyróżnionych gmin; alternatywnie histogram na telefonie.
4. **Równoległa mapa i wykresy**: podczas dashboardu kartogram jako minimapa; przy słabym urządzeniu (`navigator.hardwareConcurrency <= 4` lub wolne klatki) zamieniać minimapę na statyczny obraz zrzucony z mapy (`map.getCanvas().toDataURL()`), a MapLibre wstrzymać.
5. **View Transitions z WebGL**: migawka płótna mapy jest kosztowna i potrafi migać. Mapę wykluczamy z migawki i animujemy tylko kontener.
6. **Animacja lat** w dwóch miejscach naraz (mapa i wykresy): jeden zegar w `PlotsState`, rysowanie przez `requestAnimationFrame`, wykresy aktualizują tylko zmienione elementy.
7. **Pamięć**: obiekty Map per wskaźnik zwalniane po wyjściu z koszyka (LRU, np. 12 wskaźników).
8. **Pierwsze wejście z linku** `?tryb=dash`: najpierw KPI i ranking z jednego pliku, wykresy porównawcze potem, trendy na końcu (progresywne ładowanie, szkielety kart).

## 10. Otwarte pytania do decyzji

* Czy agregaty powiatu i województwa mają być medianą gmin czy wartością oficjalną GUS dla jednostki (gdzie istnieje)?
* Czy koszyk wskaźników ma być udostępnialny w linku (dłuższy URL), czy tylko lokalny?
* Czy dashboard ma mieć tryb wydruku (A4, raport gminy) wspólny z `report.js`?
