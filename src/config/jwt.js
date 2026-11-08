// Secret JWT wajib diset lewat .env (tidak ada nilai cadangan yang bisa ditebak)
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET belum diset di .env (minimal 16 karakter, gunakan string acak panjang)",
    );
  }
  return secret;
};

module.exports = { getJwtSecret };
