import DepositPanel from "@/components/DepositPanel";
import WithdrawCollateralPanel from "@/components/WithdrawCollateralPanel";
import BorrowPanel from "@/components/BorrowPanel";
import RepayPanel from "@/components/RepayPanel";
import HealthPanel from "@/components/HealthPanel";
import PositionPanel from "@/components/PositionPanel";

export const metadata = {
  title: "9ncore — Borrow",
};

export default function BorrowPage() {
  return (
    <main className="min-h-screen bg-void">
      <div className="max-w-[1280px] mx-auto px-6 py-10">

        <div className="mb-6">
          <div className="panel-label mb-1">BORROWER DASHBOARD</div>
          <h1 className="text-[#E8EAF0] font-bold text-2xl">Borrow ETH</h1>
          <p className="text-[#9CA3AF] text-sm mt-1">
            Deposit collateral, borrow ETH, monitor health, and repay — all with encrypted balances.
          </p>
        </div>

        {/* Flow steps */}
        <div className="flex items-center gap-2 mb-8 flex-wrap text-xs font-mono">
          {["Deposit Collateral", "→", "Borrow ETH", "→", "Monitor Health", "→", "Repay + Withdraw"].map((s, i) => (
            <span
              key={i}
              className={s === "→" ? "text-[#4B5563]" : "text-teal-soft bg-[rgba(45,212,191,0.07)] border border-[rgba(45,212,191,0.15)] px-2 py-0.5 rounded"}
            >
              {s}
            </span>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* Left column — action panels */}
          <div className="flex flex-col gap-5 flex-1 min-w-0">
            <DepositPanel />
            <WithdrawCollateralPanel />
            <BorrowPanel />
            <RepayPanel />
            <HealthPanel />
          </div>

          {/* Right column — position viewer */}
          <div className="w-full lg:w-[380px] shrink-0 sticky top-[60px] self-start flex flex-col gap-5">
            <PositionPanel />

            {/* Reminder */}
            <div className="panel">
              <div className="panel-label mb-3">BORROWER RULES</div>
              <div className="flex flex-col gap-3">
                {[
                  { icon: "↑", text: "Collateral must stay ≥ 150% of your debt at all times" },
                  { icon: "⚡", text: "Max LTV is 66.67% — you can borrow up to 2/3 of your collateral value" },
                  { icon: "↺", text: "Interest accrues at 5% APR per block — repay early to save" },
                  { icon: "✓", text: "Repay full debt before withdrawing collateral" },
                  { icon: "🔒", text: "Your balance is never revealed on-chain — only you can decrypt" },
                ].map((r, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-teal text-xs mt-0.5 shrink-0 font-mono">{r.icon}</span>
                    <span className="text-[#9CA3AF] text-xs leading-relaxed">{r.text}</span>
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
