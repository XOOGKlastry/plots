# Działki EGiB — mapa grup rejestrowych

Hybryda: kod frontendu na **GitHub Pages** + **lokalny serwer MVT** na maszynie z PostGIS (`gisss.egib.dzialki`, ~39 mln działek).

## Szybki start (zalecane)

Na komputerze z bazą:

```bat
cd plots
start.bat
```

Potem otwórz w przeglądarce:

**http://127.0.0.1:5001/**

Ten adres serwuje jednocześnie mapę i kafle (ten sam origin).

GitHub Pages jest pod HTTPS, więc przeglądarka **zablokuje** kafle z `http://127.0.0.1` (mixed content) — dlatego do codziennej pracy używaj lokalnego URL.

Kod UI jest też na: https://xoogklastry.github.io/plots/  
(z parametrem `?tiles=…` tylko gdy API jest po HTTPS, np. LAN reverse-proxy).

## Co działa

- Podkład OSM (MapLibre), działki od zoom ≈13
- Kolor według grupy rejestrowej 1–16 + legenda z pełnymi nazwami (EGiB §14)
- Klik → popup: ID, numer, obręb, pole, **pełna nazwa grupy**, użytki
- Szukanie adresu (Nominatim PL) → zoom → działka pod punktem
- Szukanie po `id_dzialki`

## Konfiguracja

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `PLOTS_DSN` | `postgresql://postgres@localhost/gisss` | PostGIS (bez hasła w repo) |
| `PLOTS_PORT` | `5001` | port (5000 = panel wewnętrzny) |
| `PLOTS_MINZ` | `13` | min. zoom MVT |
| `PLOTS_CONCURRENCY` | `6` | równoległe kafle |

Frontend: `docs/config.js` (`TILES_URL`) oraz nadpisanie `?tiles=http://HOST:PORT`.

## Endpointy

| Ścieżka | Opis |
|---------|------|
| `/` | mapa (docs/) |
| `/tiles/{z}/{x}/{y}.pbf` | MVT `dzialki` |
| `/api/at?lon=&lat=` | działka pod punktem + `grupa_opis` |
| `/api/dzialka?id=` | działka po ID + bbox |
| `/api/grupy` | słownik 1–16 |
| `/health` | status |

## Uwagi

- Panel wewnętrzny `app.py` na `:5000` jest osobny.
- Tunel Cloudflare / PMTiles — nie wymagane na teraz.
