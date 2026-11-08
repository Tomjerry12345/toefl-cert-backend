const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getJwtSecret } = require("../config/jwt");

/**
 * POST /api/auth/login
 * Login dengan username + password, kembalikan JWT
 */
const login = async (req, res) => {
  try {
    const username = String(req.body.username || "").toLowerCase().trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username dan password wajib diisi",
      });
    }

    const user = await User.findOne({ username }).select("+password");
    const valid = user ? await user.comparePassword(password) : false;

    // Pesan sengaja disamakan supaya tidak bocor info username mana yang ada
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Username atau password salah",
      });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      getJwtSecret(),
      { expiresIn: "24h" },
    );

    res.json({
      success: true,
      message: "Login berhasil",
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("login error:", error);
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

module.exports = { login, getMe };
