const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");
const User = require("../models/User");

const getNonce = async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress.toLowerCase();
    let user = await User.findOne({ walletAddress });
    if (!user) {
      user = await User.create({ walletAddress });
    }
    const message =
      "Selamat datang di TOEFL Cert System!\n\nTandatangani pesan ini untuk login.\n\nWallet: " +
      walletAddress +
      "\nNonce: " +
      user.nonce;
    res.json({ success: true, data: { nonce: user.nonce, message } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const verifySignature = async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !signature) {
      return res
        .status(400)
        .json({
          success: false,
          message: "walletAddress dan signature wajib diisi",
        });
    }
    const address = walletAddress.toLowerCase();
    const user = await User.findOne({ walletAddress: address });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan" });
    }
    const message =
      "Selamat datang di TOEFL Cert System!\n\nTandatangani pesan ini untuk login.\n\nWallet: " +
      address +
      "\nNonce: " +
      user.nonce;
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== address) {
      return res
        .status(401)
        .json({ success: false, message: "Signature tidak valid" });
    }
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
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getNonce, verifySignature, getMe };
