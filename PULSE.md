# PULSE — PrivLend Rolling Context
Project: PrivLend (Confidential Lending Pool)
Hackathon: Zama Developer Program Mainnet Season 2
Working dir: /Users/MAC/hackathon-toolkit/active/zama-mainnet-s2/privlend

---

## Active Facts (override brief if conflict)
- Contract: PrivLendPool deployed at 0xbC411fc4D05c76fbf607a49E0b454e16342406Cb on Sepolia (block 10806284)
- Sourcify verified: https://repo.sourcify.dev/contracts/full_match/11155111/0xbC411fc4D05c76fbf607a49E0b454e16342406Cb/
- @zama-fhe/relayer-sdk actual version: 0.4.1 (NOT 0.4.3 as in architecture — peer dep constraint from @fhevm/hardhat-plugin)
- Correct ACL address: 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D (NOT 0x339EcE... which is stale)
- RPC: https://ethereum-sepolia-rpc.publicnode.com (rpc.sepolia.org is DOWN)
- Next.js 16 Turbopack DEADLOCKS on @zama-fhe/relayer-sdk/web — MUST use `next build --webpack`
- Dev server uses Turbopack (fast), production build uses webpack (`npm run build` = `next build --webpack`)
- Frontend builds in 6.2s webpack, dev server ready in 453ms, renders 200 OK
- Tailwind v4 @theme syntax used (not v3 config file)

## Decisions Log
| Date | Decision | Reason |
|------|----------|--------|
| 2026-05-07 | Hardhat 2.22.x over 3.x | ESM/CJS incompatibility with fhevm plugin |
| 2026-05-07 | @fhevm/hardhat-plugin@0.4.2 (latest) | ^0.6.0 doesn't exist on npm |
| 2026-05-07 | ZamaEthereumConfig inheritance | Required for FHE coprocessor setup (FHE.fromExternal reverts without it) |
| 2026-05-07 | externalEuint128.wrap() in FHE.fromExternal | FHE.sol typed wrapper API (not raw bytes32) |
| 2026-05-08 | next build --webpack | Turbopack deadlocks on 4.5MB WASM indefinitely |
| 2026-05-08 | Dynamic import in lib/fhevm.ts | Prevent bundler from statically analyzing WASM module |
| 2026-05-08 | import { injected } from "wagmi" (not wagmi/connectors) | wagmi/connectors Tempo connector has unresolvable 'accounts' dep |

---

## hackathon-build — Session 3 (2026-05-08)

**Phases covered:** Phase 4 completion + Phase 5 start

**Verified Facts [SKILL]:**
- `next build --webpack` exits 0 in 6.2s; `next build` (Turbopack) deadlocks forever
- Next.js 16 CLI has explicit `--webpack` and `--turbopack` flags (confirmed from CLI source code in node_modules/next/dist/bin/next.map)
- `injected` is re-exported from `wagmi` main index (confirmed from wagmi/dist/esm/exports/index.js)
- Dev server (Turbopack mode): ✓ Ready 453ms, GET / 200, no hydration errors
- Page renders with title "PrivLend — Confidential Lending Pool" and "Connect Wallet" button

**Deviations [SKILL]:**
- DEV-013: Turbopack deadlock — `next build` hangs indefinitely with @zama-fhe/relayer-sdk/web
- DEV-014: lib/fhevm.ts static import → dynamic import (remove from module graph)
- DEV-015: next.config.ts `turbopack: undefined` doesn't disable Turbopack; must use `--webpack` CLI flag
- DEV-016: `wagmi/connectors` import → `wagmi` main import (avoids Tempo connector/accounts dep)
- DEV-011: tsconfig.json target ES2017 → ES2020 (BigInt literals)
- DEV-012: Tailwind v4 @theme syntax (not v3 tailwind.config.ts)

**Blockers for Downstream [SKILL]:**
- Phase 5 wallet/MetaMask testing requires manual interaction — dev server is live at http://localhost:3000
- usePosition.ts decryptPosition is stubbed (throws) — implement with real userDecrypt API in Phase 5
- Screenshots directory created at submission/screenshots/ but no screenshots yet (requires manual browser action)
- Pool has 0.18 ETH lend liquidity but no borrower position — demo starts fresh from UI

**For Next Skill:**
- Dev server running at http://localhost:3000, returns 200 OK
- All Phase 4 files committed (29 files, 1563 insertions)
- Phase 5 gate checklist in PLAN.md Phase 5 section
- Wire/verify skills should check DEV-013 (webpack build flag) and DEV-016 (wagmi import)
- `npm run typecheck` = `tsc --noEmit`, `npm run build` = `next build --webpack`
