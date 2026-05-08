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

---

## hackathon-critique — Session 4 (2026-05-08)

**Phases covered:** Full critique (all 7 phases)

**Verified Facts [SKILL]:**
- Competitive positioning: UNIQUE — 0 known lending submissions; Zama explicitly called for confidential lending
- FHE integration depth: Platinum — 12 FHE operations, multi-role ACL, Gateway decryption, ZKPoK input proofs
- PRD already contained prior critique elevations (E-1 through E-4 from previous partial pass) — building on them
- Narrative score: compelling — $700M MEV hook, two-wallet demo, Etherscan split-screen
- Gateway decryption (userDecrypt) is stubbed in usePosition.ts — critical Phase 5 item

**Key Decisions [SKILL]:**
- Applied 5 elevations: GDPR compliance framing, ACL diagram spec, FHE.select as op #12, APAC Track OpenBuild checklist, Phase 5 Gateway priority directive
- All elevations applied to PRD.md (no ARCHITECTURE.md changes required)

**Deviations:** None — clean critique run from fresh state

**Additions:**
- CRITIQUE-REPORT.md created at /privlend/CRITIQUE-REPORT.md
- .critique-state.json created
- PRD.md: Sections 11 (APAC checklist) and 12 (Phase 5 override) added
- PRD.md: FHE.select as op #12, ACL permission matrix diagram, GDPR compliance framing all added

**For Next Skill (build Phase 5):**
- CRITICAL: Phase 5 Task 5.1 = Gateway decryption in usePosition.ts. Check @zama-fhe/relayer-sdk v0.4.1 source for userDecrypt API (may also be `reencrypt` or `decrypt` — check node_modules/@zama-fhe/relayer-sdk/dist/web/index.d.ts)
- CRITICAL: Run scripts/seed-demo.ts against deployed contract before recording demo video
- APAC Track: Submit to OpenBuild (openbuild.xyz/learn/challenges/2095330503) BEFORE May 10 23:59 AOE
- README requires: ACL permission matrix (from PRD Section 4 diagram spec) + GDPR compliance section
- Contract: 0xbC411fc4D05c76fbf607a49E0b454e16342406Cb on Sepolia — already deployed and Sourcify verified

---

## url_preverify — Session 5 (2026-05-08)

**Phases covered:** url_preverify + project rename

**Verified Facts [SKILL]:**
- Project renamed from PrivLend → **9encore**
- github.com/dmustapha/9encore: FREE (404)
- 9encore.vercel.app: FREE (404)
- 9encore.onrender.com: FREE (404)
- Contract name PrivLendPool stays unchanged on-chain (0xbC411fc4D05c76fbf607a49E0b454e16342406Cb)

**Key Decisions [SKILL]:**
- 9encore chosen: x9-protocol style codename, short, memorable, both URL slots clear
- All three deployment targets locked before build continues

**Deviations:** None

**Additions:**
- urlSlots written to .conductor-state.json
- url_preverify logged as complete in pipeline-log.md

**For Next Skill (hackathon-build Phase 5):**
- Project is now called **9encore** — update README, package.json name, page title
- GitHub repo to create: github.com/dmustapha/9encore
- Vercel deploy target: 9encore.vercel.app
- CRITICAL first task: implement Gateway decryption in frontend/hooks/usePosition.ts (Phase 5 Task 5.1)
- Contract stays as PrivLendPool at 0xbC411fc4D05c76fbf607a49E0b454e16342406Cb — no rename needed on-chain

---

## url_preverify — Session 5 (2026-05-08)

**Phases covered:** URL preverify + project rename

**Verified Facts [SKILL]:**
- 9ncore: GitHub (dmustapha/9ncore) free, Vercel (9ncore.vercel.app) free, Render (9ncore.onrender.com) free
- 28 total name candidates checked across 3 sessions before landing on 9ncore

**Key Decisions [SKILL]:**
- [USER] Project renamed from PrivLend → **9ncore**
- On-chain contract name stays `PrivLendPool` (deployed, can't rename)
- GitHub slug: `9ncore` | Vercel: `9ncore.vercel.app` | Render: `9ncore.onrender.com`
- README, landing page, submission forms all use "9ncore" as display name

**Deviations:** None

**For Next Skill (hackathon-build Phase 5):**
- Display name everywhere = **9ncore** (not PrivLend)
- Contract/code variable names stay as PrivLendPool internally
- Phase 5 Task 5.1 = Gateway decryption in frontend/hooks/usePosition.ts (CRITICAL — currently stubbed/throws)
- Dev server: `cd frontend && npm run dev` (Turbopack, port 3000)
- Build: `npm run build` = `next build --webpack` (Turbopack deadlocks)
- Run seed: `npx hardhat run scripts/seed-demo.ts --network sepolia` (requires DEPLOYER_PRIVATE_KEY in .env)

---

## hackathon-build — Session 6 (2026-05-08)

**Phases covered:** Phase 5 Task 5.1 — Gateway Decryption Implementation

**Verified Facts [SKILL]:**
- `tsc --noEmit` → 0 errors after adding usePublicClient + viem imports
- `next build --webpack` → exit 0 in 5.1s, 4/4 static pages, 0 TS errors
- `usePublicClient` and `useWalletClient` both exported from wagmi main index (confirmed from wagmi/dist/esm/exports/index.js lines 53, 79)
- `generateKeypair()` returns `KeypairType<BytesHexNo0x>` = `{ publicKey: string, privateKey: string }` (no 0x prefix)
- `UserDecryptResults = ClearValues = Readonly<Record<'0x${string}', bigint | boolean | '0x${string}'>>`
- `KmsUserDecryptEIP712Type.types` includes `EIP712Domain` key — must omit before passing to viem `signTypedData`
- Storage layout verified: slot 0 = `_collateral`, slot 1 = `_debt` (both `mapping(address => euint128)`)
- `euint128` is a user-defined value type wrapping `bytes32` — stored as raw `bytes32` at the mapping slot

**Key Decisions [SKILL]:**
- Handle retrieval: `eth_getStorageAt` via `publicClient.getStorageAt` using `keccak256(abi.encode(addr, slotIndex))` — avoids need for contract getters
- EIP712 signing: strip `EIP712Domain` from types before `walletClient.signTypedData` (viem handles domain separately)
- New `PositionPanel` component added — exposes "Decrypt My Position" button, shows collateral/debt/health ratio
- Page layout: PositionPanel + HealthPanel side-by-side (md:grid-cols-2) below action panels
- Project renamed PrivLend → **9ncore** in page title, header, footer, metadata (layout.tsx, page.tsx)

**Deviations [SKILL]:**
- DEV-017: No contract view function for euint128 handles → read via `eth_getStorageAt` with computed mapping slot
- DEV-018: EIP712Domain in `createEIP712()` result must be stripped for viem `signTypedData` — viem computes domain hash itself

**Blockers for Downstream [SKILL]:**
- Phase 5 Tasks 5.2–5.4 are manual testing (MetaMask, two wallets, screenshots) — cannot be automated
- `decryptPosition` requires a live Gateway relayer — test on Sepolia with DEPLOYER_PRIVATE_KEY set
- Seed demo if pool empty: `npx hardhat run scripts/seed-demo.ts --network sepolia`
- Screenshots needed in `submission/screenshots/` (6 required for Phase 5 gate)

**For Next Skill (hackathon-debug):**
- Build gate: `next build --webpack` = exit 0 (5.1s)
- TypeScript: 0 errors
- Dev server: `cd frontend && npm run dev` → http://localhost:3000
- Phase 5 code complete — manual testing required for Phase 5 gate checklist
- After manual test + screenshots committed → run hackathon-debug in new chat
- README still says "PrivLend" in body text — update during debug or package phase
