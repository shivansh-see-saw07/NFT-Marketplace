const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy NFT contract
    const BasicNftTwo = await hre.ethers.getContractFactory("BasicNftTwo");
    const nft = await BasicNftTwo.deploy();
    await nft.waitForDeployment();
    console.log("NFT contract deployed to:", await nft.getAddress());

    // Deploy Marketplace contract
    const NFTmarketplace = await hre.ethers.getContractFactory("NFTmarketplace");
    const marketplace = await NFTmarketplace.deploy();
    await marketplace.waitForDeployment();
    console.log("Marketplace contract deployed to:", await marketplace.getAddress());

    // Save contract addresses to a file
    const fs = require("fs");
    const path = require("path");
    const addresses = {
        nft: await nft.getAddress(),
        marketplace: await marketplace.getAddress(),
    };
    fs.writeFileSync(
        path.join(__dirname, "../frontend/src/contracts/addresses.json"),
        JSON.stringify(addresses, null, 2)
    );
    console.log("Contract addresses saved to frontend/src/contracts/addresses.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 