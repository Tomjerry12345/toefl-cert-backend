const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");
const User = require("../models/User");
const { getContract } = require("../config/blockchain");

/**
 * GET /api/auth/nonce/:walletAddress
 * Cek authorizedIssuers di smart contract, lalu beri nonce
 */
const getNonce = async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress.toLowerCase();

    // Cek ke smart contract apakah wallet ini authorized issuer
    const contract = getContract();
    const isAuthorized = await contract.authorizedIssuers(walletAddress);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Wallet ini tidak terdaftar sebagai issuer di smart contract",
      });
    }

    // Buat atau ambil user di database
    let user = await User.findOne({ walletAddress });
    if (!user) {
      user = await User.create({ walletAddress });
    }

    const message =
      "Selamat datang di TOEFL Cert System!\n\nTandatangani pesan ini untuk login.\n\nWallet: " +
      walletAddress +
      "\nNonce: " +
      user.nonce;

    res.json({
      success: true,
      data: { nonce: user.nonce, message },
    });
  } catch (error) {
    console.error("getNonce error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /api/auth/verify-signature
 * Verifikasi tanda tangan MetaMask, kembalikan JWT
 */
const verifySignature = async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !signature) {
      return res.status(400).json({
        success: false,
        message: "walletAddress dan signature wajib diisi",
      });
    }

    const address = walletAddress.toLowerCase();

    // Double-check ke smart contract saat verify juga
    const contract = getContract();
    const isAuthorized = await contract.authorizedIssuers(address);
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Wallet ini tidak terdaftar sebagai issuer di smart contract",
      });
    }

    const user = await User.findOne({ walletAddress: address });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan, coba minta nonce terlebih dahulu",
      });
    }

    const message =
      "Selamat datang di TOEFL Cert System!\n\nTandatangani pesan ini untuk login.\n\nWallet: " +
      address +
      "\nNonce: " +
      user.nonce;

    // Verifikasi signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== address) {
      return res.status(401).json({
        success: false,
        message: "Signature tidak valid",
      });
    }

    // Refresh nonce (anti-replay attack)
    await user.refreshNonce();

    const token = jwt.sign(
      { id: user._id, walletAddress: user.walletAddress, role: user.role },
      process.env.JWT_SECRET || "toefl_secret_key",
      { expiresIn: "24h" },
    );

    res.json({
      success: true,
      message: "Login berhasil",
      data: {
        token,
        user: {
          id: user._id,
          walletAddress: user.walletAddress,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("verifySignature error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getNonce, verifySignature, getMe };
