import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { deployAstaVerdeFixture } from "./AstaVerde.fixture";
import { USDC_PRECISION, SECONDS_IN_A_DAY } from "./lib";

describe.only("AstaVerde Logic and Behavior", function () {
    async function advancedDays(days: bigint) {
        const secondsToAdvance = Number(days) * Number(SECONDS_IN_A_DAY);
        await ethers.provider.send("evm_increaseTime", [secondsToAdvance]);
        await ethers.provider.send("evm_mine", []);
    }

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

            await expect(astaVerde.mintBatch(producers, cids))
                .to.emit(astaVerde, "BatchMinted")
                .withArgs(1, anyValue);

            const [, tokenIds, , , remainingTokens] = await astaVerde.getBatchInfo(1);
            expect(tokenIds.length).to.equal(producers.length);
            expect(remainingTokens).to.equal(BigInt(producers.length));
        });

        it("Should fail to mint batch with mismatched producers and cids", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            const producers = [admin.address];
            const cids = ["QmCID1", "QmCID2"];

            await expect(astaVerde.mintBatch(producers, cids))
                .to.be.revertedWith("Mismatch between producers and cids lengths");
        });

        it("Should fail to mint batch exceeding maxBatchSize", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            const maxBatchSize = await astaVerde.maxBatchSize();
            const producers = Array.from({ length: Number(maxBatchSize) + 1 }, () => admin.address);
            const cids = Array.from({ length: Number(maxBatchSize) + 1 }, () => "QmCID");

            await expect(astaVerde.mintBatch(producers, cids))
                .to.be.revertedWith("Batch size exceeds max batch size");
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

            const batchInfo = await astaVerde.getBatchInfo(batchID);
            expect(batchInfo.remainingTokens).to.equal(0n);
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

            const batchInfo = await astaVerde.getBatchInfo(batchID);
            expect(batchInfo.remainingTokens).to.equal(0n);
        });
    });

    describe("Dynamic Base Price Mechanism", function () {
        it("Should increase basePrice when sale occurs within dayIncreaseThreshold", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            await astaVerde.mintBatch([admin.address, admin.address], ["QmValidCID1", "QmValidCID2"]);
            const batchID = 1n;
            const initialBasePrice = await astaVerde.basePrice();

            let currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(batchID, currentPrice, 1n);

            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();
            await advancedDays(dayIncreaseThreshold - 1n);

            currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(batchID, currentPrice, 1n);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.be.gt(initialBasePrice);
        });

        it("Should not increase basePrice when sale occurs after dayIncreaseThreshold", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            await astaVerde.mintBatch([admin.address], ["QmValidCID1"]);
            const batchID = 1n;
            const initialBasePrice = await astaVerde.basePrice();
            console.log("Initial base price:", initialBasePrice.toString());

            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();
            console.log("Day increase threshold:", dayIncreaseThreshold.toString());

            // Advance time beyond dayIncreaseThreshold
            await advancedDays(dayIncreaseThreshold + 1n);

            let currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(batchID, currentPrice, 1n);

            const newBasePrice = await astaVerde.basePrice();
            console.log("New base price:", newBasePrice.toString());

            expect(newBasePrice).to.equal(initialBasePrice);
        });

        it("Should increase base price after quick sales", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();
            const priceDelta = await astaVerde.priceDelta();

            console.log("Initial base price:", initialBasePrice.toString());

            // Mint multiple batches
            for (let i = 0; i < 3; i++) {
                await astaVerde.mintBatch([admin.address], [`QmCID${i}`]);
            }

            // Simulate quick sales within dayIncreaseThreshold
            for (let i = 1; i <= 3; i++) {
                const currentPrice = await astaVerde.getCurrentBatchPrice(i);
                await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
                await astaVerde.connect(user1).buyBatch(i, currentPrice, 1);

                const basePriceAfterSale = await astaVerde.basePrice();
                console.log(`Base price after sale ${i}:`, basePriceAfterSale.toString());

                if (i < 3) {
                    await advancedDays(dayIncreaseThreshold - 1n);
                }
            }

            const newBasePrice = await astaVerde.basePrice();
            console.log("Final base price:", newBasePrice.toString());
            expect(newBasePrice).to.equal(initialBasePrice + 3n * priceDelta);
        });

        it("Should decrease base price after prolonged period without sales", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();
            const priceDecreaseRate = await astaVerde.priceDecreaseRate();

            await astaVerde.mintBatch([admin.address], ["QmCID"]);

            // Advance time beyond dayDecreaseThreshold
            const daysToAdvance = dayDecreaseThreshold * 3n;
            await advancedDays(daysToAdvance);

            // Trigger base price update
            await astaVerde.updateBasePriceOnAction();

            const newBasePrice = await astaVerde.basePrice();
            const expectedDecrease = daysToAdvance * priceDecreaseRate;
            const expectedBasePrice = initialBasePrice > expectedDecrease ? initialBasePrice - expectedDecrease : await astaVerde.priceFloor();

            expect(newBasePrice).to.equal(expectedBasePrice);
        });

        it("Should maintain base price within bounds over extended period with mixed activity", async function () {
            const { astaVerde, mockUSDC, admin, user1, user2 } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const priceFloor = await astaVerde.priceFloor();
            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();
            const priceDelta = await astaVerde.priceDelta();
            const priceDecreaseRate = await astaVerde.priceDecreaseRate();

            let latestValidBatchId = 0n;

            for (let day = 1; day <= 60; day++) {
                if (day % 5 === 0) {
                    // Mint new batch every 5 days with 3 tokens
                    await astaVerde.mintBatch([admin.address, admin.address, admin.address], [`QmCID${day}1`, `QmCID${day}2`, `QmCID${day}3`]);
                    latestValidBatchId = await astaVerde.lastBatchID();
                    console.log(`Day ${day}: Minted new batch ${latestValidBatchId}`);
                }

                if (day % 7 === 0 && latestValidBatchId > 0n) {
                    // Simulate a sale every 7 days
                    const [, , , , remainingTokens] = await astaVerde.getBatchInfo(latestValidBatchId);
                    const tokensToBuy = remainingTokens > 1n ? 1n : remainingTokens;
                    console.log(`Day ${day}, Batch ${latestValidBatchId}, Remaining tokens: ${remainingTokens}, Buying: ${tokensToBuy}`);

                    if (tokensToBuy > 0n) {
                        const currentPrice = await astaVerde.getCurrentBatchPrice(latestValidBatchId);
                        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
                        await astaVerde.connect(user1).buyBatch(latestValidBatchId, currentPrice, tokensToBuy);

                        if (remainingTokens - tokensToBuy === 0n) {
                            console.log(`Batch ${latestValidBatchId} is now sold out`);
                            latestValidBatchId = 0n; // Reset to 0 as this batch is now sold out
                        }
                    } else {
                        console.log(`Day ${day}: No tokens available to buy`);
                    }
                }

                if (day % 10 === 0) {
                    const currentBasePrice = await astaVerde.basePrice();
                    console.log(`Day ${day}: Current base price: ${currentBasePrice}`);
                }

                await advancedDays(1n);
            }

            const finalBasePrice = await astaVerde.basePrice();
            console.log("Initial base price:", initialBasePrice.toString());
            console.log("Final base price:", finalBasePrice.toString());

            // Check that the final base price is within reasonable bounds
            expect(finalBasePrice).to.be.gte(priceFloor);
            expect(finalBasePrice).to.be.lte(initialBasePrice * 2n); // Assuming it won't more than double

            // Verify that the mechanism is still responsive
            const latestBatchId = await astaVerde.lastBatchID();
            const currentPrice = await astaVerde.getCurrentBatchPrice(latestBatchId);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(latestBatchId, currentPrice, 1);

            const updatedBasePrice = await astaVerde.basePrice();
            expect(updatedBasePrice).to.be.gt(finalBasePrice);
        });

        it("Should correctly handle edge cases in price adjustments", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            // Set base price close to price floor
            const priceFloor = await astaVerde.priceFloor();
            await astaVerde.setBasePrice(priceFloor + ethers.parseUnits("1", 6)); // 1 USDC above floor

            await astaVerde.mintBatch([admin.address], ["QmCID"]);
            const batchId = await astaVerde.lastBatchID();

            // Simulate a long period without sales
            await advancedDays(100n);

            // Trigger base price update
            await astaVerde.updateBasePriceOnAction();

            let currentBasePrice = await astaVerde.basePrice();
            expect(currentBasePrice).to.equal(priceFloor);

            // Now simulate quick sales to test price increase from floor
            for (let i = 0; i < 3; i++) {
                const [, , , , remainingTokens] = await astaVerde.getBatchInfo(batchId);
                const tokensToBuy = remainingTokens > 1n ? 1n : remainingTokens;
                console.log(`Iteration ${i}, Batch ${batchId}, Remaining tokens: ${remainingTokens}, Buying: ${tokensToBuy}`);
                const currentPrice = await astaVerde.getCurrentBatchPrice(batchId);
                await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
                if (tokensToBuy > 0n) {
                    await astaVerde.connect(user1).buyBatch(batchId, currentPrice, tokensToBuy);
                }
                await advancedDays(1n);
            }

            currentBasePrice = await astaVerde.basePrice();
            expect(currentBasePrice).to.be.gt(priceFloor);
        });

        it("Should increase basePrice multiple times with consecutive sales within dayIncreaseThreshold", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();
            const priceDelta = await astaVerde.priceDelta();

            // Mint multiple batches
            for (let i = 0; i < 5; i++) {
                await astaVerde.mintBatch([admin.address], [`QmCID${i}`]);
            }

            // Simulate consecutive sales within dayIncreaseThreshold
            for (let i = 1; i <= 5; i++) {
                const currentPrice = await astaVerde.getCurrentBatchPrice(i);
                await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
                await astaVerde.connect(user1).buyBatch(i, currentPrice, 1);

                if (i < 5) {
                    await advancedDays(dayIncreaseThreshold - 1n);
                }

                const newBasePrice = await astaVerde.basePrice();
                expect(newBasePrice).to.equal(initialBasePrice + BigInt(i) * priceDelta);
            }
        });

        it("Should increase basePrice if sale occurs exactly on dayIncreaseThreshold", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();
            const priceDelta = await astaVerde.priceDelta();

            await astaVerde.mintBatch([admin.address], ["QmCID1"]);
            await astaVerde.mintBatch([admin.address], ["QmCID2"]);

            // First sale
            let currentPrice = await astaVerde.getCurrentBatchPrice(1);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(1, currentPrice, 1);

            // Advance time to exactly dayIncreaseThreshold
            await advancedDays(dayIncreaseThreshold);

            // Second sale
            currentPrice = await astaVerde.getCurrentBatchPrice(2);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(2, currentPrice, 1);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(initialBasePrice + priceDelta);
        });

        it("Should decrease basePrice correctly after dayDecreaseThreshold", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();
            const priceDecreaseRate = await astaVerde.priceDecreaseRate();

            await astaVerde.mintBatch([admin.address], ["QmCID"]);

            // Advance time beyond dayDecreaseThreshold
            const daysToAdvance = dayDecreaseThreshold + 3n;
            await advancedDays(daysToAdvance);

            // Trigger base price update
            await astaVerde.updateBasePriceOnAction();

            const newBasePrice = await astaVerde.basePrice();
            const expectedDecrease = daysToAdvance * priceDecreaseRate;
            const expectedBasePrice = initialBasePrice > expectedDecrease ? initialBasePrice - expectedDecrease : await astaVerde.priceFloor();

            expect(newBasePrice).to.equal(expectedBasePrice);
        });

        it("Should not decrease basePrice below priceFloor", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const priceFloor = await astaVerde.priceFloor();
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();
            const priceDecreaseRate = await astaVerde.priceDecreaseRate();

            await astaVerde.mintBatch([admin.address], ["QmCID"]);

            // Calculate days needed to reach price floor
            const daysToReachFloor = (initialBasePrice - priceFloor) / priceDecreaseRate + BigInt(dayDecreaseThreshold) + 10n;

            // Advance time well beyond what's needed to reach price floor
            await advancedDays(daysToReachFloor);

            // Trigger base price update
            await astaVerde.updateBasePriceOnAction();

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(priceFloor);
        });

        it("Should allow multiple price increases within threshold period", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();
            const priceDelta = await astaVerde.priceDelta();

            // Mint multiple batches
            for (let i = 0; i < 3; i++) {
                await astaVerde.mintBatch([admin.address], [`QmCID${i}`]);
            }

            // First sale to trigger price increase
            let currentPrice = await astaVerde.getCurrentBatchPrice(1);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(1, currentPrice, 1);

            // Second sale immediately after
            currentPrice = await astaVerde.getCurrentBatchPrice(2);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(2, currentPrice, 1);

            const midBasePrice = await astaVerde.basePrice();
            expect(midBasePrice).to.equal(initialBasePrice + priceDelta * 2n);

            // Advance time but stay within threshold
            await advancedDays(dayIncreaseThreshold - 1n);

            // Third sale should trigger another increase
            currentPrice = await astaVerde.getCurrentBatchPrice(3);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(3, currentPrice, 1);

            const finalBasePrice = await astaVerde.basePrice();
            expect(finalBasePrice).to.equal(initialBasePrice + priceDelta * 3n);
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
            const initialProducerBalance = await mockUSDC.balanceOf(admin.address);

            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
            await astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount);

            const finalPlatformShare = await astaVerde.platformShareAccumulated();
            const finalProducerBalance = await mockUSDC.balanceOf(admin.address);

            const platformSharePercentage = await astaVerde.platformSharePercentage();
            const expectedPlatformShare = (totalCost * platformSharePercentage) / 100n;
            const expectedProducerShare = totalCost - expectedPlatformShare;

            expect(finalPlatformShare - initialPlatformShare).to.equal(expectedPlatformShare);
            expect(finalProducerBalance - initialProducerBalance).to.equal(expectedProducerShare);
        });
    });

    describe("Price Floor Enforcement", function () {
        it("Should not allow batch price to fall below priceFloor", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            await astaVerde.mintBatch([admin.address], ["QmValidCID"]);

            const batchID = 1;
            const basePrice = await astaVerde.basePrice();
            const priceFloor = await astaVerde.priceFloor();
            const priceDecreaseRate = await astaVerde.priceDecreaseRate();
            const daysNeeded = (basePrice - priceFloor) / priceDecreaseRate + 1n;

            await advancedDays(daysNeeded);

            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            expect(currentPrice).to.equal(priceFloor);
        });

        it("Should set batch price to exactly priceFloor when calculated price equals priceFloor", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            await astaVerde.mintBatch([admin.address], ["QmValidCID"]);

            const batchID = 1;
            const basePrice = await astaVerde.basePrice();
            const priceFloor = await astaVerde.priceFloor();
            const priceDecreaseRate = await astaVerde.priceDecreaseRate();
            const daysNeeded = (basePrice - priceFloor) / priceDecreaseRate;

            await advancedDays(daysNeeded);

            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            expect(currentPrice).to.equal(priceFloor);
        });
    });

    describe("Independent Batch Pricing", function () {
        it("Each batch should have independent pricing based on its creation time", async function () {
            const { astaVerde } = await loadFixture(deployAstaVerdeFixture);

            await astaVerde.mintBatch([await astaVerde.getAddress()], ["QmCID1"]);
            await advancedDays(2n);
            await astaVerde.mintBatch([await astaVerde.getAddress()], ["QmCID2"]);

            const batch1ID = 1n;
            const batch2ID = 2n;

            await advancedDays(3n);

            const batch1Price = await astaVerde.getCurrentBatchPrice(batch1ID);
            const batch2Price = await astaVerde.getCurrentBatchPrice(batch2ID);

            const priceDecreaseRate = await astaVerde.priceDecreaseRate();
            const basePrice = await astaVerde.basePrice();

            const expectedBatch1Price = basePrice - (5n * priceDecreaseRate);
            const expectedBatch2Price = basePrice - (3n * priceDecreaseRate);

            const priceFloor = await astaVerde.priceFloor();

            expect(batch1Price).to.equal(expectedBatch1Price > priceFloor ? expectedBatch1Price : priceFloor);
            expect(batch2Price).to.equal(expectedBatch2Price > priceFloor ? expectedBatch2Price : priceFloor);
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

    describe("Pausing Functionality", function () {
        it("Owner can pause and unpause the contract", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            await expect(astaVerde.connect(admin).pause())
                .to.emit(astaVerde, "Paused")
                .withArgs(admin.address);

            await expect(astaVerde.connect(admin).mintBatch([admin.address], ["QmCID"]))
                .to.be.revertedWithCustomError(astaVerde, "EnforcedPause");

            await expect(astaVerde.connect(admin).unpause())
                .to.emit(astaVerde, "Unpaused")
                .withArgs(admin.address);

            await expect(astaVerde.connect(admin).mintBatch([admin.address], ["QmCID"]))
                .to.emit(astaVerde, "BatchMinted");
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

            await expect(astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount))
                .to.be.revertedWith("Not enough tokens in batch");
        });

        it("Should handle high priceDecreaseRate without overflow", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            const highPriceDecreaseRate = ethers.parseUnits("1000", 6);
            await astaVerde.connect(admin).setPriceDecreaseRate(highPriceDecreaseRate);

            const newPriceDecreaseRate = await astaVerde.priceDecreaseRate();
            expect(newPriceDecreaseRate).to.equal(highPriceDecreaseRate);

            await astaVerde.mintBatch([admin.address], ["QmValidCID"]);

            const batchID = 1;
            await advancedDays(1n);

            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const expectedPrice = (await astaVerde.basePrice()) - highPriceDecreaseRate;
            const priceFloor = await astaVerde.priceFloor();

            expect(currentPrice).to.equal(expectedPrice > priceFloor ? expectedPrice : priceFloor);
        });
    });
    describe("Token Redemption", function () {
        it("Should allow token owners to redeem their tokens", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            await astaVerde.mintBatch([admin.address], ["QmValidCID"]);
            const batchID = 1n;
            const tokenAmount = 1n;
            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const totalCost = currentPrice * tokenAmount;

            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
            await astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount);

            const [, tokenIds] = await astaVerde.getBatchInfo(batchID);
            const tokenId = tokenIds[0];

            await expect(astaVerde.connect(user1).redeemTokens([tokenId]))
                .to.emit(astaVerde, "TokenRedeemed")
                .withArgs(tokenId, user1.address, anyValue);

            const tokenInfo = await astaVerde.tokens(tokenId);
            expect(tokenInfo.isRedeemed).to.be.true;

            await expect(astaVerde.connect(user1).redeemTokens([tokenId]))
                .to.be.revertedWith("Token is already redeemed");
        });

        it("Should prevent non-owners from redeeming tokens", async function () {
            const { astaVerde, mockUSDC, admin, user1, user2 } = await loadFixture(deployAstaVerdeFixture);

            await astaVerde.mintBatch([admin.address], ["QmValidCID"]);
            const batchID = 1n;
            const tokenAmount = 1n;
            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const totalCost = currentPrice * tokenAmount;

            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
            await astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount);

            const [, tokenIds] = await astaVerde.getBatchInfo(batchID);
            const tokenId = tokenIds[0];

            await expect(astaVerde.connect(user2).redeemTokens([tokenId]))
                .to.be.revertedWith("Caller is not the token owner");
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

            await expect(astaVerde.connect(admin).claimPlatformFunds(admin.address))
                .to.be.revertedWith("No funds to withdraw");
        });
    });
    describe("Detailed Auction Pricing Mechanism", function () {
        it("Should decrease price exactly by priceDecreaseRate per day", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            await astaVerde.mintBatch([admin.address], ["QmValidCID"]);
            const batchID = 1n;
            const initialPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const priceDecreaseRate = await astaVerde.priceDecreaseRate();

            await advancedDays(3n);

            const newPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const expectedPrice = initialPrice - (3n * priceDecreaseRate);

            expect(newPrice).to.equal(expectedPrice);
        });

        it("Should correctly handle multiple batches with different prices", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            console.log("Initial base price:", initialBasePrice.toString());

            await astaVerde.mintBatch([admin.address], ["QmValidCID1"]);
            const batch1ID = 1n;

            await advancedDays(2n);

            await astaVerde.mintBatch([admin.address], ["QmValidCID2"]);
            const batch2ID = 2n;

            await advancedDays(3n);

            const price1 = await astaVerde.getCurrentBatchPrice(batch1ID);
            const price2 = await astaVerde.getCurrentBatchPrice(batch2ID);

            console.log("Price of batch 1:", price1.toString());
            console.log("Price of batch 2:", price2.toString());

            expect(price1).to.be.lt(price2);

            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), price1);
            await astaVerde.connect(user1).buyBatch(batch1ID, price1, 1n);

            const newBasePrice = await astaVerde.basePrice();
            console.log("New base price after sale:", newBasePrice.toString());

            // The base price should not decrease below the initial price minus 5 days of decrease
            const minExpectedPrice = initialBasePrice - (5n * await astaVerde.priceDecreaseRate());
            expect(newBasePrice).to.be.gte(minExpectedPrice);

            await astaVerde.mintBatch([admin.address], ["QmValidCID3"]);
            const batch3Price = await astaVerde.getCurrentBatchPrice(3n);
            console.log("Price of new batch 3:", batch3Price.toString());

            expect(batch3Price).to.equal(newBasePrice);
        });
    });
});