const DEFAULT_INSTITUTION = "UIN Alauddin Makassar";

const textOrNull = (v) => {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
};

const numberOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const dateOrNull = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Rapikan input (form / batch) menjadi bentuk baku yang SAMA dengan yang
 * disimpan di MongoDB. Hash Merkle dihitung dari bentuk ini, sehingga saat
 * verifikasi hash bisa dihitung ulang dari data di database.
 */
const normalizeCert = (input, certId) => ({
  certId,
  holderName: String(input.holderName || "").trim(),
  nim: String(input.nim || "").trim(),
  nomorSurat: textOrNull(input.nomorSurat),
  lokasi: textOrNull(input.lokasi),
  waktuMulai: dateOrNull(input.waktuMulai),
  waktuSelesai: dateOrNull(input.waktuSelesai),
  skorListening: numberOrNull(input.skorListening),
  skorStructure: numberOrNull(input.skorStructure),
  skorReading: numberOrNull(input.skorReading),
  totalSkor: Number(input.totalSkor ?? input.score),
  institution: textOrNull(input.institution) || DEFAULT_INSTITUTION,
});

// Jalankan fn untuk setiap item dengan batas paralel
const mapWithConcurrency = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
};

module.exports = { normalizeCert, mapWithConcurrency, DEFAULT_INSTITUTION };
