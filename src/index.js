require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/database");
const { initBlockchain } = require("./config/blockchain");
const certificateRoutes = require("./routes/certificateRoutes");
const verifyRoutes = require("./routes/verifyRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files (QR codes & uploaded certs)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100,
  message: { success: false, message: "Terlalu banyak request, coba lagi nanti" },
});
app.use("/api/", limiter);

// ============================================================
// ROUTES
// ============================================================
app.use("/api/certificates", certificateRoutes);
app.use("/api/verify", verifyRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server berjalan normal",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route tidak ditemukan" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ============================================================
// START SERVER
// ============================================================
const startServer = async () => {
  try {
    // Connect MongoDB
    await connectDB();

    // Init Blockchain
    initBlockchain();

    app.listen(PORT, () => {
      console.log("\n🚀 ================================");
      console.log(`   TOEFL Cert Backend Running`);
      console.log(`   URL     : http://localhost:${PORT}`);
      console.log(`   Env     : ${process.env.NODE_ENV}`);
      console.log(`   Network : Ethereum Sepolia`);
      console.log("================================\n");
    });
  } catch (error) {
    console.error("❌ Gagal start server:", error);
    process.exit(1);
  }
};

startServer();
