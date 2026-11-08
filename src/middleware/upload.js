const multer = require("multer");

// Disimpan di memori (tidak menulis ke disk) - cukup untuk membaca field FormData.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  },
});

module.exports = upload;
