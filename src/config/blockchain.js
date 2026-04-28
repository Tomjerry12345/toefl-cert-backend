const { ethers } = require("ethers");
const artifactABI = require("../../contracts/abi/TOEFLCertificate.json");
const contractABI = artifactABI.abi;

let provider;
let signer;
let contract;

const initBlockchain = async () => {
  try {
    console.log("RPC URL: ", process.env.SEPOLIA_RPC_URL);
    provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    await provider.getBlockNumber().then(n => console.log("connected to block number:", n));
    signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log("Wallet address:", signer.address);

    provider.getBalance(signer.address).then((balance) => {
      console.log("Balance:", ethers.formatEther(balance), "ETH");
    });
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
