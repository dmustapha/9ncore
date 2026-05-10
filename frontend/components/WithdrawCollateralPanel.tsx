"use client";

import { useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { parseEther, formatEther } from "viem";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { useSepoliaWrite } from "@/hooks/useSepoliaWrite";
import FHEProgress from "./FHEProgress";

export default function WithdrawCollateralPanel() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { writeContractAsync } = useSepoliaWrite();

  const contract = { address: CONTRACT_ADDRESS, abi: PRIVLEND_ABI } as const;
  const { data: posData, refetch } = useReadContracts({
    contracts: [
      { ...contract, functionName: "collateralETH", args: address ? [address] : undefined },
      { ...contract, functionName: "hasBorrowPosition", args: address ? [address] : undefined },
    ],
    query: { enabled: !!address, refetchInterval: 10_000 },
  });
  const collateralWei = posData?.[0]?.result as bigint | undefined;
  const hasDebt = posData?.[1]?.result as boolean | undefined;

  async function handleWithdraw() {
    if (!amount || !address) return;
    setError(null);
    const amountWei = parseEther(amount);
    if (collateralWei !== undefined && amountWei > collateralWei) {
      setError(`Exceeds deposited collateral (${Number(formatEther(collateralWei)).toFixed(4)} ETH available).`);
      return;
    }
    if (amountWei <= 0n) {
      setError("Amount must be greater than zero.");
      return;
    }
    try {
      setStatus("submitting");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PRIVLEND_ABI,
        functionName: "withdrawCollateral",
        args: [amountWei],
      });
      setTxHash(hash);
      setStatus("done");
      setAmount("");
      refetch();
    } catch (e: any) {
      setError((e as any).shortMessage ?? e.message ?? "Withdrawal failed");
      setStatus("idle");
    }
  }

  const isBlocked = hasDebt === true;

  return (
    <div className="panel">
      <FHEProgress active={status === "submitting"} message="Processing collateral withdrawal..." />

      <div className="panel-label">COLLATERAL WITHDRAWAL</div>
      <h3 className="text-[#E8EAF0] font-bold text-lg mb-4">Withdraw Collateral</h3>

      {collateralWei !== undefined && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-[#9CA3AF] text-xs">Available collateral</span>
          <div className="flex items-center gap-2">
            <span className="text-teal-soft text-xs font-mono font-semibold">
              {Number(formatEther(collateralWei)).toFixed(4)} ETH
            </span>
            {collateralWei > 0n && !isBlocked && (
              <button
                onClick={() => setAmount(formatEther(collateralWei))}
                className="text-teal text-xs underline hover:no-underline"
              >
                Max
              </button>
            )}
          </div>
        </div>
      )}

      {isBlocked && (
        <div className="mb-4 p-3 bg-[rgba(239,68,68,0.06)] rounded-md border border-[rgba(239,68,68,0.18)]">
          <p className="text-[#EF4444] text-xs leading-relaxed">
            Active debt detected. Repay your loan fully before withdrawing collateral.
          </p>
        </div>
      )}

      <label className="text-[#9CA3AF] text-xs block mb-2">ETH Amount to Withdraw</label>
      <input
        type="number"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={isBlocked}
        className="field-input mb-4 disabled:opacity-40"
      />

      <button
        onClick={handleWithdraw}
        disabled={status !== "idle" || !address || !amount || isBlocked}
        className="w-full bg-teal hover:bg-teal/90 text-void font-bold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "idle" && "Withdraw Collateral"}
        {status === "submitting" && "Submitting..."}
        {status === "done" && "Withdrawn"}
      </button>

      {txHash && (
        <div className="mt-3 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M10 3L5 8.5 2 5.5" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[#4ADE80] text-xs font-mono">Withdrawn:</span>
          <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
            className="text-teal-soft text-xs font-mono underline hover:text-teal transition-colors">
            {txHash.slice(0, 10)}...{txHash.slice(-6)}
          </a>
        </div>
      )}
      {error && <p className="text-[#EF4444] text-sm mt-3 break-words">{error}</p>}
    </div>
  );
}
