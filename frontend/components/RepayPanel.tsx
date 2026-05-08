"use client";

import { useState } from "react";
import { useWriteContract, useAccount } from "wagmi";
import { parseEther } from "viem";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { encryptUint128 } from "@/lib/fhevm";
import FHEProgress from "./FHEProgress";

export default function RepayPanel() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "encrypting" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const { writeContractAsync } = useWriteContract();

  async function handleRepay() {
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
        functionName: "repay",
        args: [handles[0], inputProof],
        value: amountWei,
      });

      setStatus("done");
      setAmount("");
    } catch (e: any) {
      setError(e.message ?? "Repay failed");
      setStatus("idle");
    }
  }

  return (
    <div className="bg-fhe-dark/60 border border-green-500/20 rounded-2xl p-6">
      <FHEProgress
        active={status === "encrypting" || status === "submitting"}
        message="Processing repayment with interest calculation..."
      />

      <div className="flex items-center gap-2 mb-4">
        <span className="text-green-400 text-2xl">✅</span>
        <h3 className="text-white font-bold text-lg">Repay Loan</h3>
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Interest accrues in encrypted state. FHE.add computes total debt on-chain.
      </p>

      <input
        type="number"
        placeholder="0.1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 mb-4 focus:outline-none focus:border-green-500"
      />

      <button
        onClick={handleRepay}
        disabled={status !== "idle" || !address || !amount}
        className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {status === "idle" && "Repay Loan"}
        {status === "encrypting" && "Encrypting..."}
        {status === "submitting" && "Submitting..."}
        {status === "done" && "Repaid!"}
      </button>

      {error && <p className="text-red-400 text-sm mt-3 break-words">{error}</p>}
    </div>
  );
}
