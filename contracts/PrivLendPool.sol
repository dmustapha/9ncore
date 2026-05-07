// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PrivLendPool — Confidential Lending Pool on Zama FHEVM Sepolia
contract PrivLendPool is ZamaEthereumConfig {
    mapping(address => euint128) private _collateral;
    mapping(address => euint128) private _debt;
    mapping(address => ebool) private _healthFlag;
    mapping(address => euint128) private _healthNumerator;
    uint256 public lendingPool;
    mapping(address => uint256) public lenderShares;
    uint256 public totalShares;
    mapping(address => uint256) public lastBorrowBlock;
    mapping(address => bool) private _hasCollateral;
    mapping(address => bool) private _hasDebt;
    uint256 public constant LTV_DENOMINATOR = 150;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    uint256 public constant INTEREST_RATE_PER_BLOCK_BPS = 1;
    uint256 private constant BPS = 10_000;

    event LiquidityAdded(address indexed lender, uint256 ethAmount, uint256 sharesIssued);
    event LiquidityRemoved(address indexed lender, uint256 ethAmount, uint256 sharesBurned);
    event Deposited(address indexed borrower);
    event Borrowed(address indexed borrower, uint256 amount);
    event Repaid(address indexed borrower);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 repayAmount);
    event HealthChecked(address indexed borrower, address indexed caller);

    error NoEthSent();
    error InsufficientPoolLiquidity(uint256 requested, uint256 available);
    error ZeroAmount();
    error InsufficientShares(uint256 requested, uint256 held);
    error NoBorrowPosition();
    error TransferFailed();
    error InsufficientContractBalance();

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
        (bool ok, ) = payable(msg.sender).call{value: ethAmount}("");
        if (!ok) revert TransferFailed();
        emit LiquidityRemoved(msg.sender, ethAmount, shareAmount);
    }

    function deposit(bytes32 inputHandle, bytes calldata inputProof) external payable {
        if (msg.value == 0) revert NoEthSent();
        euint128 depositAmt = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        if (!_hasCollateral[msg.sender]) {
            _collateral[msg.sender] = depositAmt;
            _hasCollateral[msg.sender] = true;
        } else {
            _collateral[msg.sender] = FHE.add(_collateral[msg.sender], depositAmt);
        }
        FHE.allowThis(_collateral[msg.sender]);
        FHE.allow(_collateral[msg.sender], msg.sender);
        emit Deposited(msg.sender);
    }

    function borrow(bytes32 inputHandle, bytes calldata inputProof, uint256 plainAmount) external {
        if (plainAmount == 0) revert ZeroAmount();
        if (plainAmount > lendingPool) {
            revert InsufficientPoolLiquidity(plainAmount, lendingPool);
        }
        euint128 debtToAdd = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        if (!_hasDebt[msg.sender]) {
            _debt[msg.sender] = debtToAdd;
            _hasDebt[msg.sender] = true;
        } else {
            _debt[msg.sender] = FHE.add(_debt[msg.sender], debtToAdd);
        }
        lastBorrowBlock[msg.sender] = block.number;
        lendingPool -= plainAmount;
        FHE.allowThis(_debt[msg.sender]);
        FHE.allow(_debt[msg.sender], msg.sender);
        (bool ok, ) = payable(msg.sender).call{value: plainAmount}("");
        if (!ok) revert TransferFailed();
        emit Borrowed(msg.sender, plainAmount);
    }

    function repay(bytes32 inputHandle, bytes calldata inputProof) external payable {
        if (msg.value == 0) revert NoEthSent();
        if (!_hasDebt[msg.sender]) revert NoBorrowPosition();
        uint256 blocksDelta = block.number - lastBorrowBlock[msg.sender];
        uint256 interestBps = blocksDelta * INTEREST_RATE_PER_BLOCK_BPS;
        uint8 interestBpsU8 = uint8(interestBps > 255 ? 255 : interestBps);
        // WARNING: FHE.mul(euint128, uint8) — UNVERIFIED scalar pattern (DEV-001)
        euint128 interestFraction = FHE.mul(_debt[msg.sender], interestBpsU8);
        euint128 interest = FHE.div(interestFraction, uint128(BPS));
        euint128 totalDebt = FHE.add(_debt[msg.sender], interest);
        euint128 repayEncrypted = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        euint128 actualRepay = FHE.min(totalDebt, repayEncrypted);
        _debt[msg.sender] = FHE.sub(totalDebt, actualRepay);
        lastBorrowBlock[msg.sender] = block.number;
        lendingPool += msg.value;
        FHE.allowThis(_debt[msg.sender]);
        FHE.allow(_debt[msg.sender], msg.sender);
        emit Repaid(msg.sender);
    }

    function checkHealth(address borrower) external {
        require(_hasCollateral[borrower] || _hasDebt[borrower], "No position");
        // WARNING: FHE.mul(euint128, uint8) — UNVERIFIED scalar pattern (DEV-001)
        euint128 scaledCollateral = FHE.mul(_collateral[borrower], uint8(100));
        euint128 scaledDebt = FHE.mul(_debt[borrower], uint8(150));
        ebool isHealthy = FHE.ge(scaledCollateral, scaledDebt);
        _healthFlag[borrower] = isHealthy;
        _healthNumerator[borrower] = scaledCollateral;
        FHE.allowThis(_healthFlag[borrower]);
        FHE.allow(_healthFlag[borrower], msg.sender);
        FHE.allowThis(_healthNumerator[borrower]);
        FHE.allow(_healthNumerator[borrower], borrower);
        emit HealthChecked(borrower, msg.sender);
    }

    function liquidate(address borrower, bytes32 inputHandle, bytes calldata inputProof) external payable {
        if (msg.value == 0) revert NoEthSent();
        if (!_hasDebt[borrower]) revert NoBorrowPosition();
        euint128 repayEncrypted = FHE.fromExternal(externalEuint128.wrap(inputHandle), inputProof);
        euint128 actualRepay = FHE.min(_debt[borrower], repayEncrypted);
        _debt[borrower] = FHE.sub(_debt[borrower], actualRepay);
        FHE.allowThis(_debt[borrower]);
        FHE.allow(_debt[borrower], borrower);
        uint256 bonus = (msg.value * LIQUIDATION_BONUS_BPS) / BPS;
        uint256 collateralToRelease = msg.value + bonus;
        if (address(this).balance < collateralToRelease) revert InsufficientContractBalance();
        lendingPool += msg.value;
        (bool ok, ) = payable(msg.sender).call{value: collateralToRelease}("");
        if (!ok) revert TransferFailed();
        emit Liquidated(borrower, msg.sender, msg.value);
    }

    function totalETH() external view returns (uint256) { return address(this).balance; }
    function availableToLend() external view returns (uint256) { return lendingPool; }
    function utilizationBps() external view returns (uint256) {
        uint256 totalLent = lendingPool + (address(this).balance - lendingPool);
        if (totalLent == 0) return 0;
        uint256 borrowed = totalLent > lendingPool ? totalLent - lendingPool : 0;
        return (borrowed * BPS) / totalLent;
    }
    function hasBorrowPosition(address addr) external view returns (bool) { return _hasDebt[addr]; }
    function hasCollateral(address addr) external view returns (bool) { return _hasCollateral[addr]; }

    receive() external payable {}
}
