# Deploy

Backend ini bisa jalan di dua tempat dari kode yang sama: Docker (lokal/VPS) dan Vercel (serverless). Bedanya cuma di Chromium untuk generate PDF, lihat `launchBrowser()` di `src/services/pdfService.js`.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Cek di http://localhost:5000/api/health. Admin pertama dibuat dengan:

```bash
docker compose run --rm api node scripts/seed.js
```

Image-nya pakai Chromium dari Debian (`PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`) dan `puppeteer-core`, jadi tidak ada download Chrome saat build.

## CI

`.github/workflows/docker-publish.yml` jalan di setiap push dan PR ke `main`. Isinya build image, cek cepat bahwa app ter-load dan Chromium ada, lalu (hanya untuk push) kirim image ke ghcr.io dengan tag `latest` dan `sha-<commit>`. Pakai `GITHUB_TOKEN` bawaan, tidak perlu secret.

Image dari ghcr bisa dijalankan di mana saja:

```bash
docker run -d -p 5000:5000 --env-file .env ghcr.io/<user>/<repo>:latest
```

Package ghcr default-nya private. Kalau mau publik, ubah di Package settings.

## Vercel

Backend dibuat sebagai project terpisah dari frontend.

1. Import repo ini di Vercel, preset "Other", Node.js 22.x.
2. Isi environment variables sesuai `.env.example`, ditambah `TRUST_PROXY=true`.
3. `FRONTEND_URL` diisi domain frontend, `QR_BASE_URL` diisi `https://<domain-frontend>/verify`.
4. Deploy, lalu cek `/api/health`.
5. Arahkan URL API di frontend ke domain backend ini dan redeploy frontend.

Vercel tidak punya shell, jadi akun admin dibuat dari laptop: isi `.env` lokal dengan `MONGODB_URI` yang sama, lalu `npm run seed`.

Di MongoDB Atlas, Network Access perlu `0.0.0.0/0` karena IP Vercel tidak tetap.

## Catatan

- `PRIVATE_KEY` pakai wallet Sepolia khusus, jangan wallet utama.
- Generate PDF di Vercel paling berat (cold start, memori). `maxDuration` di `vercel.json` diset 60 detik. Untuk batch besar lebih aman lewat Docker.
- Rate limit disimpan di memori, jadi di serverless hitungannya per instance.
