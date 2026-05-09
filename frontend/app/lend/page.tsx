import LenderPanel from "@/components/LenderPanel";
import PoolStats from "@/components/PoolStats";
import { CONTRACT_ADDRESS } from "@/lib/contract";

export const metadata = {
  title: "9ncore — Lending Pool",
};

export default function LendPage() {
  return (
    <main className="min-h-screen bg-void">
      <div className="max-w-[1280px] mx-auto px-6 py-10">

        <div className="mb-6">
          <div className="panel-label mb-1">LIQUIDITY MANAGEMENT</div>
          <h1 className="text-[#E8EAF0] font-bold text-2xl">Lending Pool</h1>
          <p className="text-[#9CA3AF] text-sm mt-1">
            Provide ETH liquidity and earn 5% APR from borrower interest.
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <PoolStats />
        </div>

        {/* Panel + sidebar */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Main */}
          <div className="flex-1 min-w-0">
            <LenderPanel />
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-5">
            {/* How it works */}
            <div className="panel">
              <div className="panel-label mb-3">HOW IT WORKS</div>
              <div className="flex flex-col gap-4">
                {[
                  { step: "1", title: "Deposit ETH", desc: "Your ETH enters the lending pool. You receive shares proportional to your contribution." },
                  { step: "2", title: "Earn Interest", desc: "Borrowers pay 5% APR. Interest accrues to the pool, increasing the ETH value of your shares." },
                  { step: "3", title: "Withdraw Anytime", desc: "Redeem your shares for ETH at the current pool exchange rate." },
                ].map((s) => (
                  <div key={s.step} className="flex gap-3">
                    <div
                      className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 font-bold"
                      style={{ background: "rgba(45,212,191,0.15)", color: "#2DD4BF" }}
                    >
                      {s.step}
                    </div>
                    <div>
                      <div className="text-[#E8EAF0] text-sm font-semibold mb-0.5">{s.title}</div>
                      <div className="text-[#9CA3AF] text-xs leading-relaxed">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key params */}
            <div className="panel">
              <div className="panel-label mb-3">POOL PARAMETERS</div>
              <div className="flex flex-col">
                {[
                  { label: "Borrow APR", value: "5%" },
                  { label: "Liquidation Bonus", value: "5%" },
                  { label: "Min Collateral Ratio", value: "150%" },
                  { label: "Network", value: "Sepolia" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between items-center py-2 border-b border-[rgba(45,212,191,0.07)] last:border-b-0"
                  >
                    <span className="text-[#9CA3AF] text-sm">{row.label}</span>
                    <span className="font-mono text-teal text-sm">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[#4B5563] text-xs font-mono text-center">
              Contract:{" "}
              <a
                href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-teal transition-colors"
              >
                {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-6)}
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
