// Jangan download Chrome saat build di Vercel / Docker (Chrome disediakan lewat cara lain).
module.exports = {
  skipDownload: !!(process.env.VERCEL || process.env.PUPPETEER_SKIP_DOWNLOAD),
};
