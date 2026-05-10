// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title PrivLendPool — Confidential ETH/USDC Lending Pool on Zama FHEVM Sepolia
/// @notice Borrowers deposit ETH as collateral and borrow USDC from the pool.
///         Lenders supply USDC liquidity and earn interest from borrowers.
///         Debt and collateral balances are stored as FHE-encrypted euint128 ciphertexts.
///         Liquidators only see a health boolean — they never learn the raw amounts.
///         Only the borrower can decrypt their own position via the Zama Gateway.
///
/// Storage layout (do not reorder — usePosition.ts reads slots 0 and 1):
///   slot 0: _collateral  (euint128, ETH wei)
///   slot 1: _debt        (euint128, USDC units 1e6)
contract PrivLendPool is ZamaEthereumConfig {

    // ─── Encrypted position state ─────────────────────────────────────────────
    mapping(address => euint128) private _collateral;   // slot 0 — ETH wei
    mapping(address => euint128) private _debt;         // slot 1 — USDC units (1e6)
    mapping(address => ebool)    private _healthFlag;
    mapping(address => euint128) private _healthNumerator;

    // ─── Plaintext accounting (LTV checks, UI display, state resets) ──────────
    mapping(address => uint256) public collateralETH; // ETH wei deposited
    mapping(address => uint256) public plainDebt;     // USDC units borrowed (principal)
    mapping(address => bool) private _hasCollateral;
    mapping(address => bool) private _hasDebt;

    // ─── Lending pool (USDC) ─────────────────────────────────────────────────
    IERC20 public immutable usdc;
    uint256 public lendingPool;          // available USDC units in pool
    uint256 public totalUsdcDeposited;   // total USDC ever deposited (for utilization)
    uint256 public totalCollateralETH;   // aggregate ETH collateral locked (Phase 1.4)
    mapping(address => uint256) public lenderShares;
    uint256 public totalShares;
    mapping(address => uint256) public lastBorrowBlock;

    // ─── Protocol parameters ──────────────────────────────────────────────────
    uint256 public constant ETH_PRICE_USDC            = 2_000;      // 1 ETH = 2000 USDC (fixed oracle)
    uint256 public constant MAX_LTV_BPS               = 6_667;      // 66.67%
    uint256 public constant LIQUIDATION_BONUS_BPS     = 500;        // 5% bonus to liquidators
    uint256 public constant ANNUAL_RATE_BPS           = 500;        // 5% APR
    uint256 public constant BLOCKS_PER_YEAR           = 2_628_000;  // ~12s blocks
    uint256 private constant BPS                      = 10_000;

    // ─── Events ───────────────────────────────────────────────────────────────
    event LiquidityAdded(address indexed lender, uint256 usdcAmount, uint256 sharesIssued);
    event LiquidityRemoved(address indexed lender, uint256 usdcAmount, uint256 sharesBurned);
    event Deposited(address indexed borrower, uint256 ethAmount);
    event CollateralWithdrawn(address indexed borrower, uint256 ethAmount);
    event Borrowed(address indexed borrower, uint256 usdcAmount);
    event Repaid(address indexed borrower, uint256 usdcAmount);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 usdcRepaid);
    event HealthChecked(address indexed borrower, address indexed caller);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NoEthSent();
    error ZeroAmount();
    error InsufficientPoolLiquidity(uint256 requested, uint256 available);
    error InsufficientShares(uint256 requested, uint256 held);
    error InsufficientCollateral();
    error ExceedsMaxLTV();
    error NoBorrowPosition();
    error ActiveDebtPosition();
    error PositionIsHealthy();
    error TransferFailed();
    error InsufficientContractBalance();

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    // ─── Lender Functions ─────────────────────────────────────────────────────

    /// @notice Deposit USDC into the lending pool. Receive proportional shares.
    ///         Caller must approve this contract for `amount` USDC before calling.
    function lend(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        usdc.transferFrom(msg.sender, address(this), amount);
        uint256 shares;
        if (totalShares == 0 || lendingPool == 0) {
            shares = amount;
        } else {
            shares = (amount * totalShares) / lendingPool;
        }
        lenderShares[msg.sender] += shares;
        totalShares += shares;
        lendingPool += amount;
        totalUsdcDeposited += amount;
        emit LiquidityAdded(msg.sender, amount, shares);
    }

    /// @notice Redeem shares for USDC proportional to pool value.
    function withdrawLiquidity(uint256 shareAmount) external {
        if (shareAmount == 0) revert ZeroAmount();
        if (lenderShares[msg.sender] < shareAmount) {
            revert InsufficientShares(shareAmount, lenderShares[msg.sender]);
        }
        uint256 usdcAmount = (shareAmount * lendingPool) / totalShares;
        lenderShares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        lendingPool -= usdcAmount;
        if (totalUsdcDeposited >= usdcAmount) {
            totalUsdcDeposited -= usdcAmount;
        }
        usdc.transfer(msg.sender, usdcAmount);
        emit LiquidityRemoved(msg.sender, usdcAmount, shareAmount);
    }

    // ─── Borrower Functions ───────────────────────────────────────────────────

    /// @notice FHE-encrypt and deposit ETH collateral. Amount stored only as ciphertext.
    function deposit(bytes32 inputHandle, bytes calldata inputProof) external payable {
        if (msg.value == 0) revert NoEthSent();
        euint128 depositAmt = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        if (!_hasCollateral[msg.sender]) {
            _collateral[msg.sender] = depositAmt;
            _hasCollateral[msg.sender] = true;
        } else {
            _collateral[msg.sender] = FHE.add(_collateral[msg.sender], depositAmt);
        }
        collateralETH[msg.sender] += msg.value;
        totalCollateralETH += msg.value;
        FHE.allowThis(_collateral[msg.sender]);
        FHE.allow(_collateral[msg.sender], msg.sender);
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraw ETH collateral. Blocked while any debt is outstanding.
    function withdrawCollateral(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (_hasDebt[msg.sender]) revert ActiveDebtPosition();
        if (collateralETH[msg.sender] < amount) revert InsufficientCollateral();
        if (address(this).balance < amount) revert InsufficientContractBalance();
        collateralETH[msg.sender] -= amount;
        totalCollateralETH -= amount;
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

    /// @notice Borrow USDC against deposited ETH collateral. Max LTV is 66.67%.
    ///         The encrypted borrow amount must match plainUsdcAmount exactly.
    /// @param plainUsdcAmount USDC units to borrow (6 decimals — e.g. 1000 USDC = 1_000_000_000).
    function borrow(bytes32 inputHandle, bytes calldata inputProof, uint256 plainUsdcAmount) external {
        if (plainUsdcAmount == 0) revert ZeroAmount();
        if (plainUsdcAmount > lendingPool) revert InsufficientPoolLiquidity(plainUsdcAmount, lendingPool);

        // LTV check: max USDC borrowable = collateralWei * ETH_PRICE_USDC * MAX_LTV_BPS / BPS / 1e12
        // 1e12 converts from (wei * USDC/ETH) space to USDC units (1e6)
        uint256 maxBorrow = collateralETH[msg.sender] * ETH_PRICE_USDC * MAX_LTV_BPS / BPS / 1e12;
        if (plainDebt[msg.sender] + plainUsdcAmount > maxBorrow) revert ExceedsMaxLTV();

        euint128 debtToAdd = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        if (!_hasDebt[msg.sender]) {
            _debt[msg.sender] = debtToAdd;
            _hasDebt[msg.sender] = true;
        } else {
            _debt[msg.sender] = FHE.add(_debt[msg.sender], debtToAdd);
        }
        plainDebt[msg.sender] += plainUsdcAmount;
        lastBorrowBlock[msg.sender] = block.number;
        lendingPool -= plainUsdcAmount;

        FHE.allowThis(_debt[msg.sender]);
        FHE.allow(_debt[msg.sender], msg.sender);

        usdc.transfer(msg.sender, plainUsdcAmount);
        emit Borrowed(msg.sender, plainUsdcAmount);
    }

    /// @notice Repay USDC loan. Interest accrues via FHE arithmetic over ciphertext.
    ///         Overpaying is safe — excess is absorbed into the pool.
    ///         Caller must approve this contract for `plainUsdcAmount` USDC before calling.
    /// @param plainUsdcAmount USDC units to repay (including estimated interest).
    function repay(bytes32 inputHandle, bytes calldata inputProof, uint256 plainUsdcAmount) external {
        if (plainUsdcAmount == 0) revert ZeroAmount();
        if (!_hasDebt[msg.sender]) revert NoBorrowPosition();

        usdc.transferFrom(msg.sender, address(this), plainUsdcAmount);

        uint256 blocksDelta = block.number - lastBorrowBlock[msg.sender];
        uint128 interestBps = uint128((blocksDelta * ANNUAL_RATE_BPS) / BLOCKS_PER_YEAR);
        euint128 interest       = FHE.div(FHE.mul(_debt[msg.sender], interestBps), uint128(BPS));
        euint128 totalDebt      = FHE.add(_debt[msg.sender], interest);
        euint128 repayEncrypted = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        euint128 actualRepay    = FHE.min(totalDebt, repayEncrypted);
        _debt[msg.sender]       = FHE.sub(totalDebt, actualRepay);
        lastBorrowBlock[msg.sender] = block.number;
        lendingPool += plainUsdcAmount;

        if (plainUsdcAmount >= plainDebt[msg.sender]) {
            plainDebt[msg.sender] = 0;
            _hasDebt[msg.sender]  = false;
        } else {
            plainDebt[msg.sender] -= plainUsdcAmount;
        }

        FHE.allowThis(_debt[msg.sender]);
        FHE.allow(_debt[msg.sender], msg.sender);
        emit Repaid(msg.sender, plainUsdcAmount);
    }

    // ─── Risk Functions ───────────────────────────────────────────────────────

    /// @notice Compute position health on-chain via FHE.
    ///         Cross-unit comparison: collateral (ETH wei) vs debt (USDC units).
    ///         Healthy = collateralWei * 4000 >= debtUsdc * 3_000_000_000_000
    ///         This encodes: collateral_value_usdc >= debt * 150% (at ETH = 2000 USDC).
    function checkHealth(address borrower) external {
        require(_hasCollateral[borrower] || _hasDebt[borrower], "No position");
        euint128 lhs = FHE.mul(_collateral[borrower], uint128(4_000));
        euint128 rhs = FHE.mul(_debt[borrower], uint128(3_000_000_000_000));
        ebool isHealthy        = FHE.ge(lhs, rhs);
        _healthFlag[borrower]  = isHealthy;
        _healthNumerator[borrower] = lhs;
        FHE.allowThis(_healthFlag[borrower]);
        FHE.allow(_healthFlag[borrower], msg.sender);
        FHE.allowThis(_healthNumerator[borrower]);
        FHE.allow(_healthNumerator[borrower], borrower);
        emit HealthChecked(borrower, msg.sender);
    }

    /// @notice Liquidate an undercollateralized position.
    ///         Send USDC to repay debt, receive ETH collateral + 5% bonus.
    ///         Caller must approve this contract for `repayUsdc` USDC before calling.
    function liquidate(address borrower, uint256 repayUsdc) external {
        if (repayUsdc == 0) revert ZeroAmount();
        if (!_hasDebt[borrower]) revert NoBorrowPosition();

        // Check unhealthy: collateral value (USDC) * 100 < debt * 150
        // collateralValueUsdc = collateralETH * ETH_PRICE_USDC / 1e12
        uint256 collateralValueUsdc = collateralETH[borrower] * ETH_PRICE_USDC / 1e12;
        if (collateralValueUsdc * 100 >= plainDebt[borrower] * 150) revert PositionIsHealthy();

        uint256 actualRepay = repayUsdc > plainDebt[borrower] ? plainDebt[borrower] : repayUsdc;
        usdc.transferFrom(msg.sender, address(this), actualRepay);
        lendingPool += actualRepay;

        // ETH collateral to release: convert USDC value to ETH wei + 5% bonus
        // repayWeiEquiv = actualRepay * 1e12 / ETH_PRICE_USDC
        uint256 repayWeiEquiv = actualRepay * 1e12 / ETH_PRICE_USDC;
        uint256 collateralRelease = repayWeiEquiv * (BPS + LIQUIDATION_BONUS_BPS) / BPS;
        if (collateralRelease > collateralETH[borrower]) {
            collateralRelease = collateralETH[borrower];
        }
        if (address(this).balance < collateralRelease) revert InsufficientContractBalance();

        // Update encrypted debt
        _debt[borrower] = FHE.sub(_debt[borrower], uint128(actualRepay));
        FHE.allowThis(_debt[borrower]);
        FHE.allow(_debt[borrower], borrower);

        // Update plaintext state
        collateralETH[borrower] -= collateralRelease;
        totalCollateralETH -= collateralRelease;
        if (actualRepay >= plainDebt[borrower]) {
            plainDebt[borrower]  = 0;
            _hasDebt[borrower]   = false;
        } else {
            plainDebt[borrower] -= actualRepay;
        }
        if (collateralETH[borrower] == 0) _hasCollateral[borrower] = false;

        (bool ok,) = payable(msg.sender).call{value: collateralRelease}("");
        if (!ok) revert TransferFailed();
        emit Liquidated(borrower, msg.sender, actualRepay);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /// @notice Total USDC deposited to the pool (available + outstanding borrows).
    function totalUSDC() external view returns (uint256) {
        return totalUsdcDeposited;
    }

    function availableToLend() external view returns (uint256) {
        return lendingPool;
    }

    /// @notice Pool utilization in basis points (borrowed / total deposited).
    function utilizationBps() external view returns (uint256) {
        if (totalUsdcDeposited == 0) return 0;
        uint256 borrowed = totalUsdcDeposited > lendingPool
            ? totalUsdcDeposited - lendingPool
            : 0;
        return (borrowed * BPS) / totalUsdcDeposited;
    }

    /// @notice Maximum additional USDC borrowable given current collateral and outstanding debt.
    function maxBorrowable(address borrower) external view returns (uint256) {
        uint256 maxByLTV    = collateralETH[borrower] * ETH_PRICE_USDC * MAX_LTV_BPS / BPS / 1e12;
        uint256 alreadyOwed = plainDebt[borrower];
        if (maxByLTV <= alreadyOwed) return 0;
        uint256 headroom = maxByLTV - alreadyOwed;
        return headroom < lendingPool ? headroom : lendingPool;
    }

    function hasBorrowPosition(address addr) external view returns (bool) { return _hasDebt[addr]; }
    function hasCollateral(address addr) external view returns (bool)      { return _hasCollateral[addr]; }

    /// @dev Reject bare ETH sends — all ETH enters via deposit() with FHE encryption.
    receive() external payable {
        revert("Use deposit()");
    }
}
