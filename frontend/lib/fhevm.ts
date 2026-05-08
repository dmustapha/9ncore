"use client";

// DEV-014: Static import of @zama-fhe/relayer-sdk/web causes Turbopack production build deadlock
// (1.2MB JS + 4.5MB WASM = Turbopack hangs at optimization phase with 0% CPU).
// Fix: dynamic import inside async functions → removed from static module graph.
// SDK is only loaded in browser at runtime, never analyzed by Turbopack at build time.

type FhevmInstanceType = import("@zama-fhe/relayer-sdk/web").FhevmInstance;

let _instance: FhevmInstanceType | null = null;
let _initPromise: Promise<FhevmInstanceType> | null = null;

/**
 * Get or create a singleton FHEVM instance for browser use.
 * Uses SepoliaConfig canonical addresses.
 */
export async function getFhevmInstance(): Promise<FhevmInstanceType> {
  if (_instance) return _instance;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const { createInstance, SepoliaConfig } = await import(
      // @ts-ignore — dynamic import prevents Turbopack static analysis of WASM module
      "@zama-fhe/relayer-sdk/web"
    );
    const inst = await createInstance({
      ...SepoliaConfig,
      network: process.env.NEXT_PUBLIC_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
    });
    _instance = inst;
    return inst;
  })();

  return _initPromise;
}

/**
 * Encrypt a uint128 amount for a contract call.
 * Returns { handles: bytes32[], inputProof: Uint8Array }
 */
export async function encryptUint128(
  contractAddress: string,
  userAddress: string,
  amountWei: bigint
): Promise<{ handles: `0x${string}`[]; inputProof: `0x${string}` }> {
  const instance = await getFhevmInstance();

  const input = await instance.createEncryptedInput(contractAddress, userAddress);
  input.add128(amountWei);

  const { handles, inputProof } = await input.encrypt();

  return {
    handles: handles.map((h: any) =>
      typeof h === "string" ? (h as `0x${string}`) : `0x${Buffer.from(h).toString("hex")}`
    ) as `0x${string}`[],
    inputProof: typeof inputProof === "string"
      ? (inputProof as `0x${string}`)
      : `0x${Buffer.from(inputProof).toString("hex")}`,
  };
}

/** Reset instance (useful for wallet disconnects) */
export function resetFhevmInstance(): void {
  _instance = null;
  _initPromise = null;
}
