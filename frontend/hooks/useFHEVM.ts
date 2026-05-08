"use client";

import { useState, useEffect, useCallback } from "react";
import { getFhevmInstance, resetFhevmInstance } from "@/lib/fhevm";
// DEV-011/DEV-014: Use type-only import via dynamic import pattern to avoid static bundling
type FhevmInstance = Awaited<ReturnType<typeof getFhevmInstance>>;

export type FHEVMStatus = "idle" | "initializing" | "ready" | "error";

export function useFHEVM(walletAddress?: string) {
  const [status, setStatus] = useState<FHEVMStatus>("idle");
  const [instance, setInstance] = useState<FhevmInstance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const init = useCallback(async () => {
    if (!walletAddress) return;
    setStatus("initializing");
    setError(null);
    try {
      const inst = await getFhevmInstance();
      setInstance(inst);
      setStatus("ready");
    } catch (e: any) {
      setError(e.message ?? "FHEVM init failed");
      setStatus("error");
    }
  }, [walletAddress]);

  useEffect(() => {
    init();
    return () => resetFhevmInstance();
  }, [init]);

  return { status, instance, error, retry: init };
}
