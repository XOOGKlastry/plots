"""XYZ tile folder ({z}/{x}/{y}.webp) -> one PMTiles v3 file (raster, clustered, deduplicated).
No external packages. Usage: python xyz2pmtiles.py <src dir> <out.pmtiles> [name]
       python xyz2pmtiles.py --all <docs/data/stare> <out dir>   (every edition in p/ plus mtb, wig)"""
import gzip, hashlib, json, os, struct, sys
from pathlib import Path

TYPES = {".webp": 4, ".png": 2, ".jpg": 3, ".jpeg": 3}


def tid(z, x, y):
    acc = ((1 << (2 * z)) - 1) // 3
    for a in range(z - 1, -1, -1):
        s = 1 << a
        rx, ry = (1 if x & s else 0), (1 if y & s else 0)
        acc += ((3 * rx) ^ ry) * s * s
        if ry == 0:
            if rx == 1:
                x, y = s - 1 - x, s - 1 - y
            x, y = y, x
    return acc


def varint(n, out):
    while n >= 0x80:
        out.append((n & 0x7F) | 0x80); n >>= 7
    out.append(n)


def ser(entries):
    b = bytearray(); varint(len(entries), b); last = 0
    for e in entries: varint(e[0] - last, b); last = e[0]
    for e in entries: varint(e[3], b)
    for e in entries: varint(e[2], b)
    for i, e in enumerate(entries):
        if i > 0 and e[1] == entries[i - 1][1] + entries[i - 1][2]: varint(0, b)
        else: varint(e[1] + 1, b)
    return gzip.compress(bytes(b), mtime=0)


def dirs(entries):
    root = ser(entries)
    if len(root) <= 16384 - 127: return root, b""
    leaf = 4096
    while True:
        leaves, rootE, off = bytearray(), [], 0
        for i in range(0, len(entries), leaf):
            ch = entries[i:i + leaf]; d = ser(ch)
            rootE.append((ch[0][0], off, len(d), 0)); leaves += d; off += len(d)
        root = ser(rootE)
        if len(root) <= 16384 - 127: return root, bytes(leaves)
        leaf *= 2


def convert(src, out, name="", attribution=""):
    src = Path(src); tiles = []; ext = None
    for zd in src.iterdir():
        if not (zd.is_dir() and zd.name.isdigit()): continue
        for xd in zd.iterdir():
            if not xd.name.isdigit(): continue
            for f in xd.iterdir():
                if f.suffix.lower() in TYPES:
                    ext = f.suffix.lower(); tiles.append((tid(int(zd.name), int(xd.name), int(f.stem)), int(zd.name), int(xd.name), int(f.stem), f))
    if not tiles: raise SystemExit(f"brak kafli w {src}")
    tiles.sort()
    data, seen, entries = bytearray(), {}, []
    for t, z, x, y, f in tiles:
        b = f.read_bytes(); h = hashlib.sha1(b).digest()
        if h in seen: off, ln = seen[h]
        else: off, ln = len(data), len(b); seen[h] = (off, ln); data += b
        if entries and entries[-1][0] + entries[-1][3] == t and entries[-1][1] == off and entries[-1][2] == ln:
            e = entries[-1]; entries[-1] = (e[0], e[1], e[2], e[3] + 1)
        else: entries.append((t, off, ln, 1))
    root, leaves = dirs(entries)
    zs = [t[1] for t in tiles]; zmax = max(zs)
    import math
    def lon(x, z): return x / 2 ** z * 360 - 180
    def lat(y, z): return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 2 ** z))))
    top = [t for t in tiles if t[1] == zmax]
    w, e = lon(min(t[2] for t in top), zmax), lon(max(t[2] for t in top) + 1, zmax)
    n, s = lat(min(t[3] for t in top), zmax), lat(max(t[3] for t in top) + 1, zmax)
    meta = gzip.compress(json.dumps({"name": name or src.name, "attribution": attribution, "format": ext[1:]}, ensure_ascii=False).encode(), mtime=0)
    ro = 127; mo = ro + len(root); lo = mo + len(meta); do = lo + len(leaves)
    e7 = lambda v: int(round(v * 1e7))
    hdr = b"PMTiles" + struct.pack("<B11QBBBBBB4iB2i", 3, ro, len(root), mo, len(meta), lo, len(leaves), do, len(data),
                                   len(tiles), len(entries), len(seen), 1, 2, 1, TYPES[ext], min(zs), zmax,
                                   e7(w), e7(s), e7(e), e7(n), min(zs), e7((w + e) / 2), e7((s + n) / 2))
    assert len(hdr) == 127
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    with open(out, "wb") as fo: fo.write(hdr); fo.write(root); fo.write(meta); fo.write(leaves); fo.write(data)
    return len(tiles), len(seen), os.path.getsize(out)


if __name__ == "__main__":
    if sys.argv[1] == "--all":
        base, od = Path(sys.argv[2]), Path(sys.argv[3])
        jobs = [(base / "p" / k, od / f"p/{k}.pmtiles") for k in json.loads((base / "p" / "index.json").read_text(encoding="utf-8"))]
        jobs += [(base / k, od / f"{k}.pmtiles") for k in ("mtb", "wig") if (base / k).is_dir()]
        for s, o in jobs:
            n, u, sz = convert(s, o); print(f"{o.name}: {n} kafli, {u} unikalnych, {sz / 1e6:.1f} MB", flush=True)
    else:
        print(convert(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else ""))
