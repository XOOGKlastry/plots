"""Rozkłady GTFS -> zwarte pliki połączeń dla mapy czasu dojazdu (plots).

Dla każdego regionu i typu dnia (roboczy, sobota, niedziela) powstaje plik <region>-<dzien>.bin.gz:
  "PTR1" | uint32 długość nagłówka | nagłówek JSON (dopełniony do 4 bajtów) |
  int32 stopLon[nStops] (1e-6 st.) | int32 stopLat[nStops] | int32 tripT0[nTrips] (s od północy) | uint32 tripStart[nTrips+1] |
  uint16 tripRoute[nTrips] | uint16 stopIdx[nTimes] | uint16 run[nTimes] (przyjazd - poprzedni odjazd, s) | uint16 dwell[nTimes] (postój, s) |
  uint8 flags[nTimes] (1 = nie można wsiąść, 2 = nie można wysiąść)
Tylko biblioteka standardowa. Użycie: python build_transit.py [katalog_wyjściowy] [--cache katalog_z_zipami]
"""
import array, csv, datetime as dt, gzip, io, json, os, struct, sys, time, urllib.request, zipfile

REGIONS = [
    {"id": "slask", "name": "Śląskie", "bbox": [18.0, 49.35, 19.98, 51.12],
     "feeds": [
         {"id": "gzm", "name": "ZTM, Górnośląsko-Zagłębiowska Metropolia", "url": "https://mkuran.pl/gtfs/gzm.zip", "clip": False},
         {"id": "kolej", "name": "Kolej: PKP PLK i przewoźnicy (PKP Intercity, Koleje Śląskie, POLREGIO i inni)", "url": "https://mkuran.pl/gtfs/polish_trains.zip", "clip": True},
         {"id": "czestochowa", "name": "MPK Częstochowa", "url": "https://api.zbiorkom.live/api6-open/czestochowa/gtfs/default", "clip": False},
         {"id": "rybnik", "name": "Komunikacja Miejska Rybnik", "url": "https://api.zbiorkom.live/api6-open/rybnik/gtfs/default", "clip": False},
         {"id": "jastrzebie", "name": "MZK Jastrzębie-Zdrój", "url": "https://cdn.zbiorkom.live/gtfs/rybnik-jastrzebie.zip", "clip": False},
         {"id": "bielsko", "name": "MZK Bielsko-Biała", "url": "https://files.girlc.at/gtfs/bielsko_biala.zip", "clip": False},
         {"id": "wodzislaw", "name": "Wodzisławska Komunikacja Powiatowa", "url": "https://files.girlc.at/gtfs/powiat_wodzislawski.zip", "clip": False},
         {"id": "cieszyn", "name": "ZGK Cieszyn", "url": "https://api.zbiorkom.live/api6-open/cieszyn/gtfs/default", "clip": False},
         {"id": "zywiec", "name": "MZK Żywiec", "url": "https://api.zbiorkom.live/api6-open/zywiec/gtfs/default", "clip": False},
         {"id": "ornontowice", "name": "Komunikacja Gminna Ornontowice", "url": "https://feed.gtfs.cc/ornontowice/gtfs.zip", "clip": False},
         {"id": "oswiecim", "name": "MZK Oświęcim", "url": "https://api.zbiorkom.live/api6-open/oswiecim/gtfs/default", "clip": True},
         {"id": "chrzanow", "name": "Komunikacja Międzygminna Chrzanów", "url": "https://data.odt.org.pl/gtfs/zkkm-gtfs.zip", "clip": True},
         {"id": "olkusz", "name": "Komunikacja Międzygminna Olkusz", "url": "https://data.odt.org.pl/gtfs/olkusz-gtfs.zip", "clip": True},
     ]},
]
DAYS = [("rob", 2, "dzień roboczy"), ("sob", 5, "sobota"), ("nie", 6, "niedziela")]
HOLIDAYS = {"0101", "0106", "0501", "0503", "0815", "1101", "1111", "1224", "1225", "1226"}
CLIP_MARGIN = 0.35  # stopnie: pociągi zachowują przystanki tuż za granicą regionu


def pick_dates(today):
    """Najbliższa środa, sobota i niedziela, które nie są świętem stałym."""
    out = {}
    for key, wd, _ in DAYS:
        d = today
        for _ in range(40):
            if d.weekday() == wd and (d.strftime("%m%d") not in HOLIDAYS or wd == 6):
                break
            d += dt.timedelta(days=1)
        out[key] = d.strftime("%Y%m%d")
    return out


def fetch(feed, cache):
    path = os.path.join(cache, feed["id"] + ".zip")
    if not os.path.exists(path) or time.time() - os.path.getmtime(path) > 20 * 3600:
        req = urllib.request.Request(feed["url"], headers={"User-Agent": "plots-transit/1.0"})
        with urllib.request.urlopen(req, timeout=600) as r, open(path, "wb") as f:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
    return zipfile.ZipFile(path)


def rows(z, name):
    if name not in z.namelist():
        return iter(())
    return csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8-sig"))


def secs(t):
    h, m, s = t.split(":")
    return int(h) * 3600 + int(m) * 60 + int(s)


def services_on(z, date):
    """Identyfikatory rozkładów kursujących danego dnia (calendar.txt i calendar_dates.txt)."""
    wd = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][dt.datetime.strptime(date, "%Y%m%d").weekday()]
    on = {r["service_id"] for r in rows(z, "calendar.txt") if r.get(wd) == "1" and r["start_date"] <= date <= r["end_date"]}
    for r in rows(z, "calendar_dates.txt"):
        if r["date"] == date:
            (on.add if r["exception_type"] == "1" else on.discard)(r["service_id"])
    return on


def load_feed(feed, z, dates, bbox):
    """Zwraca {dzień: [(route_key, [(stop_id, arr, dep, flags), ...]), ...]}, przystanki i linie."""
    svc = {k: services_on(z, d) for k, d in dates.items()}
    wanted = set().union(*svc.values())
    stops = {}
    for r in rows(z, "stops.txt"):
        try:
            stops[r["stop_id"]] = (r["stop_name"], float(r["stop_lon"]), float(r["stop_lat"]))
        except (ValueError, KeyError):
            pass
    routes = {r["route_id"]: (r.get("route_short_name") or r.get("route_long_name") or "", int(r.get("route_type") or 3)) for r in rows(z, "routes.txt")}
    trips = {}
    for r in rows(z, "trips.txt"):
        if r["service_id"] in wanted:
            trips[r["trip_id"]] = (r["service_id"], r["route_id"], [])
    x0, y0, x1, y1 = bbox[0] - CLIP_MARGIN, bbox[1] - CLIP_MARGIN, bbox[2] + CLIP_MARGIN, bbox[3] + CLIP_MARGIN
    for r in rows(z, "stop_times.txt"):
        t = trips.get(r["trip_id"])
        if t is None or not r["arrival_time"] or not r["departure_time"]:
            continue
        s = stops.get(r["stop_id"])
        if s is None or (feed["clip"] and not (x0 <= s[1] <= x1 and y0 <= s[2] <= y1)):
            continue
        fl = (1 if r.get("pickup_type") == "1" else 0) | (2 if r.get("drop_off_type") == "1" else 0)
        t[2].append((int(r["stop_sequence"]), r["stop_id"], secs(r["arrival_time"]), secs(r["departure_time"]), fl))
    out = {k: [] for k in dates}
    for service, route, st in trips.values():
        if len(st) < 2:
            continue
        st.sort()
        seq = [(sid, a, d, f) for _, sid, a, d, f in st]
        for k in dates:
            if service in svc[k]:
                out[k].append((route, seq))
    return out, stops, routes


def write_region(region, key, date, day_name, feeds_data, outdir):
    stop_ix, lon, lat, names = {}, array.array("i"), array.array("i"), []
    route_ix, routes = {}, []
    t0, start, troute = array.array("i"), array.array("I", [0]), array.array("H")
    sidx, run, dwell, flags = array.array("H"), array.array("H"), array.array("H"), array.array("B")
    for fi, (feed, (bydays, stops, froutes)) in enumerate(feeds_data):
        for route, seq in bydays[key]:
            rk = (fi, route)
            if rk not in route_ix:
                route_ix[rk] = len(routes)
                routes.append([froutes.get(route, ("", 3))[0], froutes.get(route, ("", 3))[1], fi])
            troute.append(route_ix[rk])
            t0.append(seq[0][1])
            prev = seq[0][1]
            for sid, a, d, f in seq:
                sk = (fi, sid)
                if sk not in stop_ix:
                    stop_ix[sk] = len(names)
                    nm, x, y = stops[sid]
                    names.append(nm); lon.append(round(x * 1e6)); lat.append(round(y * 1e6))
                a = max(a, prev); d = max(d, a)
                sidx.append(stop_ix[sk]); run.append(min(65535, a - prev)); dwell.append(min(65535, d - a)); flags.append(f)
                prev = d
            start.append(len(sidx))
    if len(names) > 65535 or len(routes) > 65535:
        raise SystemExit("za dużo przystanków lub linii na uint16")
    header = {"v": 1, "region": region["id"], "name": region["name"], "day": key, "dayName": day_name, "date": date,
              "nStops": len(names), "nTrips": len(troute), "nRoutes": len(routes), "nTimes": len(sidx),
              "routes": routes, "names": names, "feeds": [f["name"] for f, _ in feeds_data],
              "built": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")}
    hb = json.dumps(header, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    hb += b" " * (-len(hb) % 4)
    body = b"PTR1" + struct.pack("<I", len(hb)) + hb
    for a in (lon, lat, t0, start, troute, sidx, run, dwell, flags):
        if sys.byteorder != "little":
            a.byteswap()
        body += a.tobytes()
        if a.typecode == "H" and len(body) % 2:
            body += b"\0"
    name = f"{region['id']}-{key}.bin.gz"
    with open(os.path.join(outdir, name), "wb") as f:
        f.write(gzip.compress(body, 9, mtime=0))
    return {"file": name, "date": date, "trips": len(troute), "stops": len(names), "bytes": os.path.getsize(os.path.join(outdir, name))}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    outdir = args[0] if args else "out"
    cache = sys.argv[sys.argv.index("--cache") + 1] if "--cache" in sys.argv else os.path.join(outdir, "_gtfs")
    os.makedirs(outdir, exist_ok=True); os.makedirs(cache, exist_ok=True)
    dates = pick_dates(dt.date.today() + dt.timedelta(days=1))
    index = {"built": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "regions": []}
    for region in REGIONS:
        feeds_data = []
        for feed in region["feeds"]:
            t = time.time()
            try:
                z = fetch(feed, cache)
                data = load_feed(feed, z, dates, region["bbox"])
            except Exception as e:  # one broken source must not stop the whole region
                print(f"{region['id']} {feed['id']}: POMINIĘTE ({e})", flush=True)
                continue
            feeds_data.append((feed, data))
            print(f"{region['id']} {feed['id']}: {time.time() - t:.0f} s, kursy {', '.join(str(len(v)) for v in data[0].values())}", flush=True)
        days = {}
        for key, _, day_name in DAYS:
            days[key] = write_region(region, key, dates[key], day_name, feeds_data, outdir)
            print(" ", days[key], flush=True)
        index["regions"].append({"id": region["id"], "name": region["name"], "bbox": region["bbox"], "days": days,
                                 "sources": [{"name": f["name"], "url": f["url"]} for f, _ in feeds_data]})
    with open(os.path.join(outdir, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
