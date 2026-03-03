require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

// Ganti dengan wallet address admin yang valid
const ADMIN_WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS || "0x0000000000000000000000000000000000000000";

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");

    if (ADMIN_WALLET_ADDRESS === "0x0000000000000000000000000000000000000000") {
      console.log("⚠️  ADMIN_WALLET_ADDRESS belum diset di .env!");
      console.log("   Tambahkan ADMIN_WALLET_ADDRESS=0xYourWalletHere di file .env");
      process.exit(1);
    }

    const address = ADMIN_WALLET_ADDRESS.toLowerCase();

    // Cek apakah admin sudah ada
    const existing = await User.findOne({ walletAddress: address });
    if (existing) {
      console.log("⚠️  Admin wallet sudah terdaftar, skip.");
      process.exit(0);
    }

    // Buat user admin
    const admin = new User({
      walletAddress: address,
      role: "admin",
    });

    await admin.save();
    console.log("✅ Admin berhasil dibuat!");
    console.log("   Wallet Address :", address);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

seed();
