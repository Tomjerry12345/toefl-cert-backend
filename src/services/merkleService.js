const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { ethers } = require("ethers");

/**
 * Generate leaf hash dari data sertifikat
 * Hash dibuat dari kombinasi data penting sertifikat
 */
const generateLeafHash = (certData) => {
  const { certId, holderName, holderEmail, score, testDate } = certData;

  // Encode data ke bytes lalu hash dengan keccak256
  const encoded = ethers.solidityPackedKeccak256(
    ["string", "string", "string", "uint256", "uint256"],
    [
      certId,
      holderName,
      holderEmail,
      score,
      Math.floor(new Date(testDate).getTime() / 1000),
    ]
  );

  return encoded;
};

/**
 * Buat Merkle Tree dari array data sertifikat
 * @param {Array} certsData - Array objek data sertifikat
 * @returns {Object} { tree, root, leaves }
 */
const buildMerkleTree = (certsData) => {
  if (!certsData || certsData.length === 0) {
    throw new Error("Data sertifikat tidak boleh kosong");
  }

  // Generate leaf untuk setiap sertifikat
  const leaves = certsData.map((cert) => {
    const leaf = generateLeafHash(cert);
    return Buffer.from(leaf.slice(2), "hex"); // remove 0x prefix
  });

  // Buat tree dengan opsi sortPairs untuk konsistensi
  const tree = new MerkleTree(leaves, keccak256, {
    sortPairs: true,
    hashLeaves: false, // leaves sudah di-hash
  });

  const root = tree.getHexRoot();

  return { tree, root, leaves };
};

/**
 * Ambil Merkle proof untuk satu sertifikat dalam batch
 * @param {Object} tree - Merkle Tree object
 * @param {String} leafHash - Hash leaf sertifikat
 * @returns {Array} Array proof dalam hex string
 */
const getMerkleProof = (tree, leafHash) => {
  const leaf = Buffer.from(leafHash.slice(2), "hex");
  const proof = tree.getHexProof(leaf);
  return proof;
};

/**
 * Verifikasi Merkle proof secara lokal (tanpa blockchain)
 * @param {String} merkleRoot - Root dari tree
 * @param {String} leafHash - Hash leaf yang diverifikasi
 * @param {Array} proof - Array proof
 * @returns {Boolean} true jika valid
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
 * Process batch sertifikat - generate tree dan proof untuk semua
 * @param {Array} certsData - Array data sertifikat
 * @returns {Object} { merkleRoot, certsWithProof }
 */
const processBatch = (certsData) => {
  const { tree, root } = buildMerkleTree(certsData);

  const certsWithProof = certsData.map((cert) => {
    const leafHash = generateLeafHash(cert);
    const proof = getMerkleProof(tree, leafHash);

    return {
      ...cert,
      leafHash,
      merkleProof: proof,
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
