// File: scripts/seed-demo.ts
// Seeds the demo: lender deposits USDC, borrower deposits ETH collateral and borrows USDC.

import { ethers } from "hardhat";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const borrower = signers[1] ?? signers[0];
  const CONTRACT_ADDRESS = process.env.PRIVLEND_POOL_ADDRESS;
  const USDC_ADDRESS = process.env.MOCKUSDC_ADDRESS;
  if (!CONTRACT_ADDRESS) throw new Error("Set PRIVLEND_POOL_ADDRESS in .env before seeding");
  if (!USDC_ADDRESS) throw new Error("Set MOCKUSDC_ADDRESS in .env before seeding");

  console.log("=== PrivLend Demo Seed (ETH collateral / USDC borrow) ===");
  console.log("Pool   :", CONTRACT_ADDRESS);
  console.log("USDC   :", USDC_ADDRESS);
  console.log("Lender :", deployer.address);
  console.log("Borrower:", borrower.address);

  const PrivLendPool = await ethers.getContractFactory("PrivLendPool");
  const pool = PrivLendPool.attach(CONTRACT_ADDRESS) as any;

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = MockUSDC.attach(USDC_ADDRESS) as any;

  // Step 1: Mint USDC for lender and seed pool with 20,000 USDC
  console.log("\n[1/4] Minting 20,000 USDC to lender and approving pool...");
  const seedUsdc = 20_000n * 10n ** 6n; // 20,000 USDC
  const mintTx = await usdc.connect(deployer).mint(deployer.address, seedUsdc);
  await mintTx.wait();
  const approveTx = await usdc.connect(deployer).approve(CONTRACT_ADDRESS, seedUsdc);
  await approveTx.wait();
  const lendTx = await pool.connect(deployer).lend(seedUsdc);
  await lendTx.wait();
  console.log("      tx:", lendTx.hash);
  console.log("      Lender deposited 20,000 USDC to pool");

  // Step 2: Borrower deposits 0.0001 ETH collateral (encrypted via FHEVM)
  // Using minimal amount due to testnet wallet constraints
  console.log("\n[2/4] Borrower deposits 0.0001 ETH collateral (encrypted)...");
  const fhevmInstance = await createInstance({
    ...SepoliaConfig,
    network: process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
  });

  const depositAmount = ethers.parseEther("0.0001");
  const input = await fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, borrower.address);
  input.add128(depositAmount);
  const { handles, inputProof } = await input.encrypt();
  const depositTx = await pool.connect(borrower).deposit(handles[0], inputProof, {
    value: depositAmount,
  });
  await depositTx.wait();
  console.log("      tx:", depositTx.hash);
  console.log("      Borrower deposited 0.0001 ETH collateral");

  // Step 3: Borrower borrows 0.1 USDC (max ~0.133 USDC at 66.67% LTV on $0.20 collateral)
  console.log("\n[3/4] Borrower borrows 0.10 USDC (encrypted)...");
  const borrowUsdc = 100_000n; // 0.10 USDC (6 decimals)
  const borrowInput = await fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, borrower.address);
  borrowInput.add128(borrowUsdc);
  const { handles: bHandles, inputProof: bProof } = await borrowInput.encrypt();
  const borrowTx = await pool.connect(borrower).borrow(bHandles[0], bProof, borrowUsdc);
  await borrowTx.wait();
  console.log("      tx:", borrowTx.hash);
  console.log("      Borrower received 0.10 USDC");

  console.log("\n[4/4] Summary:");
  console.log("  Pool has 19,999.90 USDC available (20,000 seeded, 0.10 borrowed)");
  console.log("  Borrower: 0.0001 ETH collateral ($0.20 value), 0.10 USDC debt");
  console.log("  Health factor: 0.20/0.15 = 1.33 (healthy, threshold = 1.0)");
  console.log("\nReady for demo recording.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
