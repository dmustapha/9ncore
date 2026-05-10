"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { usePosition } from "@/hooks/usePosition";
import FHEProgress from "./FHEProgress";

interface Props {
  /** Called when FHE decryption reveals the debt (USDC units). Used to pre-fill RepayPanel. */
  onDebtDecrypted?: (debtUnits: bigint) => void;
}

export default function PositionPanel({ onDebtDecrypted }: Props) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const {
    hasCollateral,
    hasDebt,
    collateralStr,
    debtStr,
    healthRatioStr,
    collateralWei: rawCollateral,
    debtWei: rawDebt,      // USDC units (6 dec) after migration
    decrypting,
    decryptError,
    decryptPosition,
  } = usePosition(address);

  const [revealed, setRevealed] = useState(false);
  const [revealedRows, setRevealedRows] = useState<boolean[]>([false, false, false, false]);
  const [showConfirm, setShowConfirm] = useState(false);

  // When collateralStr becomes available after decrypt, trigger staggered reveal
  useEffect(() => {
    if (collateralStr !== null && !revealed) {
      setRevealed(true);
      setShowConfirm(true);
      if (rawDebt !== null && rawDebt > 0n && onDebtDecrypted) {
        onDebtDecrypted(rawDebt);
      }
      [0, 1, 2, 3].forEach((i) => {
        setTimeout(() => {
          setRevealedRows((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, i * 160);
      });
    }
  }, [collateralStr, revealed]);

  const hasPosition = hasCollateral || hasDebt;
  const canDecrypt = !!(address && walletClient && hasPosition && !decrypting && !revealed);

  const displayCollateral = collateralStr ?? "0.0000 ETH";
  const displayDebt       = debtStr ?? "$0.00";
  const displayHealth     = healthRatioStr ?? "—";

  // Net position: collateral value in USDC minus debt
  const displayNet =
    rawCollateral !== null && rawDebt !== null
      ? (() => {
          const collateralUsdc = (rawCollateral * 2000n) / 1_000_000_000_000n;
          const net = collateralUsdc - rawDebt;
          const isNeg = net < 0n;
          const absNet = isNeg ? -net : net;
          return `${isNeg ? "-" : "+"}$${(Number(absNet) / 1e6).toFixed(2)}`;
        })()
      : "—";

  const rows = [
    { label: "Collateral",     value: displayCollateral, index: 0 },
    { label: "Debt",           value: displayDebt,       index: 1 },
    { label: "Health Factor",  value: displayHealth,     index: 2 },
    { label: "Net Value",      value: displayNet,        index: 3 },
  ];

  return (
    <div className="panel">
      <FHEProgress
        active={decrypting}
        message="Requesting Gateway decryption via FHEVM relayer..."
      />

      <div className="flex items-center justify-between mb-1">
        <div className="panel-label">POSITION VIEWER</div>
        <span
          className="badge-enc"
          style={revealed ? { animation: "none", background: "rgba(45,212,191,0.1)", borderColor: "#2DD4BF", color: "#2DD4BF" } : undefined}
        >
          {revealed ? "✓ DECRYPTED" : "● ENCRYPTED"}
        </span>
      </div>
      <h3 className="text-[#E8EAF0] font-bold text-lg mb-4">My Encrypted Position</h3>

      {!address ? (
        <p className="text-[#4B5563] text-sm font-mono">Connect your wallet to view your position.</p>
      ) : !hasPosition ? (
        <p className="text-[#4B5563] text-sm font-mono">No active position. Deposit ETH collateral to get started.</p>
      ) : (
        <>
          <div className="flex flex-col gap-0 mb-4">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex justify-between items-center py-3 border-b border-[rgba(45,212,191,0.07)] last:border-b-0"
              >
                <span className="text-[#9CA3AF] text-sm">{row.label}</span>
                <span
                  className={`font-mono font-semibold text-sm val-locked${revealedRows[row.index] ? " revealed" : ""}`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[#4B5563] text-xs font-mono mb-1 text-center">
            Collateral in ETH, debt in USDC. Health factor &ge;1.0 = safe.
          </p>
          <p className="text-[#4B5563] text-xs font-mono mb-3 text-center">
            Values encrypted via FHE. Only you can decrypt.
          </p>

          <button
            onClick={() => decryptPosition(walletClient)}
            disabled={!canDecrypt}
            className="w-full font-mono text-sm py-3 rounded-lg transition-colors border"
            style={{
              background: "#0F2622",
              borderColor: "#134E4A",
              color: "#5EEAD4",
              opacity: !canDecrypt ? 0.5 : 1,
              cursor: !canDecrypt ? "default" : "pointer",
            }}
          >
            {decrypting
              ? "Decrypting via Gateway..."
              : revealed
              ? "Position Revealed"
              : "Decrypt My Position"}
          </button>

          <p className="text-[#4B5563] text-xs mt-2 text-center font-mono">
            Requires EIP-712 signature. No tx, no gas.
          </p>

          {showConfirm && (
            <div className="mt-3 flex items-center gap-2 bg-[rgba(45,212,191,0.05)] px-3 py-2 rounded-md border border-[rgba(45,212,191,0.12)]">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M10 3L5 8.5 2 5.5" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-teal-soft text-xs font-mono">FHE.allow: decrypt access granted</span>
            </div>
          )}
        </>
      )}

      {decryptError && (
        <p className="text-[#EF4444] text-sm mt-3 break-words">Error: {decryptError}</p>
      )}
    </div>
  );
}
