const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generateLeafHash,
  buildMerkleTree,
  getMerkleProof,
  verifyMerkleProof,
  processBatch,
} = require("../src/services/merkleService");

const makeCert = (i, overrides = {}) => ({
  certId: `CERT-${i}`,
  holderName: `Peserta ${i}`,
  nim: `1050000${i}`,
  nomorSurat: `001/TOEFL/${i}`,
  lokasi: "Makassar",
  waktuMulai: "2026-01-10",
  waktuSelesai: "2026-01-10",
  skorListening: 50,
  skorStructure: 52,
  skorReading: 54,
  totalSkor: 520 + i,
  institution: "UIN Alauddin Makassar",
  ...overrides,
});

const makeCerts = (n) => Array.from({ length: n }, (_, i) => makeCert(i + 1));

test("leaf hash selalu sama untuk data yang sama", () => {
  assert.equal(generateLeafHash(makeCert(1)), generateLeafHash(makeCert(1)));
});

test("leaf hash berupa keccak256 hex (0x + 64 karakter)", () => {
  assert.match(generateLeafHash(makeCert(1)), /^0x[0-9a-f]{64}$/);
});

test("data dari form dan dari database menghasilkan hash yang sama", () => {
  const fromForm = makeCert(1);
  // Bentuk dokumen MongoDB: tanggal jadi Date, skor jadi number, ada spasi tersisa
  const fromDb = {
    ...fromForm,
    holderName: "  Peserta 1  ",
    waktuMulai: new Date("2026-01-10"),
    waktuSelesai: new Date("2026-01-10"),
    skorListening: "50",
    totalSkor: "521",
  };
  assert.equal(generateLeafHash(fromForm), generateLeafHash(fromDb));
});

test("mengubah satu field saja mengubah hash", () => {
  const base = generateLeafHash(makeCert(1));
  assert.notEqual(base, generateLeafHash(makeCert(1, { holderName: "Orang Lain" })));
  assert.notEqual(base, generateLeafHash(makeCert(1, { totalSkor: 677 })));
  assert.notEqual(base, generateLeafHash(makeCert(1, { nim: "999" })));
  assert.notEqual(base, generateLeafHash(makeCert(1, { waktuMulai: "2026-02-01" })));
});

test("buildMerkleTree menolak data kosong", () => {
  assert.throws(() => buildMerkleTree([]), /tidak boleh kosong/);
  assert.throws(() => buildMerkleTree(null), /tidak boleh kosong/);
});

// Termasuk jumlah ganjil dan 1 sertifikat (proof kosong)
for (const n of [1, 2, 3, 5, 8]) {
  test(`batch ${n} sertifikat: semua proof valid terhadap root`, () => {
    const { merkleRoot, certsWithProof, totalLeaves } = processBatch(makeCerts(n));
    assert.equal(totalLeaves, n);
    for (const c of certsWithProof) {
      assert.equal(c.merkleRoot, merkleRoot);
      assert.ok(verifyMerkleProof(merkleRoot, c.leafHash, c.merkleProof));
    }
  });
}

test("batch 1 sertifikat: proof kosong dan root sama dengan leaf", () => {
  const { merkleRoot, certsWithProof } = processBatch(makeCerts(1));
  assert.deepEqual(certsWithProof[0].merkleProof, []);
  assert.equal(merkleRoot, certsWithProof[0].leafHash);
});

test("sertifikat yang dimanipulasi ditolak", () => {
  const { merkleRoot, certsWithProof } = processBatch(makeCerts(4));
  const original = certsWithProof[0];
  const forgedHash = generateLeafHash({ ...makeCert(1), totalSkor: 677 });
  assert.equal(verifyMerkleProof(merkleRoot, forgedHash, original.merkleProof), false);
});

test("proof milik sertifikat lain ditolak", () => {
  const { merkleRoot, certsWithProof } = processBatch(makeCerts(4));
  assert.equal(
    verifyMerkleProof(merkleRoot, certsWithProof[0].leafHash, certsWithProof[1].merkleProof),
    false,
  );
});

test("proof dari batch lain (root berbeda) ditolak", () => {
  const a = processBatch(makeCerts(4));
  const b = processBatch([makeCert(10), makeCert(11), makeCert(12), makeCert(13)]);
  assert.notEqual(a.merkleRoot, b.merkleRoot);
  assert.equal(
    verifyMerkleProof(b.merkleRoot, a.certsWithProof[0].leafHash, a.certsWithProof[0].merkleProof),
    false,
  );
});

test("urutan sertifikat dalam batch tidak mengubah root (sortPairs)", () => {
  const certs = makeCerts(4);
  const reversed = [...certs].reverse();
  assert.equal(processBatch(certs).merkleRoot, processBatch(reversed).merkleRoot);
});

test("getMerkleProof konsisten dengan proof dari processBatch", () => {
  const certs = makeCerts(5);
  const { tree } = buildMerkleTree(certs);
  const { certsWithProof } = processBatch(certs);
  const leaf = generateLeafHash(certs[2]);
  assert.deepEqual(getMerkleProof(tree, leaf), certsWithProof[2].merkleProof);
});
