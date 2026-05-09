"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { useSepoliaWrite } from "@/hooks/useSepoliaWrite";
import FHEProgress from "./FHEProgress";

export default function HealthPanel() {
  const { address } = useAccount();
  const [targetAddress, setTargetAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { writeContractAsync } = useSepoliaWrite();

  async function handleCheckHealth() {
    const target = targetAddress || address;
    if (!target) return;
    setError(null);

    try {
      setStatus("checking");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PRIVLEND_ABI,
        functionName: "checkHealth",
        args: [target as `0x${string}`],
      });
      setTxHash(hash);
      setStatus("done");
    } catch (e: any) {
      setError(e.message ?? "Health check failed");
      setStatus("error");
    }
  }

  return (
    <div className="panel">
      <FHEProgress
        active={status === "checking"}
        message="Computing encrypted health ratio via FHE.ge..."
      />

      <div className="panel-label">RISK MONITORING</div>
      <h3 className="text-[#E8EAF0] font-bold text-lg mb-4">Health Check</h3>

      <label className="text-[#9CA3AF] text-xs block mb-2">Address (leave blank for self)</label>
      <input
        type="text"
        placeholder="0x... or leave blank"
        value={targetAddress}
        onChange={(e) => setTargetAddress(e.target.value)}
        className="field-input mb-4 font-mono text-sm"
      />

      <button
        onClick={handleCheckHealth}
        disabled={status === "checking" || !address}
        className="w-full bg-teal hover:bg-teal/90 text-void font-bold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "checking" ? "Computing FHE Health..." : "Check Health"}
      </button>

      {status === "done" && txHash && (
        <div className="mt-3 flex items-center gap-2 mb-2">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M10 3L5 8.5 2 5.5" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[#4ADE80] text-xs font-mono">Computed —{" "}</span>
          <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
            className="text-teal-soft text-xs font-mono underline hover:text-teal transition-colors">
            {txHash.slice(0, 10)}...{txHash.slice(-6)}
          </a>
        </div>
      )}
      {status === "done" && (
        <div className="mt-1 p-4 bg-[rgba(45,212,191,0.05)] rounded-lg border border-[rgba(45,212,191,0.12)]">
          <p className="text-[#4ADE80] text-sm font-semibold font-mono">
            Health check computed on-chain.
          </p>
          <p className="text-[#9CA3AF] text-xs mt-2 leading-relaxed">
            Liquidator: use your wallet to call userDecrypt on the health flag handle (from HealthChecked event) to see true/false.
          </p>
          <p className="text-[#9CA3AF] text-xs mt-1 leading-relaxed">
            Borrower: call userDecrypt on the healthNumerator handle to get collateral×100, then divide by your decrypted debt.
          </p>
        </div>
      )}

      {error && <p className="text-[#EF4444] text-sm mt-3 break-words">{error}</p>}
    </div>
  );
}
