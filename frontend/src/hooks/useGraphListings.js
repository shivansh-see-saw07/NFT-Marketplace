import { useState, useEffect } from "react"
import { ethers } from "ethers"

export function useGraphListings() {
    const [listings, setListings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let isMounted = true
        const POLLING_INTERVAL = 5000 // Poll every 5 seconds

        const fetchListings = async () => {
            if (!isMounted) return
            
            try {
                const response = await fetch(
                    process.env.NEXT_PUBLIC_SUBGRAPH_URL || "https://api.studio.thegraph.com/query/111188/nft-marketplace/version/latest",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            query: `
                            query GetActiveListings {
                                itemListeds(
                                    where: { 
                                        active: true,
                                        seller_not: "0x0000000000000000000000000000000000000000"
                                    }
                                    orderBy: blockTimestamp
                                    orderDirection: desc
                                ) {
                                    id
                                    nftContract
                                    tokenId
                                    seller
                                    price
                                    paymentToken
                                    active
                                    blockTimestamp
                                }
                            }
                            `,
                        }),
                    }
                )

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                const { data, errors } = await response.json()
                
                if (errors) {
                    throw new Error(errors[0].message)
                }

                if (!isMounted) return

                // Filter out any invalid listings and format them
                const validListings = data.itemListeds
                    .filter(listing => 
                        listing && 
                        listing.nftContract && 
                        listing.tokenId && 
                        listing.seller && 
                        listing.seller !== "0x0000000000000000000000000000000000000000" &&
                        listing.active === true
                    )
                    .map(listing => ({
                        ...listing,
                        id: listing.id,
                        nftContract: ethers.getAddress(listing.nftContract),
                        tokenId: BigInt(listing.tokenId),
                        seller: ethers.getAddress(listing.seller),
                        price: listing.price,
                        paymentToken: listing.paymentToken ? ethers.getAddress(listing.paymentToken) : ethers.ZeroAddress,
                        active: listing.active,
                        blockTimestamp: listing.blockTimestamp
                    }))

                console.log("Processed listings:", validListings);
                setListings(validListings)
                setError(null)
            } catch (err) {
                console.error("Error fetching listings from subgraph:", err)
                if (isMounted) {
                    setError(err.message)
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        // Initial fetch
        fetchListings()

        // Set up polling
        const intervalId = setInterval(fetchListings, POLLING_INTERVAL)

        // Cleanup
        return () => {
            isMounted = false
            clearInterval(intervalId)
        }
    }, [])

    return { listings, loading, error }
}
