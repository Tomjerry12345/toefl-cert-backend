const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { ethers } = require("ethers");

// Semua field penting sertifikat ikut di-hash. Mengubah salah satunya di
// database akan membuat hash berbeda dan verifikasi gagal.
const canonText = (v) => (v === null || v === undefined ? "" : String(v).trim());

const canonNumber = (v) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
};

const canonDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString();
};

/**
 * Bentuk baku (canonical) data sertifikat. Urutan key tetap supaya hasil
 * JSON.stringify selalu sama, baik saat penerbitan maupun verifikasi.
 */
const canonicalizeCert = (cert) => ({
  certId: canonText(cert.certId),
  holderName: canonText(cert.holderName),
  nim: canonText(cert.nim),
  nomorSurat: canonText(cert.nomorSurat),
  lokasi: canonText(cert.lokasi),
  waktuMulai: canonDate(cert.waktuMulai),
  waktuSelesai: canonDate(cert.waktuSelesai),
  skorListening: canonNumber(cert.skorListening),
  skorStructure: canonNumber(cert.skorStructure),
  skorReading: canonNumber(cert.skorReading),
  totalSkor: canonNumber(cert.totalSkor),
  institution: canonText(cert.institution),
});

/**
 * Leaf hash dari data sertifikat (objek form ATAU dokumen MongoDB)
 */
const generateLeafHash = (cert) => {
  const json = JSON.stringify(canonicalizeCert(cert));
  return ethers.keccak256(ethers.toUtf8Bytes(json));
};

const buildMerkleTree = (certsData) => {
  if (!certsData || certsData.length === 0) {
    throw new Error("Data sertifikat tidak boleh kosong");
  }

  const leaves = certsData.map((cert) => {
    const leaf = generateLeafHash(cert);
    return Buffer.from(leaf.slice(2), "hex");
  });

  const tree = new MerkleTree(leaves, keccak256, {
    sortPairs: true,
    hashLeaves: false, // leaves sudah di-hash
  });

  return { tree, root: tree.getHexRoot(), leaves };
};

const getMerkleProof = (tree, leafHash) => {
  const leaf = Buffer.from(leafHash.slice(2), "hex");
  return tree.getHexProof(leaf);
};

/**
 * Verifikasi Merkle proof secara lokal (tanpa blockchain)
 */
const verifyMerkleProof = (merkleRoot, leafHash, proof) => {
  const leaf = Buffer.from(leafHash.slice(2), "hex");
  const root = Buffer.from(merkleRoot.slice(2), "hex");
  const proofBuffers = proof.map((p) => Buffer.from(p.slice(2), "hex"));

  return MerkleTree.verify(proofBuffers, leaf, root, keccak256, {
    sortPairs: true,
  });
};

/**
 * Proses batch sertifikat - buat tree dan proof untuk semuanya
 */
const processBatch = (certsData) => {
  const { tree, root } = buildMerkleTree(certsData);

  const certsWithProof = certsData.map((cert) => {
    const leafHash = generateLeafHash(cert);
    return {
      ...cert,
      leafHash,
      merkleProof: getMerkleProof(tree, leafHash),
      merkleRoot: root,
    };
  });

  return {
    merkleRoot: root,
    certsWithProof,
    totalLeaves: certsData.length,
    treeDepth: tree.getDepth(),
  };
};

module.exports = {
  generateLeafHash,
  buildMerkleTree,
  getMerkleProof,
  verifyMerkleProof,
  processBatch,
};
