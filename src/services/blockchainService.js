const { getContract, getProvider } = require("../config/blockchain");
const { ethers } = require("ethers");

/**
 * Terbitkan sertifikat ke blockchain
 */
const issueCertificateOnChain = async (certId, merkleRoot, metadataURI = "") => {
  try {
    const contract = getContract();
    const merkleRootBytes = merkleRoot.startsWith("0x")
      ? merkleRoot
      : `0x${merkleRoot}`;

    const tx = await contract.issueCertificate(certId, merkleRootBytes, metadataURI);
    console.log(`📤 TX submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`✅ TX confirmed: block ${receipt.blockNumber}`);

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  } catch (error) {
    console.error("❌ issueCertificateOnChain error:", error);
    throw new Error(`Gagal menerbitkan ke blockchain: ${error.message}`);
  }
};

/**
 * Terbitkan batch sertifikat ke blockchain
 */
const issueBatchOnChain = async (certIds, merkleRoot, metadataURI = "") => {
  try {
    const contract = getContract();
    const merkleRootBytes = merkleRoot.startsWith("0x")
      ? merkleRoot
      : `0x${merkleRoot}`;

    const tx = await contract.issueBatch(certIds, merkleRootBytes, metadataURI);
    console.log(`📤 Batch TX submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`✅ Batch TX confirmed: block ${receipt.blockNumber}`);

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  } catch (error) {
    console.error("❌ issueBatchOnChain error:", error);
    throw new Error(`Gagal menerbitkan batch ke blockchain: ${error.message}`);
  }
};

/**
 * Verifikasi sertifikat di blockchain menggunakan Merkle proof
 */
const verifyCertificateOnChain = async (certId, leafHash, proof) => {
  try {
    const contract = getContract();

    const leafBytes = leafHash.startsWith("0x") ? leafHash : `0x${leafHash}`;
    const proofBytes = proof.map((p) => (p.startsWith("0x") ? p : `0x${p}`));

    const [isValid, isRevoked, issuedAt] = await contract.verifyCertificate(
      certId,
      leafBytes,
      proofBytes
    );

    return {
      isValid,
      isRevoked,
      issuedAt: issuedAt > 0 ? new Date(Number(issuedAt) * 1000).toISOString() : null,
    };
  } catch (error) {
    console.error("❌ verifyCertificateOnChain error:", error);
    throw new Error(`Gagal verifikasi di blockchain: ${error.message}`);
  }
};

/**
 * Cabut sertifikat di blockchain
 */
const revokeCertificateOnChain = async (certId) => {
  try {
    const contract = getContract();
    const tx = await contract.revokeCertificate(certId);
    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    throw new Error(`Gagal mencabut sertifikat: ${error.message}`);
  }
};

/**
 * Ambil status sertifikat dari blockchain
 */
const getCertStatusOnChain = async (certId) => {
  try {
    const contract = getContract();
    const [exists, isRevoked, merkleRoot, issuedAt, issuedBy] =
      await contract.getCertificateStatus(certId);

    return {
      exists,
      isRevoked,
      merkleRoot: exists ? merkleRoot : null,
      issuedAt: exists && issuedAt > 0
        ? new Date(Number(issuedAt) * 1000).toISOString()
        : null,
      issuedBy: exists ? issuedBy : null,
    };
  } catch (error) {
    throw new Error(`Gagal mengambil status dari blockchain: ${error.message}`);
  }
};

module.exports = {
  issueCertificateOnChain,
  issueBatchOnChain,
  verifyCertificateOnChain,
  revokeCertificateOnChain,
  getCertStatusOnChain,
};
