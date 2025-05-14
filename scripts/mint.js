const { ethers, network, deployments } = require("hardhat")
const { moveBlocks } = require("../utils/move-blocks")

const PRICE = ethers.parseEther("0.1")

async function mint() {
    // Get the deployer account
    const [deployer] = await ethers.getSigners()

    // Load the deployment to get contract address
    await deployments.fixture(["all"])
    const basicNftDeployment = await deployments.get("BasicNftTwo")

    // Get contract instance using ethers v6 syntax
    const basicNft = await ethers.getContractAt("BasicNftTwo", basicNftDeployment.address, deployer)

    console.log("Minting NFT...")
    const mintTx = await basicNft.mintNft()
    const mintTxReceipt = await mintTx.wait()

    // Parse Transfer event using event signature
    const iface = basicNft.interface
    const transferEventSig = iface.getEvent("Transfer").topicHash
    const transferLog = mintTxReceipt.logs.find(
        (log) => log.topics && log.topics[0] === transferEventSig
    )
    let tokenId = null
    if (transferLog) {
        const parsed = iface.parseLog(transferLog)
        tokenId = parsed.args.tokenId
    }

    console.log(
        `Minted tokenId ${tokenId ? tokenId.toString() : "not found"} from contract: ${
            basicNft.target
        }`
    )

    if (network.config.chainId == 31337) {
        // Moralis has a hard time if you move more than 1 block!
        await moveBlocks(2, (sleepAmount = 1000))
    }
}

mint()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
