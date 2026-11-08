const QRCode = require("qrcode");
const cloudinary = require("../config/cloudinary");
const { buildVerifyUrl } = require("../utils/verifyUrl");
const { mapWithConcurrency } = require("../utils/certData");

const generateQRBase64 = async (certId) => {
  const verifyUrl = buildVerifyUrl(certId);
  const base64 = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "H",
    width: 200,
    margin: 2,
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

// Escape HTML supaya data pengguna (mis. nama) tidak bisa menyisipkan tag/script ke PDF
const escapeHtml = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const injectDataToTemplate = (htmlTemplate, data, qrBase64) => {
  let html = htmlTemplate;
  const total =
    data.totalSkor != null ? String(data.totalSkor) : data.score != null ? String(data.score) : "";
  const num = (v) => (v != null ? String(v) : "");

  const fieldMap = {
    "{{nomorSurat}}": data.nomorSurat || "",
    "{{holderName}}": data.holderName || "",
    "{{nama}}": data.holderName || "",
    "{{nim}}": data.nim || "",
    "{{lokasi}}": data.lokasi || "",
    "{{waktuMulai}}": fmtDate(data.waktuMulai),
    "{{waktuSelesai}}": fmtDate(data.waktuSelesai),
    // alias untuk template lama
    "{{testDate}}": fmtDate(data.waktuMulai),
    "{{expiryDate}}": fmtDate(data.waktuSelesai),
    "{{skorListening}}": num(data.skorListening),
    "{{skorStructure}}": num(data.skorStructure),
    "{{skorReading}}": num(data.skorReading),
    "{{totalSkor}}": total,
    "{{score}}": total,
    "{{institution}}": data.institution || "UIN Alauddin Makassar",
    "{{institusi}}": data.institution || "UIN Alauddin Makassar",
    "{{certId}}": data.certId || "",
  };
  Object.entries(fieldMap).forEach(([ph, val]) => {
    html = html.replaceAll(ph, escapeHtml(val));
  });
  // QR dibuat oleh server sendiri (data URL), tidak perlu di-escape
  html = html.replaceAll("{{qrCode}}", qrBase64 || "");
  return html;
};

const uploadPDFToCloudinary = (buffer, certId) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "toefl-certificates-generated",
        public_id: `cert_${certId}.pdf`, // file raw: ekstensi ikut di public_id
        resource_type: "raw",
        type: "upload",
        access_mode: "public",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
};

const uploadImageToCloudinary = (buffer, name) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "toefl-templates", public_id: `template_bg_${Date.now()}_${name}`, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
};

const launchBrowser = () =>
  require("puppeteer").launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

// Render 1 sertifikat jadi PDF memakai browser yang sudah terbuka
const renderPdf = async (browser, htmlTemplate, certData) => {
  const { base64: qrBase64, verifyUrl } = await generateQRBase64(certData.certId);
  const finalHtml = injectDataToTemplate(htmlTemplate, certData, qrBase64);
  const page = await browser.newPage();
  try {
    await page.setJavaScriptEnabled(false); // template statis, tidak perlu JS
    await page.setContent(finalHtml, { waitUntil: "networkidle0", timeout: 30000 });
    const pdf = await page.pdf({
      format: "A4",
      landscape: false,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const result = await uploadPDFToCloudinary(Buffer.from(pdf), certData.certId);
    return { filePath: result.secure_url, base64QR: qrBase64, verifyUrl };
  } finally {
    await page.close().catch(() => {});
  }
};

// 1 sertifikat
const generatePDFFromTemplate = async (htmlTemplate, certData) => {
  let browser;
  try {
    browser = await launchBrowser();
    const out = await renderPdf(browser, htmlTemplate, certData);
    console.log(`✅ PDF generated & uploaded: ${certData.certId}`);
    return out;
  } catch (error) {
    console.error("❌ generatePDFFromTemplate error:", error.message);
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};

// Banyak sertifikat: browser dibuka SEKALI, error per sertifikat tidak menghentikan yang lain
const generatePDFsFromTemplate = async (htmlTemplate, certDataList, concurrency = 3) => {
  let browser;
  try {
    browser = await launchBrowser();
    return await mapWithConcurrency(certDataList, concurrency, async (certData) => {
      try {
        const out = await renderPdf(browser, htmlTemplate, certData);
        console.log(`✅ PDF generated & uploaded: ${certData.certId}`);
        return { certId: certData.certId, ...out, error: null };
      } catch (error) {
        console.error(`❌ PDF gagal (${certData.certId}):`, error.message);
        return { certId: certData.certId, error: error.message };
      }
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};

module.exports = {
  generatePDFFromTemplate,
  generatePDFsFromTemplate,
  uploadImageToCloudinary,
  injectDataToTemplate,
  generateQRBase64,
};
