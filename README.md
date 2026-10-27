# Działki EGiB — mapa grup rejestrowych

Frontend na **GitHub Pages** + kafle MVT z PostGIS na **OptimusPrime** przez **Cloudflare Tunnel (HTTPS)**.


## Uruchomienie (tray / zasobnik)

Na OptimusPrime:

```bat
cd %USERPROFILE%\dzialki\plots
start.bat
```

Pojawi się ikona **siatki działek** w zasobniku systemowym (obok zegara). Menu (PPM):

| Pozycja | Działanie |
|---------|-----------|
| Otwórz mapę (lokalnie) | `http://127.0.0.1:5001/` |
| Otwórz mapę (GitHub Pages) | https://xoogklastry.github.io/plots/ |
| Pokaż / kopiuj URL tunelu | powiadomienie + schowek |
| Restartuj tunel | nowy `*.trycloudflare.com` + update `docs/config.js` |
| Wyjdź | zatrzymuje API `:5001` i `cloudflared` |

Po restarcie tunelu wypchnij zaktualizowany `docs/config.js` na GitHub, żeby Pages widziało nowy URL (albo użyj bezpośrednio URL tunelu).

## Dla współpracowników (biuro)

1. Otwórz mapę: **https://xoogklastry.github.io/plots/**
2. Przybliż mapę (zoom ≥ 13), kliknij działkę, szukaj adresu lub `id_dzialki`.
3. **Warunek:** komputer OptimusPrime musi być włączony, a na nim musi działać `start.bat` (API + tunel).

Aktualny adres kafli (HTTPS): `https://rouge-bridal-blend-journals.trycloudflare.com`  
(mapa działa też bezpośrednio pod tym adresem: `https://rouge-bridal-blend-journals.trycloudflare.com/`)

Jeśli kafle nie ładują się — Dawid musi uruchomić ponownie `start.bat` na OptimusPrime (URL trycloud może się zmienić; wtedy trzeba zaktualizować `docs/config.js` i wypchnąć na GitHub, albo użyć `?tiles=NOWY_URL`).

## Dla Dawida — start na OptimusPrime

```bat
cd %USERPROFILE%\dzialki\plots
start.bat
```

Skrypt:
- uruchamia API MVT na `http://127.0.0.1:5001` (jeśli nie działa),
- startuje / restartuje `cloudflared tunnel --url http://127.0.0.1:5001`,
- zapisuje URL do `%USERPROFILE%\dzialki\tunnel_url.txt`,
- wpisuje HTTPS URL do `docs\config.js`.

Po restarcie trycloud **URL się zmienia**. Żeby Pages znów działało dla biura:
1. skopiuj nowy URL z okna `start.bat` / `tunnel_url.txt`,
2. upewnij się, że `docs/config.js` ma nowy `TILES_URL` (skrypt robi to lokalnie),
3. wypchnij commit na `XOOGKlastry/plots` (branch `main`, Pages z `/docs`).

### Stabilny tunel (opcjonalnie)

Quick tunnel (`*.trycloudflare.com`) jest tymczasowy. Stały hostname wymaga konta Cloudflare:

```bat
%USERPROFILE%\dzialki\tools\cloudflared.exe tunnel login
%USERPROFILE%\dzialki\tools\cloudflared.exe tunnel create dzialki
```

(to otwiera przeglądarkę do logowania — zrób to ręcznie / przez request_box_help). Potem wpisz stały URL w `docs/config.js`.

## Co działa

- Podkład OSM (MapLibre), działki od zoom ≈13
- Kolor według grupy rejestrowej 1–16 + legenda (EGiB §14)
- Klik → popup: ID, numer, obręb, pole, **pełna nazwa grupy**, użytki
- Szukanie adresu (Nominatim PL) → zoom → działka pod punktem
- Szukanie po `id_dzialki`
- CORS `*` na API/kafelkach (Pages → tunel OK, bez mixed content)

## Konfiguracja

| Zmienna / plik | Domyślnie | Opis |
|----------------|-----------|------|
| `PLOTS_DSN` | `postgresql://postgres@localhost/gisss` | PostGIS (bez hasła w repo) |
| `PLOTS_PORT` | `5001` | port API |
| `docs/config.js` → `TILES_URL` | tunel HTTPS | baza kafli dla Pages |
| `?tiles=` | — | nadpisanie TILES_URL w przeglądarce |

## Endpointy (przez tunel lub localhost:5001)

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
- Dane: `gisss.egib.dzialki` (~39 mln), EPSG:2180 → kafle 3857.
- Bez sekretów w repozytorium.
