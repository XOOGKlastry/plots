# Działki EGiB — mapa grup rejestrowych

Hybryda: **frontend na GitHub Pages** + **lokalny serwer MVT** na maszynie z PostGIS (`gisss.egib.dzialki`).

## Szybki start

1. Na komputerze z bazą (OptimusPrime):

```bat
cd plots
start.bat
```

Serwer startuje na **http://127.0.0.1:5001** (CORS otwarte).

2. Otwórz mapę:

**https://xoogklastry.github.io/plots/**

Frontend domyślnie łączy się z `http://127.0.0.1:5001`. Inny host/port:

`https://xoogklastry.github.io/plots/?tiles=http://192.168.10.35:5001`

## Co działa

- Podkład OSM (MapLibre), działki od zoom ≈13
- Kolor według grupy rejestrowej 1–16 + legenda z pełnymi nazwami (EGiB §14)
- Klik → popup: ID, numer, obręb, pole, **pełna nazwa grupy**, użytki
- Szukanie adresu (Nominatim PL) → zoom → działka pod punktem
- Szukanie po `id_dzialki`

## Wymagania lokalne

- PostgreSQL + PostGIS, baza `gisss`, tabela `egib.dzialki`
- Python 3 + `flask`, `psycopg` (patrz `server/requirements.txt`)
- DSN przez env `PLOTS_DSN` (domyślnie `postgresql://postgres@localhost/gisss`) — **bez haseł w repo**

Zmienne:

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `PLOTS_DSN` | `postgresql://postgres@localhost/gisss` | połączenie |
| `PLOTS_PORT` | `5001` | port HTTP |
| `PLOTS_MINZ` | `13` | min. zoom kafli |
| `PLOTS_CONCURRENCY` | `6` | max równoległych zapytań MVT |

## Endpointy

| Ścieżka | Opis |
|---------|------|
| `/tiles/{z}/{x}/{y}.pbf` | MVT warstwa `dzialki` |
| `/api/at?lon=&lat=` | działka pod punktem + `grupa_opis` |
| `/api/dzialka?id=` | działka po ID + bbox |
| `/api/grupy` | słownik 1–16 |
| `/health` | status |

## Uwagi

- Panel wewnętrzny (`app.py` na `:5000`) jest osobny — ten publiczny API używa portu **5001**, żeby nie kolidować.
- Tunel Cloudflare nie jest wymagany do codziennego użycia (wystarczy localhost / LAN).
- Pełny hosting statyczny (PMTiles) — opcjonalny następny krok, na razie pominięty.
