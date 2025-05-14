const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    if (developmentChains.includes(network.name)) {
        console.log("Local network detected! Deploying mocks...")

        // Deploy MockERC20
        await deploy("MockERC20", {
            from: deployer,
            log: true,
            args: [],
        })

        // Deploy MockV3Aggregator
        await deploy("Mock22V3Aggregator", {
            from: deployer,
            log: true,
            args: [8, 200000000000], // decimals: 8, initialAnswer: 2000 * 1e8
        })

        console.log("Mocks deployed!")
    }
}

module.exports.tags = ["all", "mocks"]
