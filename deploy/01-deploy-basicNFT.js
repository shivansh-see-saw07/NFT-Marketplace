const { network } = require("hardhat")
const { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    log("\n----------------------------------------------------")

    // Deploy BasicNft
    const basicNft = await deploy("BasicNft", {
        from: deployer,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    // Deploy BasicNftTwo
    const basicNftTwo = await deploy("BasicNftTwo", {
        from: deployer,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    // Verification block
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("\nVerifying contracts...")
        await verify(basicNft.address, [])
        await verify(basicNftTwo.address, [])
        log("Contracts verified!")
    }

    log("\nDeployment Summary:")
    log(`BasicNft deployed to: ${basicNft.address}`)
    log(`BasicNftTwo deployed to: ${basicNftTwo.address}`)
    log("----------------------------------------------------\n")
}

module.exports.tags = ["all", "basicnft"]
