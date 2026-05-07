# Technical Spike — PrivLend (Zama S2)
**Date:** 2026-05-07
**Scope:** 5 unknowns verified before PRD/Architecture writing

---

## Verified Patterns (copy these into Architecture Doc)

| Component | Pattern | Source | Confidence |
|-----------|---------|--------|:---:|
| FHE library import | `import "@fhevm/solidity/lib/FHE.sol";` | github.com/zama-ai/fhevm-hardhat-template FHECounter.sol | HIGH |
| Config import | `import "@fhevm/solidity/config/ZamaConfig.sol";` | same | HIGH |
| Library namespace | `FHE` (not `TFHE` — old naming, deprecated) | FHECounter.sol | HIGH |
| fromExternal pattern | `euint128 amt = FHE.fromExternal(inputHandle, inputProof);` | FHECounter.sol (euint32 variant confirmed) | HIGH |
| ACL grant to contract | `FHE.allowThis(handle);` | FHECounter.sol + ConfidentialERC20 | HIGH |
| ACL grant to user | `FHE.allow(handle, address);` | FHECounter.sol + ConfidentialERC20 | HIGH |
| FHE.add euint128 | `FHE.add(euint128, euint128) → euint128` | FHE.sol raw source | HIGH |
| FHE.sub euint128 | `FHE.sub(euint128, euint128) → euint128` | FHE.sol raw source | HIGH |
| FHE.mul cross-type | `FHE.mul(euint128, euint8) → euint128` and similar cross-type | FHE.sol raw source | HIGH |
| FHE.min euint128 | `FHE.min(euint128, euint128) → euint128` | FHE.sol raw source | HIGH |
| FHE.max euint128 | `FHE.max(euint128, euint128) → euint128` | FHE.sol raw source | HIGH |
| FHE.gt euint128 | `FHE.gt(euint128, euint128) → ebool` | FHE.sol raw source | HIGH |
| FHE.select | `FHE.select(ebool, euint128, euint128) → euint128` | ConfidentialERC20 (euint64 variant confirmed) | HIGH |
| FHE.div plaintext | FHE.div ONLY supports plaintext divisor, not encrypted | docs.zama.org operations page | HIGH |
| Test encrypted input | `createEncryptedInput(contractAddr, signerAddr).add32(val).encrypt()` → `{handles[0], inputProof}` | docs.zama.org quick-start-tutorial | HIGH |
| Test euint128 input | `.add128(val)` for uint128 values (inferred from add32 pattern) | Inferred from add32 + euint128 type system | MEDIUM |
| WASM webpack Next.js | `config.experiments = { asyncWebAssembly: true }` inside `webpack: function(config) { }` in next.config.js | github.com/vercel/next.js discussions #35637 | HIGH |
| ConfidentialWETH euint64 | fhevm-contracts ConfidentialWETH.sol uses euint64 — incompatible with euint128 requirement | github.com/zama-ai/fhevm-contracts | HIGH |

---

## Critical Finding: ConfidentialWETH is euint64

**Problem:** `fhevm-contracts/contracts/token/ERC20/ConfidentialWETH.sol` uses `euint64` for all balances. The `wrap()` function explicitly checks `type(uint64).max` and will revert for amounts > ~18.4 ETH.

**Impact on PrivLend architecture:** Cannot use stock ConfidentialWETH for a euint128 pool.

**Resolution (chosen):** Skip the ERC-7984 cWETH wrapper entirely for MVP. Use direct ETH custody:
- Users call `deposit() payable` on the pool
- Pool tracks `mapping(address => euint128) private collateral` in wei (full precision)
- Pool tracks `mapping(address => euint128) private debt` in wei
- Withdrawal: borrower requests Gateway decryption of their collateral handle, then calls `withdraw(amount)` with proof
- This is architecturally cleaner for MVP and avoids the euint64 incompatibility

**ERC-7984 wrapper:** Deferred to v2. Document in README as planned.

---

## Unverified Patterns (use with caution, mark WARNING in Architecture)

| Component | Pattern | Source | Risk |
|-----------|---------|--------|------|
| Relayer SDK browser import | `import { createFhevmInstance } from "@zama-fhe/relayer-sdk"` or `createEncryptedInput` | npm 403, GitHub README inconclusive | SDK may have changed API surface in v0.4.3 |
| FHE.mul scalar | `FHE.mul(euint128, uint128) → euint128` for plaintext scalar | Docs say "scalar versions where applicable" — not confirmed for mul | Interest accrual pattern depends on this |
| FHE.asEuint128 | `FHE.asEuint128(0)` for zero constant — inferred from `FHE.asEuint64(0)` in ConfidentialERC20 | Inferred | May be different method name |

---

## Assumed / Not Found (need decision trees in Implementation Plan)

| Component | What's Unknown | Fallback Approach |
|-----------|---------------|-------------------|
| Relayer SDK browser API | Exact createEncryptedInput call in browser context (vs Hardhat test context) | Use Hardhat test pattern in frontend tests; find correct browser import on Day 1 from GitHub source |
| FHE.mul scalar for interest | Whether FHE.mul(euint128, uint128) exists | Fallback: store initial_debt as plaintext snapshot and use plaintext interest calculation (privacy tradeoff, documented) |
| Gateway decryption frontend | Exact frontend code to request decryption via Gateway for borrower view | Check relayer-sdk docs for userDecrypt or reencrypt pattern on Day 2 |

---

## Interest Accrual Architecture (Decided)

**Pattern:** Plaintext-scalar multiplication + plaintext divisor

```solidity
// At repay time (all values computed in contract)
uint256 blocksDelta = block.number - lastBorrowBlock[msg.sender];  // plaintext
uint256 interestBps = (blocksDelta * INTEREST_RATE_PER_BLOCK_BPS); // plaintext
// WARNING: UNVERIFIED — FHE.mul with uint scalar
euint128 interest = FHE.div(FHE.mul(debt[msg.sender], uint128(interestBps)), 10_000);
euint128 totalRepay = FHE.add(debt[msg.sender], interest);
```

Where:
- `INTEREST_RATE_PER_BLOCK_BPS = 5e18 / (365 * 24 * 3600 / 12) / 10000` (5% APR in BPS per ~12s block)
- Sepolia: ~12s/block → ~2,628,000 blocks/year → rate ≈ 19 BPS per 10k blocks

**Fallback (if FHE.mul scalar fails):** Store `uint128 public principalSnapshot[address]` as plaintext and add `FHE.asEuint128(plaintext_interest)` to encrypted debt. Privacy tradeoff: loan size visible.

---

## Health Ratio Architecture (Decided)

**Problem:** FHE.div doesn't support encrypted divisors. Cannot compute `collateral / debt` in FHE.

**Pattern for ebool health flag (liquidator):**
```solidity
// FHE check: collateral * 100 >= debt * 150 (i.e., collateral/debt >= 1.5)
ebool isHealthy = FHE.ge(FHE.mul(collateral[addr], 100), FHE.mul(debt[addr], 150));
// [UNVERIFIED - scalar mul pattern]
```

**Pattern for euint128 health numerator (borrower):**
```solidity
// Expose numerator only; frontend divides by decrypted debt to get ratio
euint128 healthNumerator = FHE.mul(collateral[addr], 100);
FHE.allow(healthNumerator, addr);  // borrower decrypts this + their debt separately
```

Borrower decrypts `healthNumerator` and `debt` via Gateway. Frontend displays `healthNumerator / debt` as the collateralization ratio.

---

## Partial Liquidation Architecture (Decided)

**Pattern:**
```solidity
// requiredCollateral to restore health: debt * 150 / 100 (plaintext calculation on encrypted won't work)
// Alternative: liquidator provides required repay amount (plaintext), verify it restores health post-liquidation
euint128 actualRepay = FHE.min(debt[borrower], FHE.asEuint128(liquidatorAmount));
// [UNVERIFIED — FHE.asEuint128 method name]
debt[borrower] = FHE.sub(debt[borrower], actualRepay);
FHE.allowThis(debt[borrower]);
FHE.allow(debt[borrower], borrower);
```

Liquidator specifies an amount; `FHE.min` ensures they can't liquidate more than the debt. Contract verifies post-liquidation health before releasing collateral.

---

## WASM Next.js Config (Verified)

```javascript
// next.config.js — VERIFIED
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    if (isServer) {
      config.output = {
        ...config.output,
        webassemblyModuleFilename: './../static/wasm/[modulehash].wasm',
      };
    }
    return config;
  },
};

module.exports = nextConfig;
```

Additionally: copy WASM file from node_modules to public/ if SDK requires it. Test with a minimal createEncryptedInput call as Day 1 last task.

---

## Conflict Resolution

| Topic | Prior Research Said | Spike Found | Using |
|-------|--------------------|-----------|----|
| Library namespace | "FHE" (from PULSE warroom section) | FHE confirmed ✓ | FHE |
| cWETH type | "ERC-7984 using OpenZeppelin" | OZ uses euint64, incompatible | Direct ETH custody |
| "6 design challenges" | PULSE references this as a real doc | Blog post is 4 thematic areas, not a numbered list | Drop numbered reference |
