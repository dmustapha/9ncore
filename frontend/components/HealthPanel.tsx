"use client";

import { useState } from "react";
import { useWriteContract, useAccount } from "wagmi";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import FHEProgress from "./FHEProgress";

export default function HealthPanel() {
  const { address } = useAccount();
  const [targetAddress, setTargetAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const { writeContractAsync } = useWriteContract();

  async function handleCheckHealth() {
    const target = targetAddress || address;
    if (!target) return;
    setError(null);

    try {
      setStatus("checking");

      // Trigger FHE health check computation on-chain
      // This will: compute ebool (for caller) + euint128 numerator (for borrower)
      // and emit HealthChecked event
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PRIVLEND_ABI,
        functionName: "checkHealth",
        args: [target as `0x${string}`],
      });

      setStatus("done");
    } catch (e: any) {
      setError(e.message ?? "Health check failed");
      setStatus("error");
    }
  }

  return (
    <div className="bg-fhe-dark/60 border border-orange-500/20 rounded-2xl p-6">
      <FHEProgress
        active={status === "checking"}
        message="Computing encrypted health ratio via FHE.ge..."
      />

      <div className="flex items-center gap-2 mb-4">
        <span className="text-orange-400 text-2xl">🏥</span>
        <h3 className="text-white font-bold text-lg">Health Check</h3>
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Liquidators: check if a position is healthy (ebool — boolean result only).
        Borrowers: your health numerator is stored encrypted for your eyes only.
      </p>

      <input
        type="text"
        placeholder="Borrower address (or leave blank for self)"
        value={targetAddress}
        onChange={(e) => setTargetAddress(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 mb-4 focus:outline-none focus:border-orange-500 font-mono text-sm"
      />

      <button
        onClick={handleCheckHealth}
        disabled={status === "checking" || !address}
        className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {status === "checking" ? "Computing FHE Health..." : "Check Health"}
      </button>

      {status === "done" && (
        <div className="mt-4 p-4 bg-white/5 rounded-lg">
          <p className="text-green-400 text-sm font-medium">
            Health check computed on-chain.
          </p>
          <p className="text-gray-400 text-xs mt-1">
            If you are the liquidator: use your wallet to call userDecrypt on the
            health flag handle (returned from the HealthChecked event) to see
            true/false.
          </p>
          <p className="text-gray-400 text-xs mt-1">
            If you are the borrower: call userDecrypt on the healthNumerator handle
            to get collateral×100, then divide by your decrypted debt for the ratio.
          </p>
        </div>
      )}

      {error && <p className="text-red-400 text-sm mt-3 break-words">{error}</p>}
    </div>
  );
}
