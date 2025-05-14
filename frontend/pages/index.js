"use client"

import { useState, useEffect } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { ethers } from "ethers"
import { useMarketplace } from "../src/hooks/useMarketplace"
import { useGraphListings } from "../src/hooks/useGraphListings"
import basicNftAbi from "../src/hooks/abis/BasicNft.json"
import basicNftTwoAbi from "../src/hooks/abis/BasicNftTwo.json"
import { useAccount } from "wagmi"
import { useRouter } from "next/navigation"
import { useConnectModal } from "@rainbow-me/rainbowkit"

const NFT_OPTIONS = [
    {
        label: "Basic NFT",
        value: "BasicNft",
        address: "0x7D3770Ede7C7225C506d91A5ec1F859177D4166f",
        abi: basicNftAbi.abi,
    },
    {
        label: "Basic NFT Two",
        value: "BasicNftTwo",
        address: "0x1bE3e10F035773817b35199Bb272f167269A8D67",
        abi: basicNftTwoAbi.abi,
    },
]

export default function Home() {
    const { listNft, buyNft, cancelListing, updateListing } = useMarketplace()
    const { listings, loading, error } = useGraphListings()
    const { address: wagmiAddress } = useAccount()
    const { openConnectModal } = useConnectModal()

    const [selectedNft, setSelectedNft] = useState(NFT_OPTIONS[0])
    const [mintStatus, setMintStatus] = useState("")
    const [mintedTokenId, setMintedTokenId] = useState("")
    const [mintError, setMintError] = useState("")
    const [price, setPrice] = useState("")
    const [paymentToken, setPaymentToken] = useState("")
    const [editPrices, setEditPrices] = useState({})
    const [existingNftAddress, setExistingNftAddress] = useState("")
    const [existingTokenId, setExistingTokenId] = useState("")

    const formatAddress = (address) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    const handleMint = async (e) => {
        e.preventDefault()
        try {
            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()

            const contract = new ethers.Contract(selectedNft.address, selectedNft.abi, signer)

            setMintStatus("Initiating mint...")
            const tx = await contract.mintNft()
            setMintStatus("Minting... Please wait for confirmation")

            const receipt = await tx.wait()

            // Look for the Transfer event
            const event = receipt.logs.find((log) => {
                try {
                    return contract.interface.parseLog(log)?.name === "Transfer"
                } catch {
                    return false
                }
            })

            if (event) {
                const parsedLog = contract.interface.parseLog(event)
                const tokenId = parsedLog.args[2]
                setMintedTokenId(tokenId.toString())
                setMintStatus("Successfully minted NFT!")

                // Clear any previous errors
                setMintError("")

                // Close the modal after a short delay
                setTimeout(() => {
                    document.getElementById("mintModal").close()
                    // Reset status after modal closes
                    setMintStatus("")
                }, 2000)
            } else {
                throw new Error("Could not find Transfer event in transaction receipt")
            }
        } catch (error) {
            console.error("Error minting NFT:", error)
            setMintError(error.message)
            setMintStatus("Minting failed")
        }
    }

    const handleBuy = async (item) => {
        try {
            console.log("Starting buy process for item:", {
                nftContract: item.nftContract,
                tokenId: item.tokenId.toString(),
                price: item.price,
                seller: item.seller,
            })

            // Ensure we have all required parameters
            if (!item.nftContract || !item.tokenId || !item.price) {
                throw new Error("Missing required parameters for buying NFT")
            }

            // Convert tokenId to string if it's a BigInt
            const tokenId = item.tokenId.toString()

            // Ensure price is in the correct format
            const price = item.price.toString()

            console.log("Buying NFT with params:", {
                nftContract: item.nftContract,
                tokenId,
                price,
            })

            await buyNft(item.nftContract, tokenId, price)
            alert("NFT purchased successfully!")
        } catch (error) {
            console.error("Buy failed:", error)
            alert(`Failed to buy NFT: ${error.message}`)
        }
    }

    const handleCancel = async (item) => {
        try {
            await cancelListing(item.nftContract, item.tokenId)
            alert("Listing cancelled successfully!")
        } catch (error) {
            console.error("Cancel failed:", error)
            alert(`Failed to cancel listing: ${error.message}`)
        }
    }

    const handleUpdate = async (item, newPrice) => {
        try {
            await updateListing(item.nftContract, item.tokenId, newPrice)
            alert("Price updated successfully!")
            setEditPrices((prev) => ({
                ...prev,
                [`${item.nftContract}-${item.tokenId}`]: "",
            }))
        } catch (error) {
            console.error("Update failed:", error)
            alert(`Failed to update price: ${error.message}`)
        }
    }

    const handleList = async (e) => {
        e.preventDefault()
        try {
            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()

            // Basic input validation
            if (!existingNftAddress || !ethers.isAddress(existingNftAddress)) {
                throw new Error("Please enter a valid NFT contract address")
            }
            if (!existingTokenId || existingTokenId < 0) {
                throw new Error("Please enter a valid token ID")
            }
            if (!price || parseFloat(price) <= 0) {
                throw new Error("Please enter a valid price greater than 0")
            }

            // First get approval
            const nftContract = new ethers.Contract(
                existingNftAddress,
                [
                    "function approve(address to, uint256 tokenId) public",
                    "function getApproved(uint256 tokenId) public view returns (address)",
                    "function ownerOf(uint256 tokenId) public view returns (address)",
                ],
                signer
            )

            // Check ownership
            const owner = await nftContract.ownerOf(BigInt(existingTokenId))
            if (owner.toLowerCase() !== wagmiAddress.toLowerCase()) {
                throw new Error("You don't own this NFT")
            }

            console.log("Checking current approval...")
            const currentApproval = await nftContract.getApproved(BigInt(existingTokenId))
            if (
                currentApproval.toLowerCase() !==
                process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS.toLowerCase()
            ) {
                console.log("Approving marketplace...")
                const approvalTx = await nftContract.approve(
                    process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS,
                    BigInt(existingTokenId),
                    {
                        gasLimit: await nftContract.approve
                            .estimateGas(
                                process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS,
                                BigInt(existingTokenId)
                            )
                            .then((estimate) => Math.ceil(Number(estimate) * 1.2)),
                    }
                )
                console.log("Waiting for approval confirmation...")
                const approvalReceipt = await approvalTx.wait(1)
                if (!approvalReceipt || approvalReceipt.status === 0) {
                    throw new Error("Approval transaction failed")
                }
                console.log("NFT approved for marketplace")
            } else {
                console.log("NFT already approved for marketplace")
            }

            // Then list the NFT
            console.log("Listing NFT with price:", price, "ETH")

            const listingTx = await listNft(
                existingNftAddress,
                BigInt(existingTokenId),
                price,
                paymentToken || ethers.ZeroAddress
            )

            if (!listingTx || listingTx.status === 0) {
                throw new Error("Listing transaction failed")
            }

            console.log("Listing transaction successful:", listingTx.hash)

            // Clear form and close modal
            setExistingNftAddress("")
            setExistingTokenId("")
            setPrice("")
            setPaymentToken("")
            document.getElementById("listModal").close()

            // Show success message
            alert("NFT listed successfully!")
        } catch (error) {
            console.error("Error listing NFT:", error)
            alert(`Error listing NFT: ${error.message}`)
        }
    }

    const router = useRouter()

    const getNftImage = (tokenId, nftContract) => {
        const BASIC_NFT_ADDRESS = "0x7D3770Ede7C7225C506d91A5ec1F859177D4166f"
        const BASIC_NFT_TWO_ADDRESS = "0x1bE3e10F035773817b35199Bb272f167269A8D67"

        if (nftContract.toLowerCase() === BASIC_NFT_ADDRESS.toLowerCase()) {
            return "/images/doom.jpg"
        } else if (nftContract.toLowerCase() === BASIC_NFT_TWO_ADDRESS.toLowerCase()) {
            return "/images/pacman.jpg"
        }
        return `https://via.placeholder.com/400x400.png?text=NFT+${tokenId}`
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
                        <div className="logo-container">
                            <div className="logo-icon">NFT</div>
                            <div className="logo-text">
                                <div className="title-container">
                                    <span className="logo-title">NFT Marketplace</span>
                                    <span className="logo-subtitle">Explore • Trade • Collect</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="nav-right">
                        <div className="header-controls">
                            <ConnectButton />
                            {wagmiAddress && (
                                <div
                                    className="profile-access"
                                    onClick={() => router.push("/profile")}
                                >
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <div className="info-section">
                <div className="info-card">
                    <h2>Welcome to NFT Marketplace</h2>
                    <p className="info-text">
                        NFTs (Non-Fungible Tokens) are unique digital assets that represent
                        ownership of digital items like art, collectibles, and in-game items on the
                        blockchain. Each NFT has distinct properties that make it
                        non-interchangeable and verifiably scarce. This marketplace allows users to
                        mint their own NFTs, list them for sale, and trade securely using blockchain
                        technology. All transactions are conducted on the Sepolia testnet, ensuring
                        a safe environment for testing and experimentation. Users can connect their
                        wallets, browse current listings, and interact with NFTs directly from the
                        platform. (p.s. This marketplace only supports the Sepolia testnet to mint
                        and trade NFTs no actual ETH is used) The Graph is used to fetch the current
                        listings from the blockchain.
                    </p>

                    <div className="info-grid">
                        <div className="info-item">
                            <h3>🎨 Mint NFTs</h3>
                            <p>Create your own unique NFTs on the Sepolia network</p>
                        </div>
                        <div className="info-item">
                            <h3>💎 List for Sale</h3>
                            <p>Set your price and list your NFTs on the marketplace</p>
                        </div>
                        <div className="info-item">
                            <h3>🔄 Trade Safely</h3>
                            <p>Buy and sell NFTs with secure blockchain transactions</p>
                        </div>
                        <div className="info-item">
                            <h3>👛 Connect Wallet</h3>
                            <p>Use MetaMask or other wallets to start trading</p>
                        </div>
                    </div>
                </div>
            </div>

            {wagmiAddress && (
                <div className="actions">
                    <button
                        className="action-button primary"
                        onClick={() => document.getElementById("mintModal").showModal()}
                    >
                        Create your unique NFT
                    </button>
                    <button
                        className="action-button primary"
                        onClick={() => document.getElementById("listModal").showModal()}
                    >
                        Set price and list NFT
                    </button>
                </div>
            )}

            <h2 className="listings-title">Current Listings</h2>

            <div className="listings">
                {loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Loading NFTs...</p>
                    </div>
                ) : error ? (
                    <div className="error-state">
                        <p>Error loading NFTs: {error}</p>
                    </div>
                ) : listings.length === 0 ? (
                    <div className="empty-state">
                        <p>No NFTs listed yet</p>
                        {wagmiAddress && (
                            <button
                                className="action-button primary"
                                onClick={() => document.getElementById("listModal").showModal()}
                            >
                                List your first NFT
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid-container">
                        {listings.map((item) => (
                            <div key={item.id} className="nft-card">
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
                                        <span className="price">
                                            {ethers.formatEther(item.price)} ETH
                                        </span>
                                    </div>
                                    <div className="seller">
                                        Owner: {formatAddress(item.seller)}
                                    </div>
                                    {!wagmiAddress ? (
                                        <button
                                            className="connect-to-buy"
                                            onClick={openConnectModal}
                                        >
                                            Connect Wallet to Trade
                                        </button>
                                    ) : wagmiAddress.toLowerCase() === item.seller.toLowerCase() ? (
                                        <div className="owner-actions">
                                            <button
                                                className="cancel-button"
                                                onClick={() => handleCancel(item)}
                                            >
                                                Cancel Listing
                                            </button>
                                            <div className="update-price">
                                                <input
                                                    type="text"
                                                    placeholder="New Price (ETH)"
                                                    value={
                                                        editPrices[
                                                            `${item.nftContract}-${item.tokenId}`
                                                        ] || ""
                                                    }
                                                    onChange={(e) =>
                                                        setEditPrices((prev) => ({
                                                            ...prev,
                                                            [`${item.nftContract}-${item.tokenId}`]:
                                                                e.target.value,
                                                        }))
                                                    }
                                                    className="price-input"
                                                />
                                                <button
                                                    className="update-button"
                                                    onClick={() =>
                                                        handleUpdate(
                                                            item,
                                                            editPrices[
                                                                `${item.nftContract}-${item.tokenId}`
                                                            ]
                                                        )
                                                    }
                                                    disabled={
                                                        !editPrices[
                                                            `${item.nftContract}-${item.tokenId}`
                                                        ]
                                                    }
                                                >
                                                    Update Price
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            className="buy-button"
                                            onClick={() => handleBuy(item)}
                                        >
                                            Buy Now
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Mint Modal */}
            <dialog id="mintModal" className="modal">
                <h2>Mint NFT</h2>
                <form onSubmit={handleMint} className="modal-form">
                    <select
                        value={selectedNft.value}
                        onChange={(e) => {
                            const nft = NFT_OPTIONS.find((opt) => opt.value === e.target.value)
                            setSelectedNft(nft)
                            setMintedTokenId("")
                            setMintStatus("")
                            setMintError("")
                        }}
                    >
                        {NFT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    {mintStatus && (
                        <div className={`mint-status ${mintError ? "error" : "success"}`}>
                            {mintStatus}
                        </div>
                    )}
                    {mintError && <div className="mint-error">{mintError}</div>}
                    <div className="modal-actions">
                        <button type="submit" className="submit-button" disabled={!!mintStatus}>
                            {mintStatus ? "Minting..." : "Mint"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                document.getElementById("mintModal").close()
                                setMintStatus("")
                                setMintError("")
                            }}
                            className="cancel-button"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </dialog>

            {/* List Modal */}
            <dialog id="listModal" className="modal">
                <h2>List NFT</h2>
                <form onSubmit={handleList} className="modal-form">
                    <input
                        placeholder="NFT Contract Address"
                        value={existingNftAddress}
                        onChange={(e) => setExistingNftAddress(e.target.value)}
                        required
                        pattern="^0x[a-fA-F0-9]{40}$"
                        title="Please enter a valid Ethereum address (0x followed by 40 hexadecimal characters)"
                    />
                    <input
                        placeholder="Token ID"
                        value={existingTokenId}
                        onChange={(e) => setExistingTokenId(e.target.value)}
                        type="number"
                        required
                        min="0"
                    />
                    <input
                        placeholder="Price (ETH)"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        type="number"
                        step="0.000000000000000001"
                        required
                        min="0"
                    />
                    <select
                        value={paymentToken}
                        onChange={(e) => setPaymentToken(e.target.value)}
                        className="payment-select"
                    >
                        <option value="0x0000000000000000000000000000000000000000">
                            Sepolia ETH
                        </option>
                    </select>
                    <div className="modal-actions">
                        <button type="submit" className="submit-button">
                            List NFT
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                document.getElementById("listModal").close()
                                setExistingNftAddress("")
                                setExistingTokenId("")
                                setPrice("")
                                setPaymentToken("")
                            }}
                            className="cancel-button"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </dialog>

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

                .header-controls {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .profile-access {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    background: #1f2937;
                    border: 1px solid #374151;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: #9ca3af;
                }

                .profile-access:hover {
                    background: #374151;
                    color: #e5e7eb;
                    transform: translateY(-1px);
                }

                .info-section {
                    margin: 2rem 0 3rem;
                }

                .info-card {
                    background: #1f2937;
                    border: 1px solid #374151;
                    border-radius: 12px;
                    padding: 2rem;
                }

                .info-card h2 {
                    font-size: 1.75rem;
                    font-weight: 600;
                    margin-bottom: 1rem;
                    background: linear-gradient(to right, #818cf8, #c084fc);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .info-text {
                    color: #9ca3af;
                    line-height: 1.6;
                    margin-bottom: 2rem;
                    font-size: 1.1rem;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 1.5rem;
                }

                .info-item {
                    padding: 1.5rem;
                    background: #111827;
                    border: 1px solid #374151;
                    border-radius: 8px;
                    transition: transform 0.2s;
                }

                .info-item:hover {
                    transform: translateY(-2px);
                }

                .info-item h3 {
                    font-size: 1.1rem;
                    font-weight: 600;
                    margin-bottom: 0.75rem;
                    color: #e5e7eb;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .info-item p {
                    color: #9ca3af;
                    line-height: 1.5;
                }

                .actions {
                    display: flex;
                    gap: 1.5rem;
                    margin: 2rem auto;
                    justify-content: center;
                    max-width: 800px;
                }

                .action-button {
                    padding: 1rem 2rem;
                    font-size: 1.1rem;
                    min-width: 250px;
                    border-radius: 8px;
                    font-weight: 500;
                    transition: all 0.2s;
                    background: #1f2937;
                    color: #e5e7eb;
                    border: 1px solid #374151;
                }

                .action-button.primary {
                    background: #4f46e5;
                    border: none;
                }

                .action-button:hover {
                    transform: translateY(-1px);
                }

                .action-button.primary:hover {
                    background: #4338ca;
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

                .loading-state,
                .error-state,
                .empty-state {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 4rem 2rem;
                    color: #9ca3af;
                }

                .loading-spinner {
                    border: 3px solid #374151;
                    border-top: 3px solid #4f46e5;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 1rem;
                }

                @keyframes spin {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }

                .error-state {
                    color: #ef4444;
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                }

                .loading,
                .no-items {
                    text-align: center;
                    padding: 2rem;
                    color: #9ca3af;
                    grid-column: 1 / -1;
                }

                .nft-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }

                .token-id {
                    color: #9ca3af;
                    font-size: 0.875rem;
                }

                .price {
                    color: #818cf8;
                    font-weight: 600;
                }

                .seller {
                    color: #6b7280;
                    font-size: 0.875rem;
                    margin-bottom: 1rem;
                }

                .owner-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .update-price {
                    display: flex;
                    gap: 0.5rem;
                }

                .price-input {
                    flex: 1;
                    padding: 0.5rem;
                    background: #111827;
                    border: 1px solid #374151;
                    border-radius: 6px;
                    color: #e5e7eb;
                    font-size: 0.875rem;
                }

                .price-input:focus {
                    outline: none;
                    border-color: #4f46e5;
                }

                .buy-button,
                .cancel-button,
                .update-button,
                .connect-to-buy {
                    width: 100%;
                    padding: 0.75rem;
                    border: none;
                    border-radius: 6px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .buy-button {
                    background: #4f46e5;
                    color: white;
                }

                .buy-button:hover {
                    background: #4338ca;
                }

                .cancel-button {
                    background: #4f46e5;
                    color: white;
                }

                .cancel-button:hover {
                    background: #4338ca;
                }

                .update-button {
                    background: #059669;
                    color: white;
                }

                .update-button:hover {
                    background: #047857;
                }

                .update-button:disabled {
                    background: #374151;
                    cursor: not-allowed;
                }

                .connect-to-buy {
                    background: #4f46e5;
                    color: white;
                    opacity: 0.9;
                }

                .connect-to-buy:hover {
                    opacity: 1;
                }

                .modal {
                    background: #1f2937;
                    border: 1px solid #374151;
                    color: #e5e7eb;
                    border-radius: 12px;
                    padding: 20px;
                    max-width: 400px;
                    width: 100%;
                }

                .modal::backdrop {
                    background: rgba(0, 0, 0, 0.7);
                }

                .modal h2 {
                    margin-bottom: 20px;
                }

                .modal-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .modal-form select {
                    padding: 0.75rem;
                    background: #111827;
                    border: 1px solid #374151;
                    border-radius: 6px;
                    color: #e5e7eb;
                    font-size: 0.875rem;
                    cursor: pointer;
                }

                .modal-form select:focus {
                    outline: none;
                    border-color: #4f46e5;
                }

                .modal-actions {
                    display: flex;
                    gap: 0.75rem;
                    margin-top: 0.5rem;
                }

                .submit-button {
                    flex: 1;
                    padding: 0.75rem;
                    background: #4f46e5;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .submit-button:hover:not(:disabled) {
                    background: #4338ca;
                }

                .submit-button:disabled {
                    background: #374151;
                    cursor: not-allowed;
                }

                .mint-status {
                    padding: 0.75rem;
                    border-radius: 6px;
                    margin: 0.75rem 0;
                    text-align: center;
                    font-size: 0.875rem;
                }

                .mint-status.success {
                    background: #065f46;
                    color: #d1fae5;
                }

                .mint-status.error {
                    background: #991b1b;
                    color: #fee2e2;
                }

                .mint-error {
                    padding: 0.75rem;
                    background: #991b1b;
                    color: #fee2e2;
                    border-radius: 6px;
                    margin: 0.75rem 0;
                    font-size: 0.875rem;
                }

                .footer {
                    margin-top: 4rem;
                    padding: 2rem 0;
                    text-align: center;
                    color: #9ca3af;
                    border-top: 1px solid #374151;
                }

                .payment-select {
                    padding: 0.75rem;
                    background: #111827;
                    border: 1px solid #374151;
                    border-radius: 6px;
                    color: #e5e7eb;
                    width: 100%;
                    font-size: 0.875rem;
                    cursor: pointer;
                }

                .payment-select:focus {
                    outline: none;
                    border-color: #4f46e5;
                }

                .modal-form input {
                    padding: 0.75rem;
                    background: #111827;
                    border: 1px solid #374151;
                    border-radius: 6px;
                    color: #e5e7eb;
                    font-size: 0.875rem;
                }

                .modal-form input:focus {
                    outline: none;
                    border-color: #4f46e5;
                }

                .modal-form input::placeholder {
                    color: #6b7280;
                }

                .modal-form input:invalid {
                    border-color: #dc2626;
                }
            `}</style>
        </div>
    )
}
