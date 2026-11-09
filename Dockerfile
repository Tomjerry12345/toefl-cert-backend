FROM node:22-slim

# Chromium untuk Puppeteer (generate PDF) + font agar teks sertifikat tampil benar
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

# Pakai Chromium sistem (puppeteer-core), tidak download Chrome lagi
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

COPY package*.json ./
# devDependencies (hardhat, nodemon, puppeteer) tidak perlu di image produksi
RUN npm ci --omit=dev

COPY src ./src
COPY contracts/abi ./contracts/abi
COPY scripts/seed.js ./scripts/seed.js

USER node

ENV PORT=5000
EXPOSE 5000

CMD ["node", "src/index.js"]
