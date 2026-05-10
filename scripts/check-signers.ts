import { ethers } from "hardhat";
async function main() {
  const signers = await ethers.getSigners();
  console.log("Signer count:", signers.length);
  for (const s of signers) console.log(" -", s.address);
}
main().catch(console.error);
