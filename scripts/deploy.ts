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

  const PrivLendPool = await ethers.getContractFactory("PrivLendPool");
  const pool = await PrivLendPool.deploy();
  await pool.waitForDeployment();

  const address = await pool.getAddress();
  console.log("PrivLendPool deployed to:", address);
  console.log(
    "Explorer: https://sepolia.etherscan.io/address/" + address
  );

  // Save address to .env for frontend
  const envPath = ".env";
  const envContent = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf-8")
    : "";
  const updatedEnv = envContent.includes("PRIVLEND_POOL_ADDRESS=")
    ? envContent.replace(
        /PRIVLEND_POOL_ADDRESS=.*/,
        `PRIVLEND_POOL_ADDRESS=${address}`
      )
    : envContent + `\nPRIVLEND_POOL_ADDRESS=${address}`;
  fs.writeFileSync(envPath, updatedEnv);

  // Also save to frontend — patch only the contract address, preserve other vars
  const feEnvPath = "frontend/.env.local";
  const feEnvContent = fs.existsSync(feEnvPath) ? fs.readFileSync(feEnvPath, "utf-8") : "";
  const updatedFeEnv = feEnvContent.includes("NEXT_PUBLIC_CONTRACT_ADDRESS=")
    ? feEnvContent.replace(/NEXT_PUBLIC_CONTRACT_ADDRESS=.*/, `NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`)
    : `NEXT_PUBLIC_CONTRACT_ADDRESS=${address}\n` + feEnvContent;
  fs.writeFileSync(feEnvPath, updatedFeEnv);

  console.log("\nContract address saved to .env and frontend/.env.local");
  console.log("Next: fund the pool at https://sepoliafaucet.com/");
  console.log("Then: npx hardhat run scripts/seed-demo.ts --network sepolia");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
