import { useState, useEffect } from "react"
import { ethers } from "ethers"
import basicNftAbi from "./abis/BasicNft.json"
import basicNftTwoAbi from "./abis/BasicNftTwo.json"

const NFT_CONTRACTS = [
    {
        address: "0x7D3770Ede7C7225C506d91A5ec1F859177D4166f",
        abi: basicNftAbi.abi,
        name: "Basic NFT"
    },
    {
        address: "0x1bE3e10F035773817b35199Bb272f167269A8D67",
        abi: basicNftTwoAbi.abi,
        name: "Basic NFT Two"
    }
]

export function useOwnedNfts(address) {
    const [ownedNfts, setOwnedNfts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let isMounted = true

        const fetchOwnedNfts = async () => {
            if (!address) return
            
            try {
                const provider = new ethers.BrowserProvider(window.ethereum)
                const nftPromises = NFT_CONTRACTS.map(async (contract) => {
                    const nftContract = new ethers.Contract(
                        contract.address,
                        contract.abi,
                        provider
                    )

                    try {
                        // Get the total supply of NFTs
                        const totalSupply = await nftContract.getTokenCounter()
                        
                        // Check ownership for each token
                        const ownershipPromises = Array.from({ length: Number(totalSupply) }, 
                            (_, i) => (async (tokenId) => {
                                try {
                                    const owner = await nftContract.ownerOf(tokenId)
                                    if (owner.toLowerCase() === address.toLowerCase()) {
                                        return {
                                            tokenId: tokenId.toString(),
                                            nftContract: contract.address,
                                            contractName: contract.name,
                                            owner
                                        }
                                    }
                                } catch (e) {
                                    console.log(`Error checking token ${tokenId}:`, e)
                                    return null
                                }
                            })(BigInt(i))
                        )

                        const ownedTokens = await Promise.all(ownershipPromises)
                        return ownedTokens.filter(token => token !== null)
                    } catch (e) {
                        console.error(`Error fetching NFTs from contract ${contract.address}:`, e)
                        return []
                    }
                })

                const allOwnedNfts = (await Promise.all(nftPromises)).flat()
                
                if (isMounted) {
                    setOwnedNfts(allOwnedNfts)
                    setError(null)
                }
            } catch (err) {
                console.error("Error fetching owned NFTs:", err)
                if (isMounted) {
                    setError(err.message)
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        fetchOwnedNfts()

        // Poll for updates every 30 seconds
        const intervalId = setInterval(fetchOwnedNfts, 30000)

        return () => {
            isMounted = false
            clearInterval(intervalId)
        }
    }, [address])

    return { ownedNfts, loading, error }
} 