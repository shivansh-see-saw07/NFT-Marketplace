// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

error NFTmarketplace__price_must_be_greater_than_zero();
error NFTmarketplace__contract_must_be_approved();
error NFTmarketplace__item_already_listed(address nftContract, uint256 tokenId);
error NFTmarketplace__only_owner();
error NFTmarketplace__item_not_listed();
error NFTmarketplace__insufficient_payment();
error NFTmarketplace__NoProceeds();
error NFTmarketplace__invalid_payment_method();

contract NFTmarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price; // Price in USD (18 decimals)
        address paymentToken;
    }

    event ItemListed(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        address paymentToken
    );

    event ItemBought(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed buyer,
        address seller,
        uint256 price,
        address paymentToken
    );

    event ItemCancelled(
        address indexed seller,
        address indexed nftContract,
        uint256 indexed tokenId
    );

    mapping(address => AggregatorV3Interface) private s_priceFeeds;
    mapping(address => uint256) private s_proceeds;
    mapping(address => mapping(uint256 => Listing)) private s_listings;

    modifier notListed(address _nftContract, uint256 _tokenId) {
        Listing memory listing = s_listings[_nftContract][_tokenId];
        if (listing.price > 0) {
            revert NFTmarketplace__item_already_listed(_nftContract, _tokenId);
        }
        _;
    }

    modifier isOwner(
        address _nftContract,
        uint256 _tokenId,
        address spender
    ) {
        IERC721 nft = IERC721(_nftContract);
        address owner = nft.ownerOf(_tokenId);
        if (spender != owner) {
            revert NFTmarketplace__only_owner();
        }
        _;
    }

    modifier isListed(address _nftContract, uint256 _tokenId) {
        Listing memory listing = s_listings[_nftContract][_tokenId];
        if (listing.price <= 0) {
            revert NFTmarketplace__item_not_listed();
        }
        _;
    }

    function setPriceFeed(address token, address priceFeed) external {
        s_priceFeeds[token] = AggregatorV3Interface(priceFeed);
    }

    function listItems(
        address _nftContract,
        uint256 _tokenId,
        uint256 _price,
        address _paymentToken
    ) external notListed(_nftContract, _tokenId) isOwner(_nftContract, _tokenId, msg.sender) {
        if (_price <= 0) {
            revert NFTmarketplace__price_must_be_greater_than_zero();
        }
        IERC721 nft = IERC721(_nftContract);
        if (nft.getApproved(_tokenId) != address(this)) {
            revert NFTmarketplace__contract_must_be_approved();
        }

        // Validate payment token has a price feed
        if (_paymentToken != address(0)) {
            require(
                address(s_priceFeeds[_paymentToken]) != address(0),
                "Price feed not set for token"
            );
        }

        s_listings[_nftContract][_tokenId] = Listing({
            seller: msg.sender,
            price: _price,
            paymentToken: _paymentToken
        });
        emit ItemListed(_nftContract, _tokenId, msg.sender, _price, _paymentToken);
    }

    function getLatestPrice(address token) public view returns (int256) {
        AggregatorV3Interface feed = s_priceFeeds[token];
        require(address(feed) != address(0), "Price feed not set");
        (, int256 price, , , ) = feed.latestRoundData();
        return price;
    }

    // contracts/NFTmarketplace.sol
    function getPriceInToken(
        address paymentToken,
        uint256 priceInUSD
    ) public view returns (uint256) {
        if (paymentToken == address(0)) {
            // ETH calculation
            int256 ethPrice = getLatestPrice(address(0));
            return (priceInUSD * 10 ** 8) / uint256(ethPrice); // Feed uses 8 decimals
        }

        AggregatorV3Interface feed = s_priceFeeds[paymentToken];
        uint8 decimals = feed.decimals();
        int256 tokenPrice = getLatestPrice(paymentToken);

        return (priceInUSD * 10 ** decimals) / uint256(tokenPrice);
    }

    function buyItem(
        address _nftAddress,
        uint256 _tokenID,
        uint256 _amount
    ) external payable nonReentrant isListed(_nftAddress, _tokenID) {
        Listing memory listing = s_listings[_nftAddress][_tokenID];
        uint256 requiredAmount = getPriceInToken(listing.paymentToken, listing.price);

        if (listing.paymentToken == address(0)) {
            // Handle ETH payment
            if (msg.value < requiredAmount) {
                revert NFTmarketplace__insufficient_payment();
            }
            s_proceeds[listing.seller] += msg.value;
        } else {
            // Handle ERC20 payment
            if (_amount < requiredAmount) {
                revert NFTmarketplace__insufficient_payment();
            }
            IERC20(listing.paymentToken).transferFrom(msg.sender, listing.seller, requiredAmount);
        }

        delete s_listings[_nftAddress][_tokenID];
        IERC721(_nftAddress).safeTransferFrom(listing.seller, msg.sender, _tokenID);

        emit ItemBought(
            _nftAddress,
            _tokenID,
            msg.sender,
            listing.seller,
            listing.price,
            listing.paymentToken
        );
    }

    function cancelListing(
        address nftAddress,
        uint256 tokenId
    ) external isOwner(nftAddress, tokenId, msg.sender) isListed(nftAddress, tokenId) {
        delete s_listings[nftAddress][tokenId];
        emit ItemCancelled(msg.sender, nftAddress, tokenId);
    }

    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    ) external isListed(nftAddress, tokenId) isOwner(nftAddress, tokenId, msg.sender) {
        s_listings[nftAddress][tokenId].price = newPrice;
        emit ItemListed(
            nftAddress,
            tokenId,
            msg.sender,
            newPrice,
            s_listings[nftAddress][tokenId].paymentToken
        );
    }

    function withdrawProceeds() external nonReentrant {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NFTmarketplace__NoProceeds();
        }
        s_proceeds[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        require(success, "Transfer failed");
    }

    // Getters
    function getListing(
        address nftAddress,
        uint256 tokenId
    ) external view returns (Listing memory) {
        return s_listings[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }

    function getPriceFeed(address token) external view returns (address) {
        return address(s_priceFeeds[token]);
    }
}
