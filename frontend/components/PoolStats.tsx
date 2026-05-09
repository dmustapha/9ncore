"use client";

import { usePoolStats } from "@/hooks/usePoolStats";

export default function PoolStats() {
  const { totalETHStr, availableToLendStr, utilizationStr, isLoading } = usePoolStats();

  const stats = [
    { label: "Total Locked", value: totalETHStr },
    { label: "Available to Borrow", value: availableToLendStr },
    { label: "Utilization", value: utilizationStr },
    { label: "Privacy", value: "FHEVM Active", teal: true },
  ];

  return (
    <div className="flex flex-wrap gap-px bg-[rgba(45,212,191,0.12)] rounded-xl overflow-hidden border border-[rgba(45,212,191,0.20)]">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex-1 min-w-[140px] bg-surface px-5 py-4 flex flex-col gap-1"
        >
          <span className="panel-label">{s.label}</span>
          <span
            className={`font-mono font-semibold text-base ${
              s.teal ? "text-teal text-sm" : "text-[#E8EAF0]"
            }`}
          >
            {isLoading && !s.teal ? (
              <span className="text-[#4B5563]">...</span>
            ) : (
              s.value
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
