# Działki EGiB — publiczna mapa grup rejestrowych

Interaktywna mapa granic działek ewidencyjnych z kolorowaniem według **grupy rejestrowej (1–16)** zgodnie z rozporządzeniem EGiB §14.

## Live

- **Frontend (GitHub Pages):** https://xoogklastry.github.io/plots/
- **API / kafle MVT (tymczasowy tunel Cloudflare):** ustawiony w [`docs/config.js`](docs/config.js) jako `TILES_URL`

> Tunel `*.trycloudflare.com` jest **tymczasowy** (zmienia się po restarcie, bez gwarancji uptime). Do produkcji: konto Cloudflare + named tunnel albo hostowanie PMTiles (R2/S3).

## Funkcje

- Podkład OSM (MapLibre GL)
- Warstwa działek z MVT od zoom ≈13
- Kolor według pierwszej grupy w `grupa_rej` + legenda 1–16
- Klik → popup: ID, numer, obręb, pole, **pełna nazwa grupy**, użytki
- Szukanie adresu (Nominatim, Polska) → zoom → działka pod punktem
- Szukanie po `id_dzialki`

## Grupy rejestrowe (hardcoded)

Źródło: rozporządzenie Ministra Rozwoju, Pracy i Technologii w sprawie ewidencji gruntów i budynków, §14.

| Nr | Opis |
|----|------|
| 1 | Skarb Państwa (bez użytkowników wieczystych) |
| 2 | Skarb Państwa (ze zbiegiem użytkowników wieczystych) |
| 3 | Jednoosobowe spółki Skarbu Państwa, przedsiębiorstwa państwowe i państwowe osoby prawne |
| 4 | Gminy i związki międzygminne lub metropolitalne (bez użytkowników wieczystych) |
| 5 | Gminy i związki międzygminne lub metropolitalne (ze zbiegiem użytkowników wieczystych) |
| 6 | Jednoosobowe spółki jednostek samorządu terytorialnego oraz inne osoby prawne samorządu |
| 7 | Osoby fizyczne |
| 8 | Spółdzielnie |
| 9 | Kościoły i związki wyznaniowe |
| 10 | Wspólnoty gruntowe |
| 11 | Powiaty i związki powiatów (bez użytkowników wieczystych) |
| 12 | Powiaty i związki powiatów (ze zbiegiem użytkowników wieczystych) |
| 13 | Województwa (bez użytkowników wieczystych) |
| 14 | Województwa (ze zbiegiem użytkowników wieczystych) |
| 15 | Spółki prawa handlowego |
| 16 | Inne podmioty niewymienione w grupach 1–15 |

## Architektura

```
GitHub Pages (docs/)  --fetch-->  TILES_URL (Flask MVT + /api/*)
                                      |
                                 PostGIS gisss.egib.dzialki
```

Frontend jest w pełni statyczny. Dane przestrzenne (~39 mln działek) **nie** mieszczą się na Pages — serwowane są kafle MVT z maszyny z bazą (CORS `*`).

### Endpointy API

| Ścieżka | Opis |
|---------|------|
| `GET /tiles/{z}/{x}/{y}.pbf` | MVT warstwa `dzialki` (min z=13) |
| `GET /api/at?lon=&lat=` | Działka pod punktem + `grupa_opis` |
| `GET /api/dzialka?id=` | Działka po ID + bbox |
| `GET /api/grupy` | Słownik grup 1–16 |
| `GET /health` | Status |

### Uruchomienie API (maszyna z PostGIS)

```bat
set PLOTS_DSN=postgresql://USER@localhost/gisss
set PLOTS_PORT=5001
python server/public_api.py
```

DSN tylko w zmiennej środowiska / pgpass — **nigdy w repo**.

### Tunel publiczny (cloudflared)

```bat
cloudflared tunnel --url http://127.0.0.1:5001
```

Skopiuj URL `https://….trycloudflare.com` do `docs/config.js` → `TILES_URL`, commit + push.

**Trwały dostęp:** zaloguj się do Cloudflare, utwórz named tunnel i DNS CNAME na własną domenę.

## Ścieżka do pełnego hostingu statycznego (PMTiles)

1. Eksport powiatu: `python scripts/export_geojson_powiat.py 2264 out.geojson`
2. `tippecanoe -zg -o dzialki.pmtiles -l dzialki --drop-densest-as-needed out.geojson`
3. Hostuj plik (R2 / S3 / Git LFS) i w MapLibre użyj protokołu `pmtiles://…`
4. Przykładowy mini GeoJSON: [`samples/sample_2264_mini.geojson`](samples/sample_2264_mini.geojson) (200 obiektów, powiat 2264)

Na maszynie źródłowej brak tippecanoe w PATH — pełny krajowy PMTiles to następny krok (instalacja tippecanoe + batch powiatami).

## Struktura repo

```
docs/           → GitHub Pages
  index.html, app.js, config.js, grupy.js
server/         → Flask MVT/API
scripts/        → eksport GeoJSON
samples/        → próbki
```

## Uwagi

Dane pochodzą z lokalnej bazy EGiB użytkownika repozytorium. Frontend nie przechowuje haseł ani DSN. Użytkowanie tunelu trycloudflare podlega regulaminowi Cloudflare.
