"use client";

import { useAccount, useWalletClient } from "wagmi";
import { usePosition } from "@/hooks/usePosition";
import FHEProgress from "./FHEProgress";

export default function PositionPanel() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const {
    hasCollateral,
    hasDebt,
    collateralStr,
    debtStr,
    healthRatioStr,
    decrypting,
    decryptError,
    decryptPosition,
  } = usePosition(address);

  const hasPosition = hasCollateral || hasDebt;
  const canDecrypt = !!(address && walletClient && hasPosition && !decrypting);

  return (
    <div className="bg-fhe-dark/60 border border-fhe-purple/20 rounded-2xl p-6">
      <FHEProgress
        active={decrypting}
        message="Requesting Gateway decryption via FHEVM relayer..."
      />

      <div className="flex items-center gap-2 mb-4">
        <span className="text-fhe-purple text-2xl">🔏</span>
        <h3 className="text-white font-bold text-lg">My Encrypted Position</h3>
      </div>

      {!address ? (
        <p className="text-gray-500 text-sm">Connect your wallet to view your position.</p>
      ) : !hasPosition ? (
        <p className="text-gray-500 text-sm">No active position. Deposit collateral to get started.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-gray-400 text-xs mb-1">Collateral</div>
              <div className="text-white font-mono font-bold">
                {collateralStr ?? (hasCollateral ? "🔒 Encrypted" : "—")}
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-gray-400 text-xs mb-1">Debt</div>
              <div className="text-white font-mono font-bold">
                {debtStr ?? (hasDebt ? "🔒 Encrypted" : "—")}
              </div>
            </div>
          </div>

          {healthRatioStr && (
            <div className="bg-fhe-purple/10 border border-fhe-purple/20 rounded-xl p-4 mb-4">
              <div className="text-gray-400 text-xs mb-1">Health Ratio</div>
              <div className="text-fhe-purple font-mono font-bold text-lg">{healthRatioStr}</div>
            </div>
          )}

          <button
            onClick={() => decryptPosition(walletClient)}
            disabled={!canDecrypt}
            className="w-full bg-fhe-purple hover:bg-fhe-purple/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {decrypting ? "Decrypting via Gateway..." : "Decrypt My Position"}
          </button>
        </>
      )}

      {decryptError && (
        <p className="text-red-400 text-sm mt-3 break-words">Error: {decryptError}</p>
      )}

      <p className="text-gray-600 text-xs mt-4">
        Signs an EIP712 permit in MetaMask — the Zama Gateway relayer decrypts only your handles.
        No balance is visible to liquidators or observers.
      </p>
    </div>
  );
}
