// const multer = require("multer");
// const { CloudinaryStorage } = require("multer-storage-cloudinary");
// const cloudinary = require("../config/cloudinary");

// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: {
//     folder: "toefl-certificates",
//     allowed_formats: ["pdf", "jpg", "jpeg", "png"],
//     resource_type: "auto",
//   },
// });

// const upload = multer({
//   storage,
//   limits: {
//     fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
//   },
// });

// module.exports = upload;
const multer = require("multer");
const path = require("path");

// STORAGE LOKAL (WAJIB untuk proses QR PDF)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  },
});

module.exports = upload;
