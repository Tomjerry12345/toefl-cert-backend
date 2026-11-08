const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const upload = require("../middleware/upload");
const { validateIssueCert, validateBatch } = require("../middleware/validate");
const {
  issueCertificate,
  issueBatch,
  revokeCertificate,
  getAllCertificates,
  getCertificateById,
} = require("../controllers/certificateController");
const Certificate = require("../models/Certificate");

/**
 * PUBLIK: unduh PDF sertifikat (redirect ke Cloudinary)
 */
router.get("/:certId/pdf", async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certId: req.params.certId });
    if (!cert) return res.status(404).json({ success: false, message: "Sertifikat tidak ditemukan" });
    if (!cert.filePath) return res.status(404).json({ success: false, message: "PDF belum tersedia" });
    return res.redirect(cert.filePath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Gagal mengambil PDF" });
  }
});

// ============================================================
// SEMUA ROUTE DI BAWAH INI WAJIB LOGIN ADMIN
// ============================================================
router.use(authMiddleware);

router.post("/issue", upload.single("file"), validateIssueCert, issueCertificate);
router.post("/issue-batch", validateBatch, issueBatch);
router.get("/", getAllCertificates);
router.get("/:certId", getCertificateById);
router.delete("/:certId/revoke", revokeCertificate);

module.exports = router;
