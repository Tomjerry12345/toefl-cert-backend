const { v4: uuidv4 } = require("uuid");
const Certificate = require("../models/Certificate");
const Template = require("../models/Template");
const {
  processBatch,
  verifyMerkleProof,
  generateLeafHash,
} = require("../services/merkleService");
const { generateQRCode } = require("../services/qrService");
const {
  generatePDFFromTemplate,
  generatePDFsFromTemplate,
} = require("../services/pdfService");
const {
  issueCertificateOnChain,
  issueBatchOnChain,
  verifyCertificateOnChain,
  revokeCertificateOnChain,
} = require("../services/blockchainService");
const { normalizeCert, mapWithConcurrency } = require("../utils/certData");

const newCertId = () => `TOEFL-${uuidv4().toUpperCase().slice(0, 8)}`;
const issuerName = (req) => req.user?.username || "system";

// Ambil HTML template dan siapkan placeholder background
const resolveTemplate = async (templateId) => {
  if (!templateId) return null;
  const template = await Template.findById(templateId);
  if (!template) return null;
  let html = template.htmlTemplate;
  if (template.backgroundImageUrl) {
    html = html
      .replace("{{backgroundImageUrl}}", template.backgroundImageUrl)
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
    const certId = newCertId();
    const data = normalizeCert(req.body, certId);
    const batchId = `BATCH-${Date.now()}`;

    // 1. Merkle tree + proof (1 daun)
    const { merkleRoot, certsWithProof } = processBatch([data]);
    const { leafHash, merkleProof } = certsWithProof[0];

    // 2. Simpan dulu sebagai pending
    await Certificate.create({
      ...data,
      merkleRoot,
      merkleProof,
      leafHash,
      batchId,
      status: "pending",
      issuedBy: issuerName(req),
    });

    // 3. Kirim ke blockchain
    const txResult = await issueCertificateOnChain(certId, merkleRoot);
    await Certificate.updateOne(
      { certId },
      { txHash: txResult.txHash, blockNumber: txResult.blockNumber, status: "issued" },
    );

    // 4. PDF / QR (kalau gagal, sertifikat tetap sah karena sudah di blockchain)
    let filePath = null;
    let base64QR;
    let verifyUrl;
    let pdfError = null;

    try {
      const templateHtml = await resolveTemplate(req.body.templateId);
      if (templateHtml) {
        const pdf = await generatePDFFromTemplate(templateHtml, data);
        filePath = pdf.filePath;
        base64QR = pdf.base64QR;
        verifyUrl = pdf.verifyUrl;
      }
    } catch (err) {
      pdfError = err.message;
    }
    if (!base64QR) {
      const qr = await generateQRCode(certId);
      base64QR = qr.base64;
      verifyUrl = qr.verifyUrl;
    }

    await Certificate.updateOne({ certId }, { qrCodePath: verifyUrl, filePath });

    return res.status(201).json({
      success: true,
      message: pdfError
        ? "Sertifikat tercatat di blockchain, tapi PDF gagal dibuat"
        : "Sertifikat berhasil diterbitkan",
      data: {
        ...data,
        merkleRoot,
        txHash: txResult.txHash,
        blockNumber: txResult.blockNumber,
        etherscan: `https://sepolia.etherscan.io/tx/${txResult.txHash}`,
        qrCode: base64QR,
        verifyUrl,
        pdfUrl: filePath,
        pdfError,
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
    const batchId = `BATCH-${Date.now()}`;

    // 1. Rapikan data + Merkle tree untuk seluruh batch
    const records = certificates.map((c) => normalizeCert(c, newCertId()));
    const { merkleRoot, certsWithProof } = processBatch(records);

    // 2. Simpan SEMUA dulu sebagai pending (data tidak hilang kalau proses berikutnya gagal)
    await Certificate.insertMany(
      certsWithProof.map((c) => ({
        ...c,
        batchId,
        status: "pending",
        issuedBy: issuerName(req),
      })),
    );

    // 3. Satu transaksi blockchain untuk seluruh batch
    const certIds = records.map((r) => r.certId);
    const txResult = await issueBatchOnChain(certIds, merkleRoot);
    await Certificate.updateMany(
      { batchId },
      { txHash: txResult.txHash, blockNumber: txResult.blockNumber, status: "issued" },
    );

    // 4. PDF / QR per sertifikat (kegagalan satu sertifikat tidak membatalkan yang lain)
    const templateHtml = await resolveTemplate(templateId);
    let outputs;
    if (templateHtml) {
      outputs = await generatePDFsFromTemplate(templateHtml, records);
    } else {
      outputs = await mapWithConcurrency(records, 5, async (r) => {
        try {
          const qr = await generateQRCode(r.certId);
          return { certId: r.certId, filePath: null, base64QR: qr.base64, verifyUrl: qr.verifyUrl, error: null };
        } catch (err) {
          return { certId: r.certId, error: err.message };
        }
      });
    }

    await Promise.all(
      outputs
        .filter((o) => !o.error)
        .map((o) =>
          Certificate.updateOne(
            { certId: o.certId },
            { filePath: o.filePath || null, qrCodePath: o.verifyUrl },
          ),
        ),
    );

    const byId = Object.fromEntries(outputs.map((o) => [o.certId, o]));
    const savedCerts = records.map((r) => ({
      certId: r.certId,
      holderName: r.holderName,
      nim: r.nim,
      qrCode: byId[r.certId]?.base64QR || null,
      verifyUrl: byId[r.certId]?.verifyUrl || null,
      pdfUrl: byId[r.certId]?.filePath || null,
      pdfError: byId[r.certId]?.error || null,
    }));
    const failedPdf = savedCerts.filter((c) => c.pdfError).length;

    res.status(201).json({
      success: true,
      message: failedPdf
        ? `${savedCerts.length} sertifikat tercatat di blockchain, ${failedPdf} PDF gagal dibuat`
        : `${savedCerts.length} sertifikat berhasil diterbitkan`,
      data: {
        batchId,
        merkleRoot,
        txHash: txResult.txHash,
        blockNumber: txResult.blockNumber,
        etherscan: `https://sepolia.etherscan.io/tx/${txResult.txHash}`,
        failedPdf,
        certificates: savedCerts,
      },
    });
  } catch (error) {
    console.error("issueBatch error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// VERIFY CERTIFICATE (publik)
// ============================================================
const verifyCertificate = async (req, res) => {
  try {
    const { certId } = req.params;
    const cert = await Certificate.findOne({ certId });
    if (!cert) {
      return res
        .status(404)
        .json({ success: false, verified: false, message: "Sertifikat tidak ditemukan" });
    }

    // Hitung ulang hash dari data yang ada di database SEKARANG.
    // Kalau data diubah (nama, skor, dll), hash tidak akan cocok.
    const recomputedLeaf = generateLeafHash(cert);
    const dataIntact = recomputedLeaf === cert.leafHash;

    const localVerify =
      dataIntact && verifyMerkleProof(cert.merkleRoot, recomputedLeaf, cert.merkleProof);
    const chainVerify = await verifyCertificateOnChain(certId, recomputedLeaf, cert.merkleProof);
    const isValid = localVerify && chainVerify.isValid;

    res.json({
      success: true,
      verified: isValid,
      data: {
        certId: cert.certId,
        holderName: cert.holderName,
        nim: cert.nim,
        nomorSurat: cert.nomorSurat,
        lokasi: cert.lokasi,
        waktuMulai: cert.waktuMulai,
        waktuSelesai: cert.waktuSelesai,
        skorListening: cert.skorListening,
        skorStructure: cert.skorStructure,
        skorReading: cert.skorReading,
        totalSkor: cert.totalSkor,
        institution: cert.institution,
        status: cert.status,
        isRevoked: chainVerify.isRevoked,
        merkleRoot: cert.merkleRoot,
        txHash: cert.txHash,
        blockNumber: cert.blockNumber,
        issuedAt: chainVerify.issuedAt,
        dataIntact,
        localVerification: localVerify,
        blockchainVerification: chainVerify.isValid,
        etherscan: cert.txHash ? `https://sepolia.etherscan.io/tx/${cert.txHash}` : null,
      },
    });
  } catch (error) {
    console.error("verifyCertificate error:", error);
    // Endpoint publik: jangan bocorkan detail error internal
    res.status(500).json({ success: false, verified: false, message: "Gagal memverifikasi sertifikat" });
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
    if (cert.status === "revoked") {
      return res.status(400).json({ success: false, message: "Sertifikat sudah dicabut" });
    }

    const txResult = await revokeCertificateOnChain(certId);
    cert.status = "revoked";
    cert.revokedAt = new Date();
    cert.revokedReason = reason || "Tidak ada alasan";
    await cert.save();

    res.json({
      success: true,
      message: "Sertifikat berhasil dicabut",
      data: { certId, txHash: txResult.txHash, revokedAt: cert.revokedAt },
    });
  } catch (error) {
    console.error("revokeCertificate error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET ALL CERTIFICATES
// ============================================================
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const STATUSES = ["pending", "issued", "revoked"];

const getAllCertificates = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const query = {};
    if (STATUSES.includes(status)) query.status = status;
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      query.$or = [{ holderName: rx }, { nim: rx }, { certId: rx }, { nomorSurat: rx }];
    }

    const [total, certs, grouped] = await Promise.all([
      Certificate.countDocuments(query),
      Certificate.find(query)
        .select("-merkleProof -leafHash")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Certificate.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    // Statistik seluruh sertifikat (bukan hanya halaman ini)
    const stats = { total: 0, issued: 0, revoked: 0, pending: 0 };
    grouped.forEach((g) => {
      if (g._id in stats) stats[g._id] = g.count;
      stats.total += g.count;
    });

    res.json({
      success: true,
      data: certs,
      stats,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
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

module.exports = {
  issueCertificate,
  issueBatch,
  verifyCertificate,
  revokeCertificate,
  getAllCertificates,
  getCertificateById,
};
