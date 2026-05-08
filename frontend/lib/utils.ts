export function formatETH(wei: bigint, decimals = 4): string {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(decimals) + " ETH";
}

export function formatHealthRatio(numerator: bigint, debt: bigint): string {
  if (debt === 0n) return "∞";
  const ratioBps = Number(numerator) / Number(debt);
  return ratioBps.toFixed(0) + "%";
}

export function shortenAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function parseEtherInput(input: string): bigint {
  const val = parseFloat(input);
  if (isNaN(val) || val <= 0) throw new Error("Invalid ETH amount");
  return BigInt(Math.floor(val * 1e18));
}

export function bpsToPercent(bps: bigint): string {
  return ((Number(bps) / 100)).toFixed(2) + "%";
}
