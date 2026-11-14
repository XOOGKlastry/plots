const test = require("node:test"), assert = require("node:assert"), zlib = require("node:zlib"), crypto = require("node:crypto");
const { gunzip } = require("../docs/gunzip-lite.js");
test("gunzip-lite unpacks the same bytes as zlib", () => {
  const samples = [Buffer.from(""), Buffer.from("abc"), Buffer.from("rozkład jazdy ".repeat(5000)), crypto.randomBytes(70000),
    Buffer.concat([crypto.randomBytes(3000), Buffer.alloc(40000, 7), Buffer.from(Uint16Array.from({ length: 30000 }, (_, i) => (i * 37) % 900).buffer)])];
  for (const s of samples) for (const level of [0, 1, 9]) {
    const out = gunzip(new Uint8Array(zlib.gzipSync(s, { level })));
    assert.ok(Buffer.from(out).equals(s), `level ${level}, ${s.length} B`);
  }
});
