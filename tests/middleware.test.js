const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "rahasia-untuk-test-1234567890";

const authMiddleware = require("../src/middleware/auth");
const { validateIssueCert, validateBatch, MAX_BATCH } = require("../src/middleware/validate");
const { getJwtSecret } = require("../src/config/jwt");

// Jalankan app Express kecil di port acak, lalu kirim 1 request
const withServer = async (app, fn) => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
};

const post = (base, path, body, headers = {}) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const validCert = { holderName: "Budi", nim: "1050001", totalSkor: 550 };

// ---------- auth ----------
const authApp = () => {
  const app = express();
  app.get("/secret", authMiddleware, (req, res) => res.json({ user: req.user.username }));
  return app;
};

test("auth: tanpa token ditolak 401", async () => {
  await withServer(authApp(), async (base) => {
    const res = await fetch(base + "/secret");
    assert.equal(res.status, 401);
  });
});

test("auth: token palsu ditolak 401", async () => {
  await withServer(authApp(), async (base) => {
    const res = await fetch(base + "/secret", { headers: { Authorization: "Bearer abc.def.ghi" } });
    assert.equal(res.status, 401);
  });
});

test("auth: token dengan secret lain ditolak 401", async () => {
  const token = jwt.sign({ username: "admin" }, "secret-yang-berbeda-123456");
  await withServer(authApp(), async (base) => {
    const res = await fetch(base + "/secret", { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 401);
  });
});

test("auth: token expired ditolak 401", async () => {
  const token = jwt.sign({ username: "admin" }, process.env.JWT_SECRET, { expiresIn: -10 });
  await withServer(authApp(), async (base) => {
    const res = await fetch(base + "/secret", { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 401);
  });
});

test("auth: token valid diterima", async () => {
  const token = jwt.sign({ username: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  await withServer(authApp(), async (base) => {
    const res = await fetch(base + "/secret", { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { user: "admin" });
  });
});

test("jwt config: menolak secret kosong atau terlalu pendek", () => {
  const original = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET;
    assert.throws(() => getJwtSecret(), /JWT_SECRET belum diset/);
    process.env.JWT_SECRET = "pendek";
    assert.throws(() => getJwtSecret(), /JWT_SECRET belum diset/);
  } finally {
    process.env.JWT_SECRET = original;
  }
});

// ---------- validasi ----------
const validateApp = () => {
  const app = express();
  app.use(express.json());
  app.post("/issue", validateIssueCert, (req, res) => res.json({ ok: true }));
  app.post("/batch", validateBatch, (req, res) => res.json({ ok: true }));
  return app;
};

test("validasi issue: data valid lolos", async () => {
  await withServer(validateApp(), async (base) => {
    const res = await post(base, "/issue", validCert);
    assert.equal(res.status, 200);
  });
});

test("validasi issue: nama kosong ditolak 400", async () => {
  await withServer(validateApp(), async (base) => {
    const res = await post(base, "/issue", { ...validCert, holderName: "  " });
    assert.equal(res.status, 400);
    assert.match((await res.json()).message, /Nama pemegang wajib diisi/);
  });
});

test("validasi issue: skor di luar 0-677 ditolak", async () => {
  await withServer(validateApp(), async (base) => {
    assert.equal((await post(base, "/issue", { ...validCert, totalSkor: 700 })).status, 400);
    assert.equal((await post(base, "/issue", { ...validCert, totalSkor: -1 })).status, 400);
    assert.equal((await post(base, "/issue", { ...validCert, totalSkor: "abc" })).status, 400);
    assert.equal((await post(base, "/issue", { ...validCert, totalSkor: 677 })).status, 200);
  });
});

test("validasi issue: format tanggal salah ditolak", async () => {
  await withServer(validateApp(), async (base) => {
    const res = await post(base, "/issue", { ...validCert, waktuMulai: "bukan-tanggal" });
    assert.equal(res.status, 400);
  });
});

test("validasi batch: array valid lolos", async () => {
  await withServer(validateApp(), async (base) => {
    const res = await post(base, "/batch", { certificates: [validCert, validCert] });
    assert.equal(res.status, 200);
  });
});

test("validasi batch: kosong ditolak", async () => {
  await withServer(validateApp(), async (base) => {
    assert.equal((await post(base, "/batch", { certificates: [] })).status, 400);
    assert.equal((await post(base, "/batch", {})).status, 400);
  });
});

test(`validasi batch: lebih dari ${MAX_BATCH} ditolak`, async () => {
  await withServer(validateApp(), async (base) => {
    const certificates = Array.from({ length: MAX_BATCH + 1 }, () => validCert);
    assert.equal((await post(base, "/batch", { certificates })).status, 400);
  });
});

test("validasi batch: satu item tidak valid menggagalkan seluruh batch", async () => {
  await withServer(validateApp(), async (base) => {
    const res = await post(base, "/batch", {
      certificates: [validCert, { ...validCert, totalSkor: 9999 }],
    });
    assert.equal(res.status, 400);
  });
});
