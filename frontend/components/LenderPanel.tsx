"use client";

import { useState } from "react";
import { useWriteContract, useAccount } from "wagmi";
import { parseEther } from "viem";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import FHEProgress from "./FHEProgress";

export default function LenderPanel() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"lend" | "withdraw">("lend");
  const { writeContract, isPending, isSuccess, error } = useWriteContract();

  function handleLend() {
    if (!amount || !address) return;
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: PRIVLEND_ABI,
      functionName: "lend",
      value: parseEther(amount),
    });
  }

  function handleWithdraw() {
    if (!amount || !address) return;
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: PRIVLEND_ABI,
      functionName: "withdrawLiquidity",
      args: [parseEther(amount)],
    });
  }

  return (
    <div className="bg-fhe-dark/60 border border-brand-500/20 rounded-2xl p-6">
      <FHEProgress active={isPending} message="Submitting liquidity transaction..." />
      <h3 className="text-white font-bold text-lg mb-4">Lending Pool</h3>

      <div className="flex gap-2 mb-4">
        {(["lend", "withdraw"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m
                ? "bg-brand-500 text-white"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            {m === "lend" ? "Add Liquidity" : "Withdraw"}
          </button>
        ))}
      </div>

      <input
        type="number"
        placeholder="0.1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 mb-4 focus:outline-none focus:border-brand-500"
      />

      <button
        onClick={mode === "lend" ? handleLend : handleWithdraw}
        disabled={isPending || !address || !amount}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {isPending ? "Processing..." : mode === "lend" ? "Add Liquidity" : "Withdraw ETH"}
      </button>

      {isSuccess && (
        <p className="text-green-400 text-sm mt-3 text-center">Transaction confirmed</p>
      )}
      {error && (
        <p className="text-red-400 text-sm mt-3 text-center truncate">{error.message}</p>
      )}
    </div>
  );
}
