const { ethers, network, deployments } = require("hardhat")
const { moveBlocks } = require("../utils/move-blocks")

const PRICE = ethers.parseEther("0.1")

async function mintAndList() {
    try {
        const [deployer] = await ethers.getSigners()
        console.log("Using deployer address:", deployer.address)

        // Deploy all contracts
        await deployments.fixture(["all"])

        // Get NFTMarketplace contract
        const nftMarketplaceDeployment = await deployments.get("NFTmarketplace")
        if (!nftMarketplaceDeployment) {
            throw new Error("NFTmarketplace deployment not found")
        }
        console.log("NFTmarketplace found at:", nftMarketplaceDeployment.address)

        const nftMarketplace = await ethers.getContractAt(
            "NFTmarketplace",
            nftMarketplaceDeployment.address,
            deployer
        )

        // Get BasicNftTwo contract
        const basicNftDeployment = await deployments.get("BasicNftTwo")
        if (!basicNftDeployment) {
            throw new Error("BasicNftTwo deployment not found")
        }
        console.log("BasicNftTwo found at:", basicNftDeployment.address)

        const basicNft = await ethers.getContractAt(
            "BasicNftTwo",
            basicNftDeployment.address,
            deployer
        )

        // Mint NFT
        console.log("Minting NFT...")
        const mintTx = await basicNft.mintNft()
        console.log("Mint transaction hash:", mintTx.hash)

        const mintTxReceipt = await mintTx.wait()
        console.log("Mint transaction confirmed")

        // Get tokenId from Transfer event using event signature
        const iface = basicNft.interface
        const transferEventSig = iface.getEvent("Transfer").topicHash
        const transferLog = mintTxReceipt.logs.find(
            (log) => log.topics && log.topics[0] === transferEventSig
        )
        if (!transferLog) {
            throw new Error("Transfer event not found in transaction receipt")
        }
        const parsed = iface.parseLog(transferLog)
        const tokenId = parsed.args.tokenId
        console.log(`Minted NFT with Token ID: ${tokenId}`)

        // Approve NFT for marketplace
        console.log("Approving NFT for marketplace...")
        const approvalTx = await basicNft.approve(nftMarketplaceDeployment.address, tokenId)
        await approvalTx.wait()
        console.log("NFT approved for marketplace")

        // List NFT
        console.log("Listing NFT on marketplace...")
        const listTx = await nftMarketplace.listItem(basicNftDeployment.address, tokenId, PRICE)
        await listTx.wait()
        console.log("NFT listed successfully!")

        if (network.config.chainId === 31337) {
            // Moralis has a hard time if you move more than 1 block!
            await moveBlocks(2, (sleepAmount = 1000))
        }

        return { tokenId: tokenId.toString(), price: ethers.formatEther(PRICE) }
    } catch (error) {
        console.error("Error in mintAndList:", error)
        throw error
    }
}

mintAndList()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
