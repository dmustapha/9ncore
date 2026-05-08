"use client";

import { usePoolStats } from "@/hooks/usePoolStats";

export default function PoolStats() {
  const { totalETHStr, lendingPoolStr, utilizationStr, isLoading } = usePoolStats();

  const stats = [
    { label: "Total Locked", value: totalETHStr, icon: "🔒" },
    { label: "Available to Borrow", value: lendingPoolStr, icon: "💰" },
    { label: "Utilization", value: utilizationStr, icon: "📊" },
    { label: "Privacy", value: "FHEVM Active", icon: "🛡" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-fhe-dark/60 border border-fhe-purple/20 rounded-xl p-4"
        >
          <div className="text-2xl mb-2">{s.icon}</div>
          <div className="text-white font-bold text-xl">
            {isLoading ? (
              <span className="animate-pulse text-gray-500">...</span>
            ) : (
              s.value
            )}
          </div>
          <div className="text-gray-400 text-xs mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
