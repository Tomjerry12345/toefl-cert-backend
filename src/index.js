require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/database");
const { initBlockchain } = require("./config/blockchain");
const { getJwtSecret } = require("./config/jwt");
const certificateRoutes = require("./routes/certificateRoutes");
const verifyRoutes = require("./routes/verifyRoutes");
const authRoutes = require("./routes/authRoutes");
const templateRoutes = require("./routes/templateRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Aktifkan hanya jika backend ada di belakang 1 proxy (Render/Railway/Nginx, dll)
// supaya rate limit membaca IP pengunjung yang asli: TRUST_PROXY=true
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet());
app.use(
  cors({
    // Boleh lebih dari satu, pisahkan dengan koma
    origin: (process.env.FRONTEND_URL || "http://localhost:3000")
      .split(",")
      .map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 300,
  message: {
    success: false,
    message: "Terlalu banyak request, coba lagi nanti",
  },
});
app.use("/api/", limiter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server berjalan normal",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Pastikan DB & blockchain siap sebelum route lain menerima request.
// Di Vercel (serverless) ini jalan lazily saat cold start; di Docker/lokal sudah siap sebelum listen.
app.use(async (req, res, next) => {
  try {
    await ensureReady();
    next();
  } catch (err) {
    console.error("❌ Init gagal:", err.message);
    res.status(503).json({ success: false, message: "Layanan belum siap, coba lagi sebentar" });
  }
});

// ============================================================
// ROUTES
// ============================================================
app.use("/api/certificates", certificateRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/templates", templateRoutes);

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
// INIT & START SERVER
// ============================================================
// Init sekali per proses (di serverless: sekali per instance). Promise di-cache agar
// request bersamaan tidak membuat koneksi ganda; kalau gagal, boleh dicoba lagi.
let readyPromise = null;
const ensureReady = () => {
  if (!readyPromise) {
    readyPromise = (async () => {
      getJwtSecret(); // gagal cepat kalau JWT_SECRET belum diset
      await connectDB();
      await initBlockchain(); // tunggu sampai kontrak siap sebelum menerima request
      require("./config/cloudinary");
    })().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
};

const startServer = async () => {
  try {
    await ensureReady();

    app.listen(PORT, () => {
      console.log("\n🚀 ================================");
      console.log(`   TOEFL Cert Backend Running`);
      console.log(`   URL     : http://localhost:${PORT}`);
      console.log(`   Env     : ${process.env.NODE_ENV}`);
      console.log(`   Network : Ethereum Sepolia`);
      console.log("================================\n");
    });
  } catch (error) {
    console.error("❌ Gagal start server:", error.message);
    process.exit(1);
  }
};

// `node src/index.js` (lokal/Docker) -> listen. Di Vercel file ini hanya di-require (api/index.js).
if (require.main === module) startServer();

module.exports = app;
