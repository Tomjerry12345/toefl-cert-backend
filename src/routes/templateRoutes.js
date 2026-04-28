const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getDefaultHtml,
} = require("../controllers/templateController");

// Multer untuk upload background image (temp ke disk)
const upload = multer({
  dest: "uploads/temp/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file PNG/JPG/WEBP yang diizinkan"));
    }
  },
});

router.get("/default-html", getDefaultHtml);
router.get("/", getAllTemplates);
router.get("/:id", getTemplateById);
router.post("/", upload.single("backgroundImage"), createTemplate);
router.put("/:id", upload.single("backgroundImage"), updateTemplate);
router.delete("/:id", deleteTemplate);

module.exports = router;
