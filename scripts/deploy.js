const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying TOEFLCertificate contract ke Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log(`📍 Deployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  const TOEFLCertificate = await ethers.getContractFactory("TOEFLCertificate");
  const contract = await TOEFLCertificate.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✅ Contract deployed!\n`);
  console.log(`📄 Contract Address: ${address}`);
  console.log(`🔗 Etherscan: https://sepolia.etherscan.io/address/${address}\n`);
  console.log("⚠️  Salin CONTRACT_ADDRESS ini ke file .env kamu!");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
