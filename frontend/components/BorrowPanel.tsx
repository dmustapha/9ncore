"use client";

import { useState } from "react";
import { useWriteContract, useAccount } from "wagmi";
import { parseEther } from "viem";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { encryptUint128 } from "@/lib/fhevm";
import FHEProgress from "./FHEProgress";

export default function BorrowPanel() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "encrypting" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const { writeContractAsync } = useWriteContract();

  async function handleBorrow() {
    if (!amount || !address) return;
    setError(null);

    try {
      setStatus("encrypting");
      const amountWei = parseEther(amount);
      const { handles, inputProof } = await encryptUint128(
        CONTRACT_ADDRESS,
        address,
        amountWei
      );

      setStatus("submitting");
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PRIVLEND_ABI,
        functionName: "borrow",
        args: [handles[0], inputProof, amountWei],
      });

      setStatus("done");
      setAmount("");
    } catch (e: any) {
      setError(e.message ?? "Borrow failed");
      setStatus("idle");
    }
  }

  return (
    <div className="bg-fhe-dark/60 border border-yellow-500/20 rounded-2xl p-6">
      <FHEProgress
        active={status === "encrypting" || status === "submitting"}
        message={
          status === "encrypting"
            ? "Encrypting borrow amount..."
            : "Submitting borrow transaction..."
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <span className="text-yellow-400 text-2xl">💸</span>
        <h3 className="text-white font-bold text-lg">Borrow ETH</h3>
        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
          Debt Encrypted
        </span>
      </div>

      <p className="text-gray-400 text-sm mb-4">
        5% APR. Your total debt balance stays encrypted. 150% collateral ratio required.
      </p>

      <input
        type="number"
        placeholder="0.1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 mb-4 focus:outline-none focus:border-yellow-500"
      />

      <button
        onClick={handleBorrow}
        disabled={status !== "idle" || !address || !amount}
        className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {status === "idle" && "Borrow ETH"}
        {status === "encrypting" && "Encrypting..."}
        {status === "submitting" && "Submitting..."}
        {status === "done" && "Borrowed!"}
      </button>

      {error && (
        <p className="text-red-400 text-sm mt-3 break-words">{error}</p>
      )}
    </div>
  );
}
