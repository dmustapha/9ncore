"use client";

import { useAccount, useConnect, useDisconnect, injected } from "wagmi";
import { shortenAddress } from "@/lib/utils";

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-green-900/30 border border-green-500/40 rounded-full px-4 py-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-300 text-sm font-mono">
            {shortenAddress(address)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="bg-fhe-purple hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-full transition-colors"
    >
      Connect Wallet
    </button>
  );
}
