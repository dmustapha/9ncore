# PrivLend — On-Chain Proof of Integration

## Deployed Contract

| Contract | Network | Address | Explorer |
|----------|---------|---------|----------|
| PrivLendPool | Ethereum Sepolia | `0xbC411fc4D05c76fbf607a49E0b454e16342406Cb` | [Etherscan](https://sepolia.etherscan.io/address/0xbC411fc4D05c76fbf607a49E0b454e16342406Cb) |

**Sourcify Verified:** https://repo.sourcify.dev/contracts/full_match/11155111/0xbC411fc4D05c76fbf607a49E0b454e16342406Cb/

## Deployment Transaction

| Type | Tx Hash | Block |
|------|---------|-------|
| Contract Deploy | [`0x6f370735c2457989f7c71e6e2751578ebffd79d78eaa1984ede5b54c4ea15d0c`](https://sepolia.etherscan.io/tx/0x6f370735c2457989f7c71e6e2751578ebffd79d78eaa1984ede5b54c4ea15d0c) | 10806284 |

## Demo Transactions (On-Chain)

| Step | Tx Hash | Description |
|------|---------|-------------|
| Lend #1 | [`0x9437383ac4c7e6365da0717798d34d812ce81c3cfc05ce91263208a8709a4947`](https://sepolia.etherscan.io/tx/0x9437383ac4c7e6365da0717798d34d812ce81c3cfc05ce91263208a8709a4947) | Lender adds 0.1 ETH liquidity to pool |
| Lend #2 | [`0x6782c8bd80129b5051aec15cd471ee6560e710268ff6d4fbbc6a7f0ff58abbc6`](https://sepolia.etherscan.io/tx/0x6782c8bd80129b5051aec15cd471ee6560e710268ff6d4fbbc6a7f0ff58abbc6) | Lender adds 0.04 ETH liquidity to pool |
| Lend #3 | [`0x4f5945c368bc0fb25e7f3527cc8568ce0d07dd75211f095e5154d24ad3f9d955`](https://sepolia.etherscan.io/tx/0x4f5945c368bc0fb25e7f3527cc8568ce0d07dd75211f095e5154d24ad3f9d955) | Lender adds 0.04 ETH liquidity to pool |

**Total pool liquidity locked:** ~0.18 ETH (real testnet value)

## FHEVM Integration Evidence

| Component | Evidence |
|-----------|----------|
| `FHE.fromExternal()` | Used in `deposit()`, `borrow()`, `repay()`, `liquidate()` — validates encrypted user inputs with proof |
| `FHE.add()` | Accumulates encrypted collateral and debt across multiple positions |
| `FHE.sub()` | Reduces encrypted debt on repay/liquidate |
| `FHE.mul(euint128, uint128)` | Scalar interest accrual — `debt × bps / 10000` |
| `FHE.div(euint128, uint128)` | Divides interest fraction by BPS constant |
| `FHE.min(euint128, euint128)` | Caps repayment at outstanding debt (no double-pay) |
| `FHE.ge(euint128, euint128)` | Health check — `collateral×100 ≥ debt×150` |
| `FHE.allowThis()` | Grants contract persistent ACL access to ciphertexts |
| `FHE.allow(ct, user)` | Grants borrower ACL access to their own ciphertexts |
| `ZamaEthereumConfig` | Chain-aware coprocessor config (local/Sepolia/Mainnet) |

## Test Coverage

- 8/8 unit tests passing locally (hardhat mock coprocessor)
- Tests cover: lend, withdraw, deposit, borrow, repay, checkHealth, liquidate, multi-lender

## Deployer

- Address: `0xc211C942946011859ca634F22400d80570ED12A5`
- Network: Ethereum Sepolia (chainId 11155111)
