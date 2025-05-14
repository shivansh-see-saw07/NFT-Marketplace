import { ethers } from "ethers"
import basicNftAbi from "./abis/BasicNft.json"
import basicNftTwoAbi from "./abis/BasicNftTwo.json"

const abis = {
    BasicNft: basicNftAbi.abi,
    BasicNftTwo: basicNftTwoAbi.abi,
}

export async function approveNFT(nftAddress, nftType, tokenId, marketplaceAddress) {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const contract = new ethers.Contract(nftAddress, abis[nftType], signer)
    const tx = await contract.approve(marketplaceAddress, tokenId)
    await tx.wait()
}
