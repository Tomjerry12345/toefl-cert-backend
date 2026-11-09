const mongoose = require("mongoose");
const dns = require("dns");

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection; // sudah tersambung
  try {
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error; // index.js yang memutuskan: exit (Docker) atau 503 (Vercel)
  }
};

module.exports = connectDB;
