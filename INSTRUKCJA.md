# Instrukcja projektu **plots** – mapa działek EGiB z grupami rejestrowymi

> Dokument przekazania projektu (np. do ChatGPT). Wszystkie ścieżki, nazwy plików i komendy sprawdzone na repozytorium `XOOGKlastry/plots` i na komputerze **OptimusPrime** (31.10.2026).
> **Nie ma tu żadnych haseł ani sekretów** – i nie wklejaj ich do ChatGPT. Hasło do Postgresa jest w `pgpass` na OptimusPrime, nie w repo.

---

## 1. Cel projektu

Przeglądarkowa mapa działek ewidencyjnych (EGiB) z całej Polski, pokolorowanych wg **grupy rejestrowej 1–16** (kto jest właścicielem: Skarb Państwa, gmina, osoby fizyczne, kościoły…). Klik w działkę → karta z numerem, ID, obrębem, użytkami, powierzchnią, datą aktualności. Wyszukiwanie po adresie (punkty adresowe PRG) i po `id_dzialki`. Działa na komputerze i telefonie.

- Mapa publiczna: **https://xoogklastry.github.io/plots/**
- Repozytorium: **https://github.com/XOOGKlastry/plots** (branch `main`, GitHub Pages z folderu `/docs`)

---

## 2. Architektura

```
[Przeglądarka] ── https://xoogklastry.github.io/plots/  (GitHub Pages, statyczne pliki z /docs)
      │  kafle MVT + API (fetch, CORS *)
      ▼
[Cloudflare quick tunnel]  https://<losowe-słowa>.trycloudflare.com   (zmienia się po każdym restarcie!)
      ▼
[OptimusPrime]  Flask  server\public_api.py  na http://127.0.0.1:5001
      ▼
[PostgreSQL 18 + PostGIS]  localhost, baza gisss (egib.dzialki, administracja."punktyAdresowe")
```

| Element | Gdzie | Uwagi |
|---|---|---|
| Frontend | repo `docs/` → GitHub Pages; kopia w `C:\Users\kompu\dzialki\plots\docs` | MapLibre GL 4.7.1, czysty JS bez bundlera |
| API/kafle | `C:\Users\kompu\dzialki\plots\server\public_api.py` | Flask + psycopg 3, port 5001; serwuje też `docs/` pod `/` |
| Baza | PostgreSQL 18 (`C:\Program Files\PostgreSQL\18\bin`), user `postgres`, localhost | bazy `dzialki` (pobieranie) i `gisss` (serwowanie) |
| Tunel | `C:\Users\kompu\dzialki\tools\cloudflared.exe` | quick tunnel `*.trycloudflare.com`, bez konta |
| Tray | `plots\tray_app.py` (uruchamiany przez `plots\start.bat`) | ikona siatki w zasobniku: start API + tunelu |
| Python | venv `C:\Users\kompu\dzialki\.venv` | |

### Tray app, start.bat, _start_tunnel.ps1
- `plots\start.bat` – ustawia `PLOTS_DSN` (domyślnie `postgresql://postgres@localhost/gisss`) i `PLOTS_PORT=5001`, doinstalowuje `pystray`+`Pillow`, uruchamia `tray_app.py` przez `pythonw` (bez okna).
- `plots\tray_app.py` – uruchamia `server\public_api.py` (jeśli `/health` nie odpowiada) i tunel. Menu (prawy klik na ikonie): Otwórz mapę (lokalnie / Pages), Pokaż/kopiuj URL tunelu, **Restartuj tunel**, Wyjdź (zatrzymuje API i cloudflared).
- `plots\_start_tunnel.ps1` – zabija stary `cloudflared`, startuje `cloudflared tunnel --url http://127.0.0.1:5001 --no-autoupdate`, czeka ≤90 s na URL, zapisuje go do `C:\Users\kompu\dzialki\tunnel_url.txt` i **podmienia `TILES_URL` w `docs\config.js`** (lokalnie – trzeba to potem wypchnąć na GitHub!). Logi: `C:\Users\kompu\dzialki\cloudflare.out` i `cloudflare.out.err`.

---

## 3. Bazy danych

Obie na `localhost:5432`, użytkownik `postgres` (hasło w pgpass – nie w repo).

### 3.1 Baza `dzialki` – „robocza” (pobieranie z WFS)
Schemat `public` (definicja: `C:\Users\kompu\dzialki\schema.sql`):

| Tabela | Kolumny | Indeksy |
|---|---|---|
| `dzialki` (~38,7 mln) | `id_dzialki` text PK, `teryt_powiatu` char(4), `jednostka`, `gmina`, `obreb`, `nazwa_obrebu`, `numer_dzialki`, `pole_ewid` float8 (**hektary**), `grupa_rej` text (np. `"7"` lub `"4,7"`), `klasouzytki`, `ma_grupe_rej` bool, `ma_uzytki` bool, `wyjatek` bool, `dane_ukryte` bool, `data_zrodla` text, `epsg_zrodla` int, `zrodlo` text, `geom` MultiPolygon **SRID 2180**, `geom_src` (oryginał, SRID źródła), `hash_geom`, `hash_attr`, `wersja`, `pobrano` | `dzialki_pkey`, `dzialki_geom_gix` (GiST), `dzialki_teryt_ix`, `dzialki_wyj_ix` |
| `dzialki_historia` | jak `dzialki` + `hist_id` PK, `wazna_do`, `sprawdzenie_id`, `powod` | `hist_id_ix`, `hist_geom_gix` |
| `sprawdzenia` | `id`, `teryt`, `start`, `koniec`, `status`, `pierwsze_zaladowanie`, `n_pobrane`, `podsumowanie` jsonb, `blad`, `sek` | PK |
| `zmiany` | `id`, `sprawdzenie_id`, `teryt`, `ts`, `typ` (nowa/usunieta/geometria/atrybuty/podzial/scalenie/reorganizacja/zmiana_numeru), `id_dzialki`, `poprzednicy[]`, `nastepcy[]`, `szczegoly` jsonb | `zmiany_teryt_ix` |
| `powiaty_status` | `teryt` PK, `nazwa`, `url` (WFS), `n_dzialek`, `ostatnie_pobranie`, `ostatnie_sprawdzenie`, `status` (ok/blad/brak_wfs…), `blad`, `sek` | PK |

### 3.2 Baza `gisss` – „serwująca” (z niej czyta API)
- **Schemat `egib`**: kopie `dzialki`, `powiaty_status`, `zmiany`, `sprawdzenia` (te same kolumny i indeksy co wyżej; `egib.dzialki.geom` MultiPolygon SRID 2180). Kopiowane przez `egib_copy.cmd` (pg_dump z `dzialki` → pg_restore do `gisss` → `ALTER TABLE … SET SCHEMA egib`).
- **`administracja."punktyAdresowe"`** (~8,5 mln, PRG): `id` int4 PK, `geom` **Point SRID 2180**, `fid`, `ID_IIP`, `NUMER_PORZ`, `KOD_POCZT`, `DATA_NAD`, `NAZWA_ULC`, `ID_ULIC`, `NAZWA_GMI`, `TERYT_GMI`, `NAZWA_MSC`, `ID_SIMC`. Nazwy kolumn wielkimi literami → w SQL zawsze w cudzysłowie: `"NAZWA_ULC"`.
  Indeksy: `punktyAdresowe_pkey`, `punktyAdresowe_geom_gist`, `pa_geom_gist`, trigramowe `pa_ulc_trgm`, `pa_msc_trgm`, `pa_num_trgm`, `pa_kod_trgm`, oraz `pa_num`.

Kafle robione są w locie: `ST_AsMVT` + `ST_Transform(geom, 3857)` z filtrem `geom && ST_Transform(ST_TileEnvelope(z,x,y), 2180)`.

Uruchamianie SQL na OptimusPrime (PowerShell – najlepiej z pliku, bo cudzysłowy w `-c` się psują):
```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -U postgres -d gisss -f C:\temp\zapytanie.sql
```

---

## 4. Pliki i ich rola

### 4.1 Repo `XOOGKlastry/plots` (na OptimusPrime: `C:\Users\kompu\dzialki\plots`)
| Plik | Rola |
|---|---|
| `docs/index.html` | struktura strony: mapa, wyszukiwarka, panel/arkusz `#panel` z zakładkami, pasek `#tabbar` (telefon), przyciski |
| `docs/app.js` | cała logika frontu (sekcja 6) |
| `docs/style.css` | wygląd: jasny/ciemny motyw, desktop (panel z lewej) i mobile (<768 px, bottom sheet) |
| `docs/config.js` | `TILES_URL` (adres tunelu), `MIN_ZOOM: 13`, `ADR_MIN_ZOOM: 16` |
| `docs/grupy.js` | `window.GRUPY_REJ` (opisy grup 1–16) i `window.GRUPY_COLORS` (kolory, plus `brak`) |
| `server/public_api.py` | Flask: kafle MVT, API, serwowanie `docs/` |
| `server/requirements.txt` | `flask>=3`, `psycopg[binary]>=3` |
| `start.bat`, `tray_app.py`, `_start_tunnel.ps1` | start w zasobniku, tunel (sekcja 2) |
| `assets/grid.ico`, `grid.png` | ikona tray |
| `scripts/export_geojson_powiat.py`, `samples/` | pomocnicze: eksport GeoJSON powiatu, próbka |
| `README.md` | krótki opis (starszy) |

Na OptimusPrime w `docs\` leżą też kopie zapasowe `*.bak`, `*.bak2`, `*.bak3` (nie są w repo).

### 4.2 Pipeline pobierania (`C:\Users\kompu\dzialki`, poza repo)
| Plik | Rola |
|---|---|
| `pobierz.py` | pobiera działki z WFS EGiB powiatu (stronicowanie po 1000, kafelki, 3 wątki), mapuje atrybuty (`MAP`), zapis do `out\`, log `pobierz.log` |
| `sync.py` | `python sync.py 0209 0210 \| --all \| --init` – ładuje powiat do bazy `dzialki`, porównuje z poprzednią wersją (historia, `zmiany`, podziały/scalenia), `--init` tworzy schemat z `schema.sql` i wypełnia `powiaty_status` z `uslugi.csv`. DSN: `DZIALKI_DSN` |
| `run_all.py` | `python run_all.py --workers 4 --retry-blad` – wznawialne pobieranie wszystkich powiatów bez statusu ok/brak_wfs, równolegle, ale max 1 na host; log `run_all.log` |
| `naprawa.py` | ponowne pobranie wskazanych powiatów (lista TERYT jako argumenty) |
| `app.py` (+ `mapa.py`) | wewnętrzny panel na **http://127.0.0.1:5000**: lista powiatów, „Sprawdź aktualność”, raport zmian, prosta mapa |
| `schema.sql` | schemat bazy `dzialki` |
| `egib_copy.cmd` | kopiuje tabele z `dzialki` do `gisss.egib` (log `egib_copy.log`) |
| `start_public_api.cmd`, `start_tunnel.cmd`, `start_panel.cmd`, `start_run.cmd`, `naprawa1.cmd`, `naprawa2.cmd` | wrappery dla zadań harmonogramu |
| `uslugi.csv`, `przeglad.py`, `probe_*.py`, `recheck.py`, `fix_ukryte.py` | lista usług WFS i skrypty diagnostyczne |
| `tunnel_url.txt` | aktualny URL tunelu |
| `*.out`, `*.log` | logi (`public_api.out`, `cloudflare.out`, `app.out`, `run_all.out`…) |

### 4.3 Zadania Harmonogramu (Task Scheduler, folder główny)
| Zadanie | Uruchamia |
|---|---|
| `DzialkiPublicApi` | `start_public_api.cmd` → API :5001 (log `public_api.out`) |
| `DzialkiTunnel` | `start_tunnel.cmd` → cloudflared (log `cloudflare.out`) |
| `DzialkiPanel` | `start_panel.cmd` → `app.py` :5000 |
| `DzialkiPobieranie` | `start_run.cmd` → `run_all.py --workers 4 --retry-blad` |
| `DzialkiNaprawa1` | `naprawa1.cmd` → `sync.py 0461 0462 0261` |
| `DzialkiNaprawa2` | `naprawa2.cmd` → `naprawa.py <lista TERYT>` |
| `DzialkiEgibCopy` | `egib_copy.cmd` → kopia do `gisss.egib` |

Wszystkie mają **jednorazowe** wyzwalacze czasowe (październik 2026) – służą głównie do ręcznego startu: `Start-ScheduledTask DzialkiPublicApi`. Nie startują same po restarcie komputera.

---

## 5. API i zmienne środowiskowe

Baza URL: `TILES_URL` (tunel) albo `http://127.0.0.1:5001`. CORS `*` na wszystkim.

| Endpoint | Opis |
|---|---|
| `GET /tiles/{z}/{x}/{y}.pbf` | MVT, warstwa `dzialki` (od zoom 13): `id_dzialki`, `numer_dzialki`, `obreb`, `nazwa_obrebu`, `pole_ewid`, `grupa_rej`, `g1` (pierwsza grupa – do koloru), `klasouzytki`, `data_zrodla`… |
| `GET /tiles/adresy/{z}/{x}/{y}.pbf` | MVT, warstwa `adresy` (od zoom 16) |
| `GET /api/at?lon=&lat=` | działka pod punktem: atrybuty + `bbox`, `grupa_opis`, `grupy:[{nr,opis}]` |
| `GET /api/dzialka?id=` | działka po `id_dzialki` (+ bbox) |
| `GET /api/adres?q=` | wyszukiwanie adresu (lower() LIKE po kolumnach ulica/miejscowość/numer/kod) |
| `GET /api/adresy/meta` | wykryte kolumny tabeli adresów |
| `GET /api/grupy` | słownik grup 1–16 |
| `GET /health` | `{"ok":true,"port":5001,"minzoom":13}` |
| `GET /`, `/index.html`, `/app.js`, `/config.js`, `/grupy.js` | frontend z `docs/` (**`/style.css` nie jest serwowany** – patrz Znane problemy) |

| Zmienna | Domyślnie | Opis |
|---|---|---|
| `PLOTS_DSN` | `postgresql://postgres@localhost/gisss` | połączenie (hasło z pgpass) |
| `PLOTS_PORT` | `5001` | port |
| `PLOTS_MINZ` | `13` | min. zoom kafli działek |
| `PLOTS_CONCURRENCY` | `6` | równoległe zapytania do bazy |
| `PLOTS_ADR_SCHEMA` / `PLOTS_ADR_TABLE` | `administracja` / `punktyAdresowe` | tabela adresów |
| `PLOTS_ADR_MINZ` | `16` | min. zoom adresów |
| `DZIALKI_DSN` | `postgresql://postgres@localhost/dzialki` | pipeline (`sync.py`) |

---

## 6. Frontend

### 6.1 config.js
```js
window.PLOTS_CONFIG = {
  TILES_URL: "https://<tunel>.trycloudflare.com",
  MIN_ZOOM: 13,
  ADR_MIN_ZOOM: 16
};
```
Nadpisanie w przeglądarce: `?tiles=http://127.0.0.1:5001`. Inne parametry URL: `?id=<id_dzialki>`, `?q=<adres>`.

### 6.2 app.js – moduły (kolejno w pliku, jedna funkcja IIFE)
1. **Konfiguracja i `store`** – `localStorage` z prefiksem `plots.` (podkład, widok mapy, warstwy, krycie).
2. **`BASEMAPS` + `setBasemap(id, save)`** – lista podkładów, miniatury w zakładce Warstwy.
3. **Inicjalizacja mapy** (MapLibre), zapamiętanie widoku `plots.view`.
4. **Warstwy**: `base` (raster), `hill` (cieniowanie Esri), `dz-fill` / `dz-line` / `dz-sel` (działki, kolor wg `g1` z `GRUPY_COLORS`), `adr-pt` / `adr-lbl` (adresy).
5. **Panel / bottom sheet**: `tab(name)`, `snap(hidden|peek|half|full)`, `snapY()`, przeciąganie palcem, `#tabbar`, `#layersFab`.
6. **Karta działki `parcelCard`**: nagłówek „Działka N”, ID + Kopiuj, chip(y) grupy, siatka 2×2 (Obręb, Użytki, Powierzchnia [ha], Aktualność), „Pełne informacje” (wszystkie atrybuty). `adrCard` – karta adresu.
7. **Legenda** – generowana z `GRUPY_REJ`/`GRUPY_COLORS`.
8. **Wyszukiwarka** – podpowiedzi z `/api/adres`, ID działki → `/api/dzialka`, fallback Nominatim.
9. **Klik w mapę** → `/api/at`, podświetlenie, `padding()` (żeby działka nie była pod panelem).
10. **Geolokalizacja**, toast, przełączniki warstw, deep linki.

### 6.3 Podkłady (`BASEMAPS` w app.js)
`esri-img` (Esri satelita), `gp-orto` (Ortofoto Geoportal WMTS StandardResolution), `gp-hr` (Ortofoto HD – WMS HighResolution, tylko duże zoomy), `gp-topo` (Topo Geoportal WMS), `esri-topo`, `esri-street`, `osm`, `gray-light` (domyślny, max z16), `gray-dark`. Odrzucone: Carto (znak wodny „API KEY”), BDOT (401).

**Jak dodać podkład** – dopisz obiekt do tablicy `BASEMAPS`:
```js
{ id: "moj", name: "Moja nazwa", url: "https://serwer/{z}/{x}/{y}.png", max: 19, attr: "© Autor" },
// WMS: url: wms("https://serwer/WMS", "NazwaWarstwy", "image/png")   (helper wms() używa {bbox-epsg-3857})
// opcjonalnie thumb: [z, x, y] – kafel do miniatury, gdy domyślny jest pusty
```
Uwaga: Esri ma `{z}/{y}/{x}` (odwrotnie). Sprawdź, czy serwer wysyła CORS i działa po HTTPS.

### 6.4 Układ
- **Desktop (≥768 px)**: szklany panel po lewej (`--pw: 380px`), zakładki Działka/Warstwy/Legenda, przycisk zwijania `#collapse`, wyszukiwarka u góry.
- **Telefon (<768 px)**: wyszukiwarka u góry + przycisk lokalizacji obok; po prawej przycisk warstw i zoom; na dole stały `#tabbar` (Działka, Warstwy, Legenda, Szukaj); nad nim **bottom sheet** (stany hidden/peek/half/full, przeciąganie, swipe w dół zamyka, przesunięcie mapy zwija do peek). Safe-area (`env(safe-area-inset-*)`) uwzględnione. Style w `@media (max-width:767px)` w `style.css`; pozycje stanów liczy `snapY()` w app.js.
- Motyw jasny/ciemny automatycznie (`prefers-color-scheme`), fonty Manrope + JetBrains Mono (Bunny Fonts).

### 6.5 Legenda grup 1–16 (`docs/grupy.js`)
1 Skarb Państwa (bez UW) · 2 Skarb Państwa (z UW) · 3 Spółki SP, przeds. państwowe · 4 Gminy (bez UW) · 5 Gminy (z UW) · 6 Spółki JST i inne osoby prawne samorządu · 7 Osoby fizyczne · 8 Spółdzielnie · 9 Kościoły i związki wyznaniowe · 10 Wspólnoty gruntowe · 11 Powiaty (bez UW) · 12 Powiaty (z UW) · 13 Województwa (bez UW) · 14 Województwa (z UW) · 15 Spółki prawa handlowego · 16 Inne. Kolor zmieniasz w `GRUPY_COLORS` (`"brak"` = bez grupy). Ten sam słownik jest w `public_api.py` (`GRUPY`) – zmieniaj w obu.

---

## 7. Uruchamianie, zatrzymywanie, restart

**Start (normalnie):**
```bat
cd %USERPROFILE%\dzialki\plots
start.bat
```
albo przez harmonogram: `Start-ScheduledTask DzialkiPublicApi; Start-ScheduledTask DzialkiTunnel`.

**Sprawdzenie:**
```powershell
(iwr http://127.0.0.1:5001/health -UseBasicParsing).Content
Get-Content C:\Users\kompu\dzialki\tunnel_url.txt
Get-NetTCPConnection -LocalPort 5001 -State Listen
Get-Process cloudflared
```

**Stop:** tray → „Wyjdź”, albo:
```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5001 -State Listen).OwningProcess -Force
Get-Process cloudflared | Stop-Process -Force
```

**Restart API po zmianie `public_api.py`:** zatrzymaj proces na :5001, potem `Start-ScheduledTask DzialkiPublicApi` (albo tray). Tunel nie musi być restartowany – URL zostaje.

### Po zmianie tunelu (nowy URL)
1. Tray → „Restartuj tunel” (albo `start.bat`). Nowy URL: `C:\Users\kompu\dzialki\tunnel_url.txt`; skrypt sam wpisuje go do `plots\docs\config.js`.
   (Jeśli tunel był uruchomiony przez `DzialkiTunnel`/`start_tunnel.cmd`, config.js **nie** jest aktualizowany – URL jest w `cloudflare.out`; wpisz ręcznie.)
2. Wypchnij `docs/config.js` na GitHub (zmieniona linia `TILES_URL: "https://…trycloudflare.com"`).
3. Po ~1 min Pages ma nowy adres. Doraźnie: `https://xoogklastry.github.io/plots/?tiles=https://NOWY.trycloudflare.com`.

Stały adres wymagałby nazwanego tunelu Cloudflare (konto + domena) – TODO.

---

## 8. Wdrażanie zmian

1. **Edytuj** pliki (lokalnie / z ChatGPT). Frontend: `docs/*`, backend: `server/public_api.py`.
2. **Kopia zapasowa na OptimusPrime**:
   ```powershell
   cd C:\Users\kompu\dzialki\plots\docs
   foreach($f in 'index.html','app.js','style.css'){ Copy-Item $f "$f.bak4" -Force }
   ```
3. **Push na GitHub** (`main`) – przez github.com (Edit / Upload files) albo git:
   ```bash
   git add docs/app.js docs/style.css && git commit -m "Opis zmiany" && git push origin main
   ```
   GitHub Pages przebudowuje się w ~1 min.
4. **Skopiuj na OptimusPrime** (żeby lokalny `http://127.0.0.1:5001/` i adres tunelu miały to samo). Sprawdzona metoda – pobranie z GitHuba po SHA commita:
   ```powershell
   cd C:\Users\kompu\dzialki\plots\docs
   $sha = "<SHA_COMMITA>"
   foreach($f in 'index.html','app.js','style.css'){ iwr "https://raw.githubusercontent.com/XOOGKlastry/plots/$sha/docs/$f" -OutFile $f -UseBasicParsing }
   ```
   Dla `server/public_api.py` analogicznie do `..\server\`, potem restart API.
5. **Wycofanie:** `Copy-Item app.js.bak4 app.js -Force` (OptimusPrime) i revert commita na GitHubie.

**Nie nadpisuj `docs/config.js` starą wersją** – zawiera aktualny URL tunelu.

---

## 9. Testowanie

- Ręcznie: https://xoogklastry.github.io/plots/ na komputerze i telefonie; zoom ≥13, klik w działkę, wyszukiwanie „Kubika 4 Bolesławiec”, zakładka Warstwy (zmiana podkładu), Legenda, tryb ciemny.
- Konsola przeglądarki (F12) – brak czerwonych błędów; Network – kafle `.pbf` 200.
- API: `curl "https://<tunel>/api/at?lon=15.5659&lat=51.2603"`, `/health`, `/api/adres?q=Kubika%204`.
- Automatycznie (Playwright, Python):
  ```bash
  pip install playwright && python -m playwright install chromium
  python -m http.server 8088   # w folderze docs/
  ```
  i skrypt otwierający `http://127.0.0.1:8088/index.html` w oknie 390×844 (`is_mobile=True, has_touch=True`) i 1440×900, w `color_scheme` light/dark, zbierający `pageerror` i robiący zrzuty. Na serwerach bez GPU dodaj `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- JS składnia: `node --check docs/app.js`.

---

## 10. Znane problemy / TODO

- **URL tunelu trycloudflare zmienia się po każdym restarcie** → trzeba pushować `config.js`. TODO: nazwany tunel Cloudflare ze stałą domeną.
- **OptimusPrime musi być włączony** i mieć uruchomione API + tunel; zadania harmonogramu mają jednorazowe wyzwalacze (brak autostartu po restarcie). TODO: wyzwalacz „przy logowaniu”.
- `public_api.py` nie serwuje `/style.css` → widok lokalny `http://127.0.0.1:5001/` i bezpośrednio przez adres tunelu jest bez stylów (Pages działa). Fix: dodać `@app.get("/style.css")` do `frontend_asset` (i ustawić mimetype `text/css`).
- `pole_ewid` jest w **hektarach**.
- Ortofoto HD (gp-hr) renderuje się dopiero przy dużych zoomach.
- Esri szare podkłady max zoom 16 (wyżej rozmyte).
- Na OptimusPrime folder `docs` może zawierać `*.bak*` – nie commituj ich.
- `README.md` w repo jest starszy niż ta instrukcja (stary URL tunelu).
- Słownik grup jest zduplikowany (`docs/grupy.js` i `server/public_api.py`).
- Do sprawdzenia ręcznie na telefonie: zwijanie arkusza do „peek” po tapnięciu w pustą mapę.

---

## 11. Szablon promptu na start sesji ChatGPT

```
Pracujemy nad moim projektem "plots" – mapą działek EGiB z grupami rejestrowymi.
Repo: https://github.com/XOOGKlastry/plots (branch main, GitHub Pages z /docs).
Poniżej wklejam INSTRUKCJA.md (architektura, pliki, API, wdrażanie) – przeczytaj ją najpierw.

Zasady:
- Frontend: czysty HTML/CSS/JS + MapLibre GL 4.7.1, bez bundlera i bez frameworków.
- Backend: Flask server/public_api.py na Windows (OptimusPrime), PostGIS SRID 2180, kafle MVT w locie.
- Nie zmieniaj TILES_URL w config.js, jeśli o to nie proszę.
- Zachowaj działanie na telefonie (<768 px, bottom sheet + tab bar) i na komputerze (panel z lewej), jasny i ciemny motyw.
- Dawaj mi KOMPLETNE pliki do podmiany albo jednoznaczne fragmenty "zamień X na Y" z kontekstem.
- Na końcu podaj: które pliki zmienić, komendy do wdrożenia (PowerShell na OptimusPrime) i jak przetestować.
- Nigdy nie proś o hasła.

Aktualne pliki (wklejam): docs/index.html, docs/app.js, docs/style.css [, server/public_api.py]

Moja prośba: <OPIS ZMIANY>
```

---

## 12. Jak poprosić ChatGPT o zmianę – przykłady

Zasada: **co** ma się zmienić, **gdzie** (telefon/komputer/obie), **jak ma wyglądać** (zrzut ekranu pomaga), i **wklej aktualny plik**.

- **Nowy podkład:** „Dodaj do `BASEMAPS` w app.js podkład Geoportal ‘Mapa ewidencyjna’ (WMS `https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow`, warstwa `dzialki`) jako nakładkę włączaną w zakładce Warstwy, z kryciem 70%.”
- **Kolory grup:** „W `docs/grupy.js` zmień kolor grupy 7 (osoby fizyczne) na jasnoszary #d0d4da, a grupy 4 na mocniejszy zielony. Zaktualizuj legendę.”
- **Nowe pole w karcie:** „W karcie działki (`parcelCard` w app.js) dodaj komórkę ‘Gmina’ z pola `gmina` – wymaga to dodania `gmina` do SELECT w `/api/at` w `public_api.py`. Daj oba fragmenty.”
- **Filtr:** „Dodaj w zakładce Warstwy checkboxy grup 1–16; odznaczenie ukrywa działki tej grupy (filtr na `dz-fill` po `g1`). Zapamiętuj w localStorage.”
- **Mobile:** „Na telefonie arkusz w stanie ‘peek’ jest za wysoki – zmniejsz go do samego tytułu działki i chipa grupy (`snapY()` w app.js).”
- **Backend:** „Dodaj obsługę `/style.css` w `frontend_asset` w `public_api.py` z poprawnym mimetype.”
- **Eksport:** „Dodaj przycisk ‘Pobierz GeoJSON’ w karcie działki – nowy endpoint `/api/dzialka.geojson?id=` (ST_AsGeoJSON w EPSG:4326).”
- **Błąd:** „Na iPhonie po kliknięciu w działkę nic się nie dzieje. W konsoli jest: <wklej błąd>. Oto app.js: <wklej>.”

Po odpowiedzi ChatGPT: podmień pliki → test lokalnie (`python -m http.server` w `docs/`) → push → kopia na OptimusPrime (sekcja 8).
