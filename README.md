# Dzia?ki EGiB ? publiczna mapa grup rejestrowych

Interaktywna mapa granic dzia?ek ewidencyjnych z kolorowaniem wed?ug **grupy rejestrowej (1?16)** zgodnie z rozporz?dzeniem EGiB ?14.

## Live

- **Frontend (GitHub Pages):** https://xoogklastry.github.io/plots/
- **API / kafle MVT (tymczasowy tunel Cloudflare):** ustawiony w [`docs/config.js`](docs/config.js) jako `TILES_URL`

> Tunel `*.trycloudflare.com` jest **tymczasowy** (zmienia si? po restarcie, bez gwarancji uptime). Do produkcji: konto Cloudflare + named tunnel albo hostowanie PMTiles (R2/S3/Pages large assets).

## Funkcje

- Podk?ad OSM (MapLibre GL)
- Warstwa dzia?ek z MVT od zoom ?13
- Kolor wed?ug pierwszej grupy w `grupa_rej` + legenda 1?16
- Klik ? popup: ID, numer, obr?b, pole, **pe?na nazwa grupy**, u?ytki
- Szukanie adresu (Nominatim, Polska) ? zoom ? dzia?ka pod punktem
- Szukanie po `id_dzialki`

## Grupy rejestrowe (hardcoded)

?r?d?o: rozporz?dzenie Ministra Rozwoju, Pracy i Technologii w sprawie ewidencji grunt?w i budynk?w, ?14.

| Nr | Opis |
|----|------|
| 1 | Skarb Pa?stwa (bez u?ytkownik?w wieczystych) |
| 2 | Skarb Pa?stwa (ze zbiegiem u?ytkownik?w wieczystych) |
| 3 | Jednoosobowe sp??ki Skarbu Pa?stwa, przedsi?biorstwa pa?stwowe i pa?stwowe osoby prawne |
| 4 | Gminy i zwi?zki mi?dzygminne lub metropolitalne (bez u?ytkownik?w wieczystych) |
| 5 | Gminy i zwi?zki mi?dzygminne lub metropolitalne (ze zbiegiem u?ytkownik?w wieczystych) |
| 6 | Jednoosobowe sp??ki jednostek samorz?du terytorialnego oraz inne osoby prawne samorz?du |
| 7 | Osoby fizyczne |
| 8 | Sp??dzielnie |
| 9 | Ko?cio?y i zwi?zki wyznaniowe |
| 10 | Wsp?lnoty gruntowe |
| 11 | Powiaty i zwi?zki powiat?w (bez u?ytkownik?w wieczystych) |
| 12 | Powiaty i zwi?zki powiat?w (ze zbiegiem u?ytkownik?w wieczystych) |
| 13 | Wojew?dztwa (bez u?ytkownik?w wieczystych) |
| 14 | Wojew?dztwa (ze zbiegiem u?ytkownik?w wieczystych) |
| 15 | Sp??ki prawa handlowego |
| 16 | Inne podmioty niewymienione w grupach 1?15 |

## Architektura

```
GitHub Pages (docs/)  --fetch-->  TILES_URL (Flask MVT + /api/*)
                                      |
                                 PostGIS gisss.egib.dzialki
```

Frontend jest w pe?ni statyczny. Dane przestrzenne (~39 mln dzia?ek) **nie** mieszcz? si? na Pages ? serwowane s? kafle MVT z maszyny z baz? (CORS `*`).

### Endpointy API

| ?cie?ka | Opis |
|---------|------|
| `GET /tiles/{z}/{x}/{y}.pbf` | MVT warstwa `dzialki` (min z=13) |
| `GET /api/at?lon=&lat=` | Dzia?ka pod punktem + `grupa_opis` |
| `GET /api/dzialka?id=` | Dzia?ka po ID + bbox |
| `GET /api/grupy` | S?ownik grup 1?16 |
| `GET /health` | Status |

### Uruchomienie API (maszyna z PostGIS)

```bat
set PLOTS_DSN=postgresql://USER@localhost/gisss
set PLOTS_PORT=5001
python server/public_api.py
```

DSN tylko w zmiennej ?rodowiska / pgpass ? **nigdy w repo**.

### Tunel publiczny (cloudflared)

```bat
cloudflared tunnel --url http://127.0.0.1:5001
```

Skopiuj URL `https://?.trycloudflare.com` do `docs/config.js` ? `TILES_URL`, commit + push.

**Trwa?y dost?p:** zaloguj si? do Cloudflare, utw?rz named tunnel i DNS CNAME na w?asn? domen?.

## ?cie?ka do pe?nego hostingu statycznego (PMTiles)

1. Eksport powiatu: `python scripts/export_geojson_powiat.py 2264 out.geojson`
2. `tippecanoe -zg -o dzialki.pmtiles -l dzialki --drop-densest-as-needed out.geojson`
3. Hostuj plik (R2 / S3 / Git LFS) i w MapLibre u?yj protoko?u `pmtiles://?`
4. Przyk?adowy mini GeoJSON: [`samples/sample_2264_mini.geojson`](samples/sample_2264_mini.geojson) (200 obiekt?w, powiat 2264)

Na maszynie ?r?d?owej brak tippecanoe w PATH ? pe?ny krajowy PMTiles to nast?pny krok (instalacja tippecanoe / ogr2ogr + batch powiatami).

## Struktura repo

```
docs/           ? GitHub Pages
  index.html, app.js, config.js, grupy.js
server/         ? Flask MVT/API
scripts/        ? eksport GeoJSON
samples/        ? pr?bki
```

## Uwagi prawne / dane

Dane pochodz? z lokalnej bazy EGiB u?ytkownika repozytorium. Frontend nie przechowuje hase? ani DSN. U?ytkowanie tunelu trycloudflare podlega regulaminowi Cloudflare.
