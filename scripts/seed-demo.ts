// File: scripts/seed-demo.ts
// Winning Pattern #19 — Seed demo script: pre-populates borrower positions so judges
// see realistic data on first visit. Run AFTER Phase 3 deploy with PRIVLEND_POOL_ADDRESS set.
// DEV-005: aclAddress corrected from stale 0x339EcE... to live 0xf0Ffdc... (getCode() verified)

import { ethers } from "hardhat";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const borrower = signers[1] ?? signers[0]; // fallback to deployer if only one key configured
  const CONTRACT_ADDRESS = process.env.PRIVLEND_POOL_ADDRESS;
  if (!CONTRACT_ADDRESS) throw new Error("Set PRIVLEND_POOL_ADDRESS in .env before seeding");

  console.log("=== PrivLend Demo Seed ===");
  console.log("Contract :", CONTRACT_ADDRESS);
  console.log("Deployer :", deployer.address);
  console.log("Borrower :", borrower.address);

  const PrivLendPool = await ethers.getContractFactory("PrivLendPool");
  const pool = PrivLendPool.attach(CONTRACT_ADDRESS) as any;

  // Step 1: Lender deposits 0.04 ETH liquidity (reduced to fit testnet budget)
  console.log("\n[1/3] Lender deposits 0.04 ETH ...");
  const lendTx = await pool.connect(deployer).lend({ value: ethers.parseEther("0.04") });
  await lendTx.wait();
  console.log("      tx:", lendTx.hash);

  // Step 2: Borrower deposits 0.02 ETH collateral (encrypted via FHEVM)
  console.log("\n[2/3] Borrower deposits 0.02 ETH collateral (encrypted) ...");
  // DEV-005: use SepoliaConfig from sdk (correct addresses; relayerUrl included)
  const fhevmInstance = await createInstance({
    ...SepoliaConfig,
    network: process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
  });

  const depositAmount = ethers.parseEther("0.02");
  const input = await fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, borrower.address);
  input.add128(depositAmount);
  const { handles, inputProof } = await input.encrypt();
  const depositTx = await pool.connect(borrower).deposit(handles[0], inputProof, {
    value: depositAmount,
  });
  await depositTx.wait();
  console.log("      tx:", depositTx.hash);

  // Step 3: Borrower borrows 0.01 ETH
  console.log("\n[3/3] Borrower borrows 0.01 ETH ...");
  const borrowAmount = ethers.parseEther("0.01");
  const borrowInput = await fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, borrower.address);
  borrowInput.add128(borrowAmount);
  const { handles: bHandles, inputProof: bProof } = await borrowInput.encrypt();
  const borrowTx = await pool.connect(borrower).borrow(bHandles[0], bProof, borrowAmount);
  await borrowTx.wait();
  console.log("      tx:", borrowTx.hash);

  console.log("\n✅ Demo seed complete. Borrower has 0.02 ETH collateral, 0.01 ETH debt.");
  console.log("   Health ratio ≈ 200% — position healthy, visible to borrower via decrypt.");
  console.log("   Ready to record demo video.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
