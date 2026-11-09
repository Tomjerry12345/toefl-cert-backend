const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

// Sengaja tanpa JWT_SECRET / MONGODB_URI: server harus tetap menjawab health check
// dan membalas 503 (bukan crash) untuk route lain saat init gagal.
process.env.JWT_SECRET = "";
process.env.MONGODB_URI = "";
const app = require("../src/index.js");

const withServer = async (fn) => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
};

test("app diekspor sebagai fungsi Express (dibutuhkan Vercel)", () => {
  assert.equal(typeof app, "function");
  assert.equal(typeof app.listen, "function");
});

test("GET /api/health menjawab 200 tanpa database", async () => {
  await withServer(async (base) => {
    const res = await fetch(base + "/api/health");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.timestamp);
  });
});

test("route lain membalas 503 saat init gagal, bukan crash", async () => {
  await withServer(async (base) => {
    const res = await fetch(base + "/api/verify/TOEFL-15C5DFC");
    assert.equal(res.status, 503);
    assert.equal((await res.json()).success, false);
  });
});

test("header keamanan helmet terpasang", async () => {
  await withServer(async (base) => {
    const res = await fetch(base + "/api/health");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  });
});
