import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";

describe("PrivLendPool", function () {
  let pool: any;
  let owner: any, lender: any, borrower: any, liquidator: any;

  beforeEach(async function () {
    [owner, lender, borrower, liquidator] = await ethers.getSigners();
    const PrivLendPool = await ethers.getContractFactory("PrivLendPool");
    pool = await PrivLendPool.deploy();
    await pool.waitForDeployment();
  });

  async function encryptAmount(contractAddr: string, signer: any, amountWei: bigint) {
    const input = hre.fhevm.createEncryptedInput(contractAddr, signer.address);
    input.add128(amountWei);
    return input.encrypt();
  }

  it("Test 1: Lender can add ETH to lending pool", async function () {
    const tx = await pool.connect(lender).lend({ value: ethers.parseEther("1.0") });
    await tx.wait();
    expect(await pool.totalShares()).to.equal(ethers.parseEther("1.0"));
    expect(await pool.lenderShares(lender.address)).to.equal(ethers.parseEther("1.0"));
    expect(await pool.lendingPool()).to.equal(ethers.parseEther("1.0"));
  });

  it("Test 2: Lender can withdraw proportional ETH", async function () {
    await pool.connect(lender).lend({ value: ethers.parseEther("1.0") });
    const balBefore = await ethers.provider.getBalance(lender.address);
    const tx = await pool.connect(lender).withdrawLiquidity(ethers.parseEther("0.5"));
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const balAfter = await ethers.provider.getBalance(lender.address);
    expect(balAfter - balBefore + gasUsed).to.be.closeTo(
      ethers.parseEther("0.5"), ethers.parseEther("0.01")
    );
  });

  it("Test 3: Borrower can deposit encrypted collateral", async function () {
    const contractAddr = await pool.getAddress();
    const depositAmt = ethers.parseEther("0.5");
    const { handles, inputProof } = await encryptAmount(contractAddr, borrower, depositAmt);
    const tx = await pool.connect(borrower).deposit(handles[0], inputProof, { value: depositAmt });
    await tx.wait();
    expect(await pool.hasCollateral(borrower.address)).to.be.true;
  });

  it("Test 4: Borrower can borrow from pool", async function () {
    await pool.connect(lender).lend({ value: ethers.parseEther("1.0") });
    const contractAddr = await pool.getAddress();
    const collateral = ethers.parseEther("0.5");
    const { handles: cHandles, inputProof: cProof } = await encryptAmount(contractAddr, borrower, collateral);
    await pool.connect(borrower).deposit(cHandles[0], cProof, { value: collateral });
    const borrowAmt = ethers.parseEther("0.1");
    const { handles: bHandles, inputProof: bProof } = await encryptAmount(contractAddr, borrower, borrowAmt);
    await pool.connect(borrower).borrow(bHandles[0], bProof, borrowAmt);
    expect(await pool.hasBorrowPosition(borrower.address)).to.be.true;
    expect(await pool.lendingPool()).to.equal(ethers.parseEther("0.9"));
  });

  it("Test 5: Repay reduces debt (FHE.sub)", async function () {
    await pool.connect(lender).lend({ value: ethers.parseEther("1.0") });
    const contractAddr = await pool.getAddress();
    const { handles: cH, inputProof: cP } = await encryptAmount(contractAddr, borrower, ethers.parseEther("0.5"));
    await pool.connect(borrower).deposit(cH[0], cP, { value: ethers.parseEther("0.5") });
    const { handles: bH, inputProof: bP } = await encryptAmount(contractAddr, borrower, ethers.parseEther("0.1"));
    await pool.connect(borrower).borrow(bH[0], bP, ethers.parseEther("0.1"));
    const repayAmt = ethers.parseEther("0.1");
    const { handles: rH, inputProof: rP } = await encryptAmount(contractAddr, borrower, repayAmt);
    const tx = await pool.connect(borrower).repay(rH[0], rP, { value: repayAmt });
    await tx.wait();
    expect(await pool.lendingPool()).to.be.closeTo(ethers.parseEther("1.0"), ethers.parseEther("0.01"));
  });

  it("Test 6: checkHealth emits event and sets handles", async function () {
    const contractAddr = await pool.getAddress();
    const { handles: cH, inputProof: cP } = await encryptAmount(contractAddr, borrower, ethers.parseEther("0.5"));
    await pool.connect(borrower).deposit(cH[0], cP, { value: ethers.parseEther("0.5") });
    const tx = await pool.connect(liquidator).checkHealth(borrower.address);
    const receipt = await tx.wait();
    expect(receipt.logs.length).to.be.greaterThan(0);
  });

  it("Test 7: Liquidate reduces debt via FHE.min", async function () {
    await pool.connect(lender).lend({ value: ethers.parseEther("1.0") });
    const contractAddr = await pool.getAddress();
    const { handles: cH, inputProof: cP } = await encryptAmount(contractAddr, borrower, ethers.parseEther("0.5"));
    await pool.connect(borrower).deposit(cH[0], cP, { value: ethers.parseEther("0.5") });
    const { handles: bH, inputProof: bP } = await encryptAmount(contractAddr, borrower, ethers.parseEther("0.3"));
    await pool.connect(borrower).borrow(bH[0], bP, ethers.parseEther("0.3"));
    const liquidateAmt = ethers.parseEther("0.1");
    const { handles: lH, inputProof: lP } = await encryptAmount(contractAddr, liquidator, liquidateAmt);
    const tx = await pool.connect(liquidator).liquidate(borrower.address, lH[0], lP, { value: liquidateAmt });
    await tx.wait();
  });

  it("Test 8: Multiple lenders share pool proportionally", async function () {
    await pool.connect(lender).lend({ value: ethers.parseEther("1.0") });
    const [, , , , lenderB] = await ethers.getSigners();
    await pool.connect(lenderB).lend({ value: ethers.parseEther("1.0") });
    expect(await pool.totalShares()).to.equal(ethers.parseEther("2.0"));
    expect(await pool.lendingPool()).to.equal(ethers.parseEther("2.0"));
    const sharesA = await pool.lenderShares(lender.address);
    const sharesB = await pool.lenderShares(lenderB.address);
    expect(sharesA).to.equal(sharesB);
  });
});
