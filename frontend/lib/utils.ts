export function formatETH(wei: bigint, decimals = 4): string {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(decimals) + " ETH";
}

export function formatUSDC(units: bigint, decimals = 2): string {
  const usdc = Number(units) / 1e6;
  return "$" + usdc.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Health factor as Aave-style decimal (≥1.0 = healthy).
 *  collateralWei = ETH wei, debtUsdc = USDC units (6 dec)
 */
export function formatHealthFactor(collateralWei: bigint, debtUsdc: bigint): string {
  if (debtUsdc === 0n) return "∞";
  const ETH_PRICE = 2000n;
  // collateralValue in USDC units = collateralWei * 2000 / 1e12
  const collateralUsdc = (collateralWei * ETH_PRICE) / 1_000_000_000_000n;
  // health factor * 100 = collateralUsdc * 100 / (debtUsdc * 150)
  const hf100 = (collateralUsdc * 100n) / (debtUsdc * 150n);
  return (Number(hf100) / 100).toFixed(2);
}

export function shortenAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function bpsToPercent(bps: bigint): string {
  return ((Number(bps) / 100)).toFixed(2) + "%";
}
