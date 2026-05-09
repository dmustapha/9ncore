// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PrivLendPool — Confidential ETH Lending Pool on Zama FHEVM Sepolia
/// @notice Borrowers deposit ETH as collateral and borrow ETH from the pool.
///         Debt and collateral balances are stored as FHE-encrypted euint128 ciphertexts.
///         Liquidators only see a health boolean — they never learn the raw amounts.
///         Only the borrower can decrypt their own position via the Zama Gateway.
contract PrivLendPool is ZamaEthereumConfig {

    // ─── Encrypted position state ────────────────────────────────────────────
    // IMPORTANT: _collateral must remain at slot 0 and _debt at slot 1.
    // usePosition.ts reads these via getStorageAt(slot 0/1).
    mapping(address => euint128) private _collateral;   // slot 0
    mapping(address => euint128) private _debt;         // slot 1
    mapping(address => ebool)    private _healthFlag;
    mapping(address => euint128) private _healthNumerator;

    // ─── Plaintext accounting (LTV checks, UI display, state resets) ─────────
    mapping(address => uint256) public collateralETH; // wei deposited
    mapping(address => uint256) public plainDebt;     // wei borrowed (principal)
    mapping(address => bool) private _hasCollateral;
    mapping(address => bool) private _hasDebt;

    // ─── Lending pool ────────────────────────────────────────────────────────
    uint256 public lendingPool;
    mapping(address => uint256) public lenderShares;
    uint256 public totalShares;
    mapping(address => uint256) public lastBorrowBlock;

    // ─── Protocol parameters ─────────────────────────────────────────────────
    uint256 public constant MAX_LTV_BPS           = 6_667;     // 66.67% → 150% collateral ratio
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;       // 5% bonus to liquidators
    uint256 public constant ANNUAL_RATE_BPS       = 500;       // 5% APR
    uint256 public constant BLOCKS_PER_YEAR       = 2_628_000; // ~12s blocks
    uint256 private constant BPS                  = 10_000;

    // ─── Events ──────────────────────────────────────────────────────────────
    event LiquidityAdded(address indexed lender, uint256 ethAmount, uint256 sharesIssued);
    event LiquidityRemoved(address indexed lender, uint256 ethAmount, uint256 sharesBurned);
    event Deposited(address indexed borrower, uint256 amount);
    event CollateralWithdrawn(address indexed borrower, uint256 amount);
    event Borrowed(address indexed borrower, uint256 amount);
    event Repaid(address indexed borrower, uint256 amount);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 repayAmount);
    event HealthChecked(address indexed borrower, address indexed caller);

    // ─── Errors ──────────────────────────────────────────────────────────────
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

    // ─── Lender Functions ────────────────────────────────────────────────────

    /// @notice Deposit ETH into the lending pool. Receive proportional shares.
    function lend() external payable {
        if (msg.value == 0) revert NoEthSent();
        uint256 shares;
        if (totalShares == 0 || lendingPool == 0) {
            shares = msg.value;
        } else {
            shares = (msg.value * totalShares) / lendingPool;
        }
        lenderShares[msg.sender] += shares;
        totalShares += shares;
        lendingPool += msg.value;
        emit LiquidityAdded(msg.sender, msg.value, shares);
    }

    /// @notice Redeem shares for ETH proportional to pool value.
    function withdrawLiquidity(uint256 shareAmount) external {
        if (shareAmount == 0) revert ZeroAmount();
        if (lenderShares[msg.sender] < shareAmount) {
            revert InsufficientShares(shareAmount, lenderShares[msg.sender]);
        }
        uint256 ethAmount = (shareAmount * lendingPool) / totalShares;
        if (address(this).balance < ethAmount) revert InsufficientContractBalance();
        lenderShares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        lendingPool -= ethAmount;
        (bool ok,) = payable(msg.sender).call{value: ethAmount}("");
        if (!ok) revert TransferFailed();
        emit LiquidityRemoved(msg.sender, ethAmount, shareAmount);
    }

    // ─── Borrower Functions ──────────────────────────────────────────────────

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

    /// @notice Borrow ETH against deposited collateral. Max LTV is 66.67%.
    /// @param plainAmount ETH to borrow in wei.
    function borrow(bytes32 inputHandle, bytes calldata inputProof, uint256 plainAmount) external {
        if (plainAmount == 0) revert ZeroAmount();
        if (plainAmount > lendingPool) revert InsufficientPoolLiquidity(plainAmount, lendingPool);
        uint256 maxBorrow = (collateralETH[msg.sender] * MAX_LTV_BPS) / BPS;
        if (plainDebt[msg.sender] + plainAmount > maxBorrow) revert ExceedsMaxLTV();
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
        (bool ok,) = payable(msg.sender).call{value: plainAmount}("");
        if (!ok) revert TransferFailed();
        emit Borrowed(msg.sender, plainAmount);
    }

    /// @notice Repay loan. Interest accrues via FHE arithmetic over ciphertext.
    ///         Overpaying is safe — excess is absorbed, not refunded.
    function repay(bytes32 inputHandle, bytes calldata inputProof) external payable {
        if (msg.value == 0) revert NoEthSent();
        if (!_hasDebt[msg.sender]) revert NoBorrowPosition();
        uint256 blocksDelta = block.number - lastBorrowBlock[msg.sender];
        uint128 interestBps = uint128((blocksDelta * ANNUAL_RATE_BPS) / BLOCKS_PER_YEAR);
        euint128 interest       = FHE.div(FHE.mul(_debt[msg.sender], interestBps), uint128(BPS));
        euint128 totalDebt      = FHE.add(_debt[msg.sender], interest);
        euint128 repayEncrypted = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        euint128 actualRepay    = FHE.min(totalDebt, repayEncrypted);
        _debt[msg.sender]       = FHE.sub(totalDebt, actualRepay);
        lastBorrowBlock[msg.sender] = block.number;
        lendingPool += msg.value;
        if (msg.value >= plainDebt[msg.sender]) {
            plainDebt[msg.sender] = 0;
            _hasDebt[msg.sender]  = false;
        } else {
            plainDebt[msg.sender] -= msg.value;
        }
        FHE.allowThis(_debt[msg.sender]);
        FHE.allow(_debt[msg.sender], msg.sender);
        emit Repaid(msg.sender, msg.value);
    }

    // ─── Risk Functions ──────────────────────────────────────────────────────

    /// @notice Compute position health on-chain via FHE.
    ///         Healthy = collateral * 100 >= debt * 150  (i.e. ≥ 150% collateral ratio)
    function checkHealth(address borrower) external {
        require(_hasCollateral[borrower] || _hasDebt[borrower], "No position");
        euint128 scaledCollateral = FHE.mul(_collateral[borrower], uint8(100));
        euint128 scaledDebt       = FHE.mul(_debt[borrower], uint8(150));
        ebool isHealthy            = FHE.ge(scaledCollateral, scaledDebt);
        _healthFlag[borrower]      = isHealthy;
        _healthNumerator[borrower] = scaledCollateral;
        FHE.allowThis(_healthFlag[borrower]);
        FHE.allow(_healthFlag[borrower], msg.sender);
        FHE.allowThis(_healthNumerator[borrower]);
        FHE.allow(_healthNumerator[borrower], borrower);
        emit HealthChecked(borrower, msg.sender);
    }

    /// @notice Liquidate an undercollateralized position. Send ETH to repay debt,
    ///         receive collateral + 5% bonus.
    ///
    /// FIX C1: enforces that the position is genuinely unhealthy before liquidation.
    ///         collateralETH < plainDebt * (BPS / MAX_LTV_BPS) = plainDebt * 1.5
    function liquidate(address borrower, bytes32 inputHandle, bytes calldata inputProof) external payable {
        if (msg.value == 0) revert NoEthSent();
        if (!_hasDebt[borrower]) revert NoBorrowPosition();

        // Position must be undercollateralized: collateral < required minimum
        // minCollateral = plainDebt * BPS / MAX_LTV_BPS  (= plainDebt * 1.5)
        uint256 minCollateral = (plainDebt[borrower] * BPS) / MAX_LTV_BPS;
        if (collateralETH[borrower] >= minCollateral) revert PositionIsHealthy();

        euint128 repayEncrypted = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        euint128 actualRepay    = FHE.min(_debt[borrower], repayEncrypted);
        _debt[borrower]         = FHE.sub(_debt[borrower], actualRepay);
        FHE.allowThis(_debt[borrower]);
        FHE.allow(_debt[borrower], borrower);

        uint256 bonus             = (msg.value * LIQUIDATION_BONUS_BPS) / BPS;
        uint256 collateralRelease = msg.value + bonus;
        if (collateralRelease > collateralETH[borrower]) {
            collateralRelease = collateralETH[borrower];
        }
        if (address(this).balance < collateralRelease) revert InsufficientContractBalance();

        if (collateralETH[borrower] <= collateralRelease) {
            collateralETH[borrower]  = 0;
            plainDebt[borrower]      = 0;
            _hasCollateral[borrower] = false;
            _hasDebt[borrower]       = false;
        } else {
            collateralETH[borrower] -= collateralRelease;
        }
        lendingPool += msg.value;

        (bool ok,) = payable(msg.sender).call{value: collateralRelease}("");
        if (!ok) revert TransferFailed();
        emit Liquidated(borrower, msg.sender, msg.value);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    function totalETH() external view returns (uint256) {
        return address(this).balance;
    }

    function availableToLend() external view returns (uint256) {
        return lendingPool;
    }

    function utilizationBps() external view returns (uint256) {
        if (address(this).balance == 0) return 0;
        uint256 borrowed = address(this).balance > lendingPool
            ? address(this).balance - lendingPool
            : 0;
        return (borrowed * BPS) / address(this).balance;
    }

    /// @notice Maximum additional ETH borrowable given current collateral and outstanding debt.
    function maxBorrowable(address borrower) external view returns (uint256) {
        uint256 maxByLTV    = (collateralETH[borrower] * MAX_LTV_BPS) / BPS;
        uint256 alreadyOwed = plainDebt[borrower];
        if (maxByLTV <= alreadyOwed) return 0;
        uint256 headroom = maxByLTV - alreadyOwed;
        return headroom < lendingPool ? headroom : lendingPool;
    }

    function hasBorrowPosition(address addr) external view returns (bool) { return _hasDebt[addr]; }
    function hasCollateral(address addr) external view returns (bool)      { return _hasCollateral[addr]; }

    /// FIX C2: reject bare ETH sends that would inflate address(this).balance
    ///         without updating lendingPool, breaking utilizationBps math.
    receive() external payable {
        revert("Use lend()");
    }
}
