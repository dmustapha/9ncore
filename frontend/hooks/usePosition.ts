"use client";

import { useState, useCallback } from "react";
import { useReadContracts, usePublicClient } from "wagmi";
import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import { PRIVLEND_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { formatETH, formatUSDC, formatHealthFactor } from "@/lib/utils";
import { getFhevmInstance } from "@/lib/fhevm";

/** keccak256(abi.encode(address, slot)) — storage slot for mapping(address=>T)[addr] */
function mappingSlot(addr: `0x${string}`, baseSlot: bigint): `0x${string}` {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("address, uint256"), [addr, baseSlot])
  );
}

export function usePosition(walletAddress?: string) {
  const [collateralWei, setCollateralWei] = useState<bigint | null>(null);
  // After migration: debtWei is actually USDC units (6 decimals), not ETH wei.
  // Named debtWei to preserve PositionPanel's destructuring; treat as USDC units.
  const [debtWei, setDebtWei] = useState<bigint | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  const publicClient = usePublicClient();
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
   * Decrypt encrypted collateral + debt via FHEVM Gateway userDecrypt.
   *
   * Flow:
   *  1. Read euint128 handles from storage slots 0 (_collateral, ETH wei) and 1 (_debt, USDC units)
   *  2. Generate ephemeral keypair
   *  3. Sign EIP712 permit (wallet signs, never leaves device)
   *  4. Send handles + permit to Zama relayer — receives only the caller's values
   *
   * @param walletClient — viem WalletClient from useWalletClient().data
   */
  const decryptPosition = useCallback(
    async (walletClient: any) => {
      if (!walletAddress || !publicClient) return;
      setDecrypting(true);
      setDecryptError(null);

      try {
        const instance = await getFhevmInstance();
        const addr = walletAddress as `0x${string}`;

        // 1. Read encrypted handles from contract storage.
        //    slot 0 = _collateral (ETH wei), slot 1 = _debt (USDC units)
        const [rawCollateral, rawDebt] = await Promise.all([
          publicClient.getStorageAt({
            address: CONTRACT_ADDRESS as `0x${string}`,
            slot: mappingSlot(addr, 0n),
          }),
          publicClient.getStorageAt({
            address: CONTRACT_ADDRESS as `0x${string}`,
            slot: mappingSlot(addr, 1n),
          }),
        ]);

        const ZERO = `0x${"0".repeat(64)}`;
        const handles: Array<{ handle: string; contractAddress: string }> = [];
        if (rawCollateral && rawCollateral !== ZERO) {
          handles.push({ handle: rawCollateral, contractAddress: CONTRACT_ADDRESS });
        }
        if (rawDebt && rawDebt !== ZERO) {
          handles.push({ handle: rawDebt, contractAddress: CONTRACT_ADDRESS });
        }

        if (handles.length === 0) {
          throw new Error("No encrypted position found. Deposit collateral first.");
        }

        // 2. Generate ephemeral keypair for this decrypt session
        const { publicKey, privateKey } = instance.generateKeypair();

        // 3. Build EIP712 permit and sign with user's wallet
        const startTimestamp = Math.floor(Date.now() / 1000);
        const durationDays = 1;
        const eip712 = instance.createEIP712(
          publicKey,
          [CONTRACT_ADDRESS],
          startTimestamp,
          durationDays
        );

        const { EIP712Domain: _omit, ...signTypes } = eip712.types as any;
        const signature = await walletClient.signTypedData({
          domain: eip712.domain,
          types: signTypes,
          primaryType: eip712.primaryType,
          message: eip712.message,
        });

        // 4. Request decryption via Zama Gateway relayer
        const results = await instance.userDecrypt(
          handles,
          privateKey,
          publicKey,
          signature,
          [CONTRACT_ADDRESS],
          walletAddress,
          startTimestamp,
          durationDays
        );

        // 5. Update state with decrypted values
        const toBigInt = (v: any): bigint =>
          typeof v === "bigint" ? v : BigInt(String(v));

        if (rawCollateral && rawCollateral !== ZERO) {
          const val = results[rawCollateral as `0x${string}`];
          if (val !== undefined) setCollateralWei(toBigInt(val));
        }
        if (rawDebt && rawDebt !== ZERO) {
          const val = results[rawDebt as `0x${string}`];
          if (val !== undefined) setDebtWei(toBigInt(val));
        }
      } catch (e: any) {
        setDecryptError(e.message);
      } finally {
        setDecrypting(false);
      }
    },
    [walletAddress, publicClient]
  );

  return {
    hasCollateral: (hasCollateral?.result as boolean) ?? false,
    hasDebt: (hasDebt?.result as boolean) ?? false,
    collateralWei,
    debtWei, // USDC units (6 dec) after migration
    collateralStr: collateralWei !== null ? formatETH(collateralWei) : null,
    debtStr: debtWei !== null ? formatUSDC(debtWei) : null,
    healthRatioStr:
      collateralWei !== null && debtWei !== null
        ? formatHealthFactor(collateralWei, debtWei)
        : null,
    decrypting,
    decryptError,
    decryptPosition,
  };
}
