const QRCode = require("qrcode");
const cloudinary = require("../config/cloudinary");

const generateQRBase64 = async (certId) => {
  const verifyUrl = `${process.env.QR_BASE_URL}/${certId}`;
  const base64 = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "H", width: 200, margin: 2,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });
  return { base64, verifyUrl };
};

const fmtDate = (val) => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

const injectDataToTemplate = (htmlTemplate, data, qrBase64) => {
  let html = htmlTemplate;
  const fieldMap = {
    "{{nomorSurat}}": data.nomorSurat || "",
    "{{holderName}}": data.holderName || "",
    "{{nama}}": data.holderName || "",
    "{{nim}}": data.nim || "",
    "{{lokasi}}": data.lokasi || "",
    "{{waktuMulai}}": fmtDate(data.waktuMulai),
    "{{waktuSelesai}}": fmtDate(data.waktuSelesai),
    "{{skorListening}}": data.skorListening != null ? String(data.skorListening) : "",
    "{{skorStructure}}": data.skorStructure != null ? String(data.skorStructure) : "",
    "{{skorReading}}": data.skorReading != null ? String(data.skorReading) : "",
    "{{totalSkor}}": data.totalSkor != null ? String(data.totalSkor) : (data.score != null ? String(data.score) : ""),
    "{{score}}": data.totalSkor != null ? String(data.totalSkor) : (data.score != null ? String(data.score) : ""),
    "{{institution}}": data.institution || "UIN Alauddin Makassar",
    "{{institusi}}": data.institution || "UIN Alauddin Makassar",
    "{{certId}}": data.certId || "",
    "{{qrCode}}": qrBase64 || "",
  };
  Object.entries(fieldMap).forEach(([ph, val]) => { html = html.replaceAll(ph, val); });
  return html;
};

const uploadPDFToCloudinary = (buffer, certId) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "toefl-certificates-generated", public_id: `cert_${certId}`, resource_type: "raw", format: "pdf", type: "upload", access_mode: "public" },
      (error, result) => { if (error) return reject(error); resolve(result); }
    );
    stream.end(buffer);
  });
};

const uploadImageToCloudinary = (buffer, name) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "toefl-templates", public_id: `template_bg_${Date.now()}_${name}`, resource_type: "image" },
      (error, result) => { if (error) return reject(error); resolve(result); }
    );
    stream.end(buffer);
  });
};

const generatePDFFromTemplate = async (htmlTemplate, certData) => {
  let browser;
  try {
    const puppeteer = require("puppeteer");
    const { base64: qrBase64, verifyUrl } = await generateQRBase64(certData.certId);
    const finalHtml = injectDataToTemplate(htmlTemplate, certData, qrBase64);
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: "networkidle0", timeout: 30000 });
    const pdfBuffer = await page.pdf({ format: "A4", landscape: false, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    await browser.close();
    const result = await uploadPDFToCloudinary(Buffer.from(pdfBuffer), certData.certId);
    console.log(`✅ PDF generated & uploaded: ${certData.certId}`);
    return { filePath: result.secure_url, base64QR: qrBase64, verifyUrl };
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    console.error("❌ generatePDFFromTemplate error:", error.message);
    throw error;
  }
};

module.exports = { generatePDFFromTemplate, uploadImageToCloudinary, injectDataToTemplate, generateQRBase64 };
