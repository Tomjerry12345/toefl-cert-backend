# 🎓 TOEFL Certificate Verification Backend
**Implementasi Algoritma Merkle Tree pada Sistem Verifikasi Sertifikat TOEFL Berbasis Blockchain Ethereum dan QR Code**

---

## 📁 Struktur Project

```
toefl-cert-backend/
├── contracts/
│   └── TOEFLCertificate.sol     ← Smart contract Solidity
├── scripts/
│   └── deploy.js                ← Script deploy ke Sepolia
├── src/
│   ├── config/
│   │   ├── database.js          ← Koneksi MongoDB
│   │   └── blockchain.js        ← Koneksi Ethereum via ethers.js
│   ├── controllers/
│   │   └── certificateController.js
│   ├── middleware/
│   │   ├── upload.js            ← Multer file upload
│   │   └── validate.js          ← Express validator
│   ├── models/
│   │   └── Certificate.js       ← MongoDB schema
│   ├── routes/
│   │   ├── certificateRoutes.js
│   │   └── verifyRoutes.js      ← Endpoint publik QR scan
│   ├── services/
│   │   ├── merkleService.js     ← Algoritma Merkle Tree
│   │   ├── blockchainService.js ← Interaksi smart contract
│   │   └── qrService.js         ← Generate QR Code
│   └── index.js                 ← Entry point Express
├── hardhat.config.js
├── package.json
└── .env.example
```

---

## ⚙️ Setup & Instalasi

### 1. Install dependencies
```bash
npm install
```

### 2. Konfigurasi .env
```bash
cp .env.example .env
```
Isi file `.env`:
- `MONGODB_URI` - URI MongoDB kamu
- `SEPOLIA_RPC_URL` - Dari [Infura](https://infura.io) atau [Alchemy](https://alchemy.com)
- `PRIVATE_KEY` - Private key wallet Ethereum (jangan share!)
- `CONTRACT_ADDRESS` - Diisi setelah deploy

### 3. Compile & Deploy Smart Contract
```bash
# Compile
npm run compile

# Deploy ke Sepolia (pastikan wallet ada ETH Sepolia)
npm run deploy
```
Salin `CONTRACT_ADDRESS` dari output ke file `.env`.

### 4. Copy ABI hasil compile
Setelah `npm run compile`, copy file ABI:
```bash
cp artifacts/contracts/TOEFLCertificate.sol/TOEFLCertificate.json contracts/abi/
```

### 5. Jalankan server
```bash
# Development
npm run dev

# Production
npm start
```

---

## 📡 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/certificates/issue` | Terbitkan 1 sertifikat |
| `POST` | `/api/certificates/issue-batch` | Terbitkan batch sertifikat |
| `GET` | `/api/certificates` | List semua sertifikat |
| `GET` | `/api/certificates/:certId` | Detail sertifikat |
| `DELETE` | `/api/certificates/:certId/revoke` | Cabut sertifikat |
| `GET` | `/api/verify/:certId` | **Verifikasi** (endpoint publik QR) |
| `GET` | `/api/health` | Health check |

---

## 🌿 Contoh Request

### Issue Single Certificate
```json
POST /api/certificates/issue
Content-Type: multipart/form-data

{
  "holderName": "Budi Santoso",
  "holderEmail": "budi@email.com",
  "score": 550,
  "testDate": "2024-01-15",
  "expiryDate": "2026-01-15",
  "institution": "ETS - Educational Testing Service",
  "file": <PDF/JPG file>
}
```

### Issue Batch
```json
POST /api/certificates/issue-batch
Content-Type: application/json

{
  "certificates": [
    {
      "holderName": "Budi Santoso",
      "holderEmail": "budi@email.com",
      "score": 550,
      "testDate": "2024-01-15",
      "expiryDate": "2026-01-15"
    },
    {
      "holderName": "Siti Rahayu",
      "holderEmail": "siti@email.com",
      "score": 620,
      "testDate": "2024-01-15",
      "expiryDate": "2026-01-15"
    }
  ]
}
```

---

## 🔐 Cara Kerja Merkle Tree

1. **Setiap sertifikat** di-hash dengan keccak256 → menjadi **leaf node**
2. **Leaf nodes** disusun membentuk **Merkle Tree**
3. **Merkle Root** disimpan di blockchain (satu transaksi untuk satu batch)
4. **Merkle Proof** (array hash) disimpan di MongoDB per sertifikat
5. Saat **verifikasi**: proof + leaf hash digunakan untuk membuktikan sertifikat ada di tree, tanpa perlu membaca seluruh data

---

## 🛠 Tech Stack

- **Runtime**: Node.js + Express.js
- **Database**: MongoDB + Mongoose
- **Blockchain**: Ethereum Sepolia Testnet
- **Smart Contract**: Solidity + Hardhat
- **Ethereum Library**: ethers.js v6
- **Merkle Tree**: merkletreejs + keccak256
- **QR Code**: qrcode
- **File Upload**: multer
