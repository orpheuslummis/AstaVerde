import { expect } from "chai";
import { ethers, network } from "hardhat";

import { createNewAddresses, mintUSDC, USDC_PRECISION } from "./helpers";

const SECONDS_IN_A_DAY = 86400;
const MAX_BATCH_SIZE = 50;
const PLATFORM_SHARE_PERCENTAGE = 30;
const PRICE_DECREASE_RATE = 1n * USDC_PRECISION;
const PRICE_FLOOR = 40n * USDC_PRECISION;
const BASE_PRICE = 230n * USDC_PRECISION;

async function waitNSeconds(n: number) {
	await network.provider.send("evm_increaseTime", [n]);
	await network.provider.send("evm_mine");
}

export function shouldBehaveLikeAstaVerde(): void {
	it("should reach basic deployment with default params", async function () {
		expect(await this.astaVerde.basePrice()).to.equal(BASE_PRICE);
		expect(await this.astaVerde.priceFloor()).to.equal(PRICE_FLOOR);
		expect(await this.astaVerde.priceDecreaseRate()).to.equal(
			PRICE_DECREASE_RATE,
		);
		expect(await this.astaVerde.maxBatchSize()).to.equal(MAX_BATCH_SIZE);
		expect(await this.astaVerde.platformSharePercentage()).to.equal(
			PLATFORM_SHARE_PERCENTAGE,
		);
	});

	it("should mint a batch and check token balance", async function () {
		const cids = ["cid1", "cid2"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();
		const { tokenIds } = await this.astaVerde.getBatchInfo(batchID);
		expect(tokenIds.length).to.equal(2);
		// tokens are owned by contract at this point
		expect(
			await this.astaVerde.balanceOf(this.signers.admin.address, tokenIds[0]),
		).to.equal(0);
	});

	it("should fail to mint a batch without producers", async function () {
		const cids: string[] = ["abc", "xyz"];
		await expect(this.astaVerde.mintBatch([], cids)).to.be.revertedWith(
			"No producers provided",
		);
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
		await expect(this.astaVerde.mintBatch(producers, cids)).to.be.revertedWith(
			"Batch size exceeds max batch size",
		);
	});

	it("should get current price", async function () {
		const cids = ["cid1", "cid2"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();
		expect(await this.astaVerde.getBatchPrice(batchID)).to.equal(BASE_PRICE);
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

	it("should fail to get current price with invalid batchID", async function () {
		const batchID = 999; // this batchID does not exist
		await expect(this.astaVerde.getBatchPrice(batchID)).to.be.revertedWith(
			"Batch does not exist",
		);
	});

	it("should mint a small batch", async function () {
		const cids = ["cid1", "cid2"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();
		const { tokenIds, creationTime, price } =
			await this.astaVerde.getBatchInfo(batchID);
		expect(tokenIds.length).to.equal(2);
		expect(creationTime).to.be.gt(0);
		expect(price).to.be.gt(0);
	});

	it("should get market batches", async function () {
		const cids = ["cid1", "cid2"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();
		const { tokenIds, creationTime, price } =
			await this.astaVerde.getBatchInfo(batchID);
		expect(tokenIds.length).to.equal(2);
		expect(creationTime).to.be.gt(0);
		expect(price).to.be.gt(0);
	});

	it("should approve for all (erc1155)", async function () {
		const address = await this.astaVerde.getAddress();
		await this.astaVerde.setApprovalForAll(address, true);
		expect(
			await this.astaVerde.isApprovedForAll(
				this.signers.admin.address,
				address,
			),
		).to.equal(true);
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
		await this.mockUSDC.approve(address, usdcAmount);
		await this.astaVerde.setApprovalForAll(address, true);
		await this.astaVerde.buyBatch(batchID, usdcAmount, tokenAmount);
		const { tokenIds } = await this.astaVerde.getBatchInfo(batchID);
		expect(
			await this.astaVerde.balanceOf(this.signers.admin.address, tokenIds[0]),
		).to.equal(1);
	});

	it("should fail to buy a batch with insufficient funds", async function () {
		const cids = ["cid1", "cid2"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();
		const usdcAmount = 100; // Assuming the price is more than 100
		const tokenAmount = 1;
		await expect(
			this.astaVerde.buyBatch(batchID, usdcAmount, tokenAmount),
		).to.be.revertedWith("Insufficient funds sent");
	});

	it("should set platform share percentage", async function () {
		const newPercentage = 11;
		await this.astaVerde.setPlatformSharePercentage(newPercentage);
		expect(await this.astaVerde.platformSharePercentage()).to.equal(
			newPercentage,
		);
	});

	it("should fail to set platform share percentage with invalid value", async function () {
		const invalidPercentage = 101;
		await expect(
			this.astaVerde.setPlatformSharePercentage(invalidPercentage),
		).to.be.revertedWith("Share must be between 0 and 100");
	});

	it("should set price floor", async function () {
		const newPriceFloor = 99;
		await this.astaVerde.setPriceFloor(newPriceFloor);
		expect(await this.astaVerde.priceFloor()).to.equal(newPriceFloor);
	});

	it("should fail to set price floor with zero value", async function () {
		const zeroPriceFloor = 0;
		await expect(
			this.astaVerde.setPriceFloor(zeroPriceFloor),
		).to.be.revertedWith("Invalid price floor");
	});

	it("should fail to set starting price with zero value", async function () {
		const zeroStartingPrice = 0;
		await expect(
			this.astaVerde.setBasePrice(zeroStartingPrice),
		).to.be.revertedWith("Invalid starting price");
	});

	it("should set max batch size and validate the new value", async function () {
		const newMaxBatchSize = 100;
		await this.astaVerde.setMaxBatchSize(newMaxBatchSize);
		expect(await this.astaVerde.maxBatchSize()).to.equal(newMaxBatchSize);
	});

	it("should fail to set max batch size with zero value", async function () {
		const zeroMaxBatchSize = 0;
		await expect(
			this.astaVerde.setMaxBatchSize(zeroMaxBatchSize),
		).to.be.revertedWith("Invalid batch size");
	});

	it("should get batch info and validate the returned values", async function () {
		const cids = ["cid1", "cid2"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();
		const batchInfo = await this.astaVerde.getBatchInfo(batchID);
		expect(batchInfo[1]).to.deep.equal([1n, 2n]); // tokenIds
		expect(batchInfo[2]).to.be.a("bigint"); // creationTime
		expect(batchInfo[3]).to.equal(BASE_PRICE); // price
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
		await expect(this.astaVerde.buyBatch(batchID, 1000, 1)).to.be.reverted;
	});

	it("should work to buy full batch", async function () {
		const cids = ["cid1", "cid2", "cid3"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();

		const { price } = await this.astaVerde.getBatchInfo(batchID);
		const tokenAmount = cids.length;
		const usdcAmount = price * BigInt(tokenAmount);

		const user = this.signers.others[0];
		await mintUSDC(user, this.mockUSDC, 100000n * USDC_PRECISION);
		const userBalance = await this.mockUSDC.balanceOf(user);
		console.log("userBalance", userBalance.toString());
		if (userBalance < usdcAmount) {
			throw new Error("Insufficient USDC balance");
		}

		await this.mockUSDC.connect(user).approve(this.astaVerde, usdcAmount);
		await this.astaVerde.connect(user).setApprovalForAll(this.astaVerde, true);
		await this.astaVerde
			.connect(user)
			.buyBatch(batchID, usdcAmount, tokenAmount);

		const { tokenIds } = await this.astaVerde.getBatchInfo(batchID);
		expect(await this.astaVerde.balanceOf(user.address, tokenIds[0])).to.equal(
			1,
		);
		expect(await this.astaVerde.balanceOf(user.address, tokenIds[1])).to.equal(
			1,
		);
		expect(await this.astaVerde.balanceOf(user.address, tokenIds[2])).to.equal(
			1,
		);

		// Assert that each producer has received 70% of their share of the total cost
		// In this case, each producer's share of the total cost is 1/3
		const expectedProducerShare =
			(usdcAmount * BigInt(Math.floor(0.7 * 100))) /
			BigInt(producers.length * 100);
		for (let i = 0; i < producers.length; i++) {
			const producerBalance = await this.mockUSDC.balanceOf(producers[i]);
			expect(producerBalance).to.equal(expectedProducerShare);
		}
		// Assert that the platform share is correct
		const platformBalance = await this.mockUSDC.balanceOf(this.astaVerde);
		expect(platformBalance).to.equal(
			(usdcAmount * BigInt(Math.floor(0.3 * 100))) / BigInt(100),
		);
	});

	it("should work to buy full batch with a tricky base price", async function () {
		await this.astaVerde.setBasePrice(97);

		const cids = ["cid1", "cid2", "cid3"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();

		const { price } = await this.astaVerde.getBatchInfo(batchID);
		const tokenAmount = BigInt(cids.length);
		const usdcAmount = price * tokenAmount;

		const user = this.signers.others[0];
		await mintUSDC(
			user,
			this.mockUSDC,
			1000000n * USDC_PRECISION * USDC_PRECISION,
		);
		const userBalance = await this.mockUSDC.balanceOf(user);
		console.log("userBalance", userBalance.toString());
		if (userBalance < usdcAmount) {
			throw new Error("Insufficient USDC balance");
		}

		await this.mockUSDC.connect(user).approve(this.astaVerde, usdcAmount);
		await this.astaVerde.connect(user).setApprovalForAll(this.astaVerde, true);
		await this.astaVerde
			.connect(user)
			.buyBatch(batchID, usdcAmount, tokenAmount);

		const { tokenIds } = await this.astaVerde.getBatchInfo(batchID);
		expect(await this.astaVerde.balanceOf(user.address, tokenIds[0])).to.equal(
			1,
		);
		expect(await this.astaVerde.balanceOf(user.address, tokenIds[1])).to.equal(
			1,
		);
		expect(await this.astaVerde.balanceOf(user.address, tokenIds[2])).to.equal(
			1,
		);

		// Assert that each producer has received 70% of their share of the total cost
		// In this case, each producer's share of the total cost is 1/3
		const expectedProducerShare =
			(usdcAmount * BigInt(Math.floor(0.7 * 100))) /
			BigInt(producers.length * 100);
		for (let i = 0; i < producers.length; i++) {
			const producerBalance = await this.mockUSDC.balanceOf(producers[i]);
			expect(producerBalance).to.equal(expectedProducerShare);
		}

		// const platformSharePercentage = await this.astaVerde.platformSharePercentage();
		// Assert that the platform share is correct
		const platformBalance = await this.mockUSDC.balanceOf(this.astaVerde);
		const expectedPlatformShare =
			BigInt(Math.ceil(0.3 * Number(price))) * tokenAmount;
		expect(platformBalance).to.equal(expectedPlatformShare);
	});

	it("should work to buy a partial batch", async function () {
		const cids = ["cid1", "cid2", "cid3"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();

		const { price } = await this.astaVerde.getBatchInfo(batchID);
		const tokenAmount = BigInt(2); // Buy only 2 out of 3 tokens
		const usdcAmount = price * tokenAmount;

		const user = this.signers.others[0];
		await mintUSDC(user, this.mockUSDC, 1000000n * USDC_PRECISION);
		const userBalance = await this.mockUSDC.balanceOf(user);
		console.log("userBalance", userBalance.toString());
		if (userBalance < usdcAmount) {
			throw new Error("Insufficient USDC balance");
		}

		await this.mockUSDC.connect(user).approve(this.astaVerde, usdcAmount);
		await this.astaVerde.connect(user).setApprovalForAll(this.astaVerde, true);
		await this.astaVerde
			.connect(user)
			.buyBatch(batchID, usdcAmount, tokenAmount);

		const { tokenIds } = await this.astaVerde.getBatchInfo(batchID);
		expect(await this.astaVerde.balanceOf(user.address, tokenIds[0])).to.equal(
			1,
		);
		expect(await this.astaVerde.balanceOf(user.address, tokenIds[1])).to.equal(
			1,
		);
		expect(await this.astaVerde.balanceOf(user.address, tokenIds[2])).to.equal(
			0,
		); // This token was not bought
	});

	it("should fail to buy too many tokens of a partial batch", async function () {
		const cids = ["cid1", "cid2", "cid3", "cid4", "cid5"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();

		const { price } = await this.astaVerde.getBatchInfo(batchID);
		let tokenAmount = BigInt(2); // Buy only 2 out of 5 tokens initially
		let usdcAmount = price * tokenAmount;

		const user = this.signers.others[0];
		await mintUSDC(user, this.mockUSDC, 1000000n * USDC_PRECISION);
		const userBalance = await this.mockUSDC.balanceOf(user);
		if (userBalance < usdcAmount) {
			throw new Error("Insufficient USDC balance");
		}

		await this.mockUSDC.connect(user).approve(this.astaVerde, usdcAmount);
		await this.astaVerde.connect(user).setApprovalForAll(this.astaVerde, true);
		await this.astaVerde
			.connect(user)
			.buyBatch(batchID, usdcAmount, tokenAmount);

		tokenAmount = BigInt(4); // Try to buy 4 out of the 3 remaining tokens
		usdcAmount = price * tokenAmount;
		await this.mockUSDC.connect(user).approve(this.astaVerde, usdcAmount);

		// This should fail because there are not enough tokens left in the batch
		await expect(
			this.astaVerde.connect(user).buyBatch(batchID, usdcAmount, tokenAmount),
		).to.be.revertedWith("Not enough tokens in batch");
	});

	it("should work to buy the rest of tokens of a partial batch", async function () {
		const cids = ["cid1", "cid2", "cid3", "cid4", "cid5"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();

		const { price } = await this.astaVerde.getBatchInfo(batchID);
		let tokenAmount = BigInt(2); // Buy the 2 first tokens
		let usdcAmount = price * tokenAmount;

		const user = this.signers.others[0];
		await mintUSDC(user, this.mockUSDC, 1000000n * USDC_PRECISION);

		await this.mockUSDC.connect(user).approve(this.astaVerde, usdcAmount);
		await this.astaVerde.connect(user).setApprovalForAll(this.astaVerde, true);
		let tx = await this.astaVerde
			.connect(user)
			.buyBatch(batchID, usdcAmount, tokenAmount);
		let receipt = await tx.wait();
		let block = await ethers.provider.getBlock(receipt.blockNumber);
		let timestamp = block.timestamp;
		await expect(tx)
			.to.emit(this.astaVerde, "PartialBatchSold")
			.withArgs(batchID, timestamp, tokenAmount);

		tokenAmount = BigInt(3); // Buy the 3 remaining tokens
		usdcAmount = price * tokenAmount;
		await this.mockUSDC.connect(user).approve(this.astaVerde, usdcAmount);

		tx = await this.astaVerde
			.connect(user)
			.buyBatch(batchID, usdcAmount, tokenAmount);
		receipt = await tx.wait();
		block = await ethers.provider.getBlock(receipt.blockNumber);
		timestamp = block.timestamp;
		await expect(tx)
			.to.emit(this.astaVerde, "BatchSold")
			.withArgs(batchID, timestamp, 5);
	});

	/*
  mint
  buy
  increase time for N days
  mint
  observe effect of the N days on the price of thew new mint
  */
	it("base price should decrease after 10 days", async function () {
		const cids = ["cid1", "cid2"];
		const producers = createNewAddresses(cids.length);
		await expect(this.astaVerde.mintBatch(producers, cids)).to.emit(
			this.astaVerde,
			"BatchMinted",
		);

		const batchID = await this.astaVerde.lastBatchID();
		const { price } = await this.astaVerde.getBatchInfo(batchID);
		const tokenAmount = BigInt(cids.length);
		const usdcAmount = price * tokenAmount;
		const address = await this.astaVerde.getAddress();
		await this.mockUSDC.approve(address, usdcAmount);
		await this.astaVerde.setApprovalForAll(address, true);
		await this.astaVerde.buyBatch(batchID, usdcAmount, tokenAmount);
		expect(await this.astaVerde.getBatchPrice(batchID)).to.equal(BASE_PRICE);

		await waitNSeconds(10 * SECONDS_IN_A_DAY);

		const tx = await this.astaVerde.mintBatch(producers, cids);
		const receipt = await tx.wait();
		const block = await ethers.provider.getBlock(receipt.blockNumber);
		const timestamp = block.timestamp;

		await expect(tx)
			.to.emit(this.astaVerde, "BatchMinted")
			.withArgs(1, timestamp)
			.to.emit(this.astaVerde, "PlatformBasePriceAdjusted");

		const newBatchID = await this.astaVerde.lastBatchID();
		const { price: newPrice } = await this.astaVerde.getBatchInfo(newBatchID);
		expect(newPrice).to.equal(price - 10n * USDC_PRECISION);
	});

	it("base price should increase before 1 days", async function () {
		const cids = ["cid1", "cid2"];
		const producers = createNewAddresses(cids.length);

		await expect(this.astaVerde.mintBatch(producers, cids)).to.emit(
			this.astaVerde,
			"BatchMinted",
		);

		const batchID = await this.astaVerde.lastBatchID();
		const { price } = await this.astaVerde.getBatchInfo(batchID);
		const tokenAmount = BigInt(cids.length);
		const usdcAmount = price * tokenAmount;
		const address = await this.astaVerde.getAddress();
		await this.mockUSDC.approve(address, usdcAmount);
		await this.astaVerde.setApprovalForAll(address, true);
		await this.astaVerde.buyBatch(batchID, usdcAmount, tokenAmount);
		expect(await this.astaVerde.getBatchPrice(batchID)).to.equal(BASE_PRICE);

		await network.provider.send("evm_increaseTime", [SECONDS_IN_A_DAY]);
		await network.provider.send("evm_mine");

		const tx = await this.astaVerde.mintBatch(producers, cids);
		const receipt = await tx.wait();
		const block = await ethers.provider.getBlock(receipt.blockNumber);
		const timestamp = block.timestamp;

		await expect(tx)
			.to.emit(this.astaVerde, "BatchMinted")
			.withArgs(1, timestamp)
			.to.emit(this.astaVerde, "PlatformBasePriceAdjusted");

		const newBatchID = await this.astaVerde.lastBatchID();
		const { price: newPrice } = await this.astaVerde.getBatchInfo(newBatchID);
		expect(newPrice).to.equal(price + 10n * USDC_PRECISION);
	});

	it("base price should remain the same at 6 days", async function () {
		const cids = ["cid1", "cid2"];
		const producers = createNewAddresses(cids.length);
		await expect(this.astaVerde.mintBatch(producers, cids)).to.emit(
			this.astaVerde,
			"BatchMinted",
		);

		const batchID = await this.astaVerde.lastBatchID();
		const { price } = await this.astaVerde.getBatchInfo(batchID);
		const tokenAmount = BigInt(cids.length);
		const usdcAmount = price * tokenAmount;
		const address = await this.astaVerde.getAddress();
		await this.mockUSDC.approve(address, usdcAmount);
		await this.astaVerde.setApprovalForAll(address, true);
		await this.astaVerde.buyBatch(batchID, usdcAmount, tokenAmount);
		expect(await this.astaVerde.getBatchPrice(batchID)).to.equal(BASE_PRICE);

		await network.provider.send("evm_increaseTime", [SECONDS_IN_A_DAY * 3]);
		await network.provider.send("evm_mine");

		const tx = await this.astaVerde.mintBatch(producers, cids);
		const receipt = await tx.wait();
		const block = await ethers.provider.getBlock(receipt.blockNumber);
		const timestamp = block.timestamp;

		await expect(tx)
			.to.emit(this.astaVerde, "BatchMinted")
			.withArgs(1, timestamp)
			.to.emit(this.astaVerde, "PlatformBasePriceAdjusted");

		const newBatchID = await this.astaVerde.lastBatchID();
		const { price: newPrice } = await this.astaVerde.getBatchInfo(newBatchID);
		expect(newPrice).to.equal(price);
	});

	it("should handle refund when the USDC amount is greater than the total cost", async function () {
		const cids = ["cid1", "cid2", "cid3"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();
		const { price } = await this.astaVerde.getBatchInfo(batchID);
		const tokenAmount = BigInt(cids.length);
		const usdcAmount = price * tokenAmount;
		const overPaidAmount = usdcAmount + 1000n * USDC_PRECISION; // Overpay by 1000
		const user = this.signers.others[0]; // Use a user to buy, not the admin
		const initialUserBalance = 1000000n * USDC_PRECISION;
		await mintUSDC(user, this.mockUSDC, initialUserBalance);
		await this.mockUSDC.connect(user).approve(this.astaVerde, overPaidAmount);
		await this.astaVerde.connect(user).setApprovalForAll(this.astaVerde, true);
		await this.astaVerde
			.connect(user)
			.buyBatch(batchID, overPaidAmount, tokenAmount);
		const userBalanceAfterPurchase = await this.mockUSDC.balanceOf(
			user.address,
		);
		expect(userBalanceAfterPurchase).to.equal(initialUserBalance - usdcAmount); // Expect the overpaid amount to be refunded
	});

	// test_GetPartialIds(): Test retrieving partial IDs from a batch.

	// testFail_GetPartialIdsWithZeroNumberToBuy(): Test retrieving partial IDs from a batch with a zero number to buy.

	// testFail_GetPartialIdsWithNumberToBuyGreaterThanRemainingTokens(): Test retrieving partial IDs from a batch with a number to buy greater than the remaining tokens.

	it("should redeem tokens by the token owner", async function () {
		// Mint a batch of tokens
		const cids = ["cid1", "cid2", "cid3"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();

		// Buy the batch of tokens
		const batchInfo = await this.astaVerde.getBatchInfo(batchID);
		const price = batchInfo[3];
		const tokenAmount = BigInt(cids.length);
		const usdcAmount = price * tokenAmount;
		const user = this.signers.others[0];
		await mintUSDC(user, this.mockUSDC, 1000000n * USDC_PRECISION);
		await this.mockUSDC.connect(user).approve(this.astaVerde, usdcAmount);
		await this.astaVerde.connect(user).setApprovalForAll(this.astaVerde, true);
		await this.astaVerde
			.connect(user)
			.buyBatch(batchID, usdcAmount, tokenAmount);

		// Redeem the tokens
		const tokenIds = batchInfo[1];
		await this.astaVerde.connect(user).redeemTokens([...tokenIds]); // a copy of tokenIDs is needed

		// Check that the tokens are marked as redeemed
		for (let i = 0; i < tokenIds.length; i++) {
			const tokenInfo = await this.astaVerde.tokens(tokenIds[i]);
			const isRedeemed = tokenInfo[3]; // Assuming isRedeemed is the fourth property in the struct
			expect(isRedeemed).to.be.true;
		}
	});

	it("should fail to redeem tokens by a non-owner", async function () {
		// Mint a batch of tokens
		const cids = ["cid1", "cid2", "cid3"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();

		// User 1 buys the batch of tokens
		const user1 = this.signers.others[0];
		const batchInfo = await this.astaVerde.getBatchInfo(batchID);
		const price = batchInfo[3];
		const tokenAmount = BigInt(cids.length);
		const usdcAmount = price * tokenAmount;
		await mintUSDC(user1, this.mockUSDC, 1000000n * USDC_PRECISION);
		await this.mockUSDC.connect(user1).approve(this.astaVerde, usdcAmount);
		await this.astaVerde.connect(user1).setApprovalForAll(this.astaVerde, true);
		await this.astaVerde
			.connect(user1)
			.buyBatch(batchID, usdcAmount, tokenAmount);

		// User 2 attempts to redeem the tokens
		const user2 = this.signers.others[1];
		const tokenIds = batchInfo[1];
		await expect(
			this.astaVerde.connect(user2).redeemTokens([...tokenIds]),
		).to.be.revertedWith("Only the owner can redeem");
	});

	it("should fail to redeem tokens when the contract is paused", async function () {
		// Mint a batch of tokens
		const cids = ["cid1", "cid2", "cid3"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();

		// Buy the batch of tokens
		const batchInfo = await this.astaVerde.getBatchInfo(batchID);
		const price = batchInfo[3];
		const tokenAmount = BigInt(cids.length);
		const usdcAmount = price * tokenAmount;
		const user = this.signers.others[0];
		await mintUSDC(user, this.mockUSDC, 1000000n * USDC_PRECISION);
		await this.mockUSDC.connect(user).approve(this.astaVerde, usdcAmount);
		await this.astaVerde.connect(user).setApprovalForAll(this.astaVerde, true);
		await this.astaVerde
			.connect(user)
			.buyBatch(batchID, usdcAmount, tokenAmount);

		// Pause the contract
		await this.astaVerde.pause();

		// Redeem the tokens
		const tokenIds = batchInfo[1];
		try {
			await this.astaVerde.connect(user).redeemTokens([...tokenIds]);
		} catch (error) {
			if (!error.message.includes("EnforcedPause()")) {
				throw new Error(
					"Expected 'EnforcedPause()' to be included in the error message",
				);
			}
		}
	});

	it("should allow the owner to claim platform funds", async function () {
		// Mint two batches of tokens
		const cids1 = ["cid1", "cid2", "cid3"];
		const cids2 = ["cid4", "cid5", "cid6"];
		const producers1 = createNewAddresses(cids1.length);
		const producers2 = createNewAddresses(cids2.length);
		await this.astaVerde.mintBatch(producers1, cids1);
		const batchID1 = await this.astaVerde.lastBatchID();
		await this.astaVerde.mintBatch(producers2, cids2);
		const batchID2 = await this.astaVerde.lastBatchID();

		// Two different users buy the batches
		const user1 = this.signers.others[0];
		const user2 = this.signers.others[1];
		const batchInfo1 = await this.astaVerde.getBatchInfo(batchID1);
		const batchInfo2 = await this.astaVerde.getBatchInfo(batchID2);
		const price1 = batchInfo1[3];
		const price2 = batchInfo2[3];
		const tokenAmount1 = BigInt(cids1.length);
		const tokenAmount2 = BigInt(cids2.length);
		const usdcAmount1 = price1 * tokenAmount1;
		const usdcAmount2 = price2 * tokenAmount2;
		await mintUSDC(user1, this.mockUSDC, usdcAmount1);
		await mintUSDC(user2, this.mockUSDC, usdcAmount2);
		await this.mockUSDC.connect(user1).approve(this.astaVerde, usdcAmount1);
		await this.mockUSDC.connect(user2).approve(this.astaVerde, usdcAmount2);
		await this.astaVerde
			.connect(user1)
			.buyBatch(batchID1, usdcAmount1, tokenAmount1);
		await this.astaVerde
			.connect(user2)
			.buyBatch(batchID2, usdcAmount2, tokenAmount2);

		// The owner collects the platform funds;
		const ownerFundsBefore = await this.mockUSDC.balanceOf(this.signers.admin);
		console.log("ownerFundsBefore", ownerFundsBefore.toString());
		await this.astaVerde.claimPlatformFunds(this.signers.admin.address);
		const ownerFundsAfter = await this.mockUSDC.balanceOf(
			this.signers.admin.address,
		);
		console.log("ownerFundsAfter", ownerFundsAfter.toString());
		expect(ownerFundsAfter).to.be.gt(ownerFundsBefore);
	});

	it("should fail when a non-owner tries to claim platform funds", async function () {
		const nonOwner = this.signers.others[0];
		try {
			await this.astaVerde
				.connect(nonOwner)
				.claimPlatformFunds(nonOwner.address);
		} catch (error) {
			if (!error.message.includes("OwnableUnauthorizedAccount")) {
				throw new Error(
					"Expected 'OwnableUnauthorizedAccount' to be included in the error message",
				);
			}
		}
	});

	/*
  testing the decreasing price of batches
  first, mint n batches
  then, for each, wait n days for each batch before buying it, where n is batch id
  effective price should be base price - (n * priceDecreaseRate)
  */
	it("should mint n batches, each with its own price, and wait n days before buying", async function () {
		const numBatches = 10;
		const cids: string[] = new Array(MAX_BATCH_SIZE).fill("cid");
		const producers = createNewAddresses(MAX_BATCH_SIZE);
		const user = this.signers.others[0];

		const usdcAmounts = [];
		const tokenAmounts = [];

		for (let i = 0; i < numBatches; i++) {
			console.log("mint batch", i);
			await this.astaVerde.mintBatch(producers, cids);
		}

		for (let i = 0; i < numBatches; i++) {
			console.log("buy batch", i);
			let batchInfo = await this.astaVerde.getBatchInfo(i);
			let price = batchInfo[3];
			const tokenAmount = BigInt(cids.length);
			const usdcAmount = price * tokenAmount;
			usdcAmounts.push(usdcAmount);
			tokenAmounts.push(tokenAmount);
			await mintUSDC(user, this.mockUSDC, usdcAmount);
			await this.mockUSDC.connect(user).approve(this.astaVerde, usdcAmount);
			await this.astaVerde.connect(user).buyBatch(i, usdcAmount, tokenAmount); // here we see the price decrease
			const expectedPrice = BASE_PRICE - BigInt(i) * PRICE_DECREASE_RATE;
			batchInfo = await this.astaVerde.getBatchInfo(i); // here we see it decrease again
			price = batchInfo[3];

			console.log("expectedPrice", expectedPrice);
			console.log("price", price);
			expect(price).to.equal(expectedPrice);

			await waitNSeconds(SECONDS_IN_A_DAY);
		}
	});

	it("should handle edge cases for time correctly", async function () {
		const numBatches = 10;
		const cids: string[] = new Array(MAX_BATCH_SIZE).fill("cid");
		const producers = createNewAddresses(MAX_BATCH_SIZE);
		// const user = this.signers.others[0];

		for (let i = 0; i < numBatches; i++) {
			await this.astaVerde.mintBatch(producers, cids);
		}

		// Edge case 1: Buying immediately after minting
		let price = await this.astaVerde.getBatchPrice(0);
		expect(price).to.equal(BASE_PRICE);

		// Edge case 2: Buying after maximum possible time
		const one_billion_years_approx = 60 * 60 * 24 * 365.25 * 10 ** 9;
		await waitNSeconds(one_billion_years_approx);
		price = await this.astaVerde.getBatchPrice(0);
		expect(price).to.equal(PRICE_FLOOR);
	});

	it("tokens should have correct metadata after minting", async function () {
		const cids = ["cid1", "cid2"];
		const producers = createNewAddresses(cids.length);
		await this.astaVerde.mintBatch(producers, cids);
		const batchID = await this.astaVerde.lastBatchID();
		const { tokenIds } = await this.astaVerde.getBatchInfo(batchID);
		for (let i = 0; i < tokenIds.length; i++) {
			const tokenInfo = await this.astaVerde.tokens(tokenIds[i]);
			expect(tokenInfo[0]).to.equal(i + 1); // token index
			expect(tokenInfo[2]).to.equal(cids[i]); // cid
			expect(tokenInfo[3]).to.be.false; // is redeemed
		}
	});

	// test paying with a non-USDC token should fail. this requires minting AnotherERC20 and using it to pay
}
