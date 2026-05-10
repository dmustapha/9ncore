"use client";

import { useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { parseUnits } from "viem";
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

  // plainDebt and maxBorrowable are both in USDC units (6 decimals)
  const plainDebtUnits  = posData?.[0]?.result as bigint | undefined;
  const maxBorrowUnits  = posData?.[1]?.result as bigint | undefined;

  const fmtUsdc = (units: bigint) => "$" + (Number(units) / 1e6).toFixed(2);

  async function handleBorrow() {
    if (!amount || !address) return;
    setError(null);

    let amountUnits: bigint;
    try {
      amountUnits = parseUnits(amount, 6); // USDC 6 decimals
    } catch {
      setError("Invalid amount. Enter a valid number with up to 6 decimal places.");
      return;
    }
    if (amountUnits <= 0n) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (maxBorrowUnits !== undefined && amountUnits > maxBorrowUnits) {
      setError(`Exceeds max borrowable (${fmtUsdc(maxBorrowUnits)}). Deposit more ETH collateral first.`);
      return;
    }

    try {
      setStatus("encrypting");
      const { handles, inputProof } = await encryptUint128(
        CONTRACT_ADDRESS,
        address,
        amountUnits // encrypt the USDC units value
      );

      setStatus("submitting");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PRIVLEND_ABI,
        functionName: "borrow",
        args: [handles[0], inputProof, amountUnits],
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
            ? "Encrypting borrow amount with FHE..."
            : "Submitting borrow transaction..."
        }
      />

      <div className="flex items-center justify-between mb-1">
        <div className="panel-label">DEBT POSITION</div>
        <span className="badge-enc">● DEBT ENCRYPTED</span>
      </div>
      <h3 className="text-[#E8EAF0] font-bold text-lg mb-4">Borrow USDC</h3>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="bg-[rgba(45,212,191,0.05)] rounded-md px-3 py-2 border border-[rgba(45,212,191,0.12)]">
          <div className="panel-label" style={{ fontSize: "0.6rem" }}>Interest Rate</div>
          <div className="font-mono text-teal text-sm font-semibold">5% APR</div>
        </div>
        <div className="bg-[rgba(45,212,191,0.05)] rounded-md px-3 py-2 border border-[rgba(45,212,191,0.12)]">
          <div className="panel-label" style={{ fontSize: "0.6rem" }}>Min Collateral Ratio</div>
          <div className="font-mono text-teal text-sm font-semibold">150%</div>
        </div>
        <div className="bg-[rgba(45,212,191,0.05)] rounded-md px-3 py-2 border border-[rgba(45,212,191,0.12)]">
          <div className="panel-label" style={{ fontSize: "0.6rem" }}>ETH Price (Fixed)</div>
          <div className="font-mono text-teal text-sm font-semibold">$2,000</div>
        </div>
        {maxBorrowUnits !== undefined && (
          <div className="bg-[rgba(45,212,191,0.05)] rounded-md px-3 py-2 border border-[rgba(45,212,191,0.12)]">
            <div className="panel-label" style={{ fontSize: "0.6rem" }}>Max Borrowable</div>
            <div className="font-mono text-teal text-sm font-semibold">{fmtUsdc(maxBorrowUnits)}</div>
          </div>
        )}
        {plainDebtUnits !== undefined && plainDebtUnits > 0n && (
          <div className="bg-[rgba(239,68,68,0.05)] rounded-md px-3 py-2 border border-[rgba(239,68,68,0.12)]">
            <div className="panel-label" style={{ fontSize: "0.6rem" }}>Outstanding Debt</div>
            <div className="font-mono text-[#EF4444] text-sm font-semibold">{fmtUsdc(plainDebtUnits)}</div>
          </div>
        )}
      </div>

      <label className="text-[#9CA3AF] text-xs block mb-2">USDC Amount to Borrow</label>
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
        {status === "idle" && "Borrow USDC"}
        {status === "encrypting" && "Encrypting..."}
        {status === "submitting" && "Submitting..."}
        {status === "done" && "Borrow More"}
      </button>

      <p className="text-[#4B5563] text-xs mt-2 font-mono">
        Keep your collateral ratio above 150% to avoid liquidation.
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
