const QRCode = require("qrcode");
const { PDFDocument } = require("pdf-lib");
const cloudinary = require("../config/cloudinary");
const axios = require("axios");

/**
 * Generate QR Code sebagai PNG buffer
 */
const generateQRBuffer = async (certId) => {
  const verifyUrl = `${process.env.QR_BASE_URL}/${certId}`;
  const buffer = await QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: "H",
    type: "png",
    width: 150,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });
  return { buffer, verifyUrl };
};

/**
 * Upload buffer ke Cloudinary
 */
const uploadBufferToCloudinary = (buffer, folder, publicId) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: "auto" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    stream.end(buffer);
  });
};

/**
 * Embed QR Code ke PDF lalu upload ke Cloudinary
 */
const embedQRToPDF = async (pdfUrl, certId) => {
  const { buffer: qrBuffer, verifyUrl } = await generateQRBuffer(certId);

  // Download PDF dari Cloudinary
  const pdfResponse = await axios.get(pdfUrl, { responseType: "arraybuffer" });
  const pdfBytes = Buffer.from(pdfResponse.data);

  // Load PDF dan embed QR
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const qrImage = await pdfDoc.embedPng(qrBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  firstPage.drawImage(qrImage, {
    x: 20,
    y: 20,
    width: 80,
    height: 80,
  });

  const modifiedPdfBytes = await pdfDoc.save();

  // Upload PDF dengan QR ke Cloudinary
  const result = await uploadBufferToCloudinary(
    Buffer.from(modifiedPdfBytes),
    "toefl-certificates-with-qr",
    `cert_${certId}`,
  );

  // Generate base64 QR untuk response
  const base64QR = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "H",
    width: 300,
    margin: 2,
  });

  return {
    outputPath: result.secure_url,
    verifyUrl,
    base64QR,
  };
};

/**
 * Generate QR Code dan upload ke Cloudinary
 */
const generateQRCode = async (certId) => {
  const verifyUrl = `${process.env.QR_BASE_URL}/${certId}`;

  const buffer = await QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: "H",
    width: 300,
    margin: 2,
  });

  const result = await uploadBufferToCloudinary(
    buffer,
    "toefl-qrcodes",
    `qr_${certId}`,
  );

  const base64 = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "H",
    width: 300,
    margin: 2,
  });

  return {
    filePath: result.secure_url,
    base64,
    verifyUrl,
  };
};

module.exports = { embedQRToPDF, generateQRCode };
