# Mapa działek i centrum danych gmin

Interfejs inspirowany systemowymi mapami: jeden panel boczny na komputerze, zwijana karta na telefonie, osobny katalog warstw i centrum danych gmin. Nazwa produktu pozostaje do ustalenia.

## Zmiany

- Trzy podkłady: spokojna mapa wektorowa (jasna/ciemna), ortofotomapa GUGiK i mapa topograficzna GUGiK. Warstwy EGiB i PRG pozostają niezależne od podkładu.
- Warstwy są dostępne jednym przyciskiem, z wyszukiwaniem, licznikiem aktywnych warstw, kryciem działek i legendą wewnątrz katalogu.
- 2479 profili gmin z GUS BDL i zestawu referencyjnego: ludność, finanse, przedsiębiorczość i warunki życia. Nazwa, typ gminy i TERYT są zawsze rozróżniane.
- Wspólne wyszukiwanie adresu, działki i gminy; skrót `/`; ostatnio otwierane gminy; przejście od działki do właściwej jednostki po TERYT.
- Link do aktualnego widoku mapy, wybranej działki albo gminy.
- Każdy wskaźnik podaje rok i źródło. Braki i nieznane lata są jawne; data zestawu nie jest rokiem statystyki.
- API serwuje teraz arkusze stylów i nowe zasoby, więc lokalny interfejs i publiczne Pages mają te same pliki.

## Granice tej zmiany

Punkty usług, istniejące odległości piesze budynków i siatki cen RCN są zintegrowane w katalogu warstw. Pełny opis bieżącej wersji, instalacji mobilnej i aktualizacji GUS znajduje się w EXPANSION.md. Nie dodano raportów, eksportów ani porównywania gmin. Położenie z zestawu referencyjnego jest punktem miejscowości, nie granicą gminy; nie służy do przypisywania klikniętej działki do gminy. Nieznanego punktu nie zastępujemy sąsiednią jednostką.

## Sprawdzenie

Wymagania testowe: Node.js 20+ oraz Playwright 1.62.1 (wyłącznie do testów; aplikacja nie ma bundlera ani zależności npm w przeglądarce).

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm check
python -m http.server 8091 --bind 127.0.0.1 --directory docs
# W drugim terminalu:
$env:BROWSER_CHANNEL='msedge'  # albo zainstaluj Chromium przez Playwright
pnpm test:browser
node tests/features-browser.cjs
```

Test przeglądarkowy używa prawdziwego MapLibre, ale kontrolowanych odpowiedzi API działek. Obejmuje 320, 390, 768 i 1440 px w obu motywach, zmianę podkładu bez utraty nakładek, wyszukiwanie, rozróżnianie gmin, metadane, zapis preferencji, link do widoku i regresję karty działki (powierzchnia w ha). Poza tym sprawdzono endpointy zasobów Flask bez połączenia z bazą.

## Wdrożenie i wycofanie

1. Zachowaj kopię dotychczasowych `docs/` i `server/public_api.py`.
2. Wgraj `docs/index.html`, `docs/app.js`, nowe `docs/design.css`, `docs/gminy*.js`, `docs/data/` oraz `docs/styles/`. Pozostaw istniejące `docs/config.js` i `docs/grupy.js`.
3. Wgraj `server/public_api.py` i uruchom ponownie proces API, aby lokalnie były dostępne nowe zasoby.
4. GitHub Pages nadal korzysta z katalogu `docs/`. Po publikacji sprawdź kafle EGiB z realnego API oraz trzy podkłady.
5. Wycofanie: przywróć kopie tych plików, uruchom ponownie API i odwróć commit w repozytorium. Nie przywracaj starego adresu tunelu z `config.js`.

## Sensowne kolejne dodatki

1. Katalog warstw z adapterami źródeł: identyfikator, kategoria, minimalne przybliżenie, legenda, data i warunki licencji.
2. Punkty usługowe Jakdaleko dostępne najpierw jako warstwy, z jednoznacznym pochodzeniem. Odległości piesze dodawać dopiero po decyzji o zakresie i integracji istniejącego grafu.
3. Oficjalne granice gmin i pobieranie danych po wskazaniu jednostki na mapie.
4. Kontrolowany import nowych obserwacji GUS z walidacją TERYT, jednostek i lat oraz wskazaniem zmian pokrycia.
5. Zapisane własne zestawy warstw, gdy katalog będzie większy; obecna wersja już zapamiętuje aktywne warstwy i krycie.
