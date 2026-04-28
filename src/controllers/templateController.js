const Template = require("../models/Template");
const { uploadImageToCloudinary } = require("../services/pdfService");
const fs = require("fs");

// ============================================================
// GET ALL TEMPLATES
// ============================================================
const getAllTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET TEMPLATE BY ID
// ============================================================
const getTemplateById = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Template tidak ditemukan" });
    }
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// CREATE TEMPLATE
// ============================================================
const createTemplate = async (req, res) => {
  try {
    const { name, description, htmlTemplate, fields } = req.body;

    if (!name || !htmlTemplate) {
      return res.status(400).json({
        success: false,
        message: "Nama dan HTML template wajib diisi",
      });
    }

    let backgroundImageUrl = null;

    // Upload background image ke Cloudinary jika ada
    if (req.file) {
      const buffer = fs.readFileSync(req.file.path);
      const result = await uploadImageToCloudinary(buffer, name.replace(/\s+/g, "_"));
      backgroundImageUrl = result.secure_url;

      // Hapus file temp
      fs.unlinkSync(req.file.path);
    }

    const template = await Template.create({
      name,
      description: description || "",
      htmlTemplate,
      backgroundImageUrl,
      fields: fields ? JSON.parse(fields) : undefined,
      createdBy: req.user?.walletAddress || "system",
    });

    res.status(201).json({
      success: true,
      message: "Template berhasil dibuat",
      data: template,
    });
  } catch (error) {
    console.error("createTemplate error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// UPDATE TEMPLATE
// ============================================================
const updateTemplate = async (req, res) => {
  try {
    const { name, description, htmlTemplate, fields } = req.body;

    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Template tidak ditemukan" });
    }

    let backgroundImageUrl = template.backgroundImageUrl;

    // Upload background baru jika ada
    if (req.file) {
      const buffer = fs.readFileSync(req.file.path);
      const result = await uploadImageToCloudinary(buffer, name?.replace(/\s+/g, "_") || "bg");
      backgroundImageUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    const updated = await Template.findByIdAndUpdate(
      req.params.id,
      {
        name: name || template.name,
        description: description !== undefined ? description : template.description,
        htmlTemplate: htmlTemplate || template.htmlTemplate,
        backgroundImageUrl,
        fields: fields ? JSON.parse(fields) : template.fields,
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Template berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// DELETE TEMPLATE (soft delete)
// ============================================================
const deleteTemplate = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Template tidak ditemukan" });
    }

    await Template.findByIdAndUpdate(req.params.id, { isActive: false });

    res.json({ success: true, message: "Template berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET DEFAULT HTML TEMPLATE (starter)
// ============================================================
const getDefaultHtml = async (req, res) => {
  const defaultHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sertifikat TOEFL</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 210mm;
      height: 297mm;
      font-family: 'Times New Roman', serif;
      background: #fff;
      position: relative;
      overflow: hidden;
    }
    .background {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 0;
    }
    .content {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 80px;
      text-align: center;
    }
    .logo-area { margin-bottom: 20px; }
    .logo-area h2 {
      font-size: 16px;
      font-weight: bold;
      color: #1a3a6e;
      text-transform: uppercase;
      letter-spacing: 3px;
    }
    .title {
      font-size: 42px;
      font-weight: bold;
      color: #c8a84b;
      margin-bottom: 10px;
      letter-spacing: 6px;
      text-transform: uppercase;
    }
    .subtitle {
      font-size: 14px;
      color: #555;
      margin-bottom: 40px;
      letter-spacing: 2px;
    }
    .divider {
      width: 80%;
      height: 2px;
      background: linear-gradient(to right, transparent, #c8a84b, transparent);
      margin: 20px auto;
    }
    .presented { font-size: 13px; color: #777; margin-bottom: 10px; }
    .holder-name {
      font-size: 38px;
      font-weight: bold;
      color: #1a3a6e;
      margin-bottom: 6px;
      font-style: italic;
    }
    .nim { font-size: 14px; color: #555; margin-bottom: 30px; }
    .desc {
      font-size: 13px;
      color: #555;
      line-height: 1.8;
      margin-bottom: 10px;
    }
    .score-box {
      display: inline-block;
      background: #1a3a6e;
      color: white;
      padding: 14px 40px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .score-label { font-size: 11px; letter-spacing: 2px; opacity: 0.8; }
    .score-value { font-size: 36px; font-weight: bold; }
    .info-row {
      display: flex;
      gap: 40px;
      margin-top: 30px;
      font-size: 12px;
      color: #666;
    }
    .info-item { text-align: center; }
    .info-label { font-weight: bold; color: #333; margin-bottom: 4px; }
    .qr-section {
      position: absolute;
      bottom: 40px;
      right: 50px;
      text-align: center;
    }
    .qr-section img { width: 80px; height: 80px; }
    .qr-section p { font-size: 9px; color: #888; margin-top: 4px; }
    .cert-id {
      position: absolute;
      bottom: 40px;
      left: 50px;
      font-size: 10px;
      color: #aaa;
      font-family: monospace;
    }
  </style>
</head>
<body>
  {{#if backgroundImageUrl}}
  <img class="background" src="{{backgroundImageUrl}}" alt="background" />
  {{/if}}

  <div class="content">
    <div class="logo-area">
      <h2>{{institution}}</h2>
    </div>

    <div class="divider"></div>

    <div class="title">Certificate</div>
    <div class="subtitle">OF ACHIEVEMENT — TOEFL EQUIVALENT TEST</div>

    <div class="divider"></div>

    <p class="presented">This certificate is proudly presented to</p>
    <div class="holder-name">{{holderName}}</div>
    <div class="nim">NIM: {{nim}}</div>

    <p class="desc">
      Has successfully completed the TOEFL Equivalent Test<br/>
      with the following result:
    </p>

    <div class="score-box">
      <div class="score-label">TOTAL SCORE</div>
      <div class="score-value">{{score}}</div>
    </div>

    <div class="info-row">
      <div class="info-item">
        <div class="info-label">Test Date</div>
        <div>{{testDate}}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Valid Until</div>
        <div>{{expiryDate}}</div>
      </div>
    </div>
  </div>

  <div class="cert-id">Cert ID: {{certId}}</div>

  <div class="qr-section">
    <img src="{{qrCode}}" alt="QR Code" />
    <p>Scan to verify</p>
  </div>
</body>
</html>`;

  res.json({ success: true, data: { html: defaultHtml } });
};

module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getDefaultHtml,
};
