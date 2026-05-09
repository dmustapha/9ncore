"use client";

import { useReadContracts } from "wagmi";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { formatETH, bpsToPercent } from "@/lib/utils";

export function usePoolStats() {
  const contract = { address: CONTRACT_ADDRESS, abi: PRIVLEND_ABI } as const;

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { ...contract, functionName: "totalETH" },
      { ...contract, functionName: "availableToLend" },
      { ...contract, functionName: "totalShares" },
      { ...contract, functionName: "utilizationBps" },
    ],
    query: { refetchInterval: 10_000 },
  });

  const [totalETH, availableToLend, totalShares, utilizationBps] = data ?? [];

  return {
    isLoading,
    refetch,
    totalETH: totalETH?.result as bigint | undefined,
    availableToLend: availableToLend?.result as bigint | undefined,
    totalShares: totalShares?.result as bigint | undefined,
    utilizationBps: utilizationBps?.result as bigint | undefined,
    // Formatted
    totalETHStr: totalETH?.result !== undefined ? formatETH(totalETH.result as bigint) : "...",
    availableToLendStr: availableToLend?.result !== undefined ? formatETH(availableToLend.result as bigint) : "...",
    utilizationStr: utilizationBps?.result !== undefined
      ? bpsToPercent(utilizationBps.result as bigint)
      : "...",
  };
}
