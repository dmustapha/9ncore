// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title PrivLendPool — Confidential ETH/USDC Lending Pool on Zama FHEVM Sepolia
/// @notice Borrowers deposit ETH as collateral and borrow USDC.
///         Debt and collateral are stored as FHE-encrypted ciphertexts.
///         Lenders provide USDC liquidity and earn 5% APR from borrower interest.
contract PrivLendPool is ZamaEthereumConfig {
    IERC20 public immutable usdc;

    // Encrypted position state
    mapping(address => euint128) private _collateral; // encrypted ETH collateral (wei)
    mapping(address => euint128) private _debt;       // encrypted USDC debt (6 decimals)
    mapping(address => ebool)    private _healthFlag;
    mapping(address => euint128) private _healthNumerator;

    // Plaintext tracking for LTV enforcement, UI, and state resets
    mapping(address => uint256) public collateralETH; // deposited ETH in wei
    mapping(address => uint256) public plainDebt;     // outstanding USDC principal (6 decimals)

    // Lending pool (USDC, 6 decimals)
    uint256 public lendingPool;
    mapping(address => uint256) public lenderShares;
    uint256 public totalShares;

    // Interest accrual
    mapping(address => uint256) public lastBorrowBlock;

    // Position flags
    mapping(address => bool) private _hasCollateral;
    mapping(address => bool) private _hasDebt;

    // Protocol parameters
    /// @dev 1 ETH = 2000 USDC (fixed testnet price, no oracle)
    uint256 public constant ETH_PRICE_USDC     = 2_000;
    /// @dev Adjusts ETH (18 decimals) to USDC (6 decimals): 10^(18-6)
    uint256 public constant DECIMAL_ADJUSTMENT = 1e12;
    uint256 public constant MAX_LTV_BPS        = 6_667;    // 66.67% LTV → 150% collateral ratio
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;   // 5% bonus to liquidators
    uint256 public constant ANNUAL_RATE_BPS    = 500;      // 5% APR
    uint256 public constant BLOCKS_PER_YEAR    = 2_628_000; // ~12s blocks on Sepolia
    uint256 private constant BPS               = 10_000;

    // Events
    event LiquidityAdded(address indexed lender, uint256 usdcAmount, uint256 sharesIssued);
    event LiquidityRemoved(address indexed lender, uint256 usdcAmount, uint256 sharesBurned);
    event Deposited(address indexed borrower, uint256 ethAmount);
    event CollateralWithdrawn(address indexed borrower, uint256 ethAmount);
    event Borrowed(address indexed borrower, uint256 usdcAmount);
    event Repaid(address indexed borrower, uint256 usdcAmount);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 usdcRepaid, uint256 ethReleased);
    event HealthChecked(address indexed borrower, address indexed caller);

    // Errors
    error ZeroAmount();
    error InsufficientPoolLiquidity(uint256 requested, uint256 available);
    error InsufficientShares(uint256 requested, uint256 held);
    error NoBorrowPosition();
    error ActiveDebtPosition();
    error InsufficientCollateral();
    error ExceedsMaxLTV();
    error TransferFailed();
    error InsufficientContractBalance();

    constructor(address usdcToken) {
        usdc = IERC20(usdcToken);
    }

    // ─── Lender Functions ────────────────────────────────────────────────────

    /// @notice Deposit USDC into the lending pool. Requires prior ERC-20 approval.
    function lend(uint256 usdcAmount) external {
        if (usdcAmount == 0) revert ZeroAmount();
        usdc.transferFrom(msg.sender, address(this), usdcAmount);
        uint256 shares;
        if (totalShares == 0 || lendingPool == 0) {
            shares = usdcAmount;
        } else {
            shares = (usdcAmount * totalShares) / lendingPool;
        }
        lenderShares[msg.sender] += shares;
        totalShares += shares;
        lendingPool += usdcAmount;
        emit LiquidityAdded(msg.sender, usdcAmount, shares);
    }

    /// @notice Withdraw USDC proportional to share amount.
    function withdrawLiquidity(uint256 shareAmount) external {
        if (shareAmount == 0) revert ZeroAmount();
        if (lenderShares[msg.sender] < shareAmount) {
            revert InsufficientShares(shareAmount, lenderShares[msg.sender]);
        }
        uint256 usdcAmount = (shareAmount * lendingPool) / totalShares;
        if (usdc.balanceOf(address(this)) < usdcAmount) revert InsufficientContractBalance();
        lenderShares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        lendingPool -= usdcAmount;
        usdc.transfer(msg.sender, usdcAmount);
        emit LiquidityRemoved(msg.sender, usdcAmount, shareAmount);
    }

    // ─── Borrower Functions ──────────────────────────────────────────────────

    /// @notice Deposit ETH as collateral. Amount is FHE-encrypted on-chain.
    function deposit(bytes32 inputHandle, bytes calldata inputProof) external payable {
        if (msg.value == 0) revert ZeroAmount();
        euint128 depositAmt = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        if (!_hasCollateral[msg.sender]) {
            _collateral[msg.sender] = depositAmt;
            _hasCollateral[msg.sender] = true;
        } else {
            _collateral[msg.sender] = FHE.add(_collateral[msg.sender], depositAmt);
        }
        collateralETH[msg.sender] += msg.value;
        FHE.allowThis(_collateral[msg.sender]);
        FHE.allow(_collateral[msg.sender], msg.sender);
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraw ETH collateral. Only allowed when debt is fully repaid.
    function withdrawCollateral(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (_hasDebt[msg.sender]) revert ActiveDebtPosition();
        if (collateralETH[msg.sender] < amount) revert InsufficientCollateral();
        if (address(this).balance < amount) revert InsufficientContractBalance();

        collateralETH[msg.sender] -= amount;
        _collateral[msg.sender] = FHE.sub(_collateral[msg.sender], uint128(amount));
        FHE.allowThis(_collateral[msg.sender]);
        FHE.allow(_collateral[msg.sender], msg.sender);

        if (collateralETH[msg.sender] == 0) {
            _hasCollateral[msg.sender] = false;
        }

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit CollateralWithdrawn(msg.sender, amount);
    }

    /// @notice Borrow USDC against ETH collateral. Max LTV is 66.67% (1 ETH = 2000 USDC fixed).
    /// @param plainAmount USDC amount to borrow in 6-decimal units (e.g. 100 USDC = 100_000_000)
    function borrow(bytes32 inputHandle, bytes calldata inputProof, uint256 plainAmount) external {
        if (plainAmount == 0) revert ZeroAmount();
        if (plainAmount > lendingPool) revert InsufficientPoolLiquidity(plainAmount, lendingPool);

        // LTV check: plainAmount (USDC) <= collateralETH (wei) * ETH_PRICE_USDC * MAX_LTV_BPS / (BPS * DECIMAL_ADJUSTMENT)
        uint256 maxBorrowUSDC = (collateralETH[msg.sender] * ETH_PRICE_USDC * MAX_LTV_BPS) / (BPS * DECIMAL_ADJUSTMENT);
        uint256 alreadyOwed = plainDebt[msg.sender];
        if (plainAmount + alreadyOwed > maxBorrowUSDC) revert ExceedsMaxLTV();

        euint128 debtToAdd = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        if (!_hasDebt[msg.sender]) {
            _debt[msg.sender] = debtToAdd;
            _hasDebt[msg.sender] = true;
        } else {
            _debt[msg.sender] = FHE.add(_debt[msg.sender], debtToAdd);
        }
        plainDebt[msg.sender] += plainAmount;
        lastBorrowBlock[msg.sender] = block.number;
        lendingPool -= plainAmount;

        FHE.allowThis(_debt[msg.sender]);
        FHE.allow(_debt[msg.sender], msg.sender);

        usdc.transfer(msg.sender, plainAmount);
        emit Borrowed(msg.sender, plainAmount);
    }

    /// @notice Repay USDC debt. Requires prior ERC-20 approval. Overpaying is safe.
    /// @param plainRepayAmount USDC amount in 6-decimal units
    function repay(bytes32 inputHandle, bytes calldata inputProof, uint256 plainRepayAmount) external {
        if (plainRepayAmount == 0) revert ZeroAmount();
        if (!_hasDebt[msg.sender]) revert NoBorrowPosition();

        usdc.transferFrom(msg.sender, address(this), plainRepayAmount);

        // Interest accrual: 5% APR, block-weighted
        uint256 blocksDelta = block.number - lastBorrowBlock[msg.sender];
        uint128 interestBps = uint128((blocksDelta * ANNUAL_RATE_BPS) / BLOCKS_PER_YEAR);
        euint128 interest   = FHE.div(FHE.mul(_debt[msg.sender], interestBps), uint128(BPS));
        euint128 totalDebt  = FHE.add(_debt[msg.sender], interest);

        euint128 repayEncrypted = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        euint128 actualRepay    = FHE.min(totalDebt, repayEncrypted);
        _debt[msg.sender]       = FHE.sub(totalDebt, actualRepay);
        lastBorrowBlock[msg.sender] = block.number;
        lendingPool += plainRepayAmount;

        // Reset debt state when full principal is covered
        if (plainRepayAmount >= plainDebt[msg.sender]) {
            plainDebt[msg.sender] = 0;
            _hasDebt[msg.sender]  = false;
        } else {
            plainDebt[msg.sender] -= plainRepayAmount;
        }

        FHE.allowThis(_debt[msg.sender]);
        FHE.allow(_debt[msg.sender], msg.sender);
        emit Repaid(msg.sender, plainRepayAmount);
    }

    // ─── Risk Functions ──────────────────────────────────────────────────────

    /// @notice Compute health on-chain via FHE.
    ///
    /// Math (derived from standard collateral ratio):
    ///   Healthy when: collateral_USD >= 150% × debt_USD
    ///   collateral_USD = collateralWei × ETH_PRICE_USDC / DECIMAL_ADJUSTMENT
    ///   → collateralWei × 2000 / 1e12 × 100 >= debtUSDC × 150
    ///   → collateralWei × 200_000 >= debtUSDC × 150_000_000_000_000
    ///
    /// Overflow check (uint128 max ≈ 3.4 × 10^38):
    ///   LHS: 1000 ETH × 200_000 = 1000 × 10^18 × 200_000 = 2 × 10^26 ✓
    ///   RHS: 1M USDC × 150_000_000_000_000 = 10^12 × 1.5 × 10^14 = 1.5 × 10^26 ✓
    function checkHealth(address borrower) external {
        require(_hasCollateral[borrower] || _hasDebt[borrower], "No position");

        // LHS: collateral (wei) × 200_000
        euint128 collateralScaled = FHE.mul(_collateral[borrower], uint128(200_000));
        // RHS: debt (USDC 6-decimal units) × 150_000_000_000_000
        euint128 debtScaled       = FHE.mul(_debt[borrower], uint128(150_000_000_000_000));

        ebool isHealthy            = FHE.ge(collateralScaled, debtScaled);
        _healthFlag[borrower]      = isHealthy;
        _healthNumerator[borrower] = collateralScaled; // numerator for borrower to compute ratio

        FHE.allowThis(_healthFlag[borrower]);
        FHE.allow(_healthFlag[borrower], msg.sender);
        FHE.allowThis(_healthNumerator[borrower]);
        FHE.allow(_healthNumerator[borrower], borrower);
        emit HealthChecked(borrower, msg.sender);
    }

    /// @notice Liquidate undercollateralized position. Send USDC, receive ETH + 5% bonus.
    /// @param usdcRepayAmount USDC to repay in 6-decimal units. Requires ERC-20 approval.
    function liquidate(address borrower, bytes32 inputHandle, bytes calldata inputProof, uint256 usdcRepayAmount) external {
        if (usdcRepayAmount == 0) revert ZeroAmount();
        if (!_hasDebt[borrower]) revert NoBorrowPosition();

        usdc.transferFrom(msg.sender, address(this), usdcRepayAmount);

        euint128 repayEncrypted = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        euint128 actualRepay    = FHE.min(_debt[borrower], repayEncrypted);
        _debt[borrower]         = FHE.sub(_debt[borrower], actualRepay);
        FHE.allowThis(_debt[borrower]);
        FHE.allow(_debt[borrower], borrower);

        // ETH to release: usdcRepaid converted to ETH + 5% bonus
        uint256 ethEquivalent = (usdcRepayAmount * DECIMAL_ADJUSTMENT) / ETH_PRICE_USDC;
        uint256 bonus         = (ethEquivalent * LIQUIDATION_BONUS_BPS) / BPS;
        uint256 ethRelease    = ethEquivalent + bonus;
        if (ethRelease > collateralETH[borrower]) ethRelease = collateralETH[borrower];
        if (address(this).balance < ethRelease) revert InsufficientContractBalance();

        if (collateralETH[borrower] <= ethRelease) {
            collateralETH[borrower]  = 0;
            plainDebt[borrower]      = 0;
            _hasCollateral[borrower] = false;
            _hasDebt[borrower]       = false;
        } else {
            collateralETH[borrower] -= ethRelease;
        }

        lendingPool += usdcRepayAmount;
        (bool ok,) = payable(msg.sender).call{value: ethRelease}("");
        if (!ok) revert TransferFailed();
        emit Liquidated(borrower, msg.sender, usdcRepayAmount, ethRelease);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    function totalUSDC() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function availableToLend() external view returns (uint256) {
        return lendingPool;
    }

    function utilizationBps() external view returns (uint256) {
        uint256 total = usdc.balanceOf(address(this));
        if (total == 0) return 0;
        uint256 borrowed = total > lendingPool ? total - lendingPool : 0;
        return (borrowed * BPS) / total;
    }

    /// @notice Maximum additional USDC borrowable given current collateral and existing debt.
    function maxBorrowable(address borrower) external view returns (uint256) {
        uint256 maxByLTV    = (collateralETH[borrower] * ETH_PRICE_USDC * MAX_LTV_BPS) / (BPS * DECIMAL_ADJUSTMENT);
        uint256 alreadyOwed = plainDebt[borrower];
        if (maxByLTV <= alreadyOwed) return 0;
        uint256 headroom    = maxByLTV - alreadyOwed;
        return headroom < lendingPool ? headroom : lendingPool;
    }

    function hasBorrowPosition(address addr) external view returns (bool) { return _hasDebt[addr]; }
    function hasCollateral(address addr) external view returns (bool)      { return _hasCollateral[addr]; }

    receive() external payable {}
}
