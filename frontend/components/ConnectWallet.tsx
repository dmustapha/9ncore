"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain, injected } from "wagmi";
import { sepolia } from "wagmi/chains";
import { shortenAddress } from "@/lib/utils";
import { resetFhevmInstance } from "@/lib/fhevm";

export default function ConnectWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  // useAccount().chainId is the actual wallet chain — not useChainId() which
  // returns the last configured chain and lies when wallet is on mainnet.
  const isWrongNetwork = isConnected && chainId !== sepolia.id;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        {isWrongNetwork ? (
          <button
            onClick={() => switchChain({ chainId: sepolia.id })}
            disabled={isSwitching}
            className="flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.4)] rounded-full px-4 py-1.5 hover:bg-[rgba(239,68,68,0.2)] transition-colors disabled:opacity-60 cursor-pointer"
          >
            <div className="w-2 h-2 bg-[#EF4444] rounded-full animate-pulse" />
            <span className="text-[#EF4444] text-xs font-semibold font-mono">
              {isSwitching ? "Switching..." : "Wrong network — click to switch to Sepolia"}
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-[rgba(45,212,191,0.08)] border border-[rgba(45,212,191,0.30)] rounded-full px-4 py-1.5">
            <div className="w-2 h-2 bg-teal rounded-full animate-pulse" />
            <span className="text-teal-soft text-xs font-mono">
              {shortenAddress(address)}
            </span>
          </div>
        )}
        <button
          onClick={() => { resetFhevmInstance(); disconnect(); }}
          className="text-[#9CA3AF] hover:text-[#E8EAF0] text-xs font-mono transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => connect({ connector: injected() })}
        disabled={isPending}
        className="bg-teal hover:bg-teal/90 disabled:opacity-50 text-void font-bold text-sm px-5 py-2 rounded-lg transition-colors"
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && (
        <p className="text-[#EF4444] text-xs max-w-xs text-right">{error.message}</p>
      )}
    </div>
  );
}
