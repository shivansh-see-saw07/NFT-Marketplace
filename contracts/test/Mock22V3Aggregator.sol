// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract Mock22V3Aggregator is AggregatorV3Interface {
    uint8 private _decimals;
    int256 private s_latestAnswer;
    uint80 private s_roundId;

    constructor(uint8 decimals_, int256 initialAnswer) {
        _decimals = decimals_;
        s_latestAnswer = initialAnswer;
        s_roundId = 1;
    }

    // Main function needed for price feed simulations
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            s_roundId,
            s_latestAnswer,
            block.timestamp - 1 hours, // Simulate 1 hour old data
            block.timestamp,
            s_roundId
        );
    }

    // Required interface functions
    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function description() external pure returns (string memory) {
        return "Mock V3 Aggregator";
    }

    function version() external pure returns (uint256) {
        return 4;
    }

    function getRoundData(
        uint80 _roundId
    )
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        require(_roundId <= s_roundId, "Round not complete");
        return (_roundId, s_latestAnswer, block.timestamp - 1 hours, block.timestamp, _roundId);
    }

    // Update functions for testing
    function updateAnswer(int256 newAnswer) external {
        s_latestAnswer = newAnswer;
        s_roundId++;
    }

    function updateDecimals(uint8 newDecimals) external {
        _decimals = newDecimals;
    }
}
