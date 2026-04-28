const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { validateIssueCert, validateBatch } = require("../middleware/validate");
const {
  issueCertificate,
  issueBatch,
  verifyCertificate,
  revokeCertificate,
  getAllCertificates,
  getCertificateById,
} = require("../controllers/certificateController");

/**
 * @route   POST /api/certificates/issue
 * @desc    Terbitkan satu sertifikat
 */
router.post(
  "/issue",
  (req, res, next) => {
    console.log("🔥 MASUK ROUTE /issue");
    console.log("HEADERS:", req.headers); // 
    next();
  },
  upload.single("file"),
  validateIssueCert,
  issueCertificate
);

/**
 * @route   POST /api/certificates/issue-batch
 * @desc    Terbitkan banyak sertifikat sekaligus
 */
router.post("/issue-batch", validateBatch, issueBatch);

/**
 * @route   GET /api/certificates
 * @desc    Ambil semua sertifikat (dengan paginasi & filter)
 */
router.get("/", getAllCertificates);

/**
 * @route   GET /api/certificates/:certId
 * @desc    Ambil detail sertifikat by ID
 */
router.get("/:certId", getCertificateById);


router.get('/:certId/pdf', async (req, res) => {
  try {
    const Certificate = require('../models/Certificate');

    const cert = await Certificate.findOne({ certId: req.params.certId });

    if (!cert) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    if (!cert.filePath) {
      return res.status(404).json({ message: "PDF belum tersedia" });
    }

    // 🔥 INI KUNCI NYA
    return res.redirect(cert.filePath);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal ambil PDF" });
  }
});

/**
 * @route   DELETE /api/certificates/:certId/revoke
 * @desc    Cabut sertifikat
 */
router.delete("/:certId/revoke", revokeCertificate);

module.exports = router;
