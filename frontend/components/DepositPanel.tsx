"use client";

import { useState } from "react";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import { parseEther, formatEther } from "viem";
import { useSepoliaWrite } from "@/hooks/useSepoliaWrite";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { encryptUint128 } from "@/lib/fhevm";
import { formatUSDC } from "@/lib/utils";
import FHEProgress from "./FHEProgress";

export default function DepositPanel() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "encrypting" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { writeContractAsync } = useSepoliaWrite();
  const { data: walletBalance } = useBalance({ address, query: { enabled: !!address } });

  const contract = { address: CONTRACT_ADDRESS, abi: PRIVLEND_ABI } as const;
  const { data: posData, refetch: refetchPos } = useReadContracts({
    contracts: [
      { ...contract, functionName: "collateralETH", args: address ? [address] : undefined },
      { ...contract, functionName: "maxBorrowable", args: address ? [address] : undefined },
    ],
    query: { enabled: !!address, refetchInterval: 10_000 },
  });
  const collateralWei = posData?.[0]?.result as bigint | undefined;
  const maxBorrowUsdc = posData?.[1]?.result as bigint | undefined; // USDC units (6 dec)

  async function handleDeposit() {
    if (!amount || !address) return;
    setError(null);

    const amountWei = parseEther(amount);
    if (amountWei <= 0n) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (walletBalance && amountWei > walletBalance.value) {
      setError(`Insufficient wallet balance (${Number(walletBalance.value / 10n ** 15n) / 1000} ETH available).`);
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
        functionName: "deposit",
        args: [handles[0], inputProof],
        value: amountWei,
      });

      setTxHash(hash);
      setStatus("done");
      setAmount("");
      refetchPos();
    } catch (e: any) {
      setError((e as any).shortMessage ?? e.message ?? "Deposit failed");
      setStatus("idle");
    }
  }

  return (
    <div className="panel">
      <FHEProgress
        active={status === "encrypting" || status === "submitting"}
        message={
          status === "encrypting"
            ? "Encrypting collateral amount with FHE..."
            : "Submitting encrypted deposit to Sepolia..."
        }
      />

      <div className="flex items-center justify-between mb-1">
        <div className="panel-label">COLLATERAL</div>
        <span className="badge-enc">● ENCRYPTED</span>
      </div>
      <h3 className="text-[#E8EAF0] font-bold text-lg mb-4">Deposit Collateral</h3>

      {address && (
        <div className="flex gap-4 mb-3 text-xs font-mono flex-wrap">
          {walletBalance && (
            <span className="text-[#9CA3AF]">
              Wallet: <span className="text-teal-soft">{Number(walletBalance.value / 10n ** 15n) / 1000} ETH</span>
            </span>
          )}
          {collateralWei !== undefined && (
            <span className="text-[#9CA3AF]">
              Deposited: <span className="text-teal-soft">{Number(formatEther(collateralWei)).toFixed(4)} ETH</span>
            </span>
          )}
          {maxBorrowUsdc !== undefined && (
            <span className="text-[#9CA3AF]">
              Max borrow: <span className="text-teal-soft">{formatUSDC(maxBorrowUsdc)} USDC</span>
            </span>
          )}
        </div>
      )}
      <label className="text-[#9CA3AF] text-xs block mb-2">ETH Amount</label>
      <input
        type="number"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="field-input mb-4"
      />

      <button
        onClick={handleDeposit}
        disabled={(status === "encrypting" || status === "submitting") || !address || !amount}
        className="w-full bg-teal hover:bg-teal/90 text-void font-bold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "idle" && "Deposit (Encrypted)"}
        {status === "encrypting" && "Encrypting..."}
        {status === "submitting" && "Submitting..."}
        {status === "done" && "Deposit More"}
      </button>

      <div className="mt-3 flex items-start gap-2 bg-[rgba(45,212,191,0.04)] rounded-md p-3 border border-[rgba(45,212,191,0.12)]">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0">
          <path d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1Zm0 9V7m0-2h.01" stroke="#5EEAD4" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span className="text-[#9CA3AF] text-xs leading-relaxed">
          Amount is FHE-encrypted client-side before the transaction is broadcast. On-chain state stores only the ciphertext, never the plaintext value.
        </span>
      </div>

      {txHash && (
        <div className="mt-3 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M10 3L5 8.5 2 5.5" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[#4ADE80] text-xs font-mono">Deposited:</span>
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-soft text-xs font-mono underline hover:text-teal transition-colors"
          >
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
