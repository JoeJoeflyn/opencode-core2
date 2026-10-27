import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Database } from "bun:sqlite";

const text = "Core 2 — café — 日本語 — 🐈".repeat(500);
assert.equal(new TextDecoder().decode(new TextEncoder().encode(text)), text);
assert.equal(Buffer.from(Buffer.from(text).toString("base64"), "base64").toString(), text);
assert.equal(createHash("sha256").update("abc").digest("hex"),
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
assert.equal(Bun.hash.crc32("123456789"), 0xcbf43926);
assert.equal(Bun.hash.xxHash3(""), 0x2d06800538d394c2n);
assert.equal(Buffer.from(Bun.gunzipSync(Bun.gzipSync(text))).toString(), text);

function sumSquares() {
  let sum = 0;
  for (let i = 0; i < 10000; i++) sum += i * i;
  return sum;
}
for (let i = 0; i < 100; i++) assert.equal(sumSquares(), 333283335000);
assert.equal(Math.clz32(0), 32);
assert.equal(Math.clz32(1), 31);

// Exercise JSC's software lowering for a CPU without the POPCNT instruction.
const wasm = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0,
  1, 6, 1, 96, 1, 127, 1, 127,
  3, 2, 1, 0,
  7, 10, 1, 6, 112, 111, 112, 99, 110, 116, 0, 0,
  10, 7, 1, 5, 0, 32, 0, 105, 11,
])));
for (let i = 0; i < 100000; i++) {
  assert.equal(wasm.exports.popcnt(-1), 32);
  assert.equal(wasm.exports.popcnt(0x55555555), 16);
  assert.equal(wasm.exports.popcnt(0), 0);
}

const database = new Database(":memory:");
try {
  database.exec("CREATE TABLE probe (value TEXT)");
  database.query("INSERT INTO probe VALUES (?)").run(text);
  assert.equal(database.query("SELECT value FROM probe").get().value, text);
} finally {
  database.close();
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: () => new Response(text),
});
try {
  const response = await fetch(`http://127.0.0.1:${server.port}/`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), text);
} finally {
  await server.stop(true);
}

const child = Bun.spawn([process.execPath, "-e", 'console.log("CORE2_CHILD_OK")'], {
  stdout: "pipe",
  stderr: "pipe",
});
const [stdout, stderr, exitCode] = await Promise.all([
  new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
]);
assert.deepEqual({ stdout, stderr, exitCode }, {
  stdout: "CORE2_CHILD_OK\n", stderr: "", exitCode: 0,
});
console.log("CORE2_RUNTIME_OK: unicode, crypto, hash, compression, JIT, WASM popcnt, sqlite, HTTP, subprocess");
