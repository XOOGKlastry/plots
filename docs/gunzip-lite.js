/* Rozpakowywanie gzip bez pomocy przeglądarki: zapas dla telefonów, które nie mają DecompressionStream.
   Prosty dekoder DEFLATE (wzorowany na puff.c z zlib): wolniejszy od wbudowanego, ale wystarcza do plików rozkładów. */
(function (root) {
  "use strict";
  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function table(lens) {
    const count = new Uint16Array(16), offs = new Uint16Array(16), sym = new Uint16Array(lens.length);
    for (let i = 0; i < lens.length; i++) count[lens[i]]++;
    count[0] = 0;
    for (let i = 1, s = 0; i < 16; i++) { offs[i] = s; s += count[i]; }
    for (let i = 0; i < lens.length; i++) if (lens[i]) sym[offs[lens[i]]++] = i;
    return { count, sym };
  }
  let FIXED = null;
  function fixed() {
    if (!FIXED) { const l = new Uint8Array(288); l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288); FIXED = [table(l), table(new Uint8Array(30).fill(5))]; }
    return FIXED;
  }
  /* src: Uint8Array with a gzip member; returns the unpacked bytes. */
  function gunzip(src) {
    if (src[0] !== 0x1f || src[1] !== 0x8b || src[2] !== 8) throw Error("To nie jest plik gzip");
    const flg = src[3]; let pos = 10;
    if (flg & 4) pos += 2 + (src[pos] | src[pos + 1] << 8);
    if (flg & 8) { while (src[pos++]); }
    if (flg & 16) { while (src[pos++]); }
    if (flg & 2) pos += 2;
    const n = src.length, size = (src[n - 4] | src[n - 3] << 8 | src[n - 2] << 16 | src[n - 1] << 24) >>> 0, out = new Uint8Array(size);
    let op = 0, buf = 0, bit = 0;
    const bits = k => { while (bit < k) { buf |= src[pos++] << bit; bit += 8; } const v = buf & ((1 << k) - 1); buf >>>= k; bit -= k; return v; };
    const decode = t => {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len < 16; len++) {
        if (!bit) { buf = src[pos++]; bit = 8; }
        code |= buf & 1; buf >>>= 1; bit--;
        const c = t.count[len];
        if (code - c < first) return t.sym[index + (code - first)];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      throw Error("Uszkodzone dane gzip");
    };
    for (let last = 0; !last;) {
      last = bits(1); const type = bits(2);
      if (type === 0) {
        buf = 0; bit = 0; const len = src[pos] | src[pos + 1] << 8; pos += 4;
        out.set(src.subarray(pos, pos + len), op); op += len; pos += len; continue;
      }
      let lt, dt;
      if (type === 1) [lt, dt] = fixed();
      else if (type === 2) {
        const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4, cl = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) cl[ORDER[i]] = bits(3);
        const ct = table(cl), lens = new Uint8Array(hlit + hdist);
        for (let i = 0; i < hlit + hdist;) {
          const s = decode(ct);
          if (s < 16) lens[i++] = s;
          else { let prev = 0, rep; if (s === 16) { prev = lens[i - 1]; rep = 3 + bits(2); } else rep = s === 17 ? 3 + bits(3) : 11 + bits(7); while (rep--) lens[i++] = prev; }
        }
        lt = table(lens.subarray(0, hlit)); dt = table(lens.subarray(hlit));
      } else throw Error("Uszkodzone dane gzip");
      for (;;) {
        const s = decode(lt);
        if (s < 256) { out[op++] = s; continue; }
        if (s === 256) break;
        const len = LBASE[s - 257] + bits(LEXT[s - 257]), d = decode(dt), dist = DBASE[d] + bits(DEXT[d]);
        for (let i = 0, from = op - dist; i < len; i++) out[op++] = out[from++];
      }
    }
    return out;
  }
  const api = { gunzip };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GunzipLite = api;
})(typeof window !== "undefined" ? window : globalThis);
