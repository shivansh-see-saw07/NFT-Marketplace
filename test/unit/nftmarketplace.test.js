const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("NFT Marketplace Unit Tests", function () {
          let nftMarketplace, basicNft, mockPriceFeed, mockERC20, deployer, user

          const PRICE_IN_USD = ethers.parseEther("2000")
          const TOKEN_ID = 0
          const INITIAL_ANSWER = 2000e8 // $2000 with 8 decimals
          const TOKEN_AMOUNT = ethers.parseUnits("100", 18)

          beforeEach(async () => {
              // Get signers using ethers v6 syntax
              ;[deployer, user] = await ethers.getSigners()

              // Deploy contracts using deployments
              await deployments.fixture(["all"])

              // Get contract instances using getContractAt
              nftMarketplace = await ethers.getContractAt(
                  "NFTmarketplace",
                  (await deployments.get("NFTmarketplace")).address,
                  deployer,
              )

              basicNft = await ethers.getContractAt(
                  "BasicNft",
                  (await deployments.get("BasicNft")).address,
                  deployer,
              )

              mockERC20 = await ethers.getContractAt(
                  "MockERC20",
                  (await deployments.get("MockERC20")).address,
                  deployer,
              )

              mockPriceFeed = await ethers.getContractAt(
                  "Mock22V3Aggregator",
                  (await deployments.get("Mock22V3Aggregator")).address,
                  deployer,
              )

              await nftMarketplace.setPriceFeed(ethers.ZeroAddress, mockPriceFeed.target)
              await nftMarketplace.setPriceFeed(mockERC20.target, mockPriceFeed.target)
              await mockPriceFeed.updateAnswer(INITIAL_ANSWER)

              await mockERC20.mint(deployer.address, TOKEN_AMOUNT)
              await mockERC20.mint(user.address, TOKEN_AMOUNT)
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplace.target, TOKEN_ID)
          })

          describe("Price Feed Integration", function () {
              it("sets price feeds correctly", async function () {
                  const ethFeed = await nftMarketplace.getPriceFeed(ethers.ZeroAddress)
                  const erc20Feed = await nftMarketplace.getPriceFeed(mockERC20.target)

                  assert.equal(ethFeed, mockPriceFeed.target)
                  assert.equal(erc20Feed, mockPriceFeed.target)
              })

              it("calculates price correctly in ERC20 tokens", async function () {
                  await nftMarketplace.listItems(
                      basicNft.target,
                      TOKEN_ID,
                      PRICE_IN_USD,
                      mockERC20.target,
                  )

                  const requiredAmount = await nftMarketplace.getPriceInToken(
                      mockERC20.target,
                      PRICE_IN_USD,
                  )

                  await mockERC20.connect(user).approve(nftMarketplace.target, requiredAmount)
                  await expect(
                      nftMarketplace
                          .connect(user)
                          .buyItem(basicNft.target, TOKEN_ID, requiredAmount),
                  ).to.emit(nftMarketplace, "ItemBought")
              })
          })

          describe("Listing Management", function () {
              it("allows proper listing flow", async function () {
                  await expect(
                      nftMarketplace.listItems(
                          basicNft.target,
                          TOKEN_ID,
                          PRICE_IN_USD,
                          ethers.ZeroAddress,
                      ),
                  ).to.emit(nftMarketplace, "ItemListed")

                  const listing = await nftMarketplace.getListing(basicNft.target, TOKEN_ID)
                  assert.equal(listing.price.toString(), PRICE_IN_USD.toString())
                  assert.equal(listing.seller, deployer.address)

                  await expect(nftMarketplace.cancelListing(basicNft.target, TOKEN_ID)).to.emit(
                      nftMarketplace,
                      "ItemCancelled",
                  )

                  const cancelledListing = await nftMarketplace.getListing(
                      basicNft.target,
                      TOKEN_ID,
                  )
                  assert.equal(cancelledListing.price, 0)
              })
          })

          describe("Purchase Flow", function () {
              it("processes ETH payments correctly", async function () {
                  // FIX 1: List the item first
                  await nftMarketplace.listItems(
                      basicNft.target,
                      TOKEN_ID,
                      PRICE_IN_USD,
                      ethers.ZeroAddress,
                  )

                  const requiredEth = await nftMarketplace.getPriceInToken(
                      ethers.ZeroAddress,
                      PRICE_IN_USD,
                  )

                  await network.provider.send("hardhat_setBalance", [
                      user.address,
                      ethers.toBeHex(requiredEth * 2n),
                  ])

                  await expect(
                      nftMarketplace
                          .connect(user)
                          .buyItem(basicNft.target, TOKEN_ID, 0, { value: requiredEth }),
                  ).to.emit(nftMarketplace, "ItemBought")
              })

              it("processes ERC20 payments correctly", async function () {
                  await expect(
                      nftMarketplace.listItems(
                          basicNft.target,
                          TOKEN_ID,
                          PRICE_IN_USD,
                          mockERC20.target,
                      ),
                  ).to.emit(nftMarketplace, "ItemListed")

                  const requiredAmount = await nftMarketplace.getPriceInToken(
                      mockERC20.target,
                      PRICE_IN_USD,
                  )

                  await mockERC20.connect(user).approve(nftMarketplace.target, requiredAmount)

                  await expect(
                      nftMarketplace
                          .connect(user)
                          .buyItem(basicNft.target, TOKEN_ID, requiredAmount),
                  ).to.emit(nftMarketplace, "ItemBought")
              })
          })

          describe("Withdrawals", function () {
              it("handles proceeds withdrawal correctly", async function () {
                  const requiredEth = await nftMarketplace.getPriceInToken(
                      ethers.ZeroAddress,
                      PRICE_IN_USD,
                  )

                  await network.provider.send("hardhat_setBalance", [
                      user.address,
                      ethers.toQuantity(requiredEth * 2n),
                  ])

                  await nftMarketplace.listItems(
                      basicNft.target,
                      TOKEN_ID,
                      PRICE_IN_USD,
                      ethers.ZeroAddress,
                  )

                  await nftMarketplace
                      .connect(user)
                      .buyItem(basicNft.target, TOKEN_ID, 0, { value: requiredEth })

                  // FIX 2: Use the correct approach for checking balance changes
                  const deployerBalanceBefore = await ethers.provider.getBalance(deployer.address)
                  const tx = await nftMarketplace.withdrawProceeds()
                  const receipt = await tx.wait()
                  const gasUsed = receipt.gasUsed * receipt.gasPrice
                  const deployerBalanceAfter = await ethers.provider.getBalance(deployer.address)

                  // Verify that the balance change is approximately equal to requiredEth minus gas fees
                  const actualChange = deployerBalanceAfter - deployerBalanceBefore + gasUsed
                  assert.equal(actualChange.toString(), requiredEth.toString())
              })
          })
      })
