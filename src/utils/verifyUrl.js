// URL yang dibuka saat QR di-scan, mis. https://domain-frontend.com/verify
const buildVerifyUrl = (certId) => {
  const base = process.env.QR_BASE_URL;
  if (!base) {
    throw new Error(
      "QR_BASE_URL belum diset di .env (contoh: https://domain-frontend.com/verify)",
    );
  }
  return `${base.replace(/\/+$/, "")}/${certId}`;
};

module.exports = { buildVerifyUrl };
