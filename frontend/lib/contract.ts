export const PRIVLEND_ABI = [
  // Lender ops
  { type: "function", name: "lend", stateMutability: "payable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "withdrawLiquidity",
    stateMutability: "nonpayable",
    inputs: [{ name: "shareAmount", type: "uint256" }],
    outputs: [],
  },
  // Borrower ops
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [
      { name: "inputHandle", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawCollateral",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "inputHandle", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "plainAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "payable",
    inputs: [
      { name: "inputHandle", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "checkHealth",
    stateMutability: "nonpayable",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "liquidate",
    stateMutability: "payable",
    inputs: [
      { name: "borrower", type: "address" },
      { name: "inputHandle", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
  // View functions
  { type: "function", name: "lendingPool", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalShares", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalETH", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "availableToLend", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "utilizationBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "lenderShares",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "collateralETH",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "plainDebt",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "maxBorrowable",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "hasBorrowPosition",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "hasCollateral",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  // Events
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CollateralWithdrawn",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Borrowed",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Repaid",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Liquidated",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "liquidator", type: "address", indexed: true },
      { name: "repayAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LiquidityAdded",
    inputs: [
      { name: "lender", type: "address", indexed: true },
      { name: "ethAmount", type: "uint256", indexed: false },
      { name: "sharesIssued", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LiquidityRemoved",
    inputs: [
      { name: "lender", type: "address", indexed: true },
      { name: "ethAmount", type: "uint256", indexed: false },
      { name: "sharesBurned", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "HealthChecked",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "caller", type: "address", indexed: true },
    ],
  },
] as const;

if (!process.env.NEXT_PUBLIC_CONTRACT_ADDRESS) {
  throw new Error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS — check your .env.local");
}
export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
