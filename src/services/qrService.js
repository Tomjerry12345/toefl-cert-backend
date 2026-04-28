const QRCode = require("qrcode");
const { PDFDocument } = require("pdf-lib");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

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
    try {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          public_id: publicId,
          resource_type: "raw", // WAJIB untuk PDF
          format: "pdf",
          type: "upload",
          access_mode: "public", // PASTIKAN format PDF
        },
        (error, result) => {
          if (error) {
            console.error("❌ Cloudinary upload error:", error);
            return reject(error);
          }

          console.log("✅ Upload sukses ke Cloudinary");
          resolve(result);
        }
      );

      // 🔥 pastikan buffer valid
      if (!buffer || buffer.length === 0) {
        return reject(new Error("Buffer kosong!"));
      }

      stream.end(buffer);
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Embed QR Code ke PDF (PAKAI FILE LOKAL)
 */
const embedQRToPDF = async (pdfPath, certId) => {
  try {
    console.log("📄 PDF PATH (LOCAL):", pdfPath);

    const { buffer: qrBuffer, verifyUrl } = await generateQRBuffer(certId);

    // ✅ BACA FILE LOKAL
    const pdfBytes = fs.readFileSync(pdfPath);

    // Load PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Embed QR
    const qrImage = await pdfDoc.embedPng(qrBuffer);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    firstPage.drawImage(qrImage, {
      x: 20,
      y: 20,
      width: 80,
      height: 80,
    });

    // Save PDF hasil
    const modifiedPdfBytes = await pdfDoc.save();

    //cek ukuran pdf
     console.log("pdf size : ", modifiedPdfBytes.length);
    // Upload hasil ke Cloudinary
    const result = await uploadBufferToCloudinary(
      Buffer.from(modifiedPdfBytes),
      "toefl-certificates-with-qr",
      `cert_${certId}.pdf`
    );

    console.log("✅ PDF with QR uploaded:", result.secure_url);

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
  } catch (error) {
    console.error("❌ embedQRToPDF error:", error.message);
    throw error;
  }
};

/**
 * Generate QR Code tanpa PDF
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
    `qr_${certId}.pdf`
  );

  const base64 = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "H",
    width: 300,
    margin: 2,
  });

  const fileUrl = result.secure_url.replace("/upload/", "/upload/fl_attachment/");
  return {
    filePath: result.secure_url,
    base64,
    verifyUrl,
  };
};

module.exports = { embedQRToPDF, generateQRCode };