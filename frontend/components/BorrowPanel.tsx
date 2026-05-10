"use client";

import { useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { parseEther, formatEther } from "viem";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { encryptUint128 } from "@/lib/fhevm";
import { useSepoliaWrite } from "@/hooks/useSepoliaWrite";
import FHEProgress from "./FHEProgress";

export default function BorrowPanel() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "encrypting" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { writeContractAsync } = useSepoliaWrite();

  const contract = { address: CONTRACT_ADDRESS, abi: PRIVLEND_ABI } as const;
  const { data: posData, refetch: refetchPos } = useReadContracts({
    contracts: [
      { ...contract, functionName: "plainDebt", args: address ? [address] : undefined },
      { ...contract, functionName: "maxBorrowable", args: address ? [address] : undefined },
    ],
    query: { enabled: !!address, refetchInterval: 10_000 },
  });
  const plainDebtWei = posData?.[0]?.result as bigint | undefined;
  const maxBorrowWei = posData?.[1]?.result as bigint | undefined;

  async function handleBorrow() {
    if (!amount || !address) return;
    setError(null);

    const amountWei = parseEther(amount);
    if (maxBorrowWei !== undefined && amountWei > maxBorrowWei) {
      setError(`Exceeds max borrowable (${Number(formatEther(maxBorrowWei)).toFixed(4)} ETH). Deposit more collateral first.`);
      return;
    }
    if (amountWei <= 0n) {
      setError("Amount must be greater than zero.");
      return;
    }

    try {
      setStatus("encrypting");
      const { handles, inputProof } = await encryptUint128(
        CONTRACT_ADDRESS,
        address,
        amountWei
      );

      setStatus("submitting");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PRIVLEND_ABI,
        functionName: "borrow",
        args: [handles[0], inputProof, amountWei],
      });

      setTxHash(hash);
      setStatus("done");
      setAmount("");
      refetchPos();
    } catch (e: any) {
      setError((e as any).shortMessage ?? e.message ?? "Borrow failed");
      setStatus("idle");
    }
  }

  return (
    <div className="panel">
      <FHEProgress
        active={status === "encrypting" || status === "submitting"}
        message={
          status === "encrypting"
            ? "Encrypting borrow amount..."
            : "Submitting borrow transaction..."
        }
      />

      <div className="flex items-center justify-between mb-1">
        <div className="panel-label">DEBT POSITION</div>
        <span className="badge-enc">● DEBT ENCRYPTED</span>
      </div>
      <h3 className="text-[#E8EAF0] font-bold text-lg mb-4">Borrow ETH</h3>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="bg-[rgba(45,212,191,0.05)] rounded-md px-3 py-2 border border-[rgba(45,212,191,0.12)]">
          <div className="panel-label" style={{ fontSize: "0.6rem" }}>Interest Rate</div>
          <div className="font-mono text-teal text-sm font-semibold">5% APR</div>
        </div>
        <div className="bg-[rgba(45,212,191,0.05)] rounded-md px-3 py-2 border border-[rgba(45,212,191,0.12)]">
          <div className="panel-label" style={{ fontSize: "0.6rem" }}>Min Collateral Ratio</div>
          <div className="font-mono text-teal text-sm font-semibold">150%</div>
        </div>
        {maxBorrowWei !== undefined && (
          <div className="bg-[rgba(45,212,191,0.05)] rounded-md px-3 py-2 border border-[rgba(45,212,191,0.12)]">
            <div className="panel-label" style={{ fontSize: "0.6rem" }}>Max Borrowable</div>
            <div className="font-mono text-teal text-sm font-semibold">{Number(formatEther(maxBorrowWei)).toFixed(4)} ETH</div>
          </div>
        )}
        {plainDebtWei !== undefined && plainDebtWei > 0n && (
          <div className="bg-[rgba(239,68,68,0.05)] rounded-md px-3 py-2 border border-[rgba(239,68,68,0.12)]">
            <div className="panel-label" style={{ fontSize: "0.6rem" }}>Outstanding Debt</div>
            <div className="font-mono text-[#EF4444] text-sm font-semibold">{Number(formatEther(plainDebtWei)).toFixed(4)} ETH</div>
          </div>
        )}
      </div>

      <label className="text-[#9CA3AF] text-xs block mb-2">ETH Amount to Borrow</label>
      <input
        type="number"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="field-input mb-4"
      />

      <button
        onClick={handleBorrow}
        disabled={(status === "encrypting" || status === "submitting") || !address || !amount}
        className="w-full bg-teal hover:bg-teal/90 text-void font-bold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "idle" && "Borrow ETH"}
        {status === "encrypting" && "Encrypting..."}
        {status === "submitting" && "Submitting..."}
        {status === "done" && "Borrow More"}
      </button>

      <p className="text-[#4B5563] text-xs mt-2 font-mono">
        Ensure collateral ratio stays above 150% to avoid liquidation threshold.
      </p>

      {txHash && (
        <div className="mt-3 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M10 3L5 8.5 2 5.5" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[#4ADE80] text-xs font-mono">Borrowed:</span>
          <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
            className="text-teal-soft text-xs font-mono underline hover:text-teal transition-colors">
            {txHash.slice(0, 10)}...{txHash.slice(-6)}
          </a>
        </div>
      )}
      {error && (
        <p className="text-[#EF4444] text-sm mt-3 break-words">{error}</p>
      )}
    </div>
  );
}
