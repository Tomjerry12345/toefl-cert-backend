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

/**
 * @route   DELETE /api/certificates/:certId/revoke
 * @desc    Cabut sertifikat
 */
router.delete("/:certId/revoke", revokeCertificate);

module.exports = router;
