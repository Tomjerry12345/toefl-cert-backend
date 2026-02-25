const { ethers } = require("ethers");
const artifactABI = require("../../contracts/abi/TOEFLCertificate.json");
const contractABI = artifactABI.abi;

let provider;
let signer;
let contract;

const initBlockchain = () => {
  try {
    provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      contractABI,
      signer,
    );
    console.log("✅ Blockchain connection initialized");
    console.log(`📄 Contract: ${process.env.CONTRACT_ADDRESS}`);
    return { provider, signer, contract };
  } catch (error) {
    console.error("❌ Blockchain init error:", error.message);
    throw error;
  }
};

const getContract = () => {
  if (!contract) throw new Error("Blockchain belum diinisialisasi");
  return contract;
};

const getProvider = () => {
  if (!provider) throw new Error("Provider belum diinisialisasi");
  return provider;
};

module.exports = { initBlockchain, getContract, getProvider };
