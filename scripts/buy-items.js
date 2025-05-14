const { ethers, network, deployments } = require("hardhat")
const { moveBlocks } = require("../utils/move-blocks")

const TOKEN_ID = 1

async function buyItem() {
    const [signer] = await ethers.getSigners()
    await deployments.fixture(["all"])

    // Get contracts
    const nftMarketplace = await ethers.getContractAt(
        "NFTmarketplace",
        (await deployments.get("NFTmarketplace")).address,
        signer,
    )

    const basicNft = await ethers.getContractAt(
        "BasicNft",
        (await deployments.get("BasicNft")).address,
        signer,
    )

    const mockPriceFeed = await ethers.getContractAt(
        "Mock22V3Aggregator",
        (await deployments.get("Mock22V3Aggregator")).address,
        signer,
    )

    // Configure price feeds
    await nftMarketplace.setPriceFeed(ethers.ZeroAddress, mockPriceFeed.target)
    await mockPriceFeed.updateAnswer(2000e8) // $2000

    // Verify listing exists
    const listing = await nftMarketplace.getListing(basicNft.target, TOKEN_ID)
    if (!listing.price) throw new Error("Item not listed")

    // Calculate required payment
    const requiredAmount = await nftMarketplace.getPriceInToken(listing.paymentToken, listing.price)

    let tx
    if (listing.paymentToken === ethers.ZeroAddress) {
        // ETH payment
        tx = await nftMarketplace.buyItem(basicNft.target, TOKEN_ID, 0, { value: requiredAmount })
    } else {
        // ERC20 payment
        const erc20 = await ethers.getContractAt("IERC20", listing.paymentToken, signer)
        await (await erc20.approve(nftMarketplace.target, requiredAmount)).wait()
        tx = await nftMarketplace.buyItem(basicNft.target, TOKEN_ID, requiredAmount)
    }

    const receipt = await tx.wait()
    console.log(`NFT bought in block ${receipt.blockNumber}`)

    if (network.config.chainId === 31337) {
        await moveBlocks(2, 1000)
    }
}

buyItem()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Buy error:", error)
        process.exit(1)
    })
