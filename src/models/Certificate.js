const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    certId: { type: String, required: true, unique: true, index: true },
    holderName: { type: String, required: true, trim: true },
    nim: { type: String, required: true, trim: true },
    nomorSurat: { type: String, default: null },
    lokasi: { type: String, default: null },
    waktuMulai: { type: Date, default: null },
    waktuSelesai: { type: Date, default: null },
    skorListening: { type: Number, default: null },
    skorStructure: { type: Number, default: null },
    skorReading: { type: Number, default: null },
    totalSkor: { type: Number, required: true, min: 0, max: 677 },
    institution: { type: String, required: true, default: "UIN Alauddin Makassar" },
    merkleRoot: { type: String, required: true },
    merkleProof: { type: [String], default: [] },
    leafHash: { type: String, required: true },
    batchId: { type: String, required: true },
    txHash: { type: String, default: null },
    blockNumber: { type: Number, default: null },
    filePath: { type: String, default: null },
    qrCodePath: { type: String, default: null },
    status: { type: String, enum: ["pending", "issued", "revoked"], default: "pending" },
    issuedBy: { type: String, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
  },
  { timestamps: true }
);

certificateSchema.index({ merkleRoot: 1 });
certificateSchema.index({ batchId: 1 });
certificateSchema.index({ status: 1 });

module.exports = mongoose.model("Certificate", certificateSchema);
