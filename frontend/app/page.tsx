import ConnectWallet from "@/components/ConnectWallet";
import PoolStats from "@/components/PoolStats";
import LenderPanel from "@/components/LenderPanel";
import DepositPanel from "@/components/DepositPanel";
import BorrowPanel from "@/components/BorrowPanel";
import RepayPanel from "@/components/RepayPanel";
import HealthPanel from "@/components/HealthPanel";
import { CONTRACT_ADDRESS } from "@/lib/contract";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a0a2e] to-[#0a1929]">
      {/* Header */}
      <header className="border-b border-white/5 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔐</span>
            <div>
              <h1 className="text-white font-bold text-xl gradient-text">PrivLend</h1>
              <p className="text-gray-500 text-xs">Confidential Lending Pool</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1 text-xs text-fhe-purple">
              <span className="w-2 h-2 bg-fhe-purple rounded-full animate-pulse" />
              <span>FHEVM Active</span>
            </div>
            <ConnectWallet />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <section className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-fhe-purple/10 border border-fhe-purple/30 rounded-full px-4 py-2 mb-6">
            <span className="text-fhe-purple text-sm font-medium">
              Powered by Zama FHEVM — Ethereum Sepolia
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Lend and Borrow ETH
            <br />
            <span className="gradient-text">Without Leaking Positions</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Collateral and debt balances are encrypted with Fully Homomorphic Encryption.
            Liquidators see only a health boolean. You see your full position.
          </p>
          <p className="text-gray-500 text-sm mt-4">
            Contract:{" "}
            <a
              href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500 font-mono hover:underline"
            >
              {CONTRACT_ADDRESS}
            </a>
          </p>
        </section>

        {/* Pool Stats */}
        <section className="mb-8">
          <PoolStats />
        </section>

        {/* Privacy Architecture Explainer */}
        <section className="mb-8 bg-fhe-dark/40 border border-fhe-purple/15 rounded-2xl p-6">
          <h3 className="text-white font-bold text-lg mb-3">How Privacy Works</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                role: "You (Borrower)",
                color: "fhe-purple",
                access: "See full collateral + debt + exact health ratio via FHE decrypt",
                icon: "👁",
              },
              {
                role: "Liquidator",
                color: "orange-500",
                access: "See only a health boolean: healthy / not healthy",
                icon: "🔍",
              },
              {
                role: "Observer",
                color: "gray-500",
                access: "See only pool totals — no individual balances",
                icon: "👤",
              },
            ].map((r) => (
              <div
                key={r.role}
                className="bg-white/5 rounded-xl p-4"
              >
                <div className="text-2xl mb-2">{r.icon}</div>
                <div className="text-white font-semibold text-sm mb-1">{r.role}</div>
                <div className="text-gray-400 text-xs">{r.access}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Action Panels */}
        <div className="grid md:grid-cols-2 gap-6">
          <LenderPanel />
          <DepositPanel />
          <BorrowPanel />
          <RepayPanel />
        </div>

        {/* Health Check (full width) */}
        <div className="mt-6">
          <HealthPanel />
        </div>

        {/* FHE Operations Reference */}
        <section className="mt-10 bg-fhe-dark/40 border border-fhe-purple/15 rounded-2xl p-6">
          <h3 className="text-white font-bold text-lg mb-4">
            FHE Operations Demonstrated
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { op: "FHE.fromExternal", use: "Validate encrypted inputs" },
              { op: "FHE.add", use: "Accumulate collateral/debt" },
              { op: "FHE.sub", use: "Reduce debt on repay" },
              { op: "FHE.mul ×100", use: "Health numerator" },
              { op: "FHE.mul ×150", use: "Health denominator" },
              { op: "FHE.ge", use: "Compute health boolean" },
              { op: "FHE.min", use: "Cap partial liquidation" },
              { op: "FHE.div", use: "Interest calculation" },
              { op: "FHE.allowThis", use: "Contract ACL" },
              { op: "FHE.allow", use: "User/liquidator ACL" },
              { op: "FHE.mul ×BPS", use: "Interest rate BPS" },
            ].map((item) => (
              <div
                key={item.op}
                className="bg-white/5 rounded-lg p-3"
              >
                <div className="text-fhe-purple font-mono text-xs font-bold">{item.op}</div>
                <div className="text-gray-400 text-xs mt-1">{item.use}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-16 py-8 text-center text-gray-600 text-sm">
        <p>PrivLend — Zama Developer Program Mainnet S2</p>
        <p className="mt-1">
          Built with{" "}
          <a href="https://www.zama.ai/fhevm" className="text-fhe-purple hover:underline">
            Zama FHEVM
          </a>{" "}
          · Ethereum Sepolia
        </p>
      </footer>
    </main>
  );
}
