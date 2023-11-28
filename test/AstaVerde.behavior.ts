import { expect } from "chai";
import { ethers, network } from "hardhat";

import { createNewAddresses, mintMillionUSDC } from "./helpers";

// constants
const SECONDS_IN_A_DAY = 86400;
const MAX_BATCH_SIZE = 50;
const PLATFORM_SHARE_PERCENTAGE = 30;
const PRICE_DECREASE_RATE = 1;
const PRICE_FLOOR = 40;
const BASE_PRICE = 230;

export function shouldBehaveLikeAstaVerde(): void {
  it("should reach basic deployment with default params", async function () {
    expect(await this.astaVerde.basePrice()).to.equal(BASE_PRICE);
    expect(await this.astaVerde.priceFloor()).to.equal(PRICE_FLOOR);
    expect(await this.astaVerde.priceDecreaseRate()).to.equal(PRICE_DECREASE_RATE);
    expect(await this.astaVerde.maxBatchSize()).to.equal(MAX_BATCH_SIZE);
    expect(await this.astaVerde.platformSharePercentage()).to.equal(PLATFORM_SHARE_PERCENTAGE);
  });

  it("should mint a batch and check token balance", async function () {
    const cids = ["cid1", "cid2"];
    const producers = createNewAddresses(cids.length);
    await this.astaVerde.mintBatch(producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    const { tokenIds } = await this.astaVerde.getBatchInfo(batchID);
    expect(tokenIds.length).to.equal(2);
    // tokens are owned by contract at this point
    expect(await this.astaVerde.balanceOf(this.signers.admin.address, tokenIds[0])).to.equal(0);
  });

  it("should fail to mint a batch without producers", async function () {
    const cids: string[] = ["abc", "xyz"];
    await expect(this.astaVerde.mintBatch([], cids)).to.be.revertedWith("No producers provided");
  });

  it("should fail to mint a batch with mismatched producers and cids", async function () {
    const cids = ["cid"];
    const producers = createNewAddresses(cids.length + 1);
    await expect(this.astaVerde.mintBatch(producers, cids)).to.be.revertedWith(
      "Mismatch between producers and cids lengths",
    );
  });

  it("should fail to mint a batch with batch size too large", async function () {
    const cids = new Array(MAX_BATCH_SIZE + 1).fill("cid");
    const producers = createNewAddresses(cids.length);
    await expect(this.astaVerde.mintBatch(producers, cids)).to.be.revertedWith("Batch size exceeds max batch size");
  });

  it("should get current price", async function () {
    const cids = ["cid1", "cid2"];
    const producers = createNewAddresses(cids.length);
    await this.astaVerde.mintBatch(producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    expect(await this.astaVerde.getCurrentPrice(batchID)).to.equal(BASE_PRICE);
  });

  it("should increment batchID after mintBatch", async function () {
    const cids = ["cid1", "cid2"];
    const producers = createNewAddresses(cids.length);
    await this.astaVerde.mintBatch(producers, cids);
    const batchIDZero = await this.astaVerde.lastBatchID();
    await this.astaVerde.mintBatch(producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    expect(batchID).to.equal(batchIDZero + 1n);
  });

  // function testFail_GetCurrentPriceWithInvalidBatchID() public {
  //   uint256 batchID = 999; // Assuming this batchID does not exist
  //   assertEq(
  //       astaVerde.getCurrentPrice(batchID),
  //       0,
  //       "Current price does not match expected price"
  //   );

  it("should fail to get current price with invalid batchID", async function () {
    const batchID = 999; // this batchID does not exist
    await expect(this.astaVerde.getCurrentPrice(batchID)).to.be.revertedWith("Batch does not exist");
  });

  it("should mint a small batch", async function () {
    const cids = ["cid1", "cid2"];
    const producers = createNewAddresses(cids.length);
    await this.astaVerde.mintBatch(producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    const { tokenIds, creationTime, price } = await this.astaVerde.getBatchInfo(batchID);
    expect(tokenIds.length).to.equal(2);
    expect(creationTime).to.be.gt(0);
    expect(price).to.be.gt(0);
  });

  it("should get market batches", async function () {
    const cids = ["cid1", "cid2"];
    const producers = createNewAddresses(cids.length);
    await this.astaVerde.mintBatch(producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    const { tokenIds, creationTime, price } = await this.astaVerde.getBatchInfo(batchID);
    expect(tokenIds.length).to.equal(2);
    expect(creationTime).to.be.gt(0);
    expect(price).to.be.gt(0);
  });

  it("should approve for all (erc1155)", async function () {
    const address = await this.astaVerde.getAddress();
    await this.astaVerde.setApprovalForAll(address, true);
    expect(await this.astaVerde.isApprovedForAll(this.signers.admin.address, address)).to.equal(true);
  });

  it("should buy a batch", async function () {
    const cids = ["cid1", "cid2"];
    const producers = createNewAddresses(cids.length);
    await this.astaVerde.mintBatch(producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    const { price } = await this.astaVerde.getBatchInfo(batchID);
    const usdcAmount = price;
    const tokenAmount = 1;
    const address = await this.astaVerde.getAddress();
    console.log("address is", address);

    await this.mockUSDC.approve(address, usdcAmount);
    // await this.astaVerde.setApprovalForAll(this.signers.admin.address, true);
    console.log("address is", address);
    console.log(await this.astaVerde.getAddress());
    await this.astaVerde.setApprovalForAll(address, true);
    await this.astaVerde.buyBatch(batchID, usdcAmount, tokenAmount);
    const { tokenIds } = await this.astaVerde.getBatchInfo(batchID);
    expect(await this.astaVerde.balanceOf(this.signers.admin.address, tokenIds[0])).to.equal(1);
  });

  // function testFail_BuyBatchWithInsufficientFunds() public {
  //   uint256 batchID = 1;
  //   uint256 usdcAmount = 100; // Assuming the price is more than 100
  //   uint256 tokenAmount = 1;
  //   astaVerde.buyBatch(batchID, usdcAmount, tokenAmount);

  it("should fail to buy a batch with insufficient funds", async function () {
    const cids = ["cid1", "cid2"];
    const producers = createNewAddresses(cids.length);
    await this.astaVerde.mintBatch(producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    const usdcAmount = 100; // Assuming the price is more than 100
    const tokenAmount = 1;
    await expect(this.astaVerde.buyBatch(batchID, usdcAmount, tokenAmount)).to.be.revertedWith(
      "Insufficient funds sent",
    );
  });

  it("should set platform share percentage", async function () {
    const newPercentage = 30; // Assuming the new percentage is 30
    await this.astaVerde.setPlatformSharePercentage(newPercentage);
    expect(await this.astaVerde.platformSharePercentage()).to.equal(newPercentage);
  });

  it("should fail to set platform share percentage with invalid value", async function () {
    const invalidPercentage = 101; // Assuming the invalid percentage is 101
    await expect(this.astaVerde.setPlatformSharePercentage(invalidPercentage)).to.be.revertedWith(
      "Share must be between 0 and 100",
    );
  });

  it("should set price floor", async function () {
    const newPriceFloor = 100; // Assuming the new price floor is 100
    await this.astaVerde.setPriceFloor(newPriceFloor);
    expect(await this.astaVerde.priceFloor()).to.equal(newPriceFloor);
  });

  it("should fail to set price floor with zero value", async function () {
    const zeroPriceFloor = 0;
    await expect(this.astaVerde.setPriceFloor(zeroPriceFloor)).to.be.revertedWith("Invalid price floor");
  });

  it("should fail to set starting price with zero value", async function () {
    const zeroStartingPrice = 0;
    await expect(this.astaVerde.setStartingPrice(zeroStartingPrice)).to.be.revertedWith("Invalid starting price");
  });

  it("should set max batch size and validate the new value", async function () {
    const newMaxBatchSize = 100; // Assuming the new max batch size is 100
    await this.astaVerde.setMaxBatchSize(newMaxBatchSize);
    expect(await this.astaVerde.maxBatchSize()).to.equal(newMaxBatchSize);
  });

  it("should fail to set max batch size with zero value", async function () {
    const zeroMaxBatchSize = 0;
    await expect(this.astaVerde.setMaxBatchSize(zeroMaxBatchSize)).to.be.revertedWith("Invalid batch size");
  });

  it("should get batch info and validate the returned values", async function () {
    const cids = ["cid1", "cid2"];
    const producers = createNewAddresses(cids.length);
    await this.astaVerde.mintBatch(producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    const batchInfo = await this.astaVerde.getBatchInfo(batchID);
    expect(batchInfo[0]).to.deep.equal([1n, 2n]); // tokenIds
    expect(batchInfo[1]).to.be.a("bigint"); // creationTime
    expect(batchInfo[2]).to.equal(BASE_PRICE); // price
  });

  it("should pause and unpause the contract by the owner", async function () {
    await this.astaVerde.pause();
    expect(await this.astaVerde.paused()).to.be.true;
    await this.astaVerde.unpause();
    expect(await this.astaVerde.paused()).to.be.false;
  });

  it("should fail to pause and unpause the contract by a non-owner", async function () {
    const nonOwner = this.signers.others[0];
    await expect(this.astaVerde.connect(nonOwner).pause()).to.be.reverted;
    await expect(this.astaVerde.connect(nonOwner).unpause()).to.be.reverted;
  });

  it("should fail to buy a batch when the contract is paused", async function () {
    await this.astaVerde.pause();
    const batchID = await this.astaVerde.lastBatchID();
    await expect(this.astaVerde.buyBatch(batchID, 1000, 50)).to.be.reverted;
  });

  it.only("should buy full batch", async function () {
    const cids = ["cid1", "cid2", "cid3"];
    const producers = createNewAddresses(cids.length);
    await this.astaVerde.mintBatch(producers, cids);
    const batchID = await this.astaVerde.lastBatchID();

    const { price } = await this.astaVerde.getBatchInfo(batchID);
    console.log("price", price);
    const tokenAmount = cids.length;
    const usdcAmount = price * BigInt(tokenAmount);
    // const address = await this.astaVerde.getAddress();

    const user = this.signers.others[0];
    await mintMillionUSDC(user, this.mockUSDC);
    const userBalance = await this.mockUSDC.balanceOf(user);
    console.log("userBalance", userBalance.toString());
    if (userBalance < usdcAmount) {
      throw new Error("Insufficient USDC balance");
    }

    await this.mockUSDC.connect(user).approve(this.astaVerde, usdcAmount);
    await this.astaVerde.connect(user).setApprovalForAll(this.astaVerde, true);
    await this.astaVerde.connect(user).buyBatch(batchID, usdcAmount, tokenAmount);

    const { tokenIds } = await this.astaVerde.getBatchInfo(batchID);
    expect(await this.astaVerde.balanceOf(user.address, tokenIds[0])).to.equal(1);
    expect(await this.astaVerde.balanceOf(user.address, tokenIds[1])).to.equal(1);
    expect(await this.astaVerde.balanceOf(user.address, tokenIds[2])).to.equal(1);

    // // Assert that each producer has received 70% of their share of the total cost
    // // In this case, each producer's share of the total cost is 1/3
    // const expectedProducerShare = (usdcAmount * BigInt(Math.floor(0.7 * 100))) / BigInt(producers.length * 100);
    // const expectedProducerShare = (usdcAmount * 0.7) / producers.length;
    // for (let i = 0; i < producers.length; i++) {
    //   const producerBalance = await this.mockUSDC.balanceOf(producers[i]);
    //   expect(producerBalance).to.equal(expectedProducerShare);
    // }

    // // Assert that the platform share is correct
    // const platformBalance = await this.mockUSDC.balanceOf(this.astaVerde);
    // expect(platformBalance).to.equal(usdcAmount * 0.3);
  });

  it.only("should buy full batch with a tricky base price", async function () {
    // TODO
  });

  /*
  mint
  buy
  increase time for N days
  mint
  observe effect of the N days on the price of thew new mint
  */

  it("should batch starting price decrease after 10 days", async function () {
    const cids = ["cid1", "cid2"];
    const producers = createNewAddresses(cids.length);
    await expect(this.astaVerde.mintBatch(producers, cids)).to.emit(this.astaVerde, "BatchMinted");

    const batchID = await this.astaVerde.lastBatchID();
    const { price } = await this.astaVerde.getBatchInfo(batchID);
    const usdcAmount = price;
    const address = await this.astaVerde.getAddress();
    await this.mockUSDC.approve(address, usdcAmount);
    await this.astaVerde.setApprovalForAll(address, true);
    const tokenAmount = BigInt(cids.length);
    await this.astaVerde.buyBatch(batchID, usdcAmount * tokenAmount, tokenAmount);
    expect(await this.astaVerde.getCurrentPrice(batchID)).to.equal(BASE_PRICE);

    await network.provider.send("evm_increaseTime", [SECONDS_IN_A_DAY * 11]);
    await network.provider.send("evm_mine");

    const tx = await this.astaVerde.mintBatch(producers, cids);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const timestamp = block.timestamp;

    await expect(tx)
      .to.emit(this.astaVerde, "BatchMinted")
      .withArgs(1, timestamp)
      .to.emit(this.astaVerde, "PlatformStartingPriceAdjusted");

    const newBatchID = await this.astaVerde.lastBatchID();
    const { price: newPrice } = await this.astaVerde.getBatchInfo(newBatchID);
    expect(newPrice).to.equal(price - 10n);
  });

  it("should batch starting price increase before 4 days", async function () {
    const cids = ["cid1", "cid2"];
    const producers = createNewAddresses(cids.length);

    await expect(this.astaVerde.mintBatch(producers, cids)).to.emit(this.astaVerde, "BatchMinted");

    const batchID = await this.astaVerde.lastBatchID();
    const { price } = await this.astaVerde.getBatchInfo(batchID);
    const usdcAmount = price;
    const address = await this.astaVerde.getAddress();
    await this.mockUSDC.approve(address, usdcAmount);
    await this.astaVerde.setApprovalForAll(address, true);
    const tokenAmount = 1;
    await this.astaVerde.buyBatch(batchID, usdcAmount, tokenAmount);
    expect(await this.astaVerde.getCurrentPrice(batchID)).to.equal(BASE_PRICE);

    await network.provider.send("evm_increaseTime", [SECONDS_IN_A_DAY * 3]);
    await network.provider.send("evm_mine");

    const tx = await this.astaVerde.mintBatch(producers, cids);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const timestamp = block.timestamp;

    await expect(tx)
      .to.emit(this.astaVerde, "BatchMinted")
      .withArgs(1, timestamp)
      .to.emit(this.astaVerde, "PlatformStartingPriceAdjusted");

    const newBatchID = await this.astaVerde.lastBatchID();
    const { price: newPrice } = await this.astaVerde.getBatchInfo(newBatchID);
    expect(newPrice).to.equal(price + 10n);
  });

  it("should batch starting price remain the same at 6 days", async function () {
    const cids = ["cid1", "cid2"];
    const producers = createNewAddresses(cids.length);
    await expect(this.astaVerde.mintBatch(producers, cids)).to.emit(this.astaVerde, "BatchMinted");

    const batchID = await this.astaVerde.lastBatchID();
    const { price } = await this.astaVerde.getBatchInfo(batchID);
    const usdcAmount = price;
    const address = await this.astaVerde.getAddress();
    await this.mockUSDC.approve(address, usdcAmount);
    await this.astaVerde.setApprovalForAll(address, true);
    const tokenAmount = 1;
    await this.astaVerde.buyBatch(batchID, usdcAmount, tokenAmount);
    expect(await this.astaVerde.getCurrentPrice(batchID)).to.equal(BASE_PRICE);

    await network.provider.send("evm_increaseTime", [SECONDS_IN_A_DAY * 6]);
    await network.provider.send("evm_mine");

    const tx = await this.astaVerde.mintBatch(producers, cids);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const timestamp = block.timestamp;

    await expect(tx)
      .to.emit(this.astaVerde, "BatchMinted")
      .withArgs(1, timestamp)
      .to.emit(this.astaVerde, "PlatformStartingPriceAdjusted");

    const newBatchID = await this.astaVerde.lastBatchID();
    const { price: newPrice } = await this.astaVerde.getBatchInfo(newBatchID);
    expect(newPrice).to.equal(price);
  });

  // it("should update starting price based on last sale duration", async function () {
  //   // Simulate a sale to change the 'last sale duration'
  //   const cids = ["cid1", "cid2"];
  //   await this.astaVerde.mintBatch(producers, cids);
  //   const batchID = await this.astaVerde.lastBatchID();
  //   const { price } = await this.astaVerde.getBatchInfo(batchID);
  //   const usdcAmount = price;
  //   const address = await this.astaVerde.getAddress();

  //   await this.mockUSDC.approve(address, usdcAmount);
  //   await this.astaVerde.setApprovalForAll(address, true);

  //   const tokenAmount = 1;
  //   await this.astaVerde.buyBatch(batchID, usdcAmount, tokenAmount);

  //   const updatedStartingPrice = await this.astaVerde.startingPrice();
  //   expect(updatedStartingPrice).to.be.within(1, 10);
  // });

  // test_HandleRefund(): Test the refund handling when the USDC amount is greater than the total cost.

  // test_ValidateBatch(): Test the validation of a batch with a valid number to buy.

  // testFail_ValidateBatchWithZeroNumberToBuy(): Test the validation of a batch with a zero number to buy.

  // testFail_ValidateBatchWithNumberToBuyGreaterThanRemainingTokens(): Test the validation of a batch with a number to buy greater than the remaining tokens.

  // test_GetPartialIds(): Test retrieving partial IDs from a batch.

  // testFail_GetPartialIdsWithZeroNumberToBuy(): Test retrieving partial IDs from a batch with a zero number to buy.

  // testFail_GetPartialIdsWithNumberToBuyGreaterThanRemainingTokens(): Test retrieving partial IDs from a batch with a number to buy greater than the remaining tokens.

  // test_RedeemTokens(): Test redeeming tokens by the token owner.

  // testFail_RedeemTokensByNonOwner(): Test the failure of redeeming tokens by a non-owner.

  // test_ClaimPlatformFunds(): Test claiming platform funds by the owner.

  // testFail_ClaimPlatformFundsByNonOwner(): Test the failure of claiming platform funds by a non-owner.

  // testFail_ClaimPlatformFundsWithZeroBalance(): Test the failure of claiming platform funds when the balance is zero.

  // test_RedeemTokensWhenPaused(): Test the failure of redeeming tokens when the contract is paused.

  // test_ClaimPlatformFundsWhenPaused(): Test the failure of claiming platform funds when the contract is paused.

  // paying with a non-USDC token should fail

  // paying with a USCD token should succeed

  // TBD onlyOwner works

  // test with prices that do not divide cleanly by 30%

  // test with having producers.UniqueLength < cids.length
}
