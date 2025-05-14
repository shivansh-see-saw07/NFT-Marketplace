"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { useGraphListings } from "../src/hooks/useGraphListings"
import { ethers } from "ethers"
import { useMarketplace } from "../src/hooks/useMarketplace"
import { useOwnedNfts } from "../src/hooks/useOwnedNfts"

const ProfilePage = () => {
    const router = useRouter()
    const { address: wagmiAddress } = useAccount()
    const { listings, loading: listingsLoading } = useGraphListings()
    const { ownedNfts: userOwnedNfts, loading: ownedNftsLoading } = useOwnedNfts(wagmiAddress)
    const { withdrawProceeds } = useMarketplace()
    const [combinedNfts, setCombinedNfts] = useState([])
    const [totalValue, setTotalValue] = useState("0")

    useEffect(() => {
        if (wagmiAddress && listings && Array.isArray(userOwnedNfts)) {
            // Create a map of listed NFTs for quick lookup
            const listedNftsMap = new Map(
                listings
                    .filter(item => item.seller.toLowerCase() === wagmiAddress.toLowerCase())
                    .map(item => [`${item.nftContract.toLowerCase()}-${item.tokenId}`, item])
            )

            // Combine owned NFTs with listing information
            const combined = userOwnedNfts
                .filter(nft => nft && nft.nftContract && nft.tokenId) // Filter out invalid NFTs
                .map(nft => {
                    const key = `${nft.nftContract.toLowerCase()}-${nft.tokenId}`
                    const listingInfo = listedNftsMap.get(key)
                    return {
                        ...nft,
                        contractName: nft.contractName || "Unknown NFT",
                        isListed: !!listingInfo,
                        price: listingInfo?.price || "0",
                        listingId: listingInfo?.id
                    }
                })

            setCombinedNfts(combined)

            // Calculate total value of listed NFTs
            const total = Array.from(listedNftsMap.values()).reduce((sum, item) => {
                return sum + parseFloat(ethers.formatEther(item.price))
            }, 0)
            setTotalValue(total.toFixed(4))
        } else {
            // Reset state if data is not available
            setCombinedNfts([])
            setTotalValue("0")
        }
    }, [wagmiAddress, listings, userOwnedNfts])

    const formatAddress = (address) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    const getNftImage = (tokenId, nftContract) => {
        const BASIC_NFT_ADDRESS = "0x7D3770Ede7C7225C506d91A5ec1F859177D4166f"
        const BASIC_NFT_TWO_ADDRESS = "0x1bE3e10F035773817b35199Bb272f167269A8D67"

        if (nftContract.toLowerCase() === BASIC_NFT_ADDRESS.toLowerCase()) {
            return "/images/doom.jpg" // Updated path
        } else if (nftContract.toLowerCase() === BASIC_NFT_TWO_ADDRESS.toLowerCase()) {
            return "/images/pacman.jpg" // Updated path
        }
        return `https://via.placeholder.com/400x400.png?text=NFT+${tokenId}`
    }

    const handleCopyAddress = (address) => {
        navigator.clipboard.writeText(address)
            .then(() => {
                // You could add a toast notification here if you want
                alert("Address copied to clipboard!")
            })
            .catch((err) => {
                console.error("Failed to copy address:", err)
            })
    }

    const handleWithdraw = async () => {
        try {
            await withdrawProceeds()
            alert("Successfully withdrawn proceeds!")
        } catch (error) {
            if (error.message === "No proceeds to withdraw") {
                alert("You have no proceeds to withdraw")
            } else {
                alert(`Failed to withdraw proceeds: ${error.message}`)
            }
        }
    }

    return (
        <div className="container">
            <style jsx global>{`
                body {
                    background: #111827;
                    color: #e5e7eb;
                    font-family: "Inter", sans-serif;
                }
            `}</style>

            <nav className="navbar">
                <div className="nav-content">
                    <div className="nav-left">
                        <div
                            className="logo-container"
                            onClick={() => router.push("/")}
                            style={{ cursor: "pointer" }}
                        >
                            <div className="logo-icon">NFT</div>
                            <div className="logo-text">
                                <div className="title-container">
                                    <span className="logo-title">NFT Marketplace</span>
                                    <span className="logo-subtitle">Your Collection</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="profile-header">
                <div className="stats-card">
                    <div className="stat">
                        <span className="stat-label">Total NFTs</span>
                        <span className="stat-value">{combinedNfts.length}</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Listed NFTs</span>
                        <span className="stat-value">
                            {combinedNfts.filter(nft => nft.isListed).length}
                        </span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Total Value Listed</span>
                        <span className="stat-value">{totalValue} ETH</span>
                    </div>
                    <button className="withdraw-button" onClick={handleWithdraw}>
                        Withdraw Proceeds
                    </button>
                </div>
            </div>

            <div className="listings">
                {(listingsLoading || ownedNftsLoading) ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Loading your NFTs...</p>
                    </div>
                ) : combinedNfts.length === 0 ? (
                    <div className="empty-state">
                        <p>You don't own any NFTs yet</p>
                        <button
                            className="action-button primary"
                            onClick={() => router.push("/")}
                        >
                            Browse Marketplace
                        </button>
                    </div>
                ) : (
                    <div className="grid-container">
                        {combinedNfts.map((item) => (
                            <div key={`${item.nftContract}-${item.tokenId}`} className="nft-card">
                                <div className="nft-image">
                                    <img
                                        src={getNftImage(item.tokenId, item.nftContract)}
                                        alt={`NFT ${item.tokenId}`}
                                        className="nft-img"
                                        onError={(e) => {
                                            e.target.src = `https://via.placeholder.com/400x400.png?text=NFT+${item.tokenId}`
                                        }}
                                    />
                                </div>
                                <div className="nft-info">
                                    <div className="nft-header">
                                        <span className="token-id">
                                            Token ID: {item.tokenId.toString()}
                                        </span>
                                        {item.isListed && (
                                            <span className="price">{ethers.formatEther(item.price)} ETH</span>
                                        )}
                                    </div>
                                    <div className="seller">
                                        {item.isListed ? "Listed by you" : "Owned by you"}
                                    </div>
                                    <div className="contract-address">
                                        Contract: {formatAddress(item.nftContract)}
                                        <button
                                            className="copy-button"
                                            onClick={() => handleCopyAddress(item.nftContract)}
                                            title="Copy contract address"
                                        >
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <footer className="footer">
                <p>Made by Shivansh Sisodia • All rights reserved © 2025</p>
            </footer>

            <style jsx>{`
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 2rem;
                }

                .navbar {
                    position: sticky;
                    top: 0;
                    background: #1f2937;
                    border-bottom: 1px solid #374151;
                    margin: -2rem -2rem 2rem;
                    padding: 0 2rem;
                    z-index: 100;
                }

                .nav-content {
                    max-width: 1200px;
                    margin: 0 auto;
                    height: 80px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .logo-container {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .logo-icon {
                    background: #4f46e5;
                    color: white;
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 14px;
                }

                .logo-text {
                    display: flex;
                    flex-direction: column;
                }

                .title-container {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .logo-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    background: linear-gradient(to right, #818cf8, #c084fc);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .logo-subtitle {
                    font-size: 0.75rem;
                    color: #9ca3af;
                    letter-spacing: 0.5px;
                }

                .profile-header {
                    margin-bottom: 2rem;
                }

                .stats-card {
                    background: #1f2937;
                    border: 1px solid #374151;
                    border-radius: 12px;
                    padding: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                }

                .stat {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .stat-label {
                    color: #9ca3af;
                    font-size: 0.875rem;
                }

                .stat-value {
                    color: #e5e7eb;
                    font-size: 1.25rem;
                    font-weight: 600;
                }

                .withdraw-button {
                    margin-left: auto;
                    background: #4f46e5;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .withdraw-button:hover {
                    background: #4338ca;
                    transform: translateY(-1px);
                }

                .listings-title {
                    font-size: 1.75rem;
                    font-weight: 600;
                    margin: 2rem 0;
                    color: #e5e7eb;
                    background: linear-gradient(to right, #818cf8, #c084fc);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .listings {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                }

                .grid-container {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1.5rem;
                    width: 100%;
                }

                @media (max-width: 1024px) {
                    .grid-container {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 640px) {
                    .grid-container {
                        grid-template-columns: 1fr;
                    }
                }

                .nft-card {
                    background: #1f2937;
                    border: 1px solid #374151;
                    border-radius: 12px;
                    overflow: hidden;
                    transition: transform 0.2s;
                }

                .nft-card:hover {
                    transform: translateY(-2px);
                }

                .nft-image {
                    aspect-ratio: 1;
                    position: relative;
                    overflow: hidden;
                    background: #111827;
                }

                .nft-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .nft-info {
                    padding: 1rem;
                }

                .nft-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                }

                .token-id {
                    color: #9ca3af;
                }

                .price {
                    color: #e5e7eb;
                    font-weight: bold;
                }

                .seller {
                    color: #818cf8;
                    margin-bottom: 8px;
                    font-size: 14px;
                }

                .contract-address {
                    color: #9ca3af;
                    font-size: 14px;
                    font-family: monospace;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .copy-button {
                    background: none;
                    border: none;
                    padding: 4px;
                    color: #9ca3af;
                    cursor: pointer;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .copy-button:hover {
                    color: #e5e7eb;
                    background: #374151;
                }

                .empty-state {
                    text-align: center;
                    padding: 40px;
                    color: #9ca3af;
                }

                .profile-actions {
                    display: flex;
                    gap: 1.5rem;
                    margin-left: auto;
                    justify-content: center;
                }

                .action-button {
                    padding: 1rem 2rem;
                    font-size: 1.1rem;
                    min-width: 250px;
                    border-radius: 8px;
                    font-weight: 500;
                    transition: all 0.2s;
                    background: #4f46e5;
                    color: white;
                    border: none;
                    cursor: pointer;
                }

                .footer {
                    margin-top: 4rem;
                    padding: 2rem 0;
                    text-align: center;
                    color: #9ca3af;
                    border-top: 1px solid #374151;
                }

                .modal-overlay,
                .modal,
                .form-group,
                .modal-actions,
                .submit-button,
                .cancel-button {
                    display: none;
                }
            `}</style>
        </div>
    )
}

export default ProfilePage
