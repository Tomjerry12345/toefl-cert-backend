const { body, validationResult } = require("express-validator");

const MAX_BATCH = 50; // batas aman supaya 1 transaksi tidak kehabisan gas

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validasi gagal: " + errors.array().map((e) => e.msg).join("; "),
      errors: errors.array(),
    });
  }
  next();
};

const isParsableDate = (v) => !isNaN(new Date(v).getTime());

// Aturan field sertifikat, dipakai untuk single (prefix "") dan batch ("certificates.*.")
const certRules = (prefix = "") => [
  body(`${prefix}holderName`)
    .trim()
    .notEmpty().withMessage("Nama pemegang wajib diisi")
    .isLength({ max: 150 }).withMessage("Nama maksimal 150 karakter"),
  body(`${prefix}nim`)
    .trim()
    .notEmpty().withMessage("NIM wajib diisi")
    .isLength({ max: 50 }).withMessage("NIM maksimal 50 karakter"),
  body(`${prefix}totalSkor`)
    .isInt({ min: 0, max: 677 }).withMessage("Total skor TOEFL harus angka 0-677"),
  body(`${prefix}nomorSurat`)
    .optional({ values: "falsy" })
    .isLength({ max: 200 }).withMessage("Nomor surat maksimal 200 karakter"),
  body(`${prefix}lokasi`)
    .optional({ values: "falsy" })
    .isLength({ max: 200 }).withMessage("Lokasi maksimal 200 karakter"),
  body(`${prefix}waktuMulai`)
    .optional({ values: "falsy" })
    .custom(isParsableDate).withMessage("Format tanggal mulai tidak valid (pakai YYYY-MM-DD)"),
  body(`${prefix}waktuSelesai`)
    .optional({ values: "falsy" })
    .custom(isParsableDate).withMessage("Format tanggal selesai tidak valid (pakai YYYY-MM-DD)"),
  body(`${prefix}skorListening`)
    .optional({ values: "falsy" })
    .isFloat({ min: 0, max: 677 }).withMessage("Skor Listening tidak valid"),
  body(`${prefix}skorStructure`)
    .optional({ values: "falsy" })
    .isFloat({ min: 0, max: 677 }).withMessage("Skor Structure tidak valid"),
  body(`${prefix}skorReading`)
    .optional({ values: "falsy" })
    .isFloat({ min: 0, max: 677 }).withMessage("Skor Reading tidak valid"),
];

const validateIssueCert = [...certRules(""), handleValidationErrors];

const validateBatch = [
  body("certificates")
    .isArray({ min: 1, max: MAX_BATCH })
    .withMessage(`Batch harus 1-${MAX_BATCH} sertifikat`),
  ...certRules("certificates.*."),
  handleValidationErrors,
];

module.exports = { validateIssueCert, validateBatch, MAX_BATCH };
