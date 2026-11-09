const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeCert,
  mapWithConcurrency,
  DEFAULT_INSTITUTION,
} = require("../src/utils/certData");
const { buildVerifyUrl } = require("../src/utils/verifyUrl");

test("normalizeCert: field kosong jadi null, institusi default terisi", () => {
  const c = normalizeCert({ holderName: " Budi ", nim: " 123 ", totalSkor: "550" }, "CERT-1");
  assert.equal(c.certId, "CERT-1");
  assert.equal(c.holderName, "Budi");
  assert.equal(c.nim, "123");
  assert.equal(c.totalSkor, 550);
  assert.equal(c.nomorSurat, null);
  assert.equal(c.waktuMulai, null);
  assert.equal(c.skorListening, null);
  assert.equal(c.institution, DEFAULT_INSTITUTION);
});

test("normalizeCert: totalSkor boleh dari field score", () => {
  assert.equal(normalizeCert({ holderName: "A", nim: "1", score: 600 }, "X").totalSkor, 600);
});

test("normalizeCert: tanggal tidak valid jadi null, tanggal valid jadi Date", () => {
  const c = normalizeCert(
    { holderName: "A", nim: "1", totalSkor: 500, waktuMulai: "bukan-tanggal", waktuSelesai: "2026-03-01" },
    "X",
  );
  assert.equal(c.waktuMulai, null);
  assert.ok(c.waktuSelesai instanceof Date);
});

test("buildVerifyUrl: menggabungkan base dan certId tanpa garis miring ganda", () => {
  process.env.QR_BASE_URL = "https://contoh.com/verify///";
  assert.equal(buildVerifyUrl("ABC"), "https://contoh.com/verify/ABC");
  process.env.QR_BASE_URL = "https://contoh.com/verify";
  assert.equal(buildVerifyUrl("ABC"), "https://contoh.com/verify/ABC");
});

test("buildVerifyUrl: error jelas kalau QR_BASE_URL belum diset", () => {
  delete process.env.QR_BASE_URL;
  assert.throws(() => buildVerifyUrl("ABC"), /QR_BASE_URL belum diset/);
});

test("mapWithConcurrency: hasil sesuai urutan input", async () => {
  const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (x) => {
    await new Promise((r) => setTimeout(r, (6 - x) * 5)); // yang depan selesai belakangan
    return x * 10;
  });
  assert.deepEqual(out, [10, 20, 30, 40, 50]);
});

test("mapWithConcurrency: tidak melebihi batas paralel", async () => {
  let running = 0;
  let peak = 0;
  await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
  });
  assert.ok(peak <= 3, `peak paralel ${peak} melebihi 3`);
});

test("mapWithConcurrency: array kosong", async () => {
  assert.deepEqual(await mapWithConcurrency([], 3, async (x) => x), []);
});
