"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { PRIVLEND_ABI, USDC_ABI, CONTRACT_ADDRESS, USDC_ADDRESS } from "@/lib/contract";
import { encryptUint128 } from "@/lib/fhevm";
import { useSepoliaWrite } from "@/hooks/useSepoliaWrite";
import FHEProgress from "./FHEProgress";

interface Props {
  /** Pre-fills repay amount from decrypted position (Phase 5.1). USDC units (6 dec). */
  suggestedAmountUnits?: bigint | null;
}

export default function RepayPanel({ suggestedAmountUnits }: Props) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "approving" | "encrypting" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { writeContractAsync } = useSepoliaWrite();

  // Pre-fill from decrypted position
  useEffect(() => {
    if (suggestedAmountUnits && suggestedAmountUnits > 0n && !amount) {
      setAmount(formatUnits(suggestedAmountUnits, 6));
    }
  }, [suggestedAmountUnits]);

  const poolContract = { address: CONTRACT_ADDRESS, abi: PRIVLEND_ABI } as const;
  const usdcContract = { address: USDC_ADDRESS, abi: USDC_ABI } as const;

  const { data: repayData, refetch: refetchDebt } = useReadContracts({
    contracts: [
      { ...poolContract, functionName: "plainDebt", args: address ? [address] : undefined },
      { ...usdcContract, functionName: "balanceOf", args: address ? [address] : undefined },
      { ...usdcContract, functionName: "allowance", args: address ? [address, CONTRACT_ADDRESS] : undefined },
    ],
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const plainDebtUnits  = repayData?.[0]?.result as bigint | undefined;
  const usdcBalance     = repayData?.[1]?.result as bigint | undefined;
  const usdcAllowance   = repayData?.[2]?.result as bigint | undefined;

  const amountUnits = amount ? parseUnits(amount, 6) : 0n;
  const needsApproval = usdcAllowance !== undefined && amountUnits > usdcAllowance;

  const fmtUsdc = (units: bigint) => "$" + (Number(units) / 1e6).toFixed(2);

  async function handleApprove() {
    if (!amount || !address) return;
    setError(null);
    try {
      setStatus("approving");
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, amountUnits],
      });
      setTxHash(hash);
      refetchDebt();
    } catch (e: any) {
      setError((e as any).shortMessage ?? e.message ?? "Approval failed");
    } finally {
      setStatus("idle");
    }
  }

  async function handleRepay() {
    if (!amount || !address) return;
    setError(null);

    if (amountUnits <= 0n) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (usdcBalance !== undefined && amountUnits > usdcBalance) {
      setError(`Insufficient USDC balance (${fmtUsdc(usdcBalance)} available).`);
      return;
    }

    try {
      setStatus("encrypting");
      const { handles, inputProof } = await encryptUint128(
        CONTRACT_ADDRESS,
        address,
        amountUnits
      );

      setStatus("submitting");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PRIVLEND_ABI,
        functionName: "repay",
        args: [handles[0], inputProof, amountUnits],
      });

      setTxHash(hash);
      setStatus("done");
      setAmount("");
      refetchDebt();
    } catch (e: any) {
      setError((e as any).shortMessage ?? e.message ?? "Repay failed");
      setStatus("idle");
    }
  }

  const busy = status === "approving" || status === "encrypting" || status === "submitting";

  return (
    <div className="panel">
      <FHEProgress
        active={status === "encrypting" || status === "submitting"}
        message={
          status === "encrypting"
            ? "Encrypting repay amount with FHE..."
            : "Submitting repayment transaction..."
        }
      />

      <div className="panel-label">DEBT REPAYMENT</div>
      <h3 className="text-[#E8EAF0] font-bold text-lg mb-4">Repay USDC Loan</h3>

      {plainDebtUnits !== undefined && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-[#9CA3AF] text-xs">Outstanding debt (principal)</span>
          <div className="flex items-center gap-2">
            <span className="text-[#EF4444] text-xs font-mono font-semibold">
              {fmtUsdc(plainDebtUnits)}
            </span>
            {plainDebtUnits > 0n && (
              <button
                onClick={() => setAmount(formatUnits(plainDebtUnits, 6))}
                className="text-teal text-xs underline hover:no-underline"
              >
                Use
              </button>
            )}
          </div>
        </div>
      )}

      {usdcBalance !== undefined && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-[#9CA3AF] text-xs">Wallet USDC</span>
          <span className="text-teal-soft text-xs font-mono">{fmtUsdc(usdcBalance)}</span>
        </div>
      )}

      <label className="text-[#9CA3AF] text-xs block mb-2">USDC Amount to Repay</label>
      <input
        type="number"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="field-input mb-4"
      />

      {needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={busy || !address || !amount}
          className="w-full bg-teal hover:bg-teal/90 text-void font-bold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-2"
        >
          {status === "approving" ? "Approving..." : "Approve USDC"}
        </button>
      ) : (
        <button
          onClick={handleRepay}
          disabled={busy || !address || !amount}
          className="w-full bg-teal hover:bg-teal/90 text-void font-bold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "idle" && "Repay Loan"}
          {status === "encrypting" && "Encrypting..."}
          {status === "submitting" && "Submitting..."}
          {status === "done" && "Repay More"}
        </button>
      )}

      {needsApproval && (
        <p className="text-[#9CA3AF] text-xs mt-1 text-center">
          Step 1 of 2. After approving, click Repay Loan.
        </p>
      )}

      <div className="mt-3 flex items-start gap-2 bg-[rgba(45,212,191,0.04)] rounded-md p-3 border border-[rgba(45,212,191,0.12)]">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0">
          <path d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1Zm0 9V7m0-2h.01" stroke="#5EEAD4" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span className="text-[#9CA3AF] text-xs leading-relaxed">
          Interest accrues in encrypted state. The outstanding balance is computed via FHE operations over ciphertext. Overpaying is safe; excess is absorbed by the pool.
        </span>
      </div>

      {txHash && (
        <div className="mt-3 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M10 3L5 8.5 2 5.5" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[#4ADE80] text-xs font-mono">Repaid:</span>
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
