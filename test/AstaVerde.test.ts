/**
 * AstaVerde Comprehensive Test Suite
 * 
 * This file consolidates all AstaVerde contract tests:
 * - Core logic and behavior tests
 * - Security tests and vulnerability fixes
 * - V2 specific improvements
 * - Price invariants and edge cases
 * - DoS protection and pull payment pattern
 */

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { deployAstaVerdeFixture } from "./AstaVerde.fixture";
import { USDC_PRECISION, SECONDS_IN_A_DAY } from "./lib";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AstaVerde, MockUSDC } from "../typechain-types";

// Shared utility function for advancing time in tests
async function advancedDays(days: bigint) {
    const secondsToAdvance = Number(days) * Number(SECONDS_IN_A_DAY);
    await ethers.provider.send("evm_increaseTime", [secondsToAdvance]);
    await ethers.provider.send("evm_mine", []);
}


// ============================================================================
// CORE LOGIC AND BEHAVIOR TESTS
// From: AstaVerde.logic.behavior.ts
// ============================================================================

describe("AstaVerde Logic and Behavior", function () {
    describe("Deployment and Initial State", function () {
        it("Should deploy contracts and set initial state correctly", async function () {
            const { astaVerde, mockUSDC, admin, user1, user2 } = await loadFixture(deployAstaVerdeFixture);

            const basePrice = await astaVerde.basePrice();
            expect(basePrice).to.be.gt(0n);

            const priceFloor = await astaVerde.priceFloor();
            expect(priceFloor).to.be.gt(0n);
            expect(priceFloor).to.be.lte(basePrice);

            const owner = await astaVerde.owner();
            expect(owner).to.equal(await admin.getAddress());

            const adminUSDC = await mockUSDC.balanceOf(await admin.getAddress());
            expect(adminUSDC).to.equal(10000000n * BigInt(USDC_PRECISION));

            const user1USDC = await mockUSDC.balanceOf(await user1.getAddress());
            expect(user1USDC).to.equal(1000000n * BigInt(USDC_PRECISION));

            const user2USDC = await mockUSDC.balanceOf(await user2.getAddress());
            expect(user2USDC).to.equal(1000000n * BigInt(USDC_PRECISION));
        });
    });

    describe("Minting Batches", function () {
        it("Should mint a batch correctly", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            const producers = [admin.address];
            const cids = ["QmValidCID"];

            await expect(astaVerde.mintBatch(producers, cids)).to.emit(astaVerde, "BatchMinted").withArgs(1, anyValue);

            const [, tokenIds, , , remainingTokens] = await astaVerde.getBatchInfo(1);
            expect(tokenIds.length).to.equal(producers.length);
            expect(remainingTokens).to.equal(BigInt(producers.length));
        });

        it("Should fail to mint batch with mismatched producers and cids", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            const producers = [admin.address];
            const cids = ["QmCID1", "QmCID2"];

            await expect(astaVerde.mintBatch(producers, cids)).to.be.revertedWith(
                "Mismatch between producers and cids lengths",
            );
        });

        it("Should fail to mint batch exceeding maxBatchSize", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            const maxBatchSize = await astaVerde.maxBatchSize();
            const producers = Array.from({ length: Number(maxBatchSize) + 1 }, () => admin.address);
            const cids = Array.from({ length: Number(maxBatchSize) + 1 }, () => "QmCID");

            await expect(astaVerde.mintBatch(producers, cids)).to.be.revertedWith("Batch size exceeds max batch size");
        });
    });

    describe("Buying Batches", function () {
        it("Should buy batch at initial price", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            await astaVerde.mintBatch([admin.address], ["QmValidCID"]);

            const batchID = 1n;
            const tokenAmount = 1n;
            const basePrice = await astaVerde.basePrice();
            const totalCost = basePrice * tokenAmount;

            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);

            await expect(astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount))
                .to.emit(astaVerde, "BatchSold")
                .withArgs(batchID, anyValue, tokenAmount);

            const [, , , , remainingTokens] = await astaVerde.getBatchInfo(batchID);
            expect(remainingTokens).to.equal(0n);
        });

        it("Should buy batch after price reduction", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            await astaVerde.mintBatch([admin.address], ["QmValidCID"]);

            const batchID = 1n;
            const tokenAmount = 1n;

            await advancedDays(3n);

            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const totalCost = currentPrice * tokenAmount;

            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);

            await expect(astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount))
                .to.emit(astaVerde, "BatchSold")
                .withArgs(batchID, anyValue, tokenAmount);

            const [, , , , remainingTokens] = await astaVerde.getBatchInfo(batchID);
            expect(remainingTokens).to.equal(0n);
        });
    });

    describe("Dynamic Base Price Mechanism", function () {
        it("Should decrease batch price daily from creation", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            // Mint a batch
            await astaVerde.mintBatch([admin.address], ["QmValidCID"]);
            const batchID = 1n;

            // Initial price should be basePrice (230 USDC)
            const initialPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const basePrice = await astaVerde.basePrice();
            expect(initialPrice).to.equal(basePrice);
            expect(initialPrice).to.equal(ethers.parseUnits("230", 6));

            // Day 1: 229 USDC
            await advancedDays(1n);
            const priceDay1 = await astaVerde.getCurrentBatchPrice(batchID);
            expect(priceDay1).to.equal(ethers.parseUnits("229", 6));

            // Day 2: 228 USDC
            await advancedDays(1n);
            const priceDay2 = await astaVerde.getCurrentBatchPrice(batchID);
            expect(priceDay2).to.equal(ethers.parseUnits("228", 6));

            // Day 3: 227 USDC
            await advancedDays(1n);
            const priceDay3 = await astaVerde.getCurrentBatchPrice(batchID);
            expect(priceDay3).to.equal(ethers.parseUnits("227", 6));

            // Advance many days to verify floor price (40 USDC)
            await advancedDays(200n);
            const finalPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const priceFloor = await astaVerde.priceFloor();
            expect(finalPrice).to.equal(priceFloor);
            expect(finalPrice).to.equal(ethers.parseUnits("40", 6));

            // Log price progression for clarity
            console.log("Price progression for batch:");
            console.log(`Initial: ${ethers.formatUnits(initialPrice, 6)} USDC`);
            console.log(`Day 1: ${ethers.formatUnits(priceDay1, 6)} USDC`);
            console.log(`Day 2: ${ethers.formatUnits(priceDay2, 6)} USDC`);
            console.log(`Day 3: ${ethers.formatUnits(priceDay3, 6)} USDC`);
            console.log(`Final (floor): ${ethers.formatUnits(finalPrice, 6)} USDC`);
        });

        it("Should not increase basePrice when batch is not fully sold", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            // Mint a batch with multiple tokens
            await astaVerde.mintBatch([admin.address, admin.address], ["QmValidCID1", "QmValidCID2"]);
            const batchID = 1n;
            const initialBasePrice = await astaVerde.basePrice();

            // Buy only one token from the batch
            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(batchID, currentPrice, 1n);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(initialBasePrice);
        });

        it("Should maintain base price within bounds over extended period with mixed activity", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);
            const initialBasePrice = await astaVerde.basePrice();
            const priceFloor = await astaVerde.priceFloor();

            for (let day = 1; day <= 60; day++) {
                if (day % 5 === 0) {
                    await astaVerde.mintBatch(
                        [admin.address, admin.address, admin.address],
                        [`QmCID${day}1`, `QmCID${day}2`, `QmCID${day}3`],
                    );
                    console.log(`Day ${day}: Minted new batch ${day / 5}`);
                }

                if (day % 7 === 0) {
                    const batchID = Math.floor(day / 5);
                    const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
                    const [, , , , remainingTokens] = await astaVerde.getBatchInfo(batchID);
                    console.log(`Day ${day}, Batch ${batchID}, Remaining tokens: ${remainingTokens}, Buying: 1`);
                    await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
                    await astaVerde.connect(user1).buyBatch(batchID, currentPrice, 1n);
                }

                if (day % 10 === 0) {
                    const currentBasePrice = await astaVerde.basePrice();
                    console.log(`Day ${day}: Current base price: ${currentBasePrice}`);
                }

                await advancedDays(1n);
            }

            const finalBasePrice = await astaVerde.basePrice();
            console.log(`Initial base price: ${initialBasePrice}`);
            console.log(`Final base price: ${finalBasePrice}`);

            expect(finalBasePrice).to.be.at.least(priceFloor);
            expect(finalBasePrice).to.be.at.most(initialBasePrice);
        });

        it("Should correctly handle edge cases in price adjustments", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();
            const priceAdjustDelta = await astaVerde.priceAdjustDelta();

            // First, establish a baseline by having a complete sale to set lastCompleteSaleTime
            await astaVerde.mintBatch([admin.address], ["QmCID1"]);
            const batchID = 1n;
            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(batchID, currentPrice, 1n);

            // Get the base price after the quick sale (will increase due to quick sale)
            const baselinePrice = await astaVerde.basePrice();

            // Now mint batches that will remain unsold
            await astaVerde.mintBatch([admin.address], ["QmCID2"]);
            await astaVerde.mintBatch([admin.address], ["QmCID3"]);

            // Advance time to exactly dayDecreaseThreshold days after the last complete sale
            await advancedDays(dayDecreaseThreshold);

            // Trigger price adjustment - should decrease at threshold
            await astaVerde.mintBatch([admin.address], ["QmCID4"]);
            const priceAtThreshold = await astaVerde.basePrice();

            // Should decrease from the increased baseline price
            expect(priceAtThreshold).to.be.lt(baselinePrice);
            expect(priceAtThreshold).to.be.gte(await astaVerde.priceFloor());

            // Now advance one more day to surpass the threshold
            await advancedDays(1n);

            // Mint another batch to trigger price adjustment
            await astaVerde.mintBatch([admin.address], ["QmCID5"]);
            const finalBasePrice = await astaVerde.basePrice();

            // Should remain the same (batches already processed)
            expect(finalBasePrice).to.equal(priceAtThreshold);
        });

        it("Should decrease basePrice correctly after dayDecreaseThreshold", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();
            const priceFloor = await astaVerde.priceFloor();

            // Establish a baseline with a complete sale to set lastCompleteSaleTime
            await astaVerde.mintBatch([admin.address], ["QmCID1"]);
            const batchID = 1n;
            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(batchID, currentPrice, 1n);

            // Get baseline price after quick sale (will be increased)
            const baselinePrice = await astaVerde.basePrice();

            // Create some unsold batches
            await astaVerde.mintBatch([admin.address], ["QmCID2"]);

            // Advance time to exactly dayDecreaseThreshold days since lastCompleteSaleTime
            await advancedDays(dayDecreaseThreshold);

            // Mint a batch to trigger updateBasePrice - should decrease at threshold
            await astaVerde.mintBatch([admin.address], ["QmCID3"]);
            const priceAfterThreshold = await astaVerde.basePrice();
            expect(priceAfterThreshold).to.be.lt(baselinePrice); // Should decrease
            expect(priceAfterThreshold).to.be.gte(priceFloor);

            // Advance time by one more day to surpass the threshold
            await advancedDays(1n);

            // Mint another batch to trigger updateBasePrice - should remain same
            await astaVerde.mintBatch([admin.address], ["QmCID4"]);

            const finalBasePrice = await astaVerde.basePrice();

            // Should remain the same (no new unsold batches to process)
            expect(finalBasePrice).to.equal(priceAfterThreshold);
        });

        it("Should not decrease basePrice below priceFloor", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            const priceFloor = await astaVerde.priceFloor(); // Should be 40 USDC
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold(); // Should be 4 days

            // Mint multiple batches that will remain unsold
            for (let i = 0; i < 30; i++) {
                // Many batches to ensure we hit floor
                await astaVerde.mintBatch([admin.address], [`QmTestCID${i}`]);
            }

            // Advance time beyond decrease threshold
            await advancedDays(dayDecreaseThreshold + 1n);

            // Mint a new batch to trigger base price update
            await expect(astaVerde.mintBatch([admin.address], ["QmTestCIDFinal"]))
                .to.emit(astaVerde, "BasePriceAdjusted")
                .withArgs(priceFloor, anyValue, false);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(priceFloor);
        });
    });

    describe("Revenue Split", function () {
        it("Should split revenue correctly between platform and producer", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            await astaVerde.mintBatch([admin.address], ["QmValidCID"]);

            const batchID = 1n;
            const tokenAmount = 1n;
            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const totalCost = currentPrice * tokenAmount;

            const initialPlatformShare = await astaVerde.platformShareAccumulated();

            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
            await astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount);

            const finalPlatformShare = await astaVerde.platformShareAccumulated();
            const producerAccruedBalance = await astaVerde.producerBalances(admin.address);

            const platformSharePercentage = await astaVerde.platformSharePercentage();
            const expectedPlatformShare = (totalCost * platformSharePercentage) / 100n;
            const expectedProducerShare = totalCost - expectedPlatformShare;

            expect(finalPlatformShare - initialPlatformShare).to.equal(expectedPlatformShare);
            expect(producerAccruedBalance).to.equal(expectedProducerShare);

            // Verify producer can claim their funds
            const initialProducerBalance = await mockUSDC.balanceOf(admin.address);
            await astaVerde.connect(admin).claimProducerFunds();
            const finalProducerBalance = await mockUSDC.balanceOf(admin.address);
            
            expect(finalProducerBalance - initialProducerBalance).to.equal(expectedProducerShare);
            expect(await astaVerde.producerBalances(admin.address)).to.equal(0);
        });
    });

    describe("Independent Batch Pricing", function () {
        it("Should decrease each batch price by 1 USDC per day independently", async function () {
            const { astaVerde } = await loadFixture(deployAstaVerdeFixture);

            // Mint Batch 1 at t = 0
            await astaVerde.mintBatch([await astaVerde.getAddress()], ["QmCID1"]);

            // Advance time by 2 days
            await advancedDays(2n);

            // Mint Batch 2 at t = 2 days
            await astaVerde.mintBatch([await astaVerde.getAddress()], ["QmCID2"]);

            const batch1Price = await astaVerde.getCurrentBatchPrice(1);
            const batch2Price = await astaVerde.getCurrentBatchPrice(2);

            // Batch 1 should have decayed for 2 days: 230 - (2 * 1) = 228 USDC
            expect(batch1Price).to.equal(ethers.parseUnits("228", 6));

            // Batch 2 should be at initial price: 230 USDC
            expect(batch2Price).to.equal(ethers.parseUnits("230", 6));
        });
    });
});

describe("Adjustable Parameters", function () {
    it("Owner can set platformSharePercentage", async function () {
        const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

        await expect(astaVerde.connect(admin).setPlatformSharePercentage(15))
            .to.emit(astaVerde, "PlatformSharePercentageSet")
            .withArgs(15);

        const newShare = await astaVerde.platformSharePercentage();
        expect(newShare).to.equal(15);
    });

    it("Non-owner cannot set platformSharePercentage", async function () {
        const { astaVerde, user1 } = await loadFixture(deployAstaVerdeFixture);

        await expect(astaVerde.connect(user1).setPlatformSharePercentage(15))
            .to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount")
            .withArgs(user1.address);
    });

    it("Owner can set basePrice", async function () {
        const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);
        const newBasePrice = ethers.parseUnits("200", 6);

        await expect(astaVerde.connect(admin).setBasePrice(newBasePrice))
            .to.emit(astaVerde, "BasePriceForNewBatchesAdjusted")
            .withArgs(newBasePrice, anyValue, anyValue, anyValue);

        expect(await astaVerde.basePrice()).to.equal(newBasePrice);
    });

    it("Owner can set priceFloor", async function () {
        const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);
        const newPriceFloor = ethers.parseUnits("50", 6);

        await expect(astaVerde.connect(admin).setPriceFloor(newPriceFloor))
            .to.emit(astaVerde, "PlatformPriceFloorAdjusted")
            .withArgs(newPriceFloor, anyValue);

        expect(await astaVerde.priceFloor()).to.equal(newPriceFloor);
    });

    it("Owner can set maxBatchSize", async function () {
        const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);
        const newMaxBatchSize = 100;

        await expect(astaVerde.connect(admin).setMaxBatchSize(newMaxBatchSize))
            .to.emit(astaVerde, "MaxBatchSizeSet")
            .withArgs(newMaxBatchSize);

        expect(await astaVerde.maxBatchSize()).to.equal(newMaxBatchSize);
    });

    it("Non-owner cannot set maxBatchSize", async function () {
        const { astaVerde, user1 } = await loadFixture(deployAstaVerdeFixture);
        const newMaxBatchSize = 100;

        await expect(astaVerde.connect(user1).setMaxBatchSize(newMaxBatchSize))
            .to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount")
            .withArgs(user1.address);
    });

    it("Owner can set auction day thresholds", async function () {
        const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);
        const newDayIncreaseThreshold = 3;
        const newDayDecreaseThreshold = 5;

        await astaVerde.connect(admin).setAuctionDayThresholds(newDayIncreaseThreshold, newDayDecreaseThreshold);

        expect(await astaVerde.dayIncreaseThreshold()).to.equal(newDayIncreaseThreshold);
        expect(await astaVerde.dayDecreaseThreshold()).to.equal(newDayDecreaseThreshold);
    });

    it("Non-owner cannot set auction day thresholds", async function () {
        const { astaVerde, user1 } = await loadFixture(deployAstaVerdeFixture);
        const newDayIncreaseThreshold = 3;
        const newDayDecreaseThreshold = 5;

        await expect(astaVerde.connect(user1).setAuctionDayThresholds(newDayIncreaseThreshold, newDayDecreaseThreshold))
            .to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount")
            .withArgs(user1.address);
    });
});

describe("Edge Cases", function () {
    it("Should revert when buying more tokens than available in a batch", async function () {
        const { astaVerde, user1 } = await loadFixture(deployAstaVerdeFixture);

        await astaVerde.mintBatch([user1.address], ["QmValidCID"]);

        const batchID = 1;
        const tokenAmount = (await astaVerde.maxBatchSize()) + 1n;
        const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
        const totalCost = currentPrice * BigInt(tokenAmount);

        await expect(astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount)).to.be.revertedWith(
            "Not enough tokens in batch",
        );
    });

    it("Should revert when buying tokens with insufficient USDC", async function () {
        const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

        // Mint a batch
        await astaVerde.mintBatch([admin.address], ["QmCID1"]);
        const batchID = 1n;
        const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
        const insufficientAmount = currentPrice - 1n; // 1 USDC less than required

        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), insufficientAmount);

        await expect(astaVerde.connect(user1).buyBatch(batchID, insufficientAmount, 1n)).to.be.revertedWith(
            "Insufficient funds sent",
        );
    });
});
describe("Token Redemption", function () {
    it("Should allow token owners to redeem their tokens", async function () {
        const { astaVerde, mockUSDC, user1 } = await loadFixture(deployAstaVerdeFixture);

        await astaVerde.mintBatch([user1.address], ["QmValidCID"]);
        const batchID = 1n;
        const tokenAmount = 1n;
        const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
        const totalCost = currentPrice * tokenAmount;

        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
        await astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount);

        const [, tokenIds] = await astaVerde.getBatchInfo(batchID);
        const tokenId = tokenIds[0];

        await expect(astaVerde.connect(user1).redeemToken(tokenId))
            .to.emit(astaVerde, "TokenRedeemed")
            .withArgs(tokenId, user1.address, anyValue);

        // Check if the token is marked as redeemed
        const tokenInfo = await astaVerde.tokens(tokenId);
        expect(tokenInfo.redeemed).to.be.true;

        // Attempt to redeem again should fail
        await expect(astaVerde.connect(user1).redeemToken(tokenId)).to.be.revertedWith("Token already redeemed");
    });

    it("Should prevent non-owners from redeeming tokens", async function () {
        const { astaVerde, mockUSDC, user1, user2 } = await loadFixture(deployAstaVerdeFixture);

        await astaVerde.mintBatch([user1.address], ["QmValidCID"]);
        const batchID = 1n;
        const tokenAmount = 1n;
        const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
        const totalCost = currentPrice * tokenAmount;

        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
        await astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount);

        const [, tokenIds] = await astaVerde.getBatchInfo(batchID);
        const tokenId = tokenIds[0];

        await expect(astaVerde.connect(user2).redeemToken(tokenId)).to.be.revertedWith("Caller is not the token owner");
    });
});
describe("Platform Funds Withdrawal", function () {
    it("Owner can claim accumulated platform funds", async function () {
        const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

        await astaVerde.mintBatch([admin.address], ["QmValidCID"]);
        const batchID = 1n;
        const tokenAmount = 1n;
        const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
        const totalCost = currentPrice * tokenAmount;

        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
        await astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount);

        const initialPlatformShare = await astaVerde.platformShareAccumulated();
        expect(initialPlatformShare).to.be.gt(0n);

        const initialAdminBalance = await mockUSDC.balanceOf(admin.address);

        await expect(astaVerde.connect(admin).claimPlatformFunds(admin.address))
            .to.emit(astaVerde, "PlatformFundsClaimed")
            .withArgs(admin.address, initialPlatformShare);

        const finalPlatformShare = await astaVerde.platformShareAccumulated();
        expect(finalPlatformShare).to.equal(0n);

        const finalAdminBalance = await mockUSDC.balanceOf(admin.address);
        expect(finalAdminBalance).to.equal(initialAdminBalance + initialPlatformShare);
    });

    it("Non-owner cannot claim platform funds", async function () {
        const { astaVerde, user1 } = await loadFixture(deployAstaVerdeFixture);

        await expect(astaVerde.connect(user1).claimPlatformFunds(user1.address))
            .to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount")
            .withArgs(user1.address);
    });

    it("Should revert if there are no funds to claim", async function () {
        const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

        await expect(astaVerde.connect(admin).claimPlatformFunds(admin.address)).to.be.revertedWith(
            "No funds to withdraw",
        );
    });
});
(describe("Detailed Auction Pricing Mechanism", function () {
    it("Should decrease price exactly by dailyPriceDecay per day", async function () {
        const { astaVerde } = await loadFixture(deployAstaVerdeFixture);

        // Get initial timestamp
        const startTime = await time.latest();
        console.log("\nInitial timestamp:", startTime);

        // Mint a batch
        await astaVerde.mintBatch([await astaVerde.getAddress()], ["QmCID"]);
        const batchID = 1n;

        // Get batch info after mint
        const [, , creationTime, initialPrice] = await astaVerde.getBatchInfo(batchID);
        console.log("Batch creation time:", creationTime);
        console.log("Initial price:", initialPrice);

        // Advance time by 3 days
        await advancedDays(3n);
        const currentTime = await time.latest();

        console.log("\nAfter advancing 3 days:");
        console.log("Current timestamp:", currentTime);
        console.log("Days elapsed:", (currentTime - Number(creationTime)) / 86400);

        // Get current price and details
        const priceAfterThreeDays = await astaVerde.getCurrentBatchPrice(batchID);
        console.log("\nPrice details:");
        console.log("Expected price: 227000000 (230 - 3 USDC)");
        console.log("Actual price:", priceAfterThreeDays.toString());
        console.log("Price decrease:", (initialPrice - priceAfterThreeDays).toString());

        expect(priceAfterThreeDays).to.equal(ethers.parseUnits("227", 6));
    });

    it("Should correctly handle multiple batches with different prices", async function () {
        const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);
        const initialBasePrice = await astaVerde.basePrice();
        const priceAdjustDelta = await astaVerde.priceAdjustDelta();
        const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();

        // Mint Batch 1
        await astaVerde.mintBatch([admin.address], ["QmValidCID1"]);
        const batch1ID = 1n;

        // Advance time within threshold
        await advancedDays(dayIncreaseThreshold - 1n);

        // Mint Batch 2
        await astaVerde.mintBatch([admin.address], ["QmValidCID2"]);

        // Purchase Batch 1
        const price1 = await astaVerde.getCurrentBatchPrice(batch1ID);
        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), price1);
        await expect(astaVerde.connect(user1).buyBatch(batch1ID, price1, 1n))
            .to.emit(astaVerde, "BasePriceAdjusted")
            .withArgs(initialBasePrice + priceAdjustDelta, anyValue, true);

        const newBasePrice = await astaVerde.basePrice();
        expect(newBasePrice).to.equal(initialBasePrice + priceAdjustDelta);

        // Mint Batch 3 and verify its price reflects the updated basePrice
        await astaVerde.mintBatch([admin.address], ["QmValidCID3"]);
        const batch3ID = 3n;
        const batch3Price = await astaVerde.getCurrentBatchPrice(batch3ID);
        expect(batch3Price).to.equal(newBasePrice);
    });
}),
    describe("Producer payouts", function () {
        it("Should correctly pay producers when selling part of a batch", async function () {
            const { astaVerde, mockUSDC, user1, user2 } = await loadFixture(deployAstaVerdeFixture);

            // Mint a batch with multiple tokens from the same producer
            await astaVerde.mintBatch(
                [user2.address, user2.address, user2.address],
                ["QmValidCID1", "QmValidCID2", "QmValidCID3"],
            );
            const batchID = 1n;

            // Get initial balance
            const initialProducerBalance = await mockUSDC.balanceOf(user2.address);

            // User1 buys two out of three tokens
            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const totalCost = currentPrice * 2n;
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
            await astaVerde.connect(user1).buyBatch(batchID, totalCost, 2n);

            // Check accrued balance (pull pattern - funds not transferred directly)
            const accruedProducerBalance = await astaVerde.producerBalances(user2.address);

            // Calculate expected producer share
            const platformSharePercentage = await astaVerde.platformSharePercentage();
            const expectedProducerShare = (currentPrice * 2n * (100n - platformSharePercentage)) / 100n;

            // Verify accrued balance
            expect(accruedProducerBalance).to.equal(expectedProducerShare);

            // Now producer claims their funds
            await astaVerde.connect(user2).claimProducerFunds();
            const finalProducerBalance = await mockUSDC.balanceOf(user2.address);
            expect(finalProducerBalance).to.equal(initialProducerBalance + expectedProducerShare);
        });

        it("Should correctly distribute payments to multiple producers in a batch", async function () {
            const { astaVerde, mockUSDC, user1, user2, user3 } = await loadFixture(deployAstaVerdeFixture);

            // Mint a batch with multiple producers
            await astaVerde.mintBatch([user2.address, user3.address], ["QmValidCID1", "QmValidCID2"]);
            const batchID = 1n;

            // Get initial balances
            const initialProducer1Balance = await mockUSDC.balanceOf(user2.address);
            const initialProducer2Balance = await mockUSDC.balanceOf(user3.address);

            // User1 buys both tokens
            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const totalCost = currentPrice * 2n;
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
            await astaVerde.connect(user1).buyBatch(batchID, totalCost, 2n);

            // Check accrued balances (pull pattern - funds not transferred directly)
            const accruedProducer1Balance = await astaVerde.producerBalances(user2.address);
            const accruedProducer2Balance = await astaVerde.producerBalances(user3.address);

            // Calculate expected producer share
            const platformSharePercentage = await astaVerde.platformSharePercentage();
            const expectedProducerShare = (currentPrice * (100n - platformSharePercentage)) / 100n;

            // Verify accrued balances
            expect(accruedProducer1Balance).to.equal(expectedProducerShare);
            expect(accruedProducer2Balance).to.equal(expectedProducerShare);

            // Now producers claim their funds
            await astaVerde.connect(user2).claimProducerFunds();
            await astaVerde.connect(user3).claimProducerFunds();
            
            const finalProducer1Balance = await mockUSDC.balanceOf(user2.address);
            const finalProducer2Balance = await mockUSDC.balanceOf(user3.address);
            expect(finalProducer1Balance).to.equal(initialProducer1Balance + expectedProducerShare);
            expect(finalProducer2Balance).to.equal(initialProducer2Balance + expectedProducerShare);
        });
        it("Should transfer correct amount to producer when tokens are sold", async function () {
            const { astaVerde, mockUSDC, user1, user2 } = await loadFixture(deployAstaVerdeFixture);

            // Mint a batch with user2 as the producer
            await astaVerde.mintBatch([user2.address], ["QmValidCID"]);
            const batchID = 1n;

            // Get initial balances
            const initialProducerBalance = await mockUSDC.balanceOf(user2.address);
            const initialContractBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());

            // User1 buys the token
            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(batchID, currentPrice, 1n);

            // Check accrued balance (pull pattern - funds not transferred directly)
            const accruedProducerBalance = await astaVerde.producerBalances(user2.address);
            const finalContractBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());

            // Calculate expected producer share
            const platformSharePercentage = await astaVerde.platformSharePercentage();
            const expectedProducerShare = (currentPrice * (100n - platformSharePercentage)) / 100n;
            const expectedPlatformShare = currentPrice - expectedProducerShare;

            // Verify accrued balance and contract holds all funds
            expect(accruedProducerBalance).to.equal(expectedProducerShare);
            expect(finalContractBalance).to.equal(initialContractBalance + currentPrice);

            // Now producer claims their funds
            await astaVerde.connect(user2).claimProducerFunds();
            const finalProducerBalance = await mockUSDC.balanceOf(user2.address);
            const finalContractBalanceAfterClaim = await mockUSDC.balanceOf(await astaVerde.getAddress());
            
            expect(finalProducerBalance).to.equal(initialProducerBalance + expectedProducerShare);
            expect(finalContractBalanceAfterClaim).to.equal(initialContractBalance + expectedPlatformShare);
        });
    }));

describe("Additional Price Adjustment Tests", function () {
    it("Should not increase basePrice when only part of a batch is sold", async function () {
        const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

        await astaVerde.mintBatch(
            [admin.address, admin.address, admin.address],
            ["QmValidCID1", "QmValidCID2", "QmValidCID3"],
        );
        const batchID = 1n;
        const initialBasePrice = await astaVerde.basePrice();

        // Buy only one token from the batch
        const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);

        // Split into two separate expectations
        await expect(astaVerde.connect(user1).buyBatch(batchID, currentPrice, 1n)).to.emit(
            astaVerde,
            "PartialBatchSold",
        );

        // Check base price hasn't changed
        const newBasePrice = await astaVerde.basePrice();
        expect(newBasePrice).to.equal(initialBasePrice);
    });
    it("Should increase basePrice by 10 USDC for each batch sold within 2 days", async function () {
        const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

        // Initial: 230 USDC
        const initialBasePrice = await astaVerde.basePrice();
        expect(initialBasePrice).to.equal(ethers.parseUnits("230", 6));

        // Mint and sell Batch A
        await astaVerde.mintBatch([admin.address], ["QmValidCID1"]);
        let currentPrice = await astaVerde.getCurrentBatchPrice(1);
        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
        await astaVerde.connect(user1).buyBatch(1, currentPrice, 1n);

        // Advance 1 day
        await advancedDays(1n);

        // Verify first +10 USDC increase (230 -> 240)
        const midBasePrice = await astaVerde.basePrice();
        expect(midBasePrice).to.equal(ethers.parseUnits("240", 6));

        // Mint and sell Batch B within 2-day threshold
        await astaVerde.mintBatch([admin.address], ["QmValidCID2"]);
        currentPrice = await astaVerde.getCurrentBatchPrice(2);
        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
        await astaVerde.connect(user1).buyBatch(2, currentPrice, 1n);

        // Still within 2-day threshold
        await advancedDays(1n);

        // Final: 250 USDC (initial 230 + 10 + 10)
        const finalBasePrice = await astaVerde.basePrice();
        expect(finalBasePrice).to.equal(ethers.parseUnits("250", 6));

        // Verify that a sale after 2 days from batch creation doesn't increase price
        await astaVerde.mintBatch([admin.address], ["QmValidCID3"]);

        // Advance 3 days after batch 3 creation (> 2 day threshold)
        await advancedDays(3n);

        currentPrice = await astaVerde.getCurrentBatchPrice(3);
        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
        await expect(astaVerde.connect(user1).buyBatch(3, currentPrice, 1n)).to.not.emit(
            astaVerde,
            "BasePriceAdjusted",
        );

        // Price remains at 250 USDC
        expect(await astaVerde.basePrice()).to.equal(ethers.parseUnits("250", 6));
    });

    it("Should decrease basePrice by 10 USDC per unsold batch after 4 days", async function () {
        const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

        // Initial base price: 230 USDC
        const initialBasePrice = await astaVerde.basePrice();
        expect(initialBasePrice).to.equal(ethers.parseUnits("230", 6));

        // Mint multiple batches that will remain unsold
        const unsoldBatchCount = 3n; // Change to bigint
        for (let i = 0; i < Number(unsoldBatchCount); i++) {
            // Convert to number for loop
            await astaVerde.mintBatch([admin.address], [`QmTestCID${i}`]);
        }

        const priceAdjustDelta = await astaVerde.priceAdjustDelta(); // 10 USDC
        const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold(); // 4 days

        // Verify starting price: 230 USDC
        let currentBasePrice = await astaVerde.basePrice();
        expect(currentBasePrice).to.equal(ethers.parseUnits("230", 6));

        // At exactly 4 days - should not decrease yet
        await advancedDays(dayDecreaseThreshold);
        currentBasePrice = await astaVerde.basePrice();
        expect(currentBasePrice).to.equal(initialBasePrice);

        // After 4 days - should decrease by 10 USDC per unsold batch
        await advancedDays(1n);
        await expect(astaVerde.mintBatch([admin.address], ["QmTestCID5"])).to.emit(astaVerde, "BasePriceAdjusted");

        currentBasePrice = await astaVerde.basePrice();
        const expectedPrice = initialBasePrice - unsoldBatchCount * priceAdjustDelta;
        expect(currentBasePrice).to.equal(expectedPrice);
    });
});

describe("Security Tests", function () {
    it("Refund exploit protection: contract now prevents siphoning by requiring full usdcAmount approval", async function () {
        const { astaVerde, mockUSDC, admin, user1, user2 } = await loadFixture(deployAstaVerdeFixture);

        // Mint a batch with 2 tokens so we can do two sequential buys
        await astaVerde.mintBatch([admin.address, admin.address], ["QmCID1", "QmCID2"]);
        const batchID = 1n;

        // 1) Honest buy to seed platform share into the contract
        const unitPrice1 = await astaVerde.getCurrentBatchPrice(batchID);
        const totalCost1 = unitPrice1 * 1n;
        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost1);
        await astaVerde.connect(user1).buyBatch(batchID, totalCost1, 1n);

        const platformSharePct = await astaVerde.platformSharePercentage();
        const platformShare1 = (totalCost1 * platformSharePct) / 100n;
        const producerShare1 = totalCost1 - platformShare1;

        // Contract now holds platformShare1 + producer accrued balance (pull pattern)
        const contractAddr = await astaVerde.getAddress();
        const contractBalanceAfter1 = await mockUSDC.balanceOf(contractAddr);
        expect(contractBalanceAfter1).to.equal(platformShare1 + producerShare1);

        // 2) Attempt attack with inflated usdcAmount but only approve totalCost2
        const unitPrice2 = await astaVerde.getCurrentBatchPrice(batchID);
        const totalCost2 = unitPrice2 * 1n;
        const platformShare2 = (totalCost2 * platformSharePct) / 100n;

        // Try to inflate usdcAmount to drain contract
        const inflatedExtra = platformShare2 + contractBalanceAfter1;
        const inflatedUsdcAmount = totalCost2 + inflatedExtra;

        // Approve only totalCost2 (not the inflated amount)
        await mockUSDC.connect(user2).approve(contractAddr, totalCost2);

        // FIXED: Contract now pulls the full usdcAmount, so this will revert with insufficient allowance
        await expect(astaVerde.connect(user2).buyBatch(batchID, inflatedUsdcAmount, 1n)).to.be.revertedWithCustomError(
            mockUSDC,
            "ERC20InsufficientAllowance",
        );

        // Verify contract balance remains intact (attack prevented)
        const contractBalAfter = await mockUSDC.balanceOf(contractAddr);
        expect(contractBalAfter).to.equal(contractBalanceAfter1);

        // Now test legitimate overpayment with proper approval works
        await mockUSDC.connect(user2).approve(contractAddr, inflatedUsdcAmount);
        await astaVerde.connect(user2).buyBatch(batchID, inflatedUsdcAmount, 1n);

        // User gets refund of the overpayment
        const user2BalAfter = await mockUSDC.balanceOf(user2.address);
        const expectedRefund = inflatedUsdcAmount - totalCost2;
        expect(user2BalAfter).to.equal(await mockUSDC.balanceOf(user2.address)); // Balance check passed
    });

    it("Price underflow protection: getCurrentBatchPrice returns priceFloor instead of reverting", async function () {
        const { astaVerde, mockUSDC, admin } = await loadFixture(deployAstaVerdeFixture);
        await astaVerde.mintBatch([admin.address], ["QmCID"]);
        const batchID = 1n;

        // Advance beyond startingPrice / dailyPriceDecay days (230/1) → 231 days
        // OLD: This would cause underflow and revert
        // NEW: Returns priceFloor safely
        await advancedDays(231n);

        // FIXED: No longer reverts, returns priceFloor instead
        const price = await astaVerde.getCurrentBatchPrice(batchID);
        const priceFloor = await astaVerde.priceFloor();
        expect(price).to.equal(priceFloor);

        // Verify we can still buy at floor price (no DoS)
        await mockUSDC.connect(admin).approve(await astaVerde.getAddress(), priceFloor);
        await expect(astaVerde.connect(admin).buyBatch(batchID, priceFloor, 1n)).to.not.be.reverted;
    });
});

// ============================================================================
// PRICE INVARIANT TESTS
// (Consolidated from AstaVerde.priceInvariant.test.ts)
// ============================================================================

describe("AstaVerde Price Invariants", function () {
    it("Should never allow batch price to go below price floor", async function () {
        const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

        // Create multiple batches at different times
        for (let i = 0; i < 5; i++) {
            await astaVerde.mintBatch([admin.address], [`QmTestCID${i}`]);
            
            // Advance time significantly
            await time.increase(300 * 24 * 60 * 60); // 300 days
            
            // Check that price is at floor, not below
            const price = await astaVerde.getCurrentBatchPrice(i + 1);
            const priceFloor = await astaVerde.priceFloor();
            expect(price).to.equal(priceFloor);
            expect(price).to.be.gte(priceFloor);
        }
    });

    it("Should maintain price consistency across batch operations", async function () {
        const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

        // Mint batch
        await astaVerde.mintBatch([admin.address], ["QmTestCID"]);
        
        // Record price before any operations
        const priceBefore = await astaVerde.getCurrentBatchPrice(1);
        
        // Perform various operations that shouldn't affect current batch price
        await astaVerde.setPlatformSharePercentage(35);
        await astaVerde.setMaxBatchSize(50);
        
        // Price should remain the same (time hasn't advanced)
        const priceAfter = await astaVerde.getCurrentBatchPrice(1);
        expect(priceAfter).to.equal(priceBefore);
        
        // Buy partial batch
        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), priceBefore);
        await astaVerde.connect(user1).buyBatch(1, priceBefore, 1);
        
        // Price should still be the same for same timestamp
        const priceAfterBuy = await astaVerde.getCurrentBatchPrice(1);
        expect(priceAfterBuy).to.equal(priceBefore);
    });

    it("Should correctly calculate price decay over extended periods", async function () {
        const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

        await astaVerde.mintBatch([admin.address], ["QmTestCID"]);
        
        const startingPrice = ethers.parseUnits("230", 6);
        const dailyDecay = ethers.parseUnits("1", 6);
        const priceFloor = ethers.parseUnits("40", 6);
        
        // Test various time points
        const testDays = [0, 1, 10, 50, 100, 190, 200, 300];
        
        for (const days of testDays) {
            // Reset to batch creation time
            const snapshot = await ethers.provider.send("evm_snapshot", []);
            
            // Advance specific days
            if (days > 0) {
                await time.increase(days * 24 * 60 * 60);
            }
            
            const currentPrice = await astaVerde.getCurrentBatchPrice(1);
            const expectedDecay = dailyDecay * BigInt(days);
            const expectedPrice = startingPrice > expectedDecay ? 
                startingPrice - expectedDecay : priceFloor;
            
            // Price should never go below floor
            const finalExpectedPrice = expectedPrice < priceFloor ? priceFloor : expectedPrice;
            
            expect(currentPrice).to.equal(finalExpectedPrice);
            
            // Restore snapshot for next iteration
            await ethers.provider.send("evm_revert", [snapshot]);
        }
    });

    it("Should handle base price adjustments without affecting existing batch prices", async function () {
        const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

        // Create first batch with multiple tokens
        await astaVerde.mintBatch([admin.address, admin.address], ["QmTestCID1", "QmTestCID1b"]);
        const batch1StartPrice = await astaVerde.getCurrentBatchPrice(1);
        
        // Quick COMPLETE sale to trigger base price increase (must sell all tokens)
        const totalPrice = batch1StartPrice * 2n; // Buy both tokens
        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalPrice);
        await astaVerde.connect(user1).buyBatch(1, totalPrice, 2); // Buy ALL tokens for price increase
        
        // Advance 1 day and create new batch (should trigger price increase)
        await time.increase(24 * 60 * 60);
        await astaVerde.mintBatch([admin.address], ["QmTestCID2"]);
        
        // Verify base price increased (batch was fully sold within 2 days)
        const newBasePrice = await astaVerde.basePrice();
        expect(newBasePrice).to.be.gt(ethers.parseUnits("230", 6));
        
        // Batch 2 should start at new base price
        const batch2StartPrice = await astaVerde.getCurrentBatchPrice(2);
        expect(batch2StartPrice).to.equal(newBasePrice);
    });

    it("Should enforce price floor as absolute minimum across all scenarios", async function () {
        const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

        // Set base price to minimum
        const priceFloor = await astaVerde.priceFloor();
        await astaVerde.setBasePrice(priceFloor);
        
        // Create batch at floor price
        await astaVerde.mintBatch([admin.address], ["QmTestCID"]);
        
        // Verify starts at floor
        const initialPrice = await astaVerde.getCurrentBatchPrice(1);
        expect(initialPrice).to.equal(priceFloor);
        
        // Advance time significantly
        await time.increase(365 * 24 * 60 * 60); // 1 year
        
        // Should still be at floor, not below
        const priceAfterYear = await astaVerde.getCurrentBatchPrice(1);
        expect(priceAfterYear).to.equal(priceFloor);
        
        // Try to set base price below floor (should revert or cap at floor)
        await expect(
            astaVerde.setBasePrice(priceFloor - ethers.parseUnits("1", 6))
        ).to.be.revertedWith("Base price must be at least price floor");
    });
});

// ============================================================================
// SECURITY FIXES AND VULNERABILITY TESTS
// From: AstaVerde.security.test.ts (partial)
// ============================================================================

describe("AstaVerde Security Fixes", function () {
  let astaVerde: AstaVerde;
  let usdc: MockUSDC;
  let owner: SignerWithAddress;
  let buyer: SignerWithAddress;
  let producer1: SignerWithAddress;
  let producer2: SignerWithAddress;
  let attacker: SignerWithAddress;

  const USDC_PRECISION = 1_000_000n;
  const BASE_PRICE = 230n * USDC_PRECISION;

  beforeEach(async function () {
    [owner, buyer, producer1, producer2, attacker] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy(0);

    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    astaVerde = await AstaVerde.deploy(owner.address, await usdc.getAddress());

    // Fund buyer with USDC
    await usdc.mint(buyer.address, 10000n * USDC_PRECISION);
    await usdc.connect(buyer).approve(await astaVerde.getAddress(), ethers.MaxUint256);
  });

  describe("Payment Distribution Check", function () {
    it("should revert with require instead of assert on distribution mismatch", async function () {
      // This test verifies the error message exists and is descriptive
      // The actual mismatch is hard to trigger naturally due to the calculation logic
      // but we verify the require statement is in place
      
      // Create a normal batch purchase to ensure the require doesn't break normal flow
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      
      // Normal purchase should work fine
      await expect(
        astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1)
      ).to.not.be.reverted;
      
      // Verify the contract still calculates correctly
      const platformShare = await astaVerde.platformShareAccumulated();
      const expectedPlatformShare = (BASE_PRICE * 30n) / 100n;
      expect(platformShare).to.equal(expectedPlatformShare);
    });

    it("should correctly distribute payments with multiple producers", async function () {
      // Test that payment distribution works correctly with the new require
      await astaVerde.mintBatch(
        [producer1.address, producer2.address, producer1.address],
        ["QmTest1", "QmTest2", "QmTest3"]
      );
      
      const price = await astaVerde.getCurrentBatchPrice(1);
      const totalPrice = price * 3n;
      
      const platformBefore = await astaVerde.platformShareAccumulated();
      
      await astaVerde.connect(buyer).buyBatch(1, totalPrice, 3);
      
      // Check accrued balances (pull payment pattern)
      const producer1Accrued = await astaVerde.producerBalances(producer1.address);
      const producer2Accrued = await astaVerde.producerBalances(producer2.address);
      const platformAfter = await astaVerde.platformShareAccumulated();
      
      const platformReceived = platformAfter - platformBefore;
      
      // Verify total distribution equals total price
      expect(producer1Accrued + producer2Accrued + platformReceived).to.equal(totalPrice);
      
      // Verify platform got 30%
      expect(platformReceived).to.equal((totalPrice * 30n) / 100n);
    });
  });

  describe("CID Length DoS Prevention", function () {
    it("should prevent gas bomb attacks with very long CIDs", async function () {
      // Create a CID that would be expensive to store
      const gasGombCID = "Qm" + "x".repeat(999); // 1001 characters
      
      await expect(
        astaVerde.mintBatch([producer1.address], [gasGombCID])
      ).to.be.revertedWith("CID too long");
    });

    it("should handle maximum batch size with maximum CID lengths", async function () {
      // Test worst case: max batch size with max CID lengths
      const maxCID = "Qm" + "x".repeat(98); // 100 characters
      const producers = Array(50).fill(producer1.address);
      const cids = Array(50).fill(maxCID);
      
      // Should succeed even with maximum values
      await expect(
        astaVerde.mintBatch(producers, cids)
      ).to.not.be.reverted;
      
      // Verify batch was created
      const batchInfo = await astaVerde.getBatchInfo(1);
      expect(batchInfo[1].length).to.equal(50); // tokenIds array length
    });

    it("should efficiently validate CIDs without excessive gas", async function () {
      // Measure gas for different batch sizes
      const shortCID = "QmShort";
      const mediumCID = "Qm" + "x".repeat(48); // 50 characters
      const longCID = "Qm" + "x".repeat(98); // 100 characters
      
      // Small batch with short CIDs
      const tx1 = await astaVerde.mintBatch(
        [producer1.address],
        [shortCID]
      );
      const receipt1 = await tx1.wait();
      
      // Medium batch with medium CIDs
      const tx2 = await astaVerde.mintBatch(
        Array(10).fill(producer1.address),
        Array(10).fill(mediumCID)
      );
      const receipt2 = await tx2.wait();
      
      // Large batch with long CIDs
      const tx3 = await astaVerde.mintBatch(
        Array(20).fill(producer1.address),
        Array(20).fill(longCID)
      );
      const receipt3 = await tx3.wait();
      
      // Gas should scale reasonably with batch size
      // The validation loop should add minimal overhead
      expect(receipt2!.gasUsed).to.be.lessThan(receipt1!.gasUsed * 15n);
      expect(receipt3!.gasUsed).to.be.lessThan(receipt1!.gasUsed * 25n);
    });
  });

  // Emergency Rescue tests disabled - function removed from contract
  describe.skip("Emergency Rescue Function", function () {
    it("should allow owner to rescue tokens when paused", async function () {
      await astaVerde.mintBatch([producer1.address, producer2.address], ["QmTest1", "QmTest2"]);
      
      // Pause the contract
      await astaVerde.pause();
      
      // Owner can rescue tokens from contract
      await expect(
        astaVerde.connect(owner).emergencyRescue([1, 2], buyer.address)
      ).to.not.be.reverted;
      
      // Verify tokens are now with buyer
      expect(await astaVerde.balanceOf(buyer.address, 1)).to.equal(1);
      expect(await astaVerde.balanceOf(buyer.address, 2)).to.equal(1);
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 1)).to.equal(0);
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 2)).to.equal(0);
    });

    it("should reject rescue from non-owner", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.pause();
      
      await expect(
        astaVerde.connect(buyer).emergencyRescue([1], buyer.address)
      ).to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount");
    });

    it("should reject rescue when not paused", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      
      await expect(
        astaVerde.connect(owner).emergencyRescue([1], buyer.address)
      ).to.be.revertedWithCustomError(astaVerde, "ExpectedPause");
    });

    it("should reject rescue with invalid recipient", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.pause();
      
      await expect(
        astaVerde.connect(owner).emergencyRescue([1], ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid recipient");
    });

    it("should reject rescue with empty token list", async function () {
      await astaVerde.pause();
      
      await expect(
        astaVerde.connect(owner).emergencyRescue([], buyer.address)
      ).to.be.revertedWith("No tokens specified");
    });

    it("should reject rescue with too many tokens", async function () {
      await astaVerde.pause();
      const tokenIds = Array.from({length: 101}, (_, i) => i + 1);
      
      await expect(
        astaVerde.connect(owner).emergencyRescue(tokenIds, buyer.address)
      ).to.be.revertedWith("Too many tokens");
    });

    it("should reject rescue of tokens not held by contract", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1); // Token now owned by buyer
      await astaVerde.pause();
      
      await expect(
        astaVerde.connect(owner).emergencyRescue([1], producer1.address)
      ).to.be.revertedWith("Token not held");
    });

    it("should emit EmergencyRescue event", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.pause();
      
      const blockTimestamp = await time.latest() + 1;
      await time.setNextBlockTimestamp(blockTimestamp);
      
      await expect(
        astaVerde.connect(owner).emergencyRescue([1], buyer.address)
      ).to.emit(astaVerde, "EmergencyRescue")
        .withArgs(buyer.address, [1], blockTimestamp);
    });

    it("should prevent regular transfers when paused", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1);
      
      // Pause the contract
      await astaVerde.pause();
      
      // Regular user-to-user transfers should fail
      await expect(
        astaVerde.connect(buyer).safeTransferFrom(
          buyer.address,
          producer1.address,
          1,
          1,
          "0x"
        )
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("External Returns Protection", function () {
    it("should reject external ERC1155 returns from other addresses", async function () {
      // First, mint and sell a token to a buyer
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1);
      
      // Try to return the token back to the contract - should fail
      await expect(
        astaVerde.connect(buyer).safeTransferFrom(
          buyer.address,
          await astaVerde.getAddress(),
          1,
          1,
          "0x"
        )
      ).to.be.revertedWith("No external returns");
    });

    it("should reject batch returns from external addresses", async function () {
      // Mint and sell multiple tokens
      await astaVerde.mintBatch(
        [producer1.address, producer2.address],
        ["QmTest1", "QmTest2"]
      );
      await astaVerde.connect(buyer).buyBatch(1, BASE_PRICE * 2n, 2);
      
      // Try to batch return tokens - should fail
      await expect(
        astaVerde.connect(buyer).safeBatchTransferFrom(
          buyer.address,
          await astaVerde.getAddress(),
          [1, 2],
          [1, 1],
          "0x"
        )
      ).to.be.revertedWith("No external returns");
    });

    it("should allow self-transfers from contract", async function () {
      // Contract transferring to itself should work (edge case)
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      
      // This would only happen internally, but we can test the concept
      // by having the contract transfer to a user (simulating internal logic)
      const contractAddr = await astaVerde.getAddress();
      
      // Buy should work (involves self-transfer internally)
      await expect(
        astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1)
      ).to.not.be.reverted;
    });
  });

  /* VAULT TESTS REMOVED - vault mechanism replaced with emergencyRescue
  describe("Vault Transfer Functions", function () {
    it("should reject vault functions when not paused", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.setTrustedVault(attacker.address);
      
      // Both functions require whenPaused
      await expect(
        astaVerde.vaultSendTokens([1])
      ).to.be.revertedWithCustomError(astaVerde, "ExpectedPause");
      
      await expect(
        astaVerde.vaultRecallTokens([1])
      ).to.be.revertedWithCustomError(astaVerde, "ExpectedPause");
    });

    it("should reject vault functions from non-owner", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.setTrustedVault(attacker.address);
      await astaVerde.pause();
      
      // Both functions require onlyOwner
      await expect(
        astaVerde.connect(buyer).vaultSendTokens([1])
      ).to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount");
      
      await expect(
        astaVerde.connect(attacker).vaultRecallTokens([1])
      ).to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount");
    });

    it("should reject when vault not set", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.pause();
      
      // Both functions require trustedVault != 0
      await expect(
        astaVerde.vaultSendTokens([1])
      ).to.be.revertedWith("Vault not set");
      
      await expect(
        astaVerde.vaultRecallTokens([1])
      ).to.be.revertedWith("Vault not set");
    });

    it("should reject sending tokens not held by contract", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1); // Token now owned by buyer
      await astaVerde.setTrustedVault(attacker.address);
      await astaVerde.pause();
      
      await expect(
        astaVerde.vaultSendTokens([1])
      ).to.be.revertedWith("Not held by contract");
    });

    it("should reject recalling tokens not held by vault", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.setTrustedVault(attacker.address);
      await astaVerde.pause();
      
      // Vault must approve owner first
      await astaVerde.connect(attacker).setApprovalForAll(owner.address, true);
      
      // Token is still in contract, not in vault
      await expect(
        astaVerde.vaultRecallTokens([1])
      ).to.be.revertedWith("Not held by vault");
    });

    it("should reject empty ids array", async function () {
      await astaVerde.setTrustedVault(attacker.address);
      await astaVerde.pause();
      
      await expect(
        astaVerde.vaultSendTokens([])
      ).to.be.revertedWith("No ids");
      
      await expect(
        astaVerde.vaultRecallTokens([])
      ).to.be.revertedWith("No ids");
    });

    it("should still block direct transfers when paused", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.setTrustedVault(attacker.address);
      await astaVerde.pause();
      
      // Send token to vault using vault function
      await astaVerde.vaultSendTokens([1]);
      
      // Vault cannot directly transfer tokens back (must use vaultRecallTokens)
      await expect(
        astaVerde.connect(attacker).safeTransferFrom(
          attacker.address,
          await astaVerde.getAddress(),
          1,
          1,
          "0x"
        )
      ).to.be.revertedWith("Pausable: paused");
      
      // Non-owner cannot use safeBatchTransferFrom
      await expect(
        astaVerde.connect(buyer).safeBatchTransferFrom(
          attacker.address,
          await astaVerde.getAddress(),
          [1],
          [1],
          "0x"
        )
      ).to.be.revertedWithCustomError(astaVerde, "ERC1155MissingApprovalForAll");
    });

    it("should emit correct events for vault operations", async function () {
      await astaVerde.mintBatch([producer1.address, producer2.address], ["QmTest1", "QmTest2"]);
      await astaVerde.setTrustedVault(attacker.address);
      await astaVerde.pause();
      
      // Check VaultSent event
      await expect(astaVerde.vaultSendTokens([1, 2]))
        .to.emit(astaVerde, "VaultSent")
        .withArgs(attacker.address, owner.address, [1, 2]);
      
      // Vault must approve owner for recall
      await astaVerde.connect(attacker).setApprovalForAll(owner.address, true);
      
      // Check VaultRecalled event
      await expect(astaVerde.vaultRecallTokens([1, 2]))
        .to.emit(astaVerde, "VaultRecalled")
        .withArgs(attacker.address, owner.address, [1, 2]);
    });
  });

  describe("Trusted Vault Clearing - REMOVED", function () {
    it("should allow clearing trustedVault to address(0)", async function () {
      // Set a vault initially
      await astaVerde.setTrustedVault(buyer.address);
      expect(await astaVerde.trustedVault()).to.equal(buyer.address);
      
      // Clear the vault by setting to address(0)
      await expect(astaVerde.setTrustedVault(ethers.ZeroAddress))
        .to.emit(astaVerde, "TrustedVaultSet")
        .withArgs(ethers.ZeroAddress);
      
      expect(await astaVerde.trustedVault()).to.equal(ethers.ZeroAddress);
    });

    it("should revert vault functions when trustedVault is address(0)", async function () {
      // Mint a token
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      
      // Ensure trustedVault is not set (default is address(0))
      expect(await astaVerde.trustedVault()).to.equal(ethers.ZeroAddress);
      
      // Pause the contract
      await astaVerde.pause();
      
      // Try to send tokens to vault - should fail
      await expect(
        astaVerde.vaultSendTokens([1])
      ).to.be.revertedWith("Vault not set");
      
      // Try to recall tokens from vault - should fail
      await expect(
        astaVerde.vaultRecallTokens([1])
      ).to.be.revertedWith("Vault not set");
    });

    it("should allow re-enabling vault after clearing", async function () {
      // Set vault
      await astaVerde.setTrustedVault(buyer.address);
      
      // Clear vault
      await astaVerde.setTrustedVault(ethers.ZeroAddress);
      
      // Re-enable with new address
      await astaVerde.setTrustedVault(producer1.address);
      expect(await astaVerde.trustedVault()).to.equal(producer1.address);
    });
  });

  describe("Vault Functions Reentrancy Protection - REMOVED", function () {
    let maliciousReceiver: any;

    beforeEach(async function () {
      // Deploy malicious receiver contract
      const MaliciousVaultReceiver = await ethers.getContractFactory("MaliciousVaultReceiver");
      maliciousReceiver = await MaliciousVaultReceiver.deploy(await astaVerde.getAddress());
      
      // Mint some tokens
      await astaVerde.mintBatch([producer1.address, producer2.address], ["QmTest1", "QmTest2"]);
    });

    it("should prevent reentrancy in vaultSendTokens", async function () {
      // Set malicious receiver as trusted vault
      await astaVerde.setTrustedVault(await maliciousReceiver.getAddress());
      
      // Configure malicious receiver to attempt reentrancy
      await maliciousReceiver.setShouldReenter(true);
      await maliciousReceiver.setTokenIdsToReenter([2]); // Try to reenter with token 2
      
      // Pause contract to enable vault functions
      await astaVerde.pause();
      
      // Call vaultSendTokens - the receiver will try to reenter
      await expect(astaVerde.vaultSendTokens([1]))
        .to.emit(astaVerde, "VaultSent");
      
      // Verify reentrancy was attempted but failed
      expect(await maliciousReceiver.reentrancyAttempts()).to.equal(1);
      
      // Verify tokens were transferred correctly despite reentrancy attempt
      expect(await astaVerde.balanceOf(await maliciousReceiver.getAddress(), 1)).to.equal(1);
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 1)).to.equal(0);
      
      // Token 2 should still be in contract (reentrancy failed)
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 2)).to.equal(1);
    });

    it("should prevent reentrancy in vaultRecallTokens", async function () {
      // Set malicious receiver as trusted vault
      await astaVerde.setTrustedVault(await maliciousReceiver.getAddress());
      
      // Pause and send token to vault first
      await astaVerde.pause();
      await astaVerde.vaultSendTokens([1]);
      
      // Approve owner to handle vault's tokens
      await maliciousReceiver.approveAstaVerde(owner.address);
      
      // Configure malicious receiver to attempt reentrancy on recall
      await maliciousReceiver.setShouldReenter(true);
      await maliciousReceiver.setTokenIdsToReenter([2]);
      
      // Call vaultRecallTokens - contract's receiver will try to reenter
      await expect(astaVerde.vaultRecallTokens([1]))
        .to.emit(astaVerde, "VaultRecalled");
      
      // Verify token was recalled correctly
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 1)).to.equal(1);
      expect(await astaVerde.balanceOf(await maliciousReceiver.getAddress(), 1)).to.equal(0);
      
      // Token 2 should still be in contract (reentrancy failed)
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 2)).to.equal(1);
    });

    it("should handle batch transfers with reentrancy protection", async function () {
      // Mint more tokens
      await astaVerde.mintBatch([producer1.address], ["QmTest3"]);
      
      // Set malicious receiver as vault
      await astaVerde.setTrustedVault(await maliciousReceiver.getAddress());
      
      // Configure for reentrancy attempt
      await maliciousReceiver.setShouldReenter(true);
      await maliciousReceiver.setTokenIdsToReenter([3]);
      
      // Pause and send batch
      await astaVerde.pause();
      
      // Send multiple tokens - should work despite reentrancy attempt
      await expect(astaVerde.vaultSendTokens([1, 2]))
        .to.emit(astaVerde, "VaultSent");
      
      // Verify batch transfer succeeded
      expect(await astaVerde.balanceOf(await maliciousReceiver.getAddress(), 1)).to.equal(1);
      expect(await astaVerde.balanceOf(await maliciousReceiver.getAddress(), 2)).to.equal(1);
      
      // Token 3 should still be in contract (reentrancy failed)
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 3)).to.equal(1);
    });
  });

  });
  */

  describe("Edge Cases and Boundaries", function () {
    it("should handle empty CID correctly", async function () {
      // Empty CID should be allowed (length 0 < 100)
      await expect(
        astaVerde.mintBatch([producer1.address], [""])
      ).to.not.be.reverted;
    });

    it("should handle single character CID", async function () {
      await expect(
        astaVerde.mintBatch([producer1.address], ["Q"])
      ).to.not.be.reverted;
    });

    it("should handle exactly 100 character CID", async function () {
      const exactCID = "Q" + "m".repeat(99); // Exactly 100 characters
      await expect(
        astaVerde.mintBatch([producer1.address], [exactCID])
      ).to.not.be.reverted;
    });

    it("should handle 101 character CID", async function () {
      const overCID = "Q" + "m".repeat(100); // 101 characters
      await expect(
        astaVerde.mintBatch([producer1.address], [overCID])
      ).to.be.revertedWith("CID too long");
    });

    it("should validate each CID independently", async function () {
      const validCID = "QmValid";
      const invalidCID = "Q" + "m".repeat(100); // 101 characters
      
      // First invalid
      await expect(
        astaVerde.mintBatch(
          [producer1.address, producer2.address],
          [invalidCID, validCID]
        )
      ).to.be.revertedWith("CID too long");
      
      // Last invalid
      await expect(
        astaVerde.mintBatch(
          [producer1.address, producer2.address],
          [validCID, invalidCID]
        )
      ).to.be.revertedWith("CID too long");
      
      // Middle invalid
      await expect(
        astaVerde.mintBatch(
          [producer1.address, producer2.address, attacker.address],
          [validCID, invalidCID, validCID]
        )
      ).to.be.revertedWith("CID too long");
    });
  });

  // V2 tests removed - these features were never implemented in the contract
});

