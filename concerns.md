# concerns.md — PrivLend (Zama Developer Program Mainnet Season 2)
# Derived from warroom/concerns-snapshot-V1.md

## CRITICAL [C] — Violation eliminates the idea or blocks approval

[C] Uniqueness: Zero confirmed competitors in confidential lending space on Zama S2. Must stay differentiated.
[C] Saturated categories OFF LIMITS: Payroll, payments, KYC/identity, credit scoring (TrustScore) — all dead. PrivLend is lending, not these.
[C] Real human problem: Institutional DeFi participants suffer MEV/front-running today. GSR proved demand is real.
[C] FHEVM must be native: All positions, balances, health factors encrypted. ACL design is the core value proposition — not a sprinkle.
[C] Demo must feel like the real product: Two-wallet Sepolia demo (borrower + observer) must visually prove confidentiality in real time.

## IMPORTANT [I] — Violation = score penalty or documented gap

[I] Everything on Sepolia testnet: Live deployed contract required. No local-only submissions.
[I] Multi-track positioning: Builder Track (forms.zama.org) + APAC Track (openbuild.xyz) — both must be submittable from one dApp.
[I] Oracle dependency resolved: Fixed 150% LTV (LTV_DENOMINATOR = 150). No oracle. Documented as v2 integration.
[I] FHEVM native depth: Use euint128 everywhere, minimum 8 FHE ops (fromExternal, add, gt, select, allow, min, mul-approx, div-approx). More ops = higher technical correctness score.
[I] FHE latency UX: "FHE computation in progress" spinner is non-negotiable. Never let latency look like a crash.
[I] Interest accrual spec'd: plaintext delta (5% APR × elapsed blocks) added to encrypted debt at repay time via FHE.add.
[I] WASM webpack config explicit: next.config.js experiments: { asyncWebAssembly: true } must be Day 1 architecture spec — not discovered cold during build.
[I] Encrypted health ratio: euint128 healthRatio exposed to borrower. Liquidator still sees ebool health flag ONLY.
[I] Partial liquidation: FHE.min(debt, requiredRepay) — minimum liquidation to restore health, not full position wipe.

## ADVISORY [A] — Noted but not disqualifying

[A] TrustRWA narrative layer: Reference GSR (March 2026 OTC trade), T-REX/Apex Group ($100B target) in README. Documentation only — no ERC-3643 code.
[A] V2 roadmap: Include ERC-3643 T-REX integration, FHE-native oracle, async relayer liquidation as documented v2 features.
[A] Video pitch quality: First 30 seconds plain English, technical language last 60 seconds. Not disqualifying if video is functional.
