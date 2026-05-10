import Link from "next/link";
import PoolStats from "@/components/PoolStats";
import { CONTRACT_ADDRESS } from "@/lib/contract";

const FHE_OPS = [
  { op: "FHE.fromExternal", desc: "Validate encrypted inputs using zero-knowledge proof of knowledge (ZKPoK) before accepting ciphertext" },
  { op: "FHE.add", desc: "Accumulate collateral and debt balances homomorphically over encrypted ciphertexts" },
  { op: "FHE.sub", desc: "Reduce encrypted debt balance on repay: subtraction in ciphertext space, no plaintext exposed." },
  { op: "FHE.mul ×100", desc: "Compute health ratio numerator: multiply encrypted collateral by 100 for fixed-point precision." },
  { op: "FHE.mul ×150", desc: "Compute health ratio denominator: multiply encrypted debt by 150 (minimum collateral ratio)." },
  { op: "FHE.ge", desc: "Compute the health boolean for liquidators: encrypted comparison produces a single bit." },
  { op: "FHE.min", desc: "Cap partial liquidation amount to the outstanding balance, preventing over-liquidation." },
  { op: "FHE.div", desc: "Interest rate calculation over encrypted principal: division performed homomorphically." },
  { op: "FHE.allowThis", desc: "Contract self-authorization via ACL: grants the contract permission to operate on its own ciphertexts." },
  { op: "FHE.allow", desc: "Grant specific user or liquidator decrypt access to their authorized ciphertexts via ACL" },
  { op: "FHE.mul ×BPS", desc: "Interest rate basis points multiplication: computes accrued interest over encrypted principal." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-void">

      {/* ===== HERO ===== */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #0B0B16 0%, #07070D 100%)",
          padding: "60px 24px 48px",
        }}
      >
        <div className="hero-dot-grid" />
        <div className="scan-overlay" />

        <div className="max-w-[780px] mx-auto text-center relative z-10">
          <div
            className="inline-flex items-center gap-2 mb-5"
            style={{
              background: "rgba(45,212,191,0.07)",
              border: "1px solid rgba(45,212,191,0.25)",
              borderRadius: "20px",
              padding: "5px 14px",
            }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="#2DD4BF">
              <circle cx="4" cy="4" r="4"/>
            </svg>
            <span className="font-mono text-teal-soft text-xs">
              Powered by Zama FHEVM on Ethereum Sepolia
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-[#E8EAF0] leading-tight mb-4">
            Lend and Borrow ETH
            <br />
            <span className="gradient-text">Without Leaking Positions</span>
          </h1>

          <p className="text-[#9CA3AF] text-base leading-relaxed max-w-[580px] mx-auto mb-8">
            Collateral and debt are encrypted with FHE. Liquidators see only a health boolean.
            You see your full position.
          </p>

          {/* Stats bar */}
          <PoolStats />
        </div>
      </section>

      {/* ===== ROLE CARDS ===== */}
      <div className="max-w-[1280px] mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Lender card */}
        <div className="panel flex flex-col">
          <div className="panel-label mb-2">FOR LENDERS</div>
          <h2 className="text-[#E8EAF0] font-bold text-xl mb-3">Provide Liquidity</h2>
          <p className="text-[#9CA3AF] text-sm leading-relaxed mb-6 flex-1">
            Deposit ETH into the lending pool and earn yield from borrower interest. Your share
            of the pool is tracked proportionally. Withdraw at any time.
          </p>
          <div className="flex gap-3 mb-6 text-xs font-mono flex-wrap">
            {[
              { label: "APR to Lenders", value: "5%" },
              { label: "Min Deposit", value: "Any" },
            ].map((s) => (
              <div key={s.label} className="bg-[rgba(45,212,191,0.05)] border border-[rgba(45,212,191,0.12)] rounded-md px-3 py-2">
                <div className="panel-label mb-1" style={{ fontSize: "0.6rem" }}>{s.label}</div>
                <div className="text-teal font-semibold">{s.value}</div>
              </div>
            ))}
          </div>
          <Link
            href="/lend"
            className="w-full bg-teal hover:bg-teal/90 text-void font-bold py-3 rounded-lg transition-colors text-center text-sm"
          >
            Go to Lending Pool →
          </Link>
        </div>

        {/* Borrower card */}
        <div className="panel flex flex-col">
          <div className="panel-label mb-2">FOR BORROWERS</div>
          <h2 className="text-[#E8EAF0] font-bold text-xl mb-3">Borrow with Privacy</h2>
          <p className="text-[#9CA3AF] text-sm leading-relaxed mb-6 flex-1">
            Deposit ETH collateral and borrow against it. Your collateral and debt amounts stay
            encrypted on-chain. Only you can decrypt your own position.
          </p>
          <div className="flex gap-3 mb-6 text-xs font-mono flex-wrap">
            {[
              { label: "Max LTV", value: "66.67%" },
              { label: "Collateral Ratio", value: "150%" },
              { label: "Borrow Rate", value: "5% APR" },
            ].map((s) => (
              <div key={s.label} className="bg-[rgba(45,212,191,0.05)] border border-[rgba(45,212,191,0.12)] rounded-md px-3 py-2">
                <div className="panel-label mb-1" style={{ fontSize: "0.6rem" }}>{s.label}</div>
                <div className="text-teal font-semibold">{s.value}</div>
              </div>
            ))}
          </div>
          <Link
            href="/borrow"
            className="w-full bg-teal hover:bg-teal/90 text-void font-bold py-3 rounded-lg transition-colors text-center text-sm"
          >
            Go to Borrowing →
          </Link>
        </div>
      </div>

      {/* ===== PRIVACY MODEL ===== */}
      <div className="max-w-[1280px] mx-auto px-6 pb-10">
        <div className="panel">
          <div className="panel-label mb-4">PRIVACY MODEL</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: "U",
                role: "You (Borrower)",
                desc: "See full collateral + debt + exact health ratio via FHE decrypt. Requires EIP-712 signature to authorize reveal.",
                color: "rgba(45,212,191,0.15)",
              },
              {
                icon: "L",
                role: "Liquidator",
                desc: "Sees only a health boolean: healthy or not healthy. No collateral amounts revealed.",
                color: "rgba(239,68,68,0.1)",
              },
              {
                icon: "O",
                role: "Observer",
                desc: "Sees pool totals only: total ETH locked, utilization rate. No visibility into individual balances.",
                color: "rgba(156,163,175,0.1)",
              },
            ].map((r) => (
              <div key={r.role} className="role-card">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs"
                    style={{ background: r.color }}
                  >
                    {r.icon}
                  </span>
                  <span className="text-[#E8EAF0] font-semibold text-sm">{r.role}</span>
                </div>
                <p className="text-[#9CA3AF] text-xs leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== FHE OPERATIONS ===== */}
      <section
        style={{
          background: "#141420",
          borderTop: "1px solid rgba(45,212,191,0.12)",
          borderBottom: "1px solid rgba(45,212,191,0.12)",
          padding: "48px 24px",
        }}
      >
        <div className="max-w-[1280px] mx-auto">
          <div className="mb-7">
            <div className="panel-label mb-1">CRYPTOGRAPHIC LAYER</div>
            <h2 className="text-[#E8EAF0] font-bold text-xl mb-1">FHE Cryptographic Operations</h2>
            <p className="text-[#9CA3AF] text-sm">
              11 FHE operations power the privacy guarantees of every lending action
            </p>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {FHE_OPS.map((item) => (
              <div
                key={item.op}
                className="rounded-lg p-4"
                style={{
                  background: "rgba(45,212,191,0.03)",
                  border: "1px solid rgba(45,212,191,0.12)",
                }}
              >
                <div className="font-mono text-teal-soft text-sm font-semibold mb-2">{item.op}</div>
                <div className="text-[#9CA3AF] text-xs leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer
        style={{
          padding: "24px",
          borderTop: "1px solid rgba(45,212,191,0.12)",
          background: "#07070D",
        }}
      >
        <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[#4B5563] text-xs font-mono">Contract</span>
            <a
              href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#9CA3AF] text-xs font-mono hover:text-teal transition-colors"
            >
              {CONTRACT_ADDRESS}
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[#4B5563] text-xs">Ethereum Sepolia · chain 11155111</span>
            <span className="text-teal-soft text-xs">Powered by Zama FHEVM</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
