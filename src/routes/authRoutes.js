const express = require("express");
const router = express.Router();
const {
  getNonce,
  verifySignature,
  getMe,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");

router.get("/nonce/:walletAddress", getNonce);
router.post("/verify-signature", verifySignature);
router.get("/me", authMiddleware, getMe);

module.exports = router;
