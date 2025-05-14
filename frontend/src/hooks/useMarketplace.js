import { ethers } from "ethers"
import { useState, useEffect, useCallback } from "react"
import { useAccount, useChainId } from "wagmi" // Changed useNetwork to useChainId
import { useConnectModal } from "@rainbow-me/rainbowkit"
import marketplaceArtifact from "./abis/NFTmarketplace.json"

export function useMarketplace() {
    const { address } = useAccount()
    const [contract, setContract] = useState(null)

    const ensureWalletConnected = async () => {
        if (!address) throw new Error("Please connect your wallet")
        if (typeof window.ethereum === "undefined") throw new Error("Please install MetaMask")
        
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const marketplaceContract = new ethers.Contract(
            process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS,
            marketplaceArtifact.abi,
            signer
        )
        setContract(marketplaceContract)
        return marketplaceContract
    }

    // List NFT
    const listNft = async (nftContract, tokenId, price, paymentToken) => {
        try {
            const marketplaceContract = await ensureWalletConnected()
            if (!marketplaceContract) throw new Error("Wallet not connected")

            // Input validation
            if (!nftContract || !ethers.isAddress(nftContract)) {
                throw new Error("Invalid NFT contract address")
            }
            if (!tokenId) {
                throw new Error("Invalid token ID")
            }
            if (!price || parseFloat(price) <= 0) {
                throw new Error("Invalid price")
            }

            // Ensure addresses are checksummed
            const checksummedNftContract = ethers.getAddress(nftContract)
            const checksummedPaymentToken = paymentToken ? ethers.getAddress(paymentToken) : ethers.ZeroAddress

            // Verify ownership and approval before listing
            try {
                const provider = new ethers.BrowserProvider(window.ethereum)
                const signer = await provider.getSigner()
                const nftContractInstance = new ethers.Contract(
                    checksummedNftContract,
                    [
                        "function ownerOf(uint256 tokenId) view returns (address)",
                        "function getApproved(uint256 tokenId) view returns (address)",
                        "function isApprovedForAll(address owner, address operator) view returns (bool)"
                    ],
                    signer
                )

                // Check ownership
                const owner = await nftContractInstance.ownerOf(BigInt(tokenId))
                if (owner.toLowerCase() !== address.toLowerCase()) {
                    throw new Error("You don't own this NFT")
                }

                // Check approval
                const approved = await nftContractInstance.getApproved(BigInt(tokenId))
                const isApprovedForAll = await nftContractInstance.isApprovedForAll(owner, process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS)
                
                if (approved.toLowerCase() !== process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS.toLowerCase() && !isApprovedForAll) {
                    throw new Error("Marketplace is not approved to transfer this NFT. Please approve first.")
                }

                // Check if item is already listed
                const listing = await marketplaceContract.getListing(checksummedNftContract, BigInt(tokenId))
                if (listing && listing.seller !== ethers.ZeroAddress) {
                    throw new Error("This NFT is already listed")
                }
            } catch (error) {
                console.error("Validation error:", error)
                throw new Error(error.message || "Failed to validate NFT ownership and approval")
            }

            // Convert price to Wei
            const priceInWei = ethers.parseEther(price.toString())

            console.log("Listing NFT with params:", {
                nftContract: checksummedNftContract,
                tokenId: tokenId.toString(),
                price: priceInWei.toString(),
                paymentToken: checksummedPaymentToken,
            })

            // Send the transaction
            const tx = await marketplaceContract.listItems(
                checksummedNftContract,
                BigInt(tokenId),
                priceInWei,
                checksummedPaymentToken,
                {
                    gasLimit: 300000 // Use fixed gas limit since estimation is failing
                }
            )
            
            console.log("Listing transaction sent:", tx.hash)
            
            // Wait for transaction confirmation
            console.log("Waiting for transaction confirmation...")
            const receipt = await tx.wait(2)
            
            if (!receipt || receipt.status === 0) {
                throw new Error("Transaction failed")
            }

            console.log("Transaction confirmed:", receipt.hash)

            // Wait additional time for subgraph to index
            console.log("Waiting for subgraph indexing...")
            await new Promise(resolve => setTimeout(resolve, 10000))
            
            return receipt
        } catch (error) {
            console.error("Listing failed:", error)
            // Improve error messages based on common failure cases
            if (error.message.includes("insufficient funds")) {
                throw new Error("Insufficient funds to pay for gas")
            } else if (error.message.includes("user rejected")) {
                throw new Error("Transaction was rejected by user")
            } else if (error.message.includes("already listed")) {
                throw new Error("This NFT is already listed in the marketplace")
            } else if (error.message.includes("price must be greater than zero")) {
                throw new Error("The listing price must be greater than zero")
            } else if (error.message.includes("BigInt")) {
                throw new Error("Invalid number format. Please check your inputs.")
            } else if (error.data) {
                throw new Error(`Contract error: ${error.data.message || error.message}`)
            }
            throw error
        }
    }

    // Buy NFT
    const buyNft = async (nftContract, tokenId, price) => {
        try {
            const marketplaceContract = await ensureWalletConnected()
            if (!marketplaceContract) throw new Error("Wallet not connected")

            // Validate inputs
            if (!nftContract || !tokenId || !price) {
                throw new Error("Missing required parameters")
            }

            console.log("Buying NFT with params:", {
                nftContract,
                tokenId: tokenId.toString(),
                price: price.toString()
            })

            // Validate the NFT contract address
            if (!ethers.isAddress(nftContract)) {
                throw new Error("Invalid NFT contract address")
            }

            // Ensure the NFT contract address is checksummed
            const checksummedNftContract = ethers.getAddress(nftContract)

            // Validate listing exists and is active
            console.log("Fetching listing from contract...")
            const listing = await marketplaceContract.getListing(checksummedNftContract, BigInt(tokenId))
            console.log("Fetched listing:", {
                seller: listing.seller,
                price: listing.price.toString(),
                paymentToken: listing.paymentToken
            })

            if (!listing || !listing.seller || listing.seller === ethers.ZeroAddress) {
                throw new Error("Item is not listed for sale")
            }

            // Convert both prices to BigInt for comparison
            const listingPrice = listing.price
            const offeredPrice = BigInt(price)

            if (listingPrice !== offeredPrice) {
                throw new Error(`Price mismatch. Listed for: ${ethers.formatEther(listingPrice)} ETH, offered: ${ethers.formatEther(offeredPrice)} ETH`)
            }

            // Ensure sufficient balance
            const provider = new ethers.BrowserProvider(window.ethereum)
            const balance = await provider.getBalance(address)
            if (balance < listingPrice) {
                throw new Error("Insufficient balance to complete the purchase")
            }

            const config = {
                value: listingPrice,
                gasLimit: 500000
            }

            console.log("Sending buy transaction with config:", {
                nftContract: checksummedNftContract,
                tokenId: tokenId.toString(),
                value: config.value.toString(),
                gasLimit: config.gasLimit
            })

            const tx = await marketplaceContract.buyItem(
                checksummedNftContract,
                BigInt(tokenId),
                listingPrice,
                config
            )
            console.log("Buy transaction sent:", tx.hash)

            console.log("Waiting for transaction confirmation...")
            const receipt = await tx.wait(2)
            
            if (!receipt || receipt.status === 0) {
                throw new Error("Transaction failed")
            }

            console.log("Transaction confirmed:", receipt.hash)

            // Wait additional time for subgraph to index
            console.log("Waiting for subgraph indexing...")
            await new Promise(resolve => setTimeout(resolve, 10000))
            
            return receipt
        } catch (error) {
            console.error("Buy transaction failed:", error)
            // Improve error messages
            if (error.message.includes("insufficient funds")) {
                throw new Error("Insufficient funds to complete the purchase")
            } else if (error.message.includes("user rejected")) {
                throw new Error("Transaction was rejected by user")
            } else if (error.message.includes("not listed")) {
                throw new Error("This NFT is not currently listed for sale")
            } else if (error.message.includes("BigNumberish")) {
                throw new Error("Invalid price format")
            } else if (error.data) {
                const reason = error.data.message || error.message
                throw new Error(`Transaction failed: ${reason}`)
            }
            throw error
        }
    }

    // Cancel Listing
    const cancelListing = async (nftContract, tokenId) => {
        try {
            const marketplaceContract = await ensureWalletConnected()
            if (!marketplaceContract) throw new Error("Wallet not connected")
            
            // Ensure the NFT contract address is checksummed
            const checksummedNftContract = ethers.getAddress(nftContract)
            
            // Verify the listing exists before attempting to cancel
            const listing = await marketplaceContract.getListing(checksummedNftContract, tokenId)
            if (!listing || !listing.seller || listing.seller === ethers.ZeroAddress) {
                throw new Error("No active listing found for this NFT")
            }

            // Verify the caller is the seller
            if (listing.seller.toLowerCase() !== address.toLowerCase()) {
                throw new Error("Only the seller can cancel the listing")
            }

            // Verify listing has a price greater than 0
            if (BigInt(listing.price.toString()) <= BigInt(0)) {
                throw new Error("This listing is no longer active")
            }
            
            const tx = await marketplaceContract.cancelListing(checksummedNftContract, tokenId, {
                gasLimit: 300000
            })
            console.log("Cancel transaction sent:", tx.hash)
            
            const receipt = await tx.wait(2)
            
            if (receipt.status === 0) {
                throw new Error("Transaction failed")
            }

            // Wait additional time for subgraph to index
            await new Promise(resolve => setTimeout(resolve, 10000))
            
            return receipt
        } catch (error) {
            console.error("Cancel listing failed:", error)
            if (error.data) {
                throw new Error(`Failed to cancel listing: ${error.data.message || error.message}`)
            }
            throw error
        }
    }

    // Update Listing
    const updateListing = async (nftContract, tokenId, newPrice) => {
        try {
            const marketplaceContract = await ensureWalletConnected()
            if (!marketplaceContract) throw new Error("Wallet not connected")
            
            // Verify the listing exists before attempting to update
            const listing = await marketplaceContract.getListing(nftContract, tokenId)
            if (!listing || !listing.seller || listing.seller === ethers.ZeroAddress) {
                throw new Error("No active listing found for this NFT")
            }

            // Verify the caller is the seller
            if (listing.seller.toLowerCase() !== address.toLowerCase()) {
                throw new Error("Only the seller can update the listing")
            }

            const newPriceWei = ethers.parseEther(newPrice)
            
            const tx = await marketplaceContract.updateListing(
                nftContract, 
                tokenId, 
                newPriceWei
            )
            console.log("Update transaction sent:", tx.hash)
            
            // Wait for 2 block confirmations
            const receipt = await tx.wait(2)
            
            if (receipt.status === 0) {
                throw new Error("Transaction failed")
            }

            // Wait additional time for subgraph to index
            await new Promise(resolve => setTimeout(resolve, 5000))
            
            return receipt
        } catch (error) {
            console.error("Update listing failed:", error)
            throw error
        }
    }

    const getProceeds = async () => {
        if (!address) return "0"
        
        try {
            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()
            const marketplaceContract = new ethers.Contract(
                process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS,
                marketplaceArtifact.abi,
                signer
            )

            const proceeds = await marketplaceContract.getProceeds(address)
            return proceeds.toString()
        } catch (error) {
            console.error("Error getting proceeds:", error)
            throw error
        }
    }

    const withdrawProceeds = async () => {
        try {
            const proceeds = await getProceeds()
            
            if (proceeds === "0") {
                throw new Error("No proceeds to withdraw")
            }

            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()
            const marketplaceContract = new ethers.Contract(
                process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS,
                marketplaceArtifact.abi,
                signer
            )

            const tx = await marketplaceContract.withdrawProceeds()
            await tx.wait()
        } catch (error) {
            console.error("Error withdrawing proceeds:", error)
            throw error
        }
    }

    return {
        listNft,
        buyNft,
        cancelListing,
        updateListing,
        withdrawProceeds,
        getProceeds,
        ensureWalletConnected,
    }
}
