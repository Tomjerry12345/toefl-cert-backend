const { body, validationResult } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validasi gagal",
      errors: errors.array(),
    });
  }
  next();
};

const validateIssueCert = [
  body("holderName").trim().notEmpty().withMessage("Nama pemegang wajib diisi"),
  body("holderEmail").isEmail().withMessage("Email tidak valid"),
  body("score")
    .isInt({ min: 0, max: 677 })
    .withMessage("Skor TOEFL harus antara 0-677"),
  body("testDate").isISO8601().withMessage("Format tanggal tes tidak valid"),
  body("expiryDate").isISO8601().withMessage("Format tanggal kadaluarsa tidak valid"),
  handleValidationErrors,
];

const validateBatch = [
  body("certificates").isArray({ min: 1, max: 100 }).withMessage("Batch harus 1-100 sertifikat"),
  body("certificates.*.holderName").trim().notEmpty().withMessage("Nama pemegang wajib diisi"),
  body("certificates.*.holderEmail").isEmail().withMessage("Email tidak valid"),
  body("certificates.*.score")
    .isInt({ min: 0, max: 677 })
    .withMessage("Skor TOEFL harus antara 0-677"),
  body("certificates.*.testDate").isISO8601().withMessage("Format tanggal tidak valid"),
  body("certificates.*.expiryDate").isISO8601().withMessage("Format tanggal tidak valid"),
  handleValidationErrors,
];

module.exports = { validateIssueCert, validateBatch };
