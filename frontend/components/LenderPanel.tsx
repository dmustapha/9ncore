"use client";

import { useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { PRIVLEND_ABI, USDC_ABI, CONTRACT_ADDRESS, USDC_ADDRESS } from "@/lib/contract";
import { useSepoliaWrite } from "@/hooks/useSepoliaWrite";
import FHEProgress from "./FHEProgress";

export default function LenderPanel() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"lend" | "withdraw">("lend");
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const { writeContractAsync } = useSepoliaWrite();

  const poolContract = { address: CONTRACT_ADDRESS, abi: PRIVLEND_ABI } as const;
  const usdcContract = { address: USDC_ADDRESS, abi: USDC_ABI } as const;

  const { data: poolData, refetch: refetchPool } = useReadContracts({
    contracts: [
      { ...poolContract, functionName: "lenderShares", args: address ? [address] : undefined },
      { ...poolContract, functionName: "totalShares" },
      { ...poolContract, functionName: "availableToLend" },
      { ...usdcContract, functionName: "balanceOf", args: address ? [address] : undefined },
      { ...usdcContract, functionName: "allowance", args: address ? [address, CONTRACT_ADDRESS] : undefined },
    ],
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const lenderShares    = poolData?.[0]?.result as bigint | undefined;
  const totalShares     = poolData?.[1]?.result as bigint | undefined;
  const poolAvailable   = poolData?.[2]?.result as bigint | undefined;
  const usdcBalance     = poolData?.[3]?.result as bigint | undefined;
  const usdcAllowance   = poolData?.[4]?.result as bigint | undefined;

  // Calculate lender's USDC value from shares
  const lenderUsdc =
    lenderShares && totalShares && poolAvailable && totalShares > 0n
      ? (lenderShares * poolAvailable) / totalShares
      : 0n;

  const amountUnits = amount ? parseUnits(amount, 6) : 0n;
  const needsApproval = mode === "lend" && usdcAllowance !== undefined && amountUnits > usdcAllowance;

  async function handleFaucet() {
    if (!address) return;
    setIsLoading(true);
    setTxHash(null);
    setTxError(null);
    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "faucet",
      });
      setTxHash(hash);
      refetchPool();
    } catch (e: any) {
      setTxError((e as any).shortMessage ?? e.message ?? "Faucet failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove() {
    if (!amount || !address) return;
    setIsLoading(true);
    setTxHash(null);
    setTxError(null);
    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, amountUnits],
      });
      setTxHash(hash);
      refetchPool();
    } catch (e: any) {
      setTxError((e as any).shortMessage ?? e.message ?? "Approval failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLend() {
    if (!amount || !address) return;
    setIsLoading(true);
    setTxHash(null);
    setTxError(null);
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PRIVLEND_ABI,
        functionName: "lend",
        args: [amountUnits],
      });
      setTxHash(hash);
      setAmount("");
      refetchPool();
    } catch (e: any) {
      setTxError((e as any).shortMessage ?? e.message ?? "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleWithdraw() {
    if (!amount || !address) return;
    setIsLoading(true);
    setTxHash(null);
    setTxError(null);
    try {
      const shareAmt =
        amount === formatUnits(lenderShares ?? 0n, 6)
          ? (lenderShares ?? parseUnits(amount, 6))
          : parseUnits(amount, 6);
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PRIVLEND_ABI,
        functionName: "withdrawLiquidity",
        args: [shareAmt],
      });
      setTxHash(hash);
      setAmount("");
      refetchPool();
    } catch (e: any) {
      setTxError((e as any).shortMessage ?? e.message ?? "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  }

  const fmtUsdc = (units: bigint) =>
    "$" + (Number(units) / 1e6).toFixed(2);

  return (
    <div className="panel">
      <FHEProgress active={isLoading} message="Submitting liquidity transaction..." />
      <div className="panel-label">LIQUIDITY MANAGEMENT</div>
      <h3 className="text-[#E8EAF0] font-bold text-lg mb-4">Lending Pool</h3>

      {/* Balance strip */}
      {address && (
        <div className="flex gap-4 mb-3 text-xs font-mono flex-wrap items-center">
          <span className="text-[#9CA3AF]">
            Wallet USDC:{" "}
            <span className="text-teal-soft">
              {usdcBalance !== undefined ? fmtUsdc(usdcBalance) : "..."}
            </span>
          </span>
          <span className="text-[#9CA3AF]">
            Deposited:{" "}
            <span className="text-teal-soft">
              {lenderShares !== undefined ? fmtUsdc(lenderUsdc) : "..."}
            </span>
            {mode === "withdraw" && lenderShares !== undefined && lenderShares > 0n && (
              <button
                onClick={() => setAmount(formatUnits(lenderUsdc, 6))}
                className="ml-2 text-teal text-xs underline hover:no-underline"
              >
                Max
              </button>
            )}
          </span>
          <button
            onClick={handleFaucet}
            disabled={isLoading || !address}
            className="text-xs font-mono text-teal underline hover:no-underline disabled:opacity-40"
          >
            Get 10k USDC
          </button>
        </div>
      )}

      <div className="flex gap-1 bg-[rgba(45,212,191,0.05)] rounded-md p-1 mb-4">
        {(["lend", "withdraw"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setTxHash(null); setTxError(null); }}
            className={`flex-1 py-2 rounded text-sm font-semibold transition-colors ${
              mode === m
                ? "bg-teal text-void"
                : "bg-transparent text-[#9CA3AF] hover:text-[#E8EAF0]"
            }`}
          >
            {m === "lend" ? "Add Liquidity" : "Withdraw"}
          </button>
        ))}
      </div>

      <label className="text-[#9CA3AF] text-xs block mb-2">USDC Amount</label>
      <input
        type="number"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="field-input mb-4"
      />

      {mode === "lend" && needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={isLoading || !address || !amount}
          className="w-full bg-teal hover:bg-teal/90 text-void font-bold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-2"
        >
          {isLoading ? "Processing..." : "Approve USDC"}
        </button>
      ) : (
        <button
          onClick={mode === "lend" ? handleLend : handleWithdraw}
          disabled={isLoading || !address || !amount}
          className="w-full bg-teal hover:bg-teal/90 text-void font-bold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading
            ? "Processing..."
            : mode === "lend"
            ? "Add Liquidity"
            : "Withdraw USDC"}
        </button>
      )}

      {mode === "lend" && needsApproval && (
        <p className="text-[#9CA3AF] text-xs mt-1 text-center">
          Step 1 of 2. After approving, click Add Liquidity.
        </p>
      )}

      {txHash && (
        <div className="mt-3 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M10 3L5 8.5 2 5.5" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[#4ADE80] text-xs font-mono">Confirmed:</span>
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
      {txError && (
        <p className="text-[#EF4444] text-sm mt-3 break-words">{txError}</p>
      )}
    </div>
  );
}
