"use client";

import { useState, useCallback } from "react";
import { useReadContracts } from "wagmi";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { formatETH, formatHealthRatio } from "@/lib/utils";

export function usePosition(walletAddress?: string) {
  const [collateralWei, setCollateralWei] = useState<bigint | null>(null);
  const [debtWei, setDebtWei] = useState<bigint | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  const contract = { address: CONTRACT_ADDRESS, abi: PRIVLEND_ABI } as const;

  const { data: positionData } = useReadContracts({
    contracts: [
      { ...contract, functionName: "hasCollateral", args: [(walletAddress ?? "0x0") as `0x${string}`] },
      { ...contract, functionName: "hasBorrowPosition", args: [(walletAddress ?? "0x0") as `0x${string}`] },
    ],
    query: { enabled: !!walletAddress },
  });

  const [hasCollateral, hasDebt] = positionData ?? [];

  /**
   * Decrypt encrypted position via userDecrypt.
   * [UNVERIFIED: exact handle retrieval and userDecrypt API]
   */
  const decryptPosition = useCallback(
    async (_signer: any) => {
      if (!walletAddress) return;
      setDecrypting(true);
      setDecryptError(null);

      try {
        // NOTE: Handle retrieval requires the contract to emit events or provide a getter.
        // Since euint128 handles aren't directly returned by view functions,
        // we'll use the checkHealth events to get the handles.
        // [ASSUMED: this pattern may need adjustment based on actual SDK]
        throw new Error("Position decrypt: see HealthPanel for handle-based decrypt");
      } catch (e: any) {
        setDecryptError(e.message);
      } finally {
        setDecrypting(false);
      }
    },
    [walletAddress]
  );

  return {
    hasCollateral: (hasCollateral?.result as boolean) ?? false,
    hasDebt: (hasDebt?.result as boolean) ?? false,
    collateralWei,
    debtWei,
    collateralStr: collateralWei ? formatETH(collateralWei) : null,
    debtStr: debtWei ? formatETH(debtWei) : null,
    healthRatioStr:
      collateralWei && debtWei
        ? formatHealthRatio(collateralWei * 100n, debtWei)
        : null,
    decrypting,
    decryptError,
    decryptPosition,
  };
}
