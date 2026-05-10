import { ethers } from "hardhat";

async function main() {
  const provider = ethers.provider;
  const deployer = "0xc211C942946011859ca634F22400d80570ED12A5";
  const contractAddr = "0xbC411fc4D05c76fbf607a49E0b454e16342406Cb";

  const nonce = await provider.getTransactionCount(deployer);
  console.log("Current nonce:", nonce);

  // The contract was deployed at some nonce - scan recent blocks
  const latest = await provider.getBlockNumber();
  console.log("Latest block:", latest);

  // Check last 20 blocks for tx from deployer
  for (let b = latest; b >= latest - 50; b--) {
    const block = await provider.getBlock(b, true);
    if (!block || !block.transactions) continue;
    for (const tx of block.prefetchedTransactions) {
      if (tx.from?.toLowerCase() === deployer.toLowerCase() && tx.to === null) {
        const receipt = await provider.getTransactionReceipt(tx.hash);
        if (receipt?.contractAddress?.toLowerCase() === contractAddr.toLowerCase()) {
          console.log("Deploy TX Hash:", tx.hash);
          console.log("Block:", b);
          return;
        }
      }
    }
  }
  console.log("TX not found in last 50 blocks");
}

main().catch(console.error);
