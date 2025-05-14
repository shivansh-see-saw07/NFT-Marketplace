# NFT Marketplace

## Features

-   List NFTs for sale
-   Purchase NFTs
-   Withdraw proceeds from sales
-   Update listing prices
-   Basic NFT marketplace functionality

## Tech Stack

-   Smart Contracts: Solidity
-   Development Framework: Hardhat
-   Frontend: React.js
-   Ethereum Web Client Library: ethers.js
-   File Storage: IPFS

## Getting Started

### Prerequisites

-   Node.js >= 14.0.0
-   npm >= 6.0.0
-   MetaMask wallet

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd hardhat-nft-marketplace
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory and add your configuration:

```
PRIVATE_KEY=your_private_key
GOERLI_RPC_URL=your_goerli_endpoint
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Smart Contract Development

1. Compile contracts:

```bash
npx hardhat compile
```

2. Run tests:

```bash
npx hardhat test
```

3. Deploy to local network:

```bash
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

### Frontend Development

1. Navigate to frontend directory:

```bash
cd frontend
```

2. Install frontend dependencies:

```bash
npm install
```

3. Start development server:

```bash
npm run dev
```

## Testing

Run the test suite:

```bash
npx hardhat test
```

Run test coverage:

```bash
npx hardhat coverage
```

## Deployment

1. Deploy to testnet (Goerli):

```bash
npx hardhat run scripts/deploy.js --network goerli
```

2. Verify on Etherscan:

```bash
npx hardhat verify --network goerli DEPLOYED_CONTRACT_ADDRESS
```

## Frontend Interaction

1. Connect your MetaMask wallet
2. Ensure you're on the correct network
3. List NFTs by clicking "List NFT"
4. Purchase NFTs by clicking "Buy"
5. Withdraw proceeds from sales using "Withdraw"

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License.
