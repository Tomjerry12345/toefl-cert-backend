require("dotenv").config();
const mongoose = require("mongoose");
const dns = require("dns");
const User = require("../src/models/User");

// Tambahkan di .env:
//   ADMIN_USERNAME=admin
//   ADMIN_PASSWORD=passwordkamu
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "").toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const seed = async () => {
  try {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      console.log("⚠️  ADMIN_USERNAME dan ADMIN_PASSWORD belum diset di .env!");
      process.exit(1);
    }
    if (ADMIN_PASSWORD.length < 8) {
      console.log("⚠️  ADMIN_PASSWORD minimal 8 karakter.");
      process.exit(1);
    }

    dns.setServers(["1.1.1.1", "8.8.8.8"]);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");

    // Bersihkan sisa login MetaMask lama (user tanpa username + index walletAddress)
    const legacy = await User.deleteMany({ username: { $exists: false } });
    if (legacy.deletedCount) {
      console.log(`🧹 ${legacy.deletedCount} user MetaMask lama dihapus`);
    }
    try {
      await User.collection.dropIndex("users");
      console.log("🧹 Index walletAddress lama dihapus");
    } catch (_) {
      // index tidak ada, abaikan
    }
    await User.syncIndexes();

    let admin = await User.findOne({ username: ADMIN_USERNAME });
    if (admin) {
      admin.password = ADMIN_PASSWORD; // otomatis di-hash saat save
      await admin.save();
      console.log("🔁 Admin sudah ada, password di-reset.");
    } else {
      admin = new User({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
        role: "admin",
      });
      await admin.save();
      console.log("✅ Admin berhasil dibuat!");
    }
    console.log("   Username :", ADMIN_USERNAME);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

seed();
