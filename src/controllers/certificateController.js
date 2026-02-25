const { v4: uuidv4 } = require("uuid");
const Certificate = require("../models/Certificate");
const {
  processBatch,
  verifyMerkleProof,
} = require("../services/merkleService");
const { generateQRCode, embedQRToPDF } = require("../services/qrService");
const {
  issueCertificateOnChain,
  issueBatchOnChain,
  verifyCertificateOnChain,
  revokeCertificateOnChain,
  getCertStatusOnChain,
} = require("../services/blockchainService");

// ============================================================
// ISSUE SINGLE CERTIFICATE
// ============================================================
const issueCertificate = async (req, res) => {
  try {
    const {
      holderName,
      holderEmail,
      score,
      testDate,
      expiryDate,
      institution,
    } = req.body;

    const certId = `TOEFL-${uuidv4().toUpperCase().slice(0, 8)}`;
    const batchId = `BATCH-${Date.now()}`;

    const certData = { certId, holderName, holderEmail, score, testDate };
    const { merkleRoot, certsWithProof } = processBatch([certData]);
    const { leafHash, merkleProof } = certsWithProof[0];

    const txResult = await issueCertificateOnChain(certId, merkleRoot);

    let qrCodePath, pdfWithQRPath, base64QR, verifyUrl;

    if (req.file) {
      const result = await embedQRToPDF(req.file.path, certId);
      qrCodePath = result.outputPath;
      pdfWithQRPath = result.outputPath;
      base64QR = result.base64QR;
      verifyUrl = result.verifyUrl;
    } else {
      const qr = await generateQRCode(certId);
      qrCodePath = qr.filePath;
      base64QR = qr.base64;
      verifyUrl = qr.verifyUrl;
    }

    const certificate = new Certificate({
      certId,
      holderName,
      holderEmail,
      score,
      testDate: new Date(testDate),
      expiryDate: new Date(expiryDate),
      institution: institution || "ETS - Educational Testing Service",
      merkleRoot,
      merkleProof,
      leafHash,
      batchId,
      txHash: txResult.txHash,
      blockNumber: txResult.blockNumber,
      qrCodePath,
      filePath: pdfWithQRPath || null,
      status: "issued",
      issuedBy: req.issuerAddress || "system",
    });

    await certificate.save();

    res.status(201).json({
      success: true,
      message: "Sertifikat berhasil diterbitkan",
      data: {
        certId,
        holderName,
        holderEmail,
        score,
        merkleRoot,
        txHash: txResult.txHash,
        blockNumber: txResult.blockNumber,
        qrCode: base64QR,
        verifyUrl,
        pdfDownloadUrl: pdfWithQRPath || null,
        etherscan: `https://sepolia.etherscan.io/tx/${txResult.txHash}`,
      },
    });
  } catch (error) {
    console.error("issueCertificate error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// ISSUE BATCH CERTIFICATE
// ============================================================
const issueBatch = async (req, res) => {
  try {
    const { certificates } = req.body;

    if (!Array.isArray(certificates) || certificates.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Data sertifikat tidak valid" });
    }

    const batchId = `BATCH-${Date.now()}`;

    const certsData = certificates.map((cert) => ({
      ...cert,
      certId: `TOEFL-${uuidv4().toUpperCase().slice(0, 8)}`,
    }));

    const { merkleRoot, certsWithProof } = processBatch(certsData);

    const certIds = certsWithProof.map((c) => c.certId);
    const txResult = await issueBatchOnChain(certIds, merkleRoot);

    const savedCerts = [];
    for (const cert of certsWithProof) {
      const qr = await generateQRCode(cert.certId);

      const certificate = new Certificate({
        certId: cert.certId,
        holderName: cert.holderName,
        holderEmail: cert.holderEmail,
        score: cert.score,
        testDate: new Date(cert.testDate),
        expiryDate: new Date(cert.expiryDate),
        institution: cert.institution || "ETS - Educational Testing Service",
        merkleRoot,
        merkleProof: cert.merkleProof,
        leafHash: cert.leafHash,
        batchId,
        txHash: txResult.txHash,
        blockNumber: txResult.blockNumber,
        qrCodePath: qr.filePath,
        status: "issued",
        issuedBy: req.issuerAddress || "system",
      });

      await certificate.save();
      savedCerts.push({
        certId: cert.certId,
        holderName: cert.holderName,
        holderEmail: cert.holderEmail,
        qrCode: qr.base64,
        verifyUrl: qr.verifyUrl,
      });
    }

    res.status(201).json({
      success: true,
      message: `${savedCerts.length} sertifikat berhasil diterbitkan`,
      data: {
        batchId,
        merkleRoot,
        txHash: txResult.txHash,
        blockNumber: txResult.blockNumber,
        etherscan: `https://sepolia.etherscan.io/tx/${txResult.txHash}`,
        certificates: savedCerts,
      },
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
    if (!cert) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: "Sertifikat tidak ditemukan",
      });
    }

    const localVerify = verifyMerkleProof(
      cert.merkleRoot,
      cert.leafHash,
      cert.merkleProof,
    );

    const chainVerify = await verifyCertificateOnChain(
      certId,
      cert.leafHash,
      cert.merkleProof,
    );

    const isValid = localVerify && chainVerify.isValid;

    res.json({
      success: true,
      verified: isValid,
      data: {
        certId: cert.certId,
        holderName: cert.holderName,
        score: cert.score,
        testDate: cert.testDate,
        expiryDate: cert.expiryDate,
        institution: cert.institution,
        status: cert.status,
        isRevoked: chainVerify.isRevoked,
        merkleRoot: cert.merkleRoot,
        txHash: cert.txHash,
        blockNumber: cert.blockNumber,
        issuedAt: chainVerify.issuedAt,
        localVerification: localVerify,
        blockchainVerification: chainVerify.isValid,
        etherscan: cert.txHash
          ? `https://sepolia.etherscan.io/tx/${cert.txHash}`
          : null,
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
    if (!cert) {
      return res
        .status(404)
        .json({ success: false, message: "Sertifikat tidak ditemukan" });
    }
    if (cert.status === "revoked") {
      return res
        .status(400)
        .json({ success: false, message: "Sertifikat sudah dicabut" });
    }

    const txResult = await revokeCertificateOnChain(certId);

    cert.status = "revoked";
    cert.revokedAt = new Date();
    cert.revokedReason = reason || "Tidak ada alasan";
    await cert.save();

    res.json({
      success: true,
      message: "Sertifikat berhasil dicabut",
      data: {
        certId,
        txHash: txResult.txHash,
        revokedAt: cert.revokedAt,
      },
    });
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
        { holderEmail: { $regex: search, $options: "i" } },
        { certId: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Certificate.countDocuments(query);
    const certs = await Certificate.find(query)
      .select("-merkleProof -leafHash") // sembunyikan data teknis
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: certs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
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
    if (!cert) {
      return res
        .status(404)
        .json({ success: false, message: "Sertifikat tidak ditemukan" });
    }
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
