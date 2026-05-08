"use client";

import { useState } from "react";
import { useWriteContract, useAccount } from "wagmi";
import { parseEther } from "viem";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { encryptUint128 } from "@/lib/fhevm";
import FHEProgress from "./FHEProgress";

export default function DepositPanel() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "encrypting" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const { writeContractAsync } = useWriteContract();

  async function handleDeposit() {
    if (!amount || !address) return;
    setError(null);

    try {
      // Step 1: Encrypt the amount
      setStatus("encrypting");
      const amountWei = parseEther(amount);
      const { handles, inputProof } = await encryptUint128(
        CONTRACT_ADDRESS,
        address,
        amountWei
      );

      // Step 2: Submit transaction
      setStatus("submitting");
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PRIVLEND_ABI,
        functionName: "deposit",
        args: [handles[0], inputProof],
        value: amountWei,
      });

      setStatus("done");
      setAmount("");
    } catch (e: any) {
      setError(e.message ?? "Deposit failed");
      setStatus("idle");
    }
  }

  return (
    <div className="bg-fhe-dark/60 border border-fhe-purple/20 rounded-2xl p-6">
      <FHEProgress
        active={status === "encrypting" || status === "submitting"}
        message={
          status === "encrypting"
            ? "Encrypting collateral amount with FHE..."
            : "Submitting encrypted deposit to Sepolia..."
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <span className="text-fhe-purple text-2xl">🛡</span>
        <h3 className="text-white font-bold text-lg">Deposit Collateral</h3>
        <span className="text-xs bg-fhe-purple/20 text-fhe-purple px-2 py-0.5 rounded-full">
          Encrypted
        </span>
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Your collateral amount is encrypted — no one can see your position balance.
      </p>

      <input
        type="number"
        placeholder="0.2"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 mb-4 focus:outline-none focus:border-fhe-purple"
      />

      <button
        onClick={handleDeposit}
        disabled={status !== "idle" || !address || !amount}
        className="w-full bg-fhe-purple hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {status === "idle" && "Deposit (Encrypted)"}
        {status === "encrypting" && "Encrypting..."}
        {status === "submitting" && "Submitting..."}
        {status === "done" && "Deposited!"}
      </button>

      {status === "done" && (
        <p className="text-green-400 text-sm mt-3 text-center">
          Collateral deposited. Encrypted on-chain.
        </p>
      )}
      {error && (
        <p className="text-red-400 text-sm mt-3 break-words">{error}</p>
      )}
    </div>
  );
}
