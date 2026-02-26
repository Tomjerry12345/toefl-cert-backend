require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");

    // Cek apakah admin sudah ada
    const existing = await User.findOne({ username: "admin" });
    if (existing) {
      console.log("⚠️  Admin sudah ada, skip.");
      process.exit(0);
    }

    // Buat user admin default
    const admin = new User({
      username: "admin",
      password: "admin123",
      role: "admin",
    });

    await admin.save();
    console.log("✅ Admin user berhasil dibuat!");
    console.log("   Username : admin");
    console.log("   Password : admin123");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

seed();
