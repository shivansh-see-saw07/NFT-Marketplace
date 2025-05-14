const { network, ethers } = require("hardhat")
const {
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    networkConfig,
} = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    log("----------------------------------------------------")
    const args = [] // Constructor arguments if any
    const nftMarketplace = await deploy("NFTmarketplace", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    if (!developmentChains.includes(network.name)) {
        // Set price feed for ETH/USD
        const ethUsdPriceFeed = networkConfig[chainId].ethUsdPriceFeed

        // Use getContractAt instead of getContract
        const nftMarketplaceContract = await ethers.getContractAt(
            "NFTmarketplace",
            nftMarketplace.address,
            await ethers.getSigner(deployer),
        )

        await nftMarketplaceContract.setPriceFeed(
            ethers.ZeroAddress, // ETH
            ethUsdPriceFeed,
        )
        log(`Set ETH/USD price feed to ${ethUsdPriceFeed}`)

        // Verify the contract
        if (process.env.ETHERSCAN_API_KEY) {
            log("Verifying...")
            await verify(nftMarketplace.address, args)
        }
    }
    log("----------------------------------------------------")
}

module.exports.tags = ["all", "nftmarketplace"]
