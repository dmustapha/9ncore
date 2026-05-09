"use client";

import { useWriteContract, useSwitchChain, useAccount } from "wagmi";
import { sepolia } from "wagmi/chains";
import type { Abi } from "viem";

type WriteArgs = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  [key: string]: unknown;
};

/**
 * Drop-in replacement for useWriteContract that auto-switches to Sepolia
 * before every transaction if the wallet is on the wrong network.
 *
 * IMPORTANT: uses useAccount().chainId (actual wallet chain) NOT useChainId().
 * useChainId() returns the last *configured* chain when the wallet is on an
 * unsupported chain — it lies. useAccount().chainId is ground truth.
 */
export function useSepoliaWrite() {
  const { writeContractAsync, writeContract, ...rest } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const { chainId } = useAccount();

  const sepoliaWriteAsync = async (args: WriteArgs) => {
    if (chainId !== sepolia.id) {
      await switchChainAsync({ chainId: sepolia.id });
    }
    // Pass chainId as a guard — if switch failed or chain state is stale,
    // wagmi throws ChainMismatchError instead of silently sending to mainnet.
    return writeContractAsync({
      ...args,
      chainId: sepolia.id,
    } as Parameters<typeof writeContractAsync>[0]);
  };

  return { writeContractAsync: sepoliaWriteAsync, ...rest };
}
