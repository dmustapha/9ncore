// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC — Testnet USDC for PrivLend demo
/// @notice 6-decimal ERC-20. Owner can mint freely for pool seeding and testing.
///         Anyone can call faucet() to get 10,000 USDC for demo purposes.
contract MockUSDC is ERC20 {
    address public owner;

    event FaucetDrip(address indexed to, uint256 amount);

    constructor() ERC20("Mock USDC", "USDC") {
        owner = msg.sender;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Owner-only mint for pool seeding.
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "Not owner");
        _mint(to, amount);
    }

    /// @notice Public faucet — drips 10,000 USDC per call. No limit (testnet only).
    function faucet() external {
        uint256 amount = 10_000 * 10 ** 6; // 10,000 USDC
        _mint(msg.sender, amount);
        emit FaucetDrip(msg.sender, amount);
    }
}
