import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { deployAstaVerdeFixture } from "./AstaVerde.fixture";
import { USDC_PRECISION, SECONDS_IN_A_DAY } from "./lib";
import { time } from "@nomicfoundation/hardhat-network-helpers";

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
        it("Should increase basePrice when a batch is fully sold within dayIncreaseThreshold", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const priceAdjustDelta = await astaVerde.priceAdjustDelta();

            await astaVerde.mintBatch([admin.address], ["QmValidCID"]);

            const batchID = 1n;
            const tokenAmount = 1n;
            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const totalCost = currentPrice * tokenAmount;

            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);

            await expect(astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount))
                .to.emit(astaVerde, "BasePriceAdjusted")
                .withArgs(initialBasePrice + priceAdjustDelta, anyValue, true);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.be.gt(initialBasePrice);
        });


        it("Should not increase basePrice when batch is not fully sold", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            // Mint a batch with multiple tokens
            await astaVerde.mintBatch([admin.address, admin.address], ["QmValidCID1", "QmValidCID2"]);
            const batchID = 1n;
            const initialBasePrice = await astaVerde.basePrice();

            // Buy only one token from the batch
            let currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(batchID, currentPrice, 1n);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(initialBasePrice);
        });

        it("Should increase base price after quick full batch sales", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();
            const priceAdjustDelta = await astaVerde.priceAdjustDelta();

            console.log("Initial base price:", initialBasePrice.toString());

            for (let i = 1; i <= 3; i++) {
                await astaVerde.mintBatch([admin.address], ["QmCID"]);
                const currentPrice = await astaVerde.getCurrentBatchPrice(i);
                await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
                await astaVerde.connect(user1).buyBatch(i, currentPrice, 1n);

                if (i < 3) {
                    await advancedDays(dayIncreaseThreshold - 1n);
                }
            }

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(initialBasePrice + 3n * priceAdjustDelta);
        });

        it("Should maintain base price within bounds over extended period with mixed activity", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);
            const initialBasePrice = await astaVerde.basePrice();
            const priceFloor = await astaVerde.priceFloor();

            for (let day = 1; day <= 60; day++) {
                if (day % 5 === 0) {
                    await astaVerde.mintBatch([admin.address, admin.address, admin.address], [`QmCID${day}1`, `QmCID${day}2`, `QmCID${day}3`]);
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
            const { astaVerde } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            console.log("Initial base price:", initialBasePrice.toString());

            // Advance time to exactly dayDecreaseThreshold days
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();
            await advancedDays(dayDecreaseThreshold);

            // Mint a batch to trigger price adjustment
            await astaVerde.mintBatch([await astaVerde.getAddress()], ["QmCID"]);

            const newBasePrice = await astaVerde.basePrice();
            console.log("New base price after minting:", newBasePrice.toString());

            // The price should not have decreased yet
            expect(newBasePrice).to.equal(initialBasePrice);

            // Now advance one more day to surpass the threshold
            await advancedDays(1n);

            // Mint another batch to trigger price adjustment
            await astaVerde.mintBatch([await astaVerde.getAddress()], ["QmCID2"]);

            const finalBasePrice = await astaVerde.basePrice();
            console.log("Final base price after decrease:", finalBasePrice.toString());

            // Calculate expected decrease
            const priceAdjustDelta = await astaVerde.priceAdjustDelta();
            const expectedPrice = initialBasePrice - priceAdjustDelta;
            expect(finalBasePrice).to.equal(expectedPrice);
        });


        it("Should decrease basePrice correctly after dayDecreaseThreshold", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);
            const initialBasePrice = await astaVerde.basePrice();
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();
            const priceAdjustDelta = await astaVerde.priceAdjustDelta();
            const priceFloor = await astaVerde.priceFloor();

            // Advance time to exactly dayDecreaseThreshold days
            await advancedDays(dayDecreaseThreshold);

            // Mint a batch to potentially trigger updateBasePrice
            await astaVerde.mintBatch([admin.address], ["QmCID"]);

            const priceAfterMint = await astaVerde.basePrice();
            expect(priceAfterMint).to.equal(initialBasePrice); // No decrease yet

            // Advance time by one more day to surpass the threshold
            await advancedDays(1n);

            // Mint another batch to trigger updateBasePrice
            await astaVerde.mintBatch([admin.address], ["QmCID2"]);

            const finalBasePrice = await astaVerde.basePrice();
            const expectedDecrease = 1n * priceAdjustDelta; // One day over the threshold
            const expectedPrice = initialBasePrice - expectedDecrease > priceFloor
                ? initialBasePrice - expectedDecrease
                : priceFloor;

            expect(finalBasePrice).to.equal(expectedPrice);
        });


        it("Should increase basePrice if full batch sale occurs exactly on dayIncreaseThreshold", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();
            const priceAdjustDelta = await astaVerde.priceAdjustDelta();

            await astaVerde.mintBatch([admin.address, admin.address], ["QmCID1", "QmCID2"]);
            await astaVerde.mintBatch([admin.address, admin.address], ["QmCID3", "QmCID4"]);

            // First full batch sale
            let currentPrice = await astaVerde.getCurrentBatchPrice(1);
            let totalCost = currentPrice * 2n;
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
            await astaVerde.connect(user1).buyBatch(1, totalCost, 2n);

            // Advance time to exactly dayIncreaseThreshold
            await advancedDays(dayIncreaseThreshold);

            // Second full batch sale
            currentPrice = await astaVerde.getCurrentBatchPrice(2);
            totalCost = currentPrice * 2n;
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
            await astaVerde.connect(user1).buyBatch(2, totalCost, 2n);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(initialBasePrice + priceAdjustDelta * 2n);
        });


        it("Should not decrease basePrice below priceFloor", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);
            const initialBasePrice = await astaVerde.basePrice();
            const priceFloor = await astaVerde.priceFloor();
            const priceAdjustDelta = await astaVerde.priceAdjustDelta();
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();

            // Calculate the number of days needed to decrease basePrice to priceFloor
            const totalDecreaseNeeded = initialBasePrice - priceFloor;
            const daysToDecrease = (totalDecreaseNeeded + priceAdjustDelta - 1n) / priceAdjustDelta; // Ceiling division
            const daysNeeded = dayDecreaseThreshold + daysToDecrease + 1n; // Adding 1 to surpass the threshold

            // Advance time by daysNeeded to trigger decrease
            await advancedDays(daysNeeded);

            // Mint a new batch to trigger base price update
            await expect(astaVerde.mintBatch([admin.address], ["QmTestCID"]))
                .to.emit(astaVerde, "BasePriceAdjusted")
                .withArgs(priceFloor, anyValue, false);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(priceFloor);
        });




        it("Should allow multiple price increases within threshold period", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();
            const priceAdjustDelta = await astaVerde.priceAdjustDelta();

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
            expect(midBasePrice).to.equal(initialBasePrice + priceAdjustDelta * 2n);

            // Advance time but stay within threshold
            await advancedDays(dayIncreaseThreshold - 1n);

            // Third sale should trigger another increase
            currentPrice = await astaVerde.getCurrentBatchPrice(3);
            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), currentPrice);
            await astaVerde.connect(user1).buyBatch(3, currentPrice, 1);

            const finalBasePrice = await astaVerde.basePrice();
            expect(finalBasePrice).to.equal(initialBasePrice + priceAdjustDelta * 3n);
        });

        it("Should increase basePrice multiple times with consecutive full batch sales within dayIncreaseThreshold", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            const initialBasePrice = await astaVerde.basePrice();
            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();
            const priceAdjustDelta = await astaVerde.priceAdjustDelta();

            // Mint multiple batches
            for (let i = 0; i < 5; i++) {
                await astaVerde.mintBatch([admin.address, admin.address], [`QmCID${i}1`, `QmCID${i}2`]);
            }

            // Simulate consecutive full batch sales within dayIncreaseThreshold
            for (let i = 1; i <= 5; i++) {
                const currentPrice = await astaVerde.getCurrentBatchPrice(i);
                const totalCost = currentPrice * 2n; // 2 tokens per batch
                await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
                await astaVerde.connect(user1).buyBatch(i, totalCost, 2n);

                if (i < 5) {
                    await advancedDays(dayIncreaseThreshold - 1n);
                }

                const newBasePrice = await astaVerde.basePrice();
                expect(newBasePrice).to.equal(initialBasePrice + BigInt(i) * priceAdjustDelta);
            }
        });
        it("Should reflect decreased basePrice after inactivity period", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);
            const initialBasePrice = await astaVerde.basePrice();
            const priceFloor = await astaVerde.priceFloor();
            const priceAdjustDelta = await astaVerde.priceAdjustDelta();
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();

            // Calculate the number of days needed to decrease basePrice to priceFloor
            const totalDecreaseNeeded = initialBasePrice - priceFloor;
            const daysToDecrease = (totalDecreaseNeeded + priceAdjustDelta - 1n) / priceAdjustDelta; // Ceiling division
            const daysNeeded = dayDecreaseThreshold + daysToDecrease + 1n; // Adding 1 to surpass the threshold

            // Advance time by daysNeeded to trigger decrease
            await advancedDays(daysNeeded);

            // Mint a new batch to trigger base price update
            await expect(astaVerde.mintBatch([admin.address], ["QmTestCID"]))
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
            // const batchID = 1n;
            const initialBasePrice = await astaVerde.basePrice();
            const priceFloor = await astaVerde.priceFloor();
            const priceAdjustDelta = await astaVerde.priceAdjustDelta();
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();

            // Calculate the number of days needed to decrease basePrice to priceFloor
            const totalDecreaseNeeded = initialBasePrice - priceFloor;
            const daysToDecrease = (totalDecreaseNeeded + priceAdjustDelta - 1n) / priceAdjustDelta; // Ceiling division
            const daysNeeded = dayDecreaseThreshold + daysToDecrease + 1n; // Adding 1 to surpass the threshold

            // Advance time by daysNeeded to trigger decrease
            await advancedDays(daysNeeded);

            // Mint a new batch to trigger base price update
            await expect(astaVerde.mintBatch([admin.address], ["QmTestCID"]))
                .to.emit(astaVerde, "BasePriceAdjusted")
                .withArgs(priceFloor, anyValue, false);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(priceFloor);
        });



        it("Should set batch price to exactly priceFloor when calculated price equals priceFloor", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);
            const initialBasePrice = await astaVerde.basePrice();
            const priceFloor = await astaVerde.priceFloor();

            // Set priceAdjustDelta to exactly match the difference
            const priceAdjustDeltaExact = initialBasePrice - priceFloor;
            await astaVerde.connect(admin).setPriceDelta(priceAdjustDeltaExact);

            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();
            const daysNeeded = dayDecreaseThreshold + 1n; // Advance days to trigger decrease

            // Advance time by daysNeeded to trigger price decrease
            await advancedDays(daysNeeded);

            // Mint a new batch to trigger base price update
            await expect(astaVerde.connect(admin).mintBatch([admin.address], ["QmBoundaryCID"]))
                .to.emit(astaVerde, "BasePriceAdjusted")
                .withArgs(priceFloor, anyValue, false);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(priceFloor);
        });


    });

    describe("Independent Batch Pricing", function () {
        describe("Independent Batch Pricing", function () {
            it("Each batch should have independent pricing based on its creation time", async function () {
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

            await expect(astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount))
                .to.be.revertedWith("Not enough tokens in batch");
        });

        it("Should handle high priceDecreaseRate without overflow", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);

            const highPriceDecreaseRate = ethers.parseUnits("1000", 6); // 1,000,000 USDC
            await astaVerde.connect(admin).setPriceDelta(highPriceDecreaseRate);

            // Mint a batch and advance time
            await astaVerde.mintBatch([admin.address], ["QmValidCID"]);

            const initialBasePrice = await astaVerde.basePrice();
            const priceFloor = await astaVerde.priceFloor();
            const totalDecreaseNeeded = initialBasePrice - priceFloor; // 190,000,000
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold(); // 4

            const daysToDecrease = totalDecreaseNeeded / highPriceDecreaseRate; // 190
            const daysNeeded = daysToDecrease + dayDecreaseThreshold + 1n; // 195

            await advancedDays(daysNeeded);

            // Mint another batch to trigger base price update
            await expect(astaVerde.mintBatch([admin.address], ["QmTestCID"]))
                .to.emit(astaVerde, "BasePriceAdjusted")
                .withArgs(priceFloor, anyValue, false);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(priceFloor); // 40,000,000
        });



        it("Should set basePrice to exactly priceFloor when decrease equals the difference", async function () {
            const { astaVerde, admin } = await loadFixture(deployAstaVerdeFixture);
            const initialBasePrice = await astaVerde.basePrice();
            const priceFloor = await astaVerde.priceFloor();

            // Set priceDelta to exactly match the difference
            const priceDeltaExact = initialBasePrice - priceFloor;
            await astaVerde.connect(admin).setPriceDelta(priceDeltaExact);

            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();
            const daysNeeded = dayDecreaseThreshold + 1n; // Advance days to trigger decrease

            // Advance time by daysNeeded to trigger price decrease
            await advancedDays(daysNeeded);

            // Mint a new batch to trigger base price update
            await expect(astaVerde.connect(admin).mintBatch([admin.address], ["QmBoundaryCID"]))
                .to.emit(astaVerde, "BasePriceAdjusted")
                .withArgs(priceFloor, anyValue, false);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(priceFloor);
        });





        it("Should revert when buying tokens with insufficient USDC", async function () {
            const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

            // Mint a batch
            await astaVerde.mintBatch([admin.address], ["QmCID1"]);
            const batchID = 1n;
            const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
            const insufficientAmount = currentPrice - 1n; // 1 USDC less than required

            await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), insufficientAmount);

            await expect(
                astaVerde.connect(user1).buyBatch(batchID, insufficientAmount, 1n)
            ).to.be.revertedWith("Insufficient funds sent");
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
            await expect(astaVerde.connect(user1).redeemToken(tokenId))
                .to.be.revertedWith("Token already redeemed");
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

            await expect(astaVerde.connect(user2).redeemToken(tokenId))
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
                await astaVerde.mintBatch([user2.address, user2.address, user2.address], ["QmValidCID1", "QmValidCID2", "QmValidCID3"]);
                const batchID = 1n;

                // Get initial balance
                const initialProducerBalance = await mockUSDC.balanceOf(user2.address);

                // User1 buys two out of three tokens
                const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
                const totalCost = currentPrice * 2n;
                await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
                await astaVerde.connect(user1).buyBatch(batchID, totalCost, 2n);

                // Check final balance
                const finalProducerBalance = await mockUSDC.balanceOf(user2.address);

                // Calculate expected producer share
                const platformSharePercentage = await astaVerde.platformSharePercentage();
                const expectedProducerShare = currentPrice * 2n * (100n - platformSharePercentage) / 100n;

                // Verify balance
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

                // Check final balances
                const finalProducer1Balance = await mockUSDC.balanceOf(user2.address);
                const finalProducer2Balance = await mockUSDC.balanceOf(user3.address);

                // Calculate expected producer share
                const platformSharePercentage = await astaVerde.platformSharePercentage();
                const expectedProducerShare = currentPrice * (100n - platformSharePercentage) / 100n;

                // Verify balances
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

                // Check final balances
                const finalProducerBalance = await mockUSDC.balanceOf(user2.address);
                const finalContractBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());

                // Calculate expected producer share
                const platformSharePercentage = await astaVerde.platformSharePercentage();
                const expectedProducerShare = currentPrice * (100n - platformSharePercentage) / 100n;

                // Verify balances
                expect(finalProducerBalance).to.equal(initialProducerBalance + expectedProducerShare);
                expect(finalContractBalance).to.equal(initialContractBalance + currentPrice - expectedProducerShare);
            });
        });

    it("Should not increase basePrice when only part of a batch is sold", async function () {
        const { astaVerde, mockUSDC, admin, user1 } = await loadFixture(deployAstaVerdeFixture);

        // Mint a batch with 3 tokens
        await astaVerde.mintBatch([admin.address, admin.address, admin.address], ["QmCID1", "QmCID2", "QmCID3"]);
        const batchID = 1n;
        const initialBasePrice = await astaVerde.basePrice();

        // Buy 2 out of 3 tokens
        const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
        const totalCost = currentPrice * 2n;

        await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), totalCost);
        await expect(astaVerde.connect(user1).buyBatch(batchID, totalCost, 2n))
            .to.emit(astaVerde, "PartialBatchSold")
            .withArgs(batchID, anyValue, 1n);

        const newBasePrice = await astaVerde.basePrice();
        expect(newBasePrice).to.equal(initialBasePrice); // Base price should remain unchanged
    });
});
