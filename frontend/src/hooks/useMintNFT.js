import { ethers } from "ethers"
import { useWalletClient } from "wagmi"
import basicNftAbi from "./abis/BasicNft.json"
import basicNftTwoAbi from "./abis/BasicNftTwo.json"

const abis = {
    BasicNft: basicNftAbi.abi,
    BasicNftTwo: basicNftTwoAbi.abi,
}

export function useMintNFT(nftAddress, nftType) {
    const { data: walletClient } = useWalletClient()

    const mint = async () => {
        if (!walletClient) throw new Error("Wallet not connected")
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const contract = new ethers.Contract(nftAddress, abis[nftType], signer)
        
        try {
            // First try to get the tokenId directly from the mint function
            const tx = await contract.mintNft()
            const receipt = await tx.wait()
            
            // Try to get tokenId from the DogMinted event first
            const dogMintedEvent = receipt.logs.find(
                log => log.fragment && log.fragment.name === 'DogMinted'
            )
            
            if (dogMintedEvent) {
                return dogMintedEvent.args[0].toString()
            }
            
            // If DogMinted event not found, try Transfer event
            const transferEvent = receipt.logs.find(
                log => log.fragment && log.fragment.name === 'Transfer'
            )
            
            if (transferEvent) {
                return transferEvent.args[2].toString() // tokenId is the third argument in Transfer event
            }
            
            // If no events found, try to get the latest token ID from the contract
            const tokenCounter = await contract.getTokenCounter()
            return (tokenCounter - 1).toString()
            
        } catch (error) {
            console.error("Error minting NFT:", error)
            throw error
        }
    }

    return { mint }
}
