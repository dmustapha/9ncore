# Build Report — PrivLend (Confidential Lending Pool)
Generated: 2026-05-07 (updated 2026-05-08)
Builder: hackathon-build skill
Hackathon: Zama Developer Program Mainnet Season 2

## Summary
| Phase | Steps | Status | Notes |
|-------|-------|--------|-------|
| Phase 1: Scaffold & Spike | 1.1 (spike), 1.2-1.6 (scaffold) | complete | DT-1/DT-2/DT-5 resolved |
| Phase 2: Smart Contracts | 2.1 (contract), 2.2 (tests) | complete | 8/8 tests passing |
| Phase 3: Deploy to Sepolia | 3.1 (deploy), 3.2 (verify), 3.3 (seed) | complete | Contract deployed+Sourcify-verified; 3 lend txs on-chain; seed collateral/borrow skipped (wallet exhausted after deploy gas) |
| Phase 4: Frontend | 4.1 (all files), build gate | complete | next build --webpack exits 0; DEV-011..016 logged |
| Phase 5: Integration & Demo Prep | pending | pending | |

## Deviations from Architecture
| ID | Component | ARCHITECTURE Said | ACTUAL | Reason | Downstream Impact |
|----|-----------|-------------------|--------|--------|-------------------|
| DEV-001 | PrivLendPool.sol — interest accrual | `FHE.mul(debt, uint8 bps)` scalar plaintext multiply | `FHE.mul(debt, FHE.asEuint128(uint256(bps)))` encrypted-encrypted multiply | FHE.sol has NO scalar plaintext multiply for euint128. Only encrypted×encrypted variants exist. Grep for `ScalarMul\|mul.*uint128[^e]\|euint128.*uint128\b` returned zero matches. | All interest calculations must wrap plaintext BPS in asEuint128() first. No functional difference — result is identical. Contracts that copy from ARCHITECTURE.md must use the fallback pattern. |
| DEV-002 | package.json — Hardhat version | `hardhat: "^3.0.0"` (arch implied Hardhat 3 tooling) | `hardhat: "^2.22.0"` + `@nomicfoundation/hardhat-toolbox: "^5.0.0"` | Hardhat 3.x is ESM-only; project uses `"type": "commonjs"` in package.json. `@fhevm/hardhat-plugin@0.4.2` peerDeps require `hardhat: "^2.0.0"`. Downgraded to Hardhat 2.22.x for compatibility. | None — Hardhat 2.x + toolbox v5 provides same compile/test/deploy capabilities. |
| DEV-003 | package.json — @fhevm/hardhat-plugin version | `@fhevm/hardhat-plugin: "^0.6.0"` | `@fhevm/hardhat-plugin@0.4.2` (latest published) | npm registry shows latest is `0.4.2`; `0.6.0` does not exist on registry. `npm view @fhevm/hardhat-plugin@^0.6.0` returns empty. | None — 0.4.2 is the production-stable release with full FHEVM support. |
| DEV-004 | package.json — @zama-fhe/relayer-sdk version | `@zama-fhe/relayer-sdk: "0.4.3"` | `@zama-fhe/relayer-sdk@0.4.1"` | `@fhevm/hardhat-plugin@0.4.2` peerDeps declare `@zama-fhe/relayer-sdk: "0.4.1"` — strict semver. Installing 0.4.3 breaks the peer dep resolution. Used 0.4.1 as required by the plugin. Frontend will use same version for consistency. | Minor — 0.4.1 vs 0.4.3 likely patch-only. `createInstance` API confirmed identical in both via DT-2 spike. |
| DEV-005 | ARCHITECTURE.md — FHEVM ACL Sepolia address | `0x339EcE85B9E11a3A3AA557582784a15d7F82AAa3` | `0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D` | Architecture had a stale ACL address. Running `getCode()` against the arch address returned `0x` (no contract). Correct address sourced from `@fhevm/mock-utils` node_modules `SepoliaConfig.ACLAddress`. Spike confirmed: code length 342, ACL is live on Sepolia. | Significant — all contracts using `TFHE.allowThis()` / ACL allowances must use the correct address in hardhat.config.ts network settings. Deploy scripts unaffected (plugin auto-configures). |
| DEV-006 | frontend/next.config.js — Turbopack vs webpack | ARCHITECTURE.md assumed Next.js 14 + webpack; `asyncWebAssembly: true` in webpack experiments | `turbopack: {}` added alongside webpack config; Turbopack has native WASM support so no explicit WASM config needed there | `create-next-app@16.2.5` generates Next.js 16 with Turbopack as default bundler. Build errors without `turbopack: {}` when webpack config is also present. | None — build compiles successfully in 3.7s, 4/4 static pages. WASM handled natively by Turbopack. Webpack config retained for explicit `--webpack` mode. |
| DEV-007 | PrivLendPool.sol — FHE.fromExternal first argument type | `FHE.fromExternal(bytes32 inputHandle, bytes calldata inputProof)` — architecture assumed raw bytes32 as first arg | `FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof)` — FHE.sol line 8624 requires typed `externalEuint128` wrapper as first arg; raw bytes32 causes "Member not found" compile error | FHE.sol defines overloads per encrypted type; `externalEuint128` is a user-defined value type with `.wrap(bytes32)` / `.unwrap()` accessors. Function signatures in contract stay as `bytes32 inputHandle` (matches relayer SDK). Only the FHE.fromExternal call sites needed wrapping. 4 occurrences fixed: deposit, borrow, repay, liquidate. | None — correct API now used. Seed script handles[0] is bytes32, wrapped at call site. |
| DEV-008 | test/PrivLendPool.test.ts — FHEVM instance creation | `import { createFhevmInstance } from "@zama-fhe/relayer-sdk"` root package import | `import hre from "hardhat"` + `hre.fhevm.createEncryptedInput(contractAddr, signer.address)` | `@zama-fhe/relayer-sdk@0.4.1` has no root `.` export. Subpath-only: `./web`, `./node`, `./bundle`. Root import causes `ERR_PACKAGE_PATH_NOT_EXPORTED` in Hardhat's CJS runtime. `hre.fhevm` injected by `@fhevm/hardhat-plugin` is the correct test API. | None — identical `RelayerEncryptedInput` interface, same `.add128()` + `.encrypt()` API, mock proofs via embedded engine. |
| DEV-009 | PrivLendPool.sol — CoprocessorConfig uninitialized | Bare `contract PrivLendPool {` with no coprocessor setup | `contract PrivLendPool is ZamaEthereumConfig {` + import from `@fhevm/solidity/config/ZamaConfig.sol` | Without `ZamaEthereumConfig`, `FHE.setCoprocessor()` never called. CoprocessorConfig slot stays zero. `FHE.fromExternal()` calls `IFHEVMExecutor(address(0)).verifyInput()` — reverts with "function returned unexpected amount of data". `ZamaEthereumConfig` reads `block.chainid` at deploy: sets local (31337), Sepolia (11155111), or Mainnet (1) addresses. | Significant — required for both local tests and Sepolia deploy. Chain-aware: same binary works everywhere, no address changes in deploy scripts. |
| DEV-010 | scripts/seed-demo.ts — FHEVM instance creation | `createFhevmInstance` from `@zama-fhe/relayer-sdk` root | `createInstance` from `@zama-fhe/relayer-sdk/node` + `SepoliaConfig` spread | Same root import problem as DEV-008 — no root export. `createFhevmInstance` is the web subpath name; node subpath exports `createInstance`. Config uses `SepoliaConfig` (canonical addresses from sdk) + `network` = RPC URL string. | None — correct API for Node.js context. Signer fallback (borrower = deployer) handles single-key testnet wallets. |
| DEV-011 | frontend/tsconfig.json — TypeScript target | ES2017 target (create-next-app default) | ES2020 target | lib/utils.ts uses BigInt literals (100n, 150n); tsc error TS2737: BigInt literals not available when targeting lower than ES2020 | None — ES2020 fully supported by all modern browsers and Node.js >= 10 |
| DEV-012 | frontend/app/globals.css — Tailwind v4 syntax | ARCHITECTURE.md assumed Tailwind v3 with tailwind.config.ts custom colors | Tailwind v4 @import "tailwindcss" + @theme {} block for custom color CSS variables | Tailwind v4 installed (create-next-app default); v4 uses CSS-native @theme directive, tailwind.config.ts is not used | None — custom colors (fhe-purple, fhe-dark, brand-500/600) correctly resolved via CSS @theme |
| DEV-013 | frontend/next.config.ts — Turbopack deadlock | ARCHITECTURE.md assumed webpack build; Turbopack expected to handle WASM | Turbopack deadlocks at "Creating an optimized production build..." with 0% CPU; `next build --webpack` CLI flag forces webpack mode | @zama-fhe/relayer-sdk/web is 1.2MB JS + 4.5MB WASM (tfhe_bg.wasm); Turbopack hangs indefinitely at optimization phase even with dynamic imports (module still traced in bundle graph). `turbopack: undefined` in next.config does NOT disable Turbopack. | Significant — all production build commands must use `next build --webpack`. Dev server unaffected (can still use Turbopack). |
| DEV-014 | frontend/lib/fhevm.ts — static import → dynamic import | Static `import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/web"` | `await import("@zama-fhe/relayer-sdk/web")` inside async functions; type via `Awaited<ReturnType<typeof getFhevmInstance>>` | Static import puts 4.5MB WASM module in Turbopack/webpack static module graph; causes build deadlock (DEV-013). Dynamic import defers loading to browser runtime. | None — SDK loaded on first FHE operation, not at module parse time. FHEVM functionality unchanged. |
| DEV-015 | frontend/package.json — build script | `"build": "next build"` (default) | `"build": "next build --webpack"` | Next.js 16 defaults to Turbopack for `next build`; `--webpack` flag explicitly selects webpack. Confirmed by reading Next.js CLI source in node_modules/next/dist/bin/next.map | Minor — build works correctly; webpack produces 6.2s compile + 4/4 static pages |
| DEV-016 | frontend/components — wagmi connectors import | `import { injected } from "wagmi/connectors"` | `import { injected } from "wagmi"` (main index re-exports injected) | `wagmi/connectors` pulls in `@wagmi/core/dist/esm/tempo/Connectors.js` which dynamically imports optional `accounts` package; webpack fails on unresolved bare specifier. `injected` is available directly from `wagmi` main index. | None — identical injected() connector behavior |
| DEV-001-CORRECTION | DEV-001 scalar mul assessment | DEV-001 claimed no scalar plaintext mul for euint128 exists | `FHE.mul(euint128 a, uint128 b)` EXISTS at FHE.sol line 6847; used in contract via implicit uint8→uint128 cast, compiles clean | Spike grep pattern was too narrow. Scalar multiply IS confirmed. `asEuint128()` wrapping NOT needed. Contract's `FHE.mul(_debt, interestBpsU8)` is correct as-is. | Corrects DEV-001 Known Risk: no workaround needed. |

## Failed Attempts & Resolutions
| Step | Error | Attempts | Resolution |
|------|-------|----------|------------|
| 1.1.a BUILD-REPORT.md write | Edit tool "String to replace not found" (empty table body matching failure) | 1 | Used Write tool (full rewrite) instead |
| 4.1.d Turbopack build | Deadlock at "Creating an optimized production build..." 0% CPU (SIGKILL after timeout) | 8 | Forced webpack mode via `next build --webpack` CLI flag; dynamic import in lib/fhevm.ts still needed for runtime safety |
| 4.1.d webpack build attempt 1 | Module not found: Can't resolve 'accounts' (wagmi/connectors Tempo connector) | 1 | Changed `import { injected } from "wagmi/connectors"` → `import { injected } from "wagmi"` (main index) |

## Verification Results
| Phase | Command | Expected | Actual | Pass? |
|-------|---------|----------|--------|-------|
| 1.1.a DT-1 spike | grep -n "scalar\|ScalarMul\|mul.*uint128[^e]" FHE.sol | Plaintext scalar mul for euint128 | ZERO MATCHES — no scalar mul exists | PASS (fallback confirmed) |
| 1.1.a DT-2 spike | cat @zama-fhe/relayer-sdk/lib/web.d.ts grep createInstance | createInstance function signature | `createInstance(config: FhevmInstanceConfig): Promise<FhevmInstance>` at line 438 | PASS |
| 1.1.a DT-5 spike | grep -n "asEuint128" FHE.sol | asEuint128 method exists | Found at line 946 | PASS |
| 1.1.a FHE.min spike | grep -n "min" FHE.sol | FHE.min exists for partial liquidation | euint128 min variant confirmed | PASS |
| 1.1.c Hardhat compile | npx hardhat compile | Nothing to compile / No errors | Nothing to compile. No need to generate any newer typings. | PASS |
| 1.2 FHEVM ACL spike | npx hardhat run scripts/spike-fhevm.ts --network sepolia | ✅ FHEVM ACL contract is live on Sepolia | Signer: 0xc211C942946011859ca634F22400d80570ED12A5 / Network: sepolia / ACL code length: 342 / ✅ FHEVM ACL contract is live on Sepolia | PASS |
| 1.3 Next.js scaffold + WASM config | cd frontend && npm run build | ✓ Compiled successfully, 4/4 static pages, asyncWebAssembly confirmed | ✓ Compiled successfully in 3.7s / 4 static pages generated / turbopack: {} + webpack asyncWebAssembly: true both present in next.config.js | PASS |
| 2.1 Contract compile | npx hardhat compile | Compiled 1 Solidity file successfully | Generating typings for: 3 artifacts in dir: typechain-types for target: ethers-v6 / Successfully generated 28 typings\! / Compiled 2 Solidity files successfully (evm target: paris). | PASS |
| 2.2 All 8 tests | npx hardhat test | 7+ passing | PrivLendPool: ✔ Test 1 / ✔ Test 2 / ✔ Test 3 / ✔ Test 4 / ✔ Test 5 / ✔ Test 6 / ✔ Test 7 / ✔ Test 8 — 8 passing (174ms) | PASS |

## Phase 3 Verification Results
| Phase | Command | Expected | Actual | Pass? |
|-------|---------|----------|--------|-------|
| 3.1 Deploy | `npx hardhat run scripts/deploy.ts --network sepolia` | Address printed | `PrivLendPool deployed to: 0xbC411fc4D05c76fbf607a49E0b454e16342406Cb` / Explorer link printed | PASS |
| 3.2 Sourcify verify | `npx hardhat verify --network sepolia 0xbC411fc4...` | Verified on Sourcify | `Successfully verified contract PrivLendPool on Sourcify. https://repo.sourcify.dev/...` (Etherscan skipped: no API key) | PASS |
| 3.2 Code live | `getCode(0xbC411fc4...)` | Code length > 0 | Code length: 13916 | PASS |
| 3.3 Lend txs | `seed-demo.ts [1/3]` (3 runs) | Pool has liquidity | 3 lend txs confirmed on-chain: 0.18 ETH total | PASS |

## Phase 4 Verification Results
| Phase | Command | Expected | Actual | Pass? |
|-------|---------|----------|--------|-------|
| 4.1 TypeScript | `cd frontend && npx tsc --noEmit` | 0 errors | 0 errors, 0 warnings | PASS |
| 4.1 Production build gate | `cd frontend && npx next build --webpack` | exit 0 | ⚠ Compiled with warnings in 6.2s / TypeScript 14.5s / 4/4 static pages / exit 0 | PASS |

## Known Risks (for debug)
- ~~DEV-001: asEuint128 wrapping required~~ CORRECTED: `FHE.mul(euint128, uint128)` confirmed at FHE.sol line 6847. Scalar mul works natively.
- RPC fallback: rpc.sepolia.org is DOWN — use https://ethereum-sepolia-rpc.publicnode.com in all deploy scripts and .env.
- WASM: asyncWebAssembly: true must be in next.config.js before ANY frontend test — omitting causes silent import failure of @zama-fhe/relayer-sdk/web.
- Interest BPS cap: uint8 max 255; interestBpsU8 capped at line 108. Interest > 2.55% per block silently caps.
- FHE.div not exercised by mock tests — repay path uses FHE.div(interestFraction, uint128(BPS)). Tests pass (block delta=0 so interest=0), but non-zero accrual path untested. Confirm on Sepolia.
- ZamaEthereumConfig constructor fires before any FHE op (MRO order); safe for both local and Sepolia deploy.
- Seed collateral+borrow txs skipped: deployer wallet exhausted during seed-demo runs (multiple failed attempts burned gas). Pool has 0.18 ETH lend liquidity but no borrower position seeded. Demo video should show fresh FHE deposit flow from UI rather than pre-seeded state.
- DEV-013: Production builds MUST use `next build --webpack` — Turbopack deadlocks on WASM module. Dev server still uses Turbopack (fast dev experience unaffected).
- Webpack circular dependency warnings: "Circular dependency between chunks with runtime (webpack, 403, 784)" and "(63, webpack-runtime, 444)" — these are wagmi/viem internal chunk graph cycles, non-breaking, produce warnings not errors.
- usePosition.ts decryptPosition: full decrypt flow stubbed with `throw new Error(...)`. HealthPanel.tsx has the working checkHealth pattern. userDecrypt pattern needs gateway URL and real handle retrieval — implement in Phase 5.
- Etherscan verification skipped (no API key in .env). Sourcify verified instead — full source match at https://repo.sourcify.dev/.../0xbC411fc4...

## Contract Addresses
| Contract | Network | Address | Tx Hash |
|----------|---------|---------|---------|
| PrivLendPool | Sepolia (11155111) | `0xbC411fc4D05c76fbf607a49E0b454e16342406Cb` | `0x6f370735c2457989f7c71e6e2751578ebffd79d78eaa1984ede5b54c4ea15d0c` |

Sourcify: https://repo.sourcify.dev/contracts/full_match/11155111/0xbC411fc4D05c76fbf607a49E0b454e16342406Cb/

## Phase 3 Demo Transactions
| Step | Tx Hash | Description |
|------|---------|-------------|
| Lend #1 | `0x9437383ac4c7e6365da0717798d34d812ce81c3cfc05ce91263208a8709a4947` | 0.1 ETH lend (seed run 1) |
| Lend #2 | `0x6782c8bd80129b5051aec15cd471ee6560e710268ff6d4fbbc6a7f0ff58abbc6` | 0.04 ETH lend (seed run 2) |
| Lend #3 | `0x4f5945c368bc0fb25e7f3527cc8568ce0d07dd75211f095e5154d24ad3f9d955` | 0.04 ETH lend (seed run 3) |

## Environment Variables Added
| Key | Source Step | Value/Description |
|-----|-------------|-------------------|
| `PRIVLEND_POOL_ADDRESS` | 3.1 deploy | `0xbC411fc4D05c76fbf607a49E0b454e16342406Cb` |
