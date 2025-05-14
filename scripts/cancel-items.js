const { ethers, network, deployments } = require("hardhat")
const { moveBlocks } = require("../utils/move-blocks")

const TOKEN_ID = 0

async function cancel() {
    // Get the deployer account
    const [deployer] = await ethers.getSigners()

    // Load the deployments to get contract addresses
    await deployments.fixture(["all"])

    // Get NFT Marketplace contract
    const marketplaceDeployment = await deployments.get("NFTmarketplace")
    const nftMarketplace = await ethers.getContractAt(
        "NFTmarketplace",
        marketplaceDeployment.address,
        deployer,
    )

    // Get Basic NFT contract
    const nftDeployment = await deployments.get("BasicNft")
    const basicNft = await ethers.getContractAt("BasicNft", nftDeployment.address, deployer)

    // Cancel listing using the NFT contract target address
    const tx = await nftMarketplace.cancelListing(basicNft.target, TOKEN_ID)
    await tx.wait()

    console.log("NFT Canceled!")

    if (network.config.chainId == 31337) {
        await moveBlocks(2, (sleepAmount = 1000))
    }
}

cancel()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
