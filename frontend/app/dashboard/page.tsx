"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { formatUSDC, formatHealthFactor } from "@/lib/utils";
import PoolStats from "@/components/PoolStats";
import PositionPanel from "@/components/PositionPanel";

function PositionSummary({ address }: { address: `0x${string}` }) {
  const contract = { address: CONTRACT_ADDRESS, abi: PRIVLEND_ABI } as const;
  const { data } = useReadContracts({
    contracts: [
      { ...contract, functionName: "collateralETH", args: [address] },
      { ...contract, functionName: "plainDebt", args: [address] },
      { ...contract, functionName: "maxBorrowable", args: [address] },
      { ...contract, functionName: "hasBorrowPosition", args: [address] },
      { ...contract, functionName: "hasCollateral", args: [address] },
    ],
    query: { refetchInterval: 10_000 },
  });

  const collateralWei = data?.[0]?.result as bigint | undefined;
  const debtUsdc      = data?.[1]?.result as bigint | undefined; // plainDebt returns USDC units (6 dec)
  const maxBorrow     = data?.[2]?.result as bigint | undefined; // maxBorrowable returns USDC units (6 dec)
  const hasDebt       = data?.[3]?.result as boolean | undefined;
  const hasCollat     = data?.[4]?.result as boolean | undefined;

  // Health factor: collateralValue_usdc / (debt * 1.5), ≥1.0 = safe
  // Uses formatHealthFactor from utils which handles cross-unit math (ETH wei vs USDC units)
  const hfStr = collateralWei !== undefined && debtUsdc !== undefined && debtUsdc > 0n
    ? formatHealthFactor(collateralWei, debtUsdc)
    : null;
  const hfNum = hfStr ? parseFloat(hfStr) : null;
  const isHealthy = hfNum !== null ? hfNum >= 1.0 : null;

  const hasPosition = hasCollat || hasDebt;

  const stats = [
    {
      label: "Collateral",
      value: collateralWei !== undefined ? `${Number(formatEther(collateralWei)).toFixed(4)} ETH` : "...",
      sub: "Deposited & locked",
      color: "#2DD4BF",
    },
    {
      label: "Debt (Principal)",
      value: debtUsdc !== undefined ? formatUSDC(debtUsdc) : "...",
      sub: "USDC owed (excl. interest)",
      color: debtUsdc && debtUsdc > 0n ? "#EF4444" : "#9CA3AF",
    },
    {
      label: "Max Borrowable",
      value: maxBorrow !== undefined ? formatUSDC(maxBorrow) : "...",
      sub: "USDC at current LTV headroom",
      color: "#2DD4BF",
    },
    {
      label: "Health Factor",
      value: isHealthy === null
        ? (hasPosition ? "—" : "No position")
        : isHealthy ? `${hfStr} ✓` : `${hfStr} ⚠`,
      sub: hfNum !== null ? `${hfNum >= 1.0 ? "Safe" : "At risk"} · liquidates below 1.0` : "Deposit collateral to start",
      color: isHealthy === null ? "#4B5563" : isHealthy ? "#4ADE80" : "#EF4444",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((s) => (
        <div
          key={s.label}
          className="panel flex flex-col gap-1"
          style={{ borderColor: `${s.color}22` }}
        >
          <div className="panel-label">{s.label}</div>
          <div className="font-mono font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
          <div className="text-[#4B5563] text-xs">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  return (
    <main className="min-h-screen bg-void">
      <div className="max-w-[1280px] mx-auto px-6 py-10">

        <div className="mb-6">
          <div className="panel-label mb-1">OVERVIEW</div>
          <h1 className="text-[#E8EAF0] font-bold text-2xl">Dashboard</h1>
          <p className="text-[#9CA3AF] text-sm mt-1">
            Your position and pool stats at a glance.
          </p>
        </div>

        {/* Pool stats */}
        <div className="mb-8">
          <PoolStats />
        </div>

        {/* Position summary */}
        {isConnected && address ? (
          <>
            <div className="panel-label mb-3">YOUR POSITION</div>
            <PositionSummary address={address} />
          </>
        ) : (
          <div className="panel mb-8 text-center py-8">
            <p className="text-[#9CA3AF] text-sm mb-4">Connect your wallet to see your position.</p>
          </div>
        )}

        {/* Main content: encrypted position + quick actions */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* Left: PositionPanel (FHE decrypt) */}
          <div className="flex-1 min-w-0">
            <PositionPanel />
          </div>

          {/* Right: Quick actions */}
          <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-4">
            <div className="panel">
              <div className="panel-label mb-4">QUICK ACTIONS</div>
              <div className="flex flex-col gap-3">
                <Link
                  href="/lend"
                  className="flex items-center justify-between p-3 rounded-lg bg-[rgba(45,212,191,0.05)] border border-[rgba(45,212,191,0.15)] hover:border-[rgba(45,212,191,0.35)] transition-colors group"
                >
                  <div>
                    <div className="text-[#E8EAF0] text-sm font-semibold">Add Liquidity</div>
                    <div className="text-[#4B5563] text-xs mt-0.5">Lend USDC and earn 5% APR</div>
                  </div>
                  <span className="text-teal-soft text-sm group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
                <Link
                  href="/borrow"
                  className="flex items-center justify-between p-3 rounded-lg bg-[rgba(45,212,191,0.05)] border border-[rgba(45,212,191,0.15)] hover:border-[rgba(45,212,191,0.35)] transition-colors group"
                >
                  <div>
                    <div className="text-[#E8EAF0] text-sm font-semibold">Deposit Collateral</div>
                    <div className="text-[#4B5563] text-xs mt-0.5">Lock ETH to unlock borrowing</div>
                  </div>
                  <span className="text-teal-soft text-sm group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
                <Link
                  href="/borrow#borrow"
                  className="flex items-center justify-between p-3 rounded-lg bg-[rgba(45,212,191,0.05)] border border-[rgba(45,212,191,0.15)] hover:border-[rgba(45,212,191,0.35)] transition-colors group"
                >
                  <div>
                    <div className="text-[#E8EAF0] text-sm font-semibold">Borrow USDC</div>
                    <div className="text-[#4B5563] text-xs mt-0.5">Up to 66.67% of your collateral</div>
                  </div>
                  <span className="text-teal-soft text-sm group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
                <Link
                  href="/borrow"
                  className="flex items-center justify-between p-3 rounded-lg bg-[rgba(239,68,68,0.04)] border border-[rgba(239,68,68,0.12)] hover:border-[rgba(239,68,68,0.25)] transition-colors group"
                >
                  <div>
                    <div className="text-[#E8EAF0] text-sm font-semibold">Repay Loan</div>
                    <div className="text-[#4B5563] text-xs mt-0.5">Reduce debt + unlock collateral</div>
                  </div>
                  <span className="text-[#EF4444] text-sm group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
              </div>
            </div>

            {/* Protocol reminder */}
            <div className="panel">
              <div className="panel-label mb-3">PROTOCOL</div>
              <div className="flex flex-col">
                {[
                  { label: "Borrow APR", value: "5%" },
                  { label: "Max LTV", value: "66.67%" },
                  { label: "Liquidation at", value: "< 150% ratio" },
                  { label: "Network", value: "Sepolia" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between py-2 border-b border-[rgba(45,212,191,0.07)] last:border-b-0"
                  >
                    <span className="text-[#9CA3AF] text-xs">{row.label}</span>
                    <span className="text-teal font-mono text-xs">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
