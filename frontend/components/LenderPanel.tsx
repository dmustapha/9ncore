"use client";

import { useState } from "react";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import { parseEther, formatEther } from "viem";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
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

  const { data: walletBalance } = useBalance({ address, query: { enabled: !!address } });

  const contract = { address: CONTRACT_ADDRESS, abi: PRIVLEND_ABI } as const;
  const { data: poolData } = useReadContracts({
    contracts: [
      { ...contract, functionName: "lenderShares", args: address ? [address] : undefined },
      { ...contract, functionName: "totalShares" },
      { ...contract, functionName: "totalETH" },
    ],
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const lenderShares = poolData?.[0]?.result as bigint | undefined;
  const totalShares = poolData?.[1]?.result as bigint | undefined;
  const totalETH = poolData?.[2]?.result as bigint | undefined;
  const lenderETH =
    lenderShares && totalShares && totalETH && totalShares > 0n
      ? (lenderShares * totalETH) / totalShares
      : 0n;

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
        value: parseEther(amount),
      });
      setTxHash(hash);
      setAmount("");
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
      // withdrawLiquidity takes share count. Since shares start 1:1 with deposits,
      // parseEther(amount) works directly. For post-interest withdrawals, use lenderShares directly.
      const shareAmt = amount === formatEther(lenderShares ?? 0n)
        ? (lenderShares ?? parseEther(amount))
        : parseEther(amount);
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PRIVLEND_ABI,
        functionName: "withdrawLiquidity",
        args: [shareAmt],
      });
      setTxHash(hash);
      setAmount("");
    } catch (e: any) {
      setTxError((e as any).shortMessage ?? e.message ?? "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="panel">
      <FHEProgress active={isLoading} message="Submitting liquidity transaction..." />
      <div className="panel-label">LIQUIDITY MANAGEMENT</div>
      <h3 className="text-[#E8EAF0] font-bold text-lg mb-4">Lending Pool</h3>

      {/* Balance strip */}
      {address && (
        <div className="flex gap-4 mb-4 text-xs font-mono">
          <span className="text-[#9CA3AF]">
            Wallet:{" "}
            <span className="text-teal-soft">
              {walletBalance ? `${Number(walletBalance.value / 10n ** 15n) / 1000} ETH` : "..."}
            </span>
          </span>
          <span className="text-[#9CA3AF]">
            Deposited:{" "}
            <span className="text-teal-soft">
              {lenderShares !== undefined ? `${Number(lenderETH) / 1e18 < 0.0001 && lenderETH === 0n ? "0 ETH" : (Number(lenderETH) / 1e18).toFixed(4) + " ETH"}` : "..."}
            </span>
            {mode === "withdraw" && lenderShares !== undefined && lenderShares > 0n && (
              <button
                onClick={() => setAmount(formatEther(lenderETH))}
                className="ml-2 text-teal text-xs underline hover:no-underline"
              >
                Max
              </button>
            )}
          </span>
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

      <label className="text-[#9CA3AF] text-xs block mb-2">ETH Amount</label>
      <input
        type="number"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="field-input mb-4"
      />

      <button
        onClick={mode === "lend" ? handleLend : handleWithdraw}
        disabled={isLoading || !address || !amount}
        className="w-full bg-teal hover:bg-teal/90 text-void font-bold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isLoading ? "Processing..." : mode === "lend" ? "Add Liquidity" : "Withdraw ETH"}
      </button>

      {txHash && (
        <div className="mt-3 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M10 3L5 8.5 2 5.5" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[#4ADE80] text-xs font-mono">Confirmed —{" "}</span>
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
