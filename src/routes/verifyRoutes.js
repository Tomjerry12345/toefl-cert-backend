const express = require("express");
const router = express.Router();
const { verifyCertificate } = require("../controllers/certificateController");

/**
 * @route   GET /api/verify/:certId
 * @desc    Endpoint publik untuk verifikasi via QR Code scan
 */
router.get("/:certId", verifyCertificate);

module.exports = router;
