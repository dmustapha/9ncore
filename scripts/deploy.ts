import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  // Step 1: Deploy MockUSDC
  console.log("\n[1/2] Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log("MockUSDC deployed to:", usdcAddress);
  console.log("Explorer: https://sepolia.etherscan.io/address/" + usdcAddress);

  // Step 2: Deploy PrivLendPool with USDC address
  console.log("\n[2/2] Deploying PrivLendPool...");
  const PrivLendPool = await ethers.getContractFactory("PrivLendPool");
  const pool = await PrivLendPool.deploy(usdcAddress);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("PrivLendPool deployed to:", poolAddress);
  console.log("Explorer: https://sepolia.etherscan.io/address/" + poolAddress);

  // Save addresses to root .env
  const envPath = ".env";
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  envContent = envContent.includes("PRIVLEND_POOL_ADDRESS=")
    ? envContent.replace(/PRIVLEND_POOL_ADDRESS=.*/, `PRIVLEND_POOL_ADDRESS=${poolAddress}`)
    : envContent + `\nPRIVLEND_POOL_ADDRESS=${poolAddress}`;

  envContent = envContent.includes("MOCKUSDC_ADDRESS=")
    ? envContent.replace(/MOCKUSDC_ADDRESS=.*/, `MOCKUSDC_ADDRESS=${usdcAddress}`)
    : envContent + `\nMOCKUSDC_ADDRESS=${usdcAddress}`;

  fs.writeFileSync(envPath, envContent);

  // Save addresses to frontend .env.local
  const feEnvPath = "frontend/.env.local";
  let feEnvContent = fs.existsSync(feEnvPath) ? fs.readFileSync(feEnvPath, "utf-8") : "";

  feEnvContent = feEnvContent.includes("NEXT_PUBLIC_CONTRACT_ADDRESS=")
    ? feEnvContent.replace(/NEXT_PUBLIC_CONTRACT_ADDRESS=.*/, `NEXT_PUBLIC_CONTRACT_ADDRESS=${poolAddress}`)
    : `NEXT_PUBLIC_CONTRACT_ADDRESS=${poolAddress}\n` + feEnvContent;

  feEnvContent = feEnvContent.includes("NEXT_PUBLIC_USDC_ADDRESS=")
    ? feEnvContent.replace(/NEXT_PUBLIC_USDC_ADDRESS=.*/, `NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}`)
    : `NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}\n` + feEnvContent;

  fs.writeFileSync(feEnvPath, feEnvContent);

  console.log("\nAddresses saved to .env and frontend/.env.local");
  console.log("\nNext steps:");
  console.log("  1. Seed the pool: npx hardhat run scripts/seed-demo.ts --network sepolia");
  console.log("  2. Update Vercel env: NEXT_PUBLIC_CONTRACT_ADDRESS=" + poolAddress);
  console.log("  3. Update Vercel env: NEXT_PUBLIC_USDC_ADDRESS=" + usdcAddress);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
