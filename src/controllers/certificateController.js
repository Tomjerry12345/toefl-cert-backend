const { v4: uuidv4 } = require("uuid");
const Certificate = require("../models/Certificate");
const { processBatch, verifyMerkleProof } = require("../services/merkleService");
const { generateQRCode, embedQRToPDF } = require("../services/qrService");
const {
  issueCertificateOnChain, issueBatchOnChain,
  verifyCertificateOnChain, revokeCertificateOnChain,
} = require("../services/blockchainService");

// Helper inject template HTML
const resolveTemplate = async (templateId) => {
  if (!templateId) return null;
  const Template = require("../models/Template");
  const template = await Template.findById(templateId);
  if (!template) return null;
  let html = template.htmlTemplate;
  if (template.backgroundImageUrl) {
    html = html.replace("{{backgroundImageUrl}}", template.backgroundImageUrl)
      .replace(/\{\{#if backgroundImageUrl\}\}/g, "")
      .replace(/\{\{\/if\}\}/g, "");
  } else {
    html = html.replace(/\{\{#if backgroundImageUrl\}\}[\s\S]*?\{\{\/if\}\}/g, "");
  }
  return html;
};

// ============================================================
// ISSUE SINGLE CERTIFICATE
// ============================================================
const issueCertificate = async (req, res) => {
  try {
    const {
      holderName, nim, nomorSurat, lokasi,
      waktuMulai, waktuSelesai,
      skorListening, skorStructure, skorReading, totalSkor,
      institution, templateId,
    } = req.body;

    if (!holderName) return res.status(400).json({ success: false, message: "Nama wajib diisi" });
    if (!nim) return res.status(400).json({ success: false, message: "NIM wajib diisi" });
    if (!totalSkor || isNaN(totalSkor)) return res.status(400).json({ success: false, message: "Total skor wajib diisi dan harus angka" });

    const certId = `TOEFL-${uuidv4().toUpperCase().slice(0, 8)}`;
    const batchId = `BATCH-${Date.now()}`;

    const certData = { certId, holderName, nim, score: Number(totalSkor) };
    const { merkleRoot, certsWithProof } = processBatch([certData]);
    const { leafHash, merkleProof } = certsWithProof[0];

    await Certificate.create({
      certId, holderName, nim,
      nomorSurat: nomorSurat || null,
      lokasi: lokasi || null,
      waktuMulai: waktuMulai ? new Date(waktuMulai) : null,
      waktuSelesai: waktuSelesai ? new Date(waktuSelesai) : null,
      skorListening: skorListening ? Number(skorListening) : null,
      skorStructure: skorStructure ? Number(skorStructure) : null,
      skorReading: skorReading ? Number(skorReading) : null,
      totalSkor: Number(totalSkor),
      institution: institution || "UIN Alauddin Makassar",
      merkleRoot, merkleProof, leafHash, batchId,
      status: "pending",
      issuedBy: req.issuerAddress || "system",
    });

    console.log("⛓️ KIRIM KE BLOCKCHAIN:", { certId, merkleRoot });
    const txResult = await issueCertificateOnChain(certId, merkleRoot);
    console.log("⛓️ Blockchain done:", txResult.txHash);

    let qrCodePath, pdfWithQRPath, base64QR, verifyUrl;
    const templateHtml = await resolveTemplate(templateId);

    if (templateHtml) {
      const { generatePDFFromTemplate } = require("../services/pdfService");
      const pdfResult = await generatePDFFromTemplate(templateHtml, {
        certId, holderName, nim, nomorSurat, lokasi,
        waktuMulai, waktuSelesai,
        skorListening: skorListening ? Number(skorListening) : null,
        skorStructure: skorStructure ? Number(skorStructure) : null,
        skorReading: skorReading ? Number(skorReading) : null,
        totalSkor: Number(totalSkor),
        institution: institution || "UIN Alauddin Makassar",
      });
      qrCodePath = pdfResult.verifyUrl;
      pdfWithQRPath = pdfResult.filePath;
      base64QR = pdfResult.base64QR;
      verifyUrl = pdfResult.verifyUrl;
    } else {
      const qr = await generateQRCode(certId);
      qrCodePath = qr.filePath;
      base64QR = qr.base64;
      verifyUrl = qr.verifyUrl;
    }

    await Certificate.findOneAndUpdate(
      { certId },
      { txHash: txResult.txHash, blockNumber: txResult.blockNumber, qrCodePath, filePath: pdfWithQRPath || null, status: "issued" }
    );

    console.log("✅ ISSUE SUCCESS:", certId);

    return res.status(201).json({
      success: true,
      message: "Sertifikat berhasil diterbitkan",
      data: {
        certId, holderName, nim,
        nomorSurat: nomorSurat || null,
        lokasi: lokasi || null,
        waktuMulai: waktuMulai || null,
        waktuSelesai: waktuSelesai || null,
        skorListening: skorListening ? Number(skorListening) : null,
        skorStructure: skorStructure ? Number(skorStructure) : null,
        skorReading: skorReading ? Number(skorReading) : null,
        totalSkor: Number(totalSkor),
        institution: institution || "UIN Alauddin Makassar",
        merkleRoot,
        txHash: txResult.txHash,
        blockNumber: txResult.blockNumber,
        etherscan: `https://sepolia.etherscan.io/tx/${txResult.txHash}`,
        qrCode: base64QR,
        verifyUrl,
        pdfUrl: pdfWithQRPath || null,
      },
    });
  } catch (error) {
    console.error("issueCertificate error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// ISSUE BATCH CERTIFICATE
// ============================================================
const issueBatch = async (req, res) => {
  try {
    const { certificates, templateId } = req.body;
    if (!Array.isArray(certificates) || certificates.length === 0) {
      return res.status(400).json({ success: false, message: "Data sertifikat tidak valid" });
    }

    const templateHtml = await resolveTemplate(templateId);
    const batchId = `BATCH-${Date.now()}`;

    const certsData = certificates.map((cert) => ({
      ...cert,
      certId: `TOEFL-${uuidv4().toUpperCase().slice(0, 8)}`,
      score: Number(cert.totalSkor || cert.score || 0),
    }));

    const { merkleRoot, certsWithProof } = processBatch(certsData);
    const certIds = certsWithProof.map((c) => c.certId);
    const txResult = await issueBatchOnChain(certIds, merkleRoot);

    const savedCerts = [];
    for (const cert of certsWithProof) {
      let filePath = null, qrBase64 = null, verifyUrl = null;

      if (templateHtml) {
        const { generatePDFFromTemplate } = require("../services/pdfService");
        const pdfResult = await generatePDFFromTemplate(templateHtml, {
          certId: cert.certId,
          holderName: cert.holderName,
          nim: cert.nim,
          nomorSurat: cert.nomorSurat || null,
          lokasi: cert.lokasi || null,
          waktuMulai: cert.waktuMulai || null,
          waktuSelesai: cert.waktuSelesai || null,
          skorListening: cert.skorListening ? Number(cert.skorListening) : null,
          skorStructure: cert.skorStructure ? Number(cert.skorStructure) : null,
          skorReading: cert.skorReading ? Number(cert.skorReading) : null,
          totalSkor: Number(cert.totalSkor || cert.score || 0),
          institution: cert.institution || "UIN Alauddin Makassar",
        });
        filePath = pdfResult.filePath;
        qrBase64 = pdfResult.base64QR;
        verifyUrl = pdfResult.verifyUrl;
      } else {
        const qr = await generateQRCode(cert.certId);
        qrBase64 = qr.base64;
        verifyUrl = qr.verifyUrl;
      }

      await new Certificate({
        certId: cert.certId,
        holderName: cert.holderName,
        nim: cert.nim,
        nomorSurat: cert.nomorSurat || null,
        lokasi: cert.lokasi || null,
        waktuMulai: cert.waktuMulai ? new Date(cert.waktuMulai) : null,
        waktuSelesai: cert.waktuSelesai ? new Date(cert.waktuSelesai) : null,
        skorListening: cert.skorListening ? Number(cert.skorListening) : null,
        skorStructure: cert.skorStructure ? Number(cert.skorStructure) : null,
        skorReading: cert.skorReading ? Number(cert.skorReading) : null,
        totalSkor: Number(cert.totalSkor || cert.score || 0),
        institution: cert.institution || "UIN Alauddin Makassar",
        merkleRoot, merkleProof: cert.merkleProof, leafHash: cert.leafHash,
        batchId, txHash: txResult.txHash, blockNumber: txResult.blockNumber,
        qrCodePath: verifyUrl, filePath: filePath, status: "issued",
        issuedBy: req.issuerAddress || "system",
      }).save();

      savedCerts.push({ certId: cert.certId, holderName: cert.holderName, nim: cert.nim, qrCode: qrBase64, verifyUrl, pdfUrl: filePath });
    }

    res.status(201).json({
      success: true,
      message: `${savedCerts.length} sertifikat berhasil diterbitkan`,
      data: { batchId, merkleRoot, txHash: txResult.txHash, blockNumber: txResult.blockNumber, etherscan: `https://sepolia.etherscan.io/tx/${txResult.txHash}`, certificates: savedCerts },
    });
  } catch (error) {
    console.error("issueBatch error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// VERIFY CERTIFICATE
// ============================================================
const verifyCertificate = async (req, res) => {
  try {
    const { certId } = req.params;
    const cert = await Certificate.findOne({ certId });
    if (!cert) return res.status(404).json({ success: false, verified: false, message: "Sertifikat tidak ditemukan" });

    const localVerify = verifyMerkleProof(cert.merkleRoot, cert.leafHash, cert.merkleProof);
    const chainVerify = await verifyCertificateOnChain(certId, cert.leafHash, cert.merkleProof);
    const isValid = localVerify && chainVerify.isValid;

    res.json({
      success: true, verified: isValid,
      data: {
        certId: cert.certId, holderName: cert.holderName, nim: cert.nim,
        nomorSurat: cert.nomorSurat, lokasi: cert.lokasi,
        waktuMulai: cert.waktuMulai, waktuSelesai: cert.waktuSelesai,
        skorListening: cert.skorListening, skorStructure: cert.skorStructure,
        skorReading: cert.skorReading, totalSkor: cert.totalSkor,
        institution: cert.institution, status: cert.status,
        isRevoked: chainVerify.isRevoked, merkleRoot: cert.merkleRoot,
        txHash: cert.txHash, blockNumber: cert.blockNumber,
        issuedAt: chainVerify.issuedAt,
        localVerification: localVerify, blockchainVerification: chainVerify.isValid,
        etherscan: cert.txHash ? `https://sepolia.etherscan.io/tx/${cert.txHash}` : null,
      },
    });
  } catch (error) {
    console.error("verifyCertificate error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// REVOKE CERTIFICATE
// ============================================================
const revokeCertificate = async (req, res) => {
  try {
    const { certId } = req.params;
    const { reason } = req.body;
    const cert = await Certificate.findOne({ certId });
    if (!cert) return res.status(404).json({ success: false, message: "Sertifikat tidak ditemukan" });
    if (cert.status === "revoked") return res.status(400).json({ success: false, message: "Sertifikat sudah dicabut" });

    const txResult = await revokeCertificateOnChain(certId);
    cert.status = "revoked";
    cert.revokedAt = new Date();
    cert.revokedReason = reason || "Tidak ada alasan";
    await cert.save();

    res.json({ success: true, message: "Sertifikat berhasil dicabut", data: { certId, txHash: txResult.txHash, revokedAt: cert.revokedAt } });
  } catch (error) {
    console.error("revokeCertificate error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET ALL CERTIFICATES
// ============================================================
const getAllCertificates = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { holderName: { $regex: search, $options: "i" } },
        { nim: { $regex: search, $options: "i" } },
        { certId: { $regex: search, $options: "i" } },
        { nomorSurat: { $regex: search, $options: "i" } },
      ];
    }
    const total = await Certificate.countDocuments(query);
    const certs = await Certificate.find(query)
      .select("-merkleProof -leafHash")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ success: true, data: certs, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET CERTIFICATE BY ID
// ============================================================
const getCertificateById = async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certId: req.params.certId });
    if (!cert) return res.status(404).json({ success: false, message: "Sertifikat tidak ditemukan" });
    res.json({ success: true, data: cert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { issueCertificate, issueBatch, verifyCertificate, revokeCertificate, getAllCertificates, getCertificateById };
