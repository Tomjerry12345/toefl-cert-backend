const { generateQRBase64 } = require("./pdfService");

/**
 * QR Code untuk sertifikat tanpa template PDF (base64 + link verifikasi)
 */
const generateQRCode = async (certId) => {
  const { base64, verifyUrl } = await generateQRBase64(certId);
  return { base64, verifyUrl, filePath: null };
};

module.exports = { generateQRCode };
