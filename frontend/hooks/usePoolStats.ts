"use client";

import { useReadContracts } from "wagmi";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { formatETH, formatUSDC, bpsToPercent } from "@/lib/utils";

export function usePoolStats() {
  const contract = { address: CONTRACT_ADDRESS, abi: PRIVLEND_ABI } as const;

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { ...contract, functionName: "totalUSDC" },
      { ...contract, functionName: "availableToLend" },
      { ...contract, functionName: "totalCollateralETH" },
      { ...contract, functionName: "utilizationBps" },
      { ...contract, functionName: "totalShares" },
    ],
    query: { refetchInterval: 10_000 },
  });

  const [totalUSDC, availableToLend, totalCollateralETH, utilizationBps, totalShares] = data ?? [];

  return {
    isLoading,
    refetch,
    totalUSDC: totalUSDC?.result as bigint | undefined,
    availableToLend: availableToLend?.result as bigint | undefined,
    totalCollateralETH: totalCollateralETH?.result as bigint | undefined,
    utilizationBps: utilizationBps?.result as bigint | undefined,
    totalShares: totalShares?.result as bigint | undefined,
    // Formatted
    totalUSDCStr: totalUSDC?.result !== undefined ? formatUSDC(totalUSDC.result as bigint) : "...",
    availableToLendStr: availableToLend?.result !== undefined ? formatUSDC(availableToLend.result as bigint) : "...",
    totalCollateralETHStr: totalCollateralETH?.result !== undefined ? formatETH(totalCollateralETH.result as bigint) : "...",
    utilizationStr: utilizationBps?.result !== undefined
      ? bpsToPercent(utilizationBps.result as bigint)
      : "...",
  };
}
