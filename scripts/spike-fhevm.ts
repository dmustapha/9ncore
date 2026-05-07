import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);

  // Correct Sepolia ACL address from @fhevm/mock-utils SepoliaConfig
  // ARCHITECTURE.md had stale address 0x339Ece85B9E11a3a3aa557582784a15D7f82aaA3 (DEV-005)
  const ACL_ADDR = "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D";
  const code = await ethers.provider.getCode(ACL_ADDR);
  console.log("ACL code length:", code.length);

  if (code.length > 2) {
    console.log("✅ FHEVM ACL contract is live on Sepolia");
  } else {
    console.log("❌ ACL contract not found — check network");
  }
}

main().catch(console.error);
