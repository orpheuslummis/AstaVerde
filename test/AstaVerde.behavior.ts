// test/AstaVerde.behavior.ts
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { AstaVerde, MockUSDC } from "../types";
import { deployAstaVerdeFixture } from "./AstaVerde.fixture";
import {
    USDC_PRECISION,
    advancePastThreshold,
    setupBatchAndBuy,
    calculateShares,
    expectBalancesAfterPurchase,
    genAddresses,
    waitNSeconds,
} from "./lib";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

const SECONDS_IN_A_DAY = 86400n;
const MAX_BATCH_SIZE = 50n;
const PLATFORM_SHARE_PERCENTAGE = 30n;
const PRICE_DECREASE_RATE = 1n * BigInt(USDC_PRECISION);
const PRICE_FLOOR = 40n * BigInt(USDC_PRECISION);
const BASE_PRICE = 230n * BigInt(USDC_PRECISION);
const PRICE_DELTA = 10n * BigInt(USDC_PRECISION);

export function shouldBehaveLikeAstaVerde(): void {
    let astaVerde: AstaVerde;
    let mockUSDC: MockUSDC;
    let admin: SignerWithAddress;
    let user: SignerWithAddress;
    let user1: SignerWithAddress;

    beforeEach(async function () {
        const fixture = await deployAstaVerdeFixture();
        astaVerde = fixture.astaVerde;
        mockUSDC = fixture.mockUSDC;
        admin = fixture.admin;
        user = fixture.user1;
        user1 = fixture.user2;
    });

    describe("Deployment and basic functionality", function () {
        it("should initialize contract with expected default parameters", async function () {
            expect(await astaVerde.basePrice()).to.equal(BASE_PRICE);
            expect(await astaVerde.priceFloor()).to.equal(PRICE_FLOOR);
            expect(await astaVerde.priceDecreaseRate()).to.equal(PRICE_DECREASE_RATE);
            expect(await astaVerde.maxBatchSize()).to.equal(MAX_BATCH_SIZE);
            expect(await astaVerde.platformSharePercentage()).to.equal(PLATFORM_SHARE_PERCENTAGE);
        });

        it("should return current price and increment batchID after minting a batch", async function () {
            const cids = ["cid1", "cid2"];
            const { batchID, price } = await setupBatchAndBuy(astaVerde, admin, user, cids, 2n);
            const currentBasePrice = await astaVerde.basePrice();
            const currentBatchPrice = await astaVerde.getCurrentBatchPrice(batchID);
        
            expect(currentBatchPrice).to.equal(currentBasePrice);
        
            await astaVerde.mintBatch(genAddresses(cids.length), cids);
            const newBatchID = await astaVerde.lastBatchID();
            expect(newBatchID).to.equal(BigInt(batchID) + 1n);
        });

        it("should revert when getting price for non-existent batch", async function () {
            const nonExistentBatchID = 999n;
            await expect(astaVerde.getCurrentBatchPrice(nonExistentBatchID)).to.be.revertedWith(
                "Batch ID is out of bounds"
            );
        });

        it("should correctly set and get parameters", async function () {
            const parameterTests = [
                { method: "setBasePrice", value: BASE_PRICE + 10n * BigInt(USDC_PRECISION), getter: "basePrice" },
                { method: "setPriceFloor", value: PRICE_FLOOR + 10n * BigInt(USDC_PRECISION), getter: "priceFloor" },
                { method: "setPriceDecreaseRate", value: 2n * BigInt(USDC_PRECISION), getter: "priceDecreaseRate" },
                { method: "setMaxBatchSize", value: 100n, getter: "maxBatchSize" },
                { method: "setPlatformSharePercentage", value: 40n, getter: "platformSharePercentage" },
            ] as const;

            for (const test of parameterTests) {
                await astaVerde.connect(admin)[test.method](test.value);
                expect(await astaVerde[test.getter]()).to.equal(test.value);
            }
        });

        it("should revert pause attempt by non-owner account", async function () {
            const nonOwner = user;
            await expect(astaVerde.connect(nonOwner).pause()).to.be.reverted;
        });

        it("should revert unpause attempt by non-owner account", async function () {
            const nonOwner = user;
            await expect(astaVerde.connect(nonOwner).unpause()).to.be.reverted;
        });

        it("should prevent batch purchases when contract is paused", async function () {
            await astaVerde.connect(admin).pause();
            const batchID = await astaVerde.lastBatchID();
            await expect(astaVerde.connect(user).buyBatch(batchID, 1n)).to.be.reverted;
        });
    });

    describe("Token redemption", function () {
        it("should allow token owner to redeem tokens", async function () {
            const { batchID, price, producers } = await setupBatchAndBuy(astaVerde, admin, user, ["cid1", "cid2"], 2n);
            const batchInfo = await astaVerde.getBatchInfo(batchID);
            const tokenIds = [...batchInfo.tokenIds];

            await expect(astaVerde.connect(user).redeemTokens(tokenIds))
                .to.emit(astaVerde, "TokenRedeemed")
                .withArgs(tokenIds[0], await user.getAddress(), anyValue)
                .and.to.emit(astaVerde, "TokenRedeemed")
                .withArgs(tokenIds[1], await user.getAddress(), anyValue);

            for (const tokenId of tokenIds) {
                const tokenInfo = await astaVerde.tokens(tokenId);
                expect(tokenInfo.isRedeemed).to.equal(true);
            }
        });

        it("should revert redemption attempt by non-owner of tokens", async function () {
            const { batchID } = await setupBatchAndBuy(astaVerde, admin, user, ["cid1", "cid2"], 2n);
            const batchInfo = await astaVerde.getBatchInfo(batchID);
            const tokenIds = [...batchInfo.tokenIds];
            const nonOwner = user1;

            await expect(astaVerde.connect(nonOwner).redeemTokens(tokenIds)).to.be.revertedWith(
                "Caller is not the token owner"
            );
        });

        it("should revert attempt to redeem already redeemed tokens", async function () {
            const { batchID, producers } = await setupBatchAndBuy(astaVerde, admin, user, ["cid1", "cid2"], 2n);
            const batchInfo = await astaVerde.getBatchInfo(batchID);
            const tokenIds = [...batchInfo.tokenIds];

            await astaVerde.connect(user).redeemTokens(tokenIds);

            await expect(astaVerde.connect(user).redeemTokens(tokenIds)).to.be.revertedWith(
                "Token is already redeemed"
            );
        });

        it("should revert attempt to redeem non-existent tokens", async function () {
            const nonExistentTokenId = 999n;
            await expect(astaVerde.connect(admin).redeemTokens([nonExistentTokenId])).to.be.revertedWith(
                "Batch ID is out of bounds"
            );
        });

        it("should emit TokenRedeemed event", async function () {
            const cids = ["cid_new", "cid_new2"];
            const { batchID } = await setupBatchAndBuy(astaVerde, admin, user, cids, 2n);
            const batchInfo = await astaVerde.getBatchInfo(batchID);
            const tokenId = batchInfo.tokenIds[0];

            await expect(astaVerde.connect(user).redeemTokens([tokenId]))
                .to.emit(astaVerde, "TokenRedeemed")
                .withArgs(tokenId, await user.getAddress(), anyValue);
        });
    });

    describe("Base Price Adjustment Logic", function () {
        it("should increase basePrice by priceDelta for each day when conditions are met", async function () {
            const cids = ["cid1", "cid2"];
            const tokenAmount = 1n;

            await astaVerde.connect(admin).mintBatch(genAddresses(cids.length), cids);
            await astaVerde.connect(user).buyBatch(0n, tokenAmount);

            const initialBasePrice = await astaVerde.basePrice();
            const priceDelta = await astaVerde.priceDelta();
            expect(priceDelta).to.equal(10n * BigInt(USDC_PRECISION));

            const daysPassed = 2n;
            await waitNSeconds(daysPassed * SECONDS_IN_A_DAY - 1n);

            await expect(astaVerde.connect(user).buyBatch(0n, tokenAmount))
                .to.emit(astaVerde, "BasePriceAdjusted")
                .withArgs(initialBasePrice + priceDelta * daysPassed, anyValue, "increase", daysPassed);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(initialBasePrice + priceDelta * daysPassed);
        });

        it("should decrease basePrice when no sales occur within dayDecreaseThreshold", async function () {
            const cids = ["cid1", "cid2"];
            const tokenAmount = 1n;

            await astaVerde.connect(admin).mintBatch(genAddresses(cids.length), cids);
            await astaVerde.connect(user).buyBatch(0n, tokenAmount);

            const initialBasePrice = await astaVerde.basePrice();
            const decreaseThreshold = await astaVerde.dayDecreaseThreshold();
            const priceDecreaseRate = await astaVerde.priceDecreaseRate();

            await waitNSeconds(decreaseThreshold * SECONDS_IN_A_DAY + 1n);

            await astaVerde.connect(user).buyBatch(0n, tokenAmount);

            const newBasePrice = await astaVerde.basePrice();
            const expectedPrice = initialBasePrice - (priceDecreaseRate * decreaseThreshold);
            expect(newBasePrice).to.equal(expectedPrice);
        });
    });

    describe("Price Adjustments", function () {
        it("should increase price when sales occur within dayIncreaseThreshold", async function () {
            const cids = ["cid1", "cid2"];
            const tokenAmount = 1n;

            const { batchID } = await setupBatchAndBuy(astaVerde, admin, user, cids, tokenAmount);

            const initialBasePrice = await astaVerde.basePrice();
            const priceDelta = await astaVerde.priceDelta();
            expect(priceDelta).to.equal(10n * BigInt(USDC_PRECISION));

            const increaseThreshold = await astaVerde.dayIncreaseThreshold();
            await waitNSeconds(increaseThreshold * SECONDS_IN_A_DAY - 1n);

            await expect(astaVerde.connect(user).buyBatch(batchID, tokenAmount))
                .to.emit(astaVerde, "BasePriceAdjusted")
                .withArgs(initialBasePrice + priceDelta, anyValue, "increase", anyValue);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(initialBasePrice + priceDelta);
        });

        it("should not reduce price below priceFloor", async function () {
            const cids = ["cid2", "cid3"];
            const tokenAmount = 1n;

            const { batchID } = await setupBatchAndBuy(astaVerde, admin, user, cids, tokenAmount);

            const newBasePrice = 41n * BigInt(USDC_PRECISION); // 41 USDC
            await astaVerde.connect(admin).setBasePrice(newBasePrice);

            expect(await astaVerde.basePrice()).to.equal(newBasePrice);

            await advancePastThreshold(astaVerde, "dayDecreaseThreshold");

            await expect(astaVerde.connect(user).buyBatch(batchID, tokenAmount))
                .to.emit(astaVerde, "BasePriceAdjusted")
                .withArgs(PRICE_FLOOR, anyValue, "floor", anyValue);

            const finalBasePrice = await astaVerde.basePrice();
            expect(finalBasePrice).to.equal(PRICE_FLOOR);
        });
    });

    describe("USDC Splitting and Balances", function () {
        it("should correctly split USDC between producer and platform with explicit rounding", async function () {
            const cids = ["cid1", "cid2", "cid3"];
            const tokenAmount = BigInt(cids.length);
            const { batchID, price, producers } = await setupBatchAndBuy(astaVerde, admin, user, cids, tokenAmount);

            const { platformShare, producerShare } = calculateShares(
                price * tokenAmount,
                PLATFORM_SHARE_PERCENTAGE
            );

            await expectBalancesAfterPurchase(
                mockUSDC,
                producers,
                await astaVerde.getAddress(),
                platformShare,
                producerShare
            );

            const batchInfo = await astaVerde.getBatchInfo(batchID);
            const tokenIds = batchInfo.tokenIds;

            for (const tokenId of tokenIds) {
                expect(await astaVerde.balanceOf(await user.getAddress(), tokenId)).to.equal(1n);
            }
        });
    });

    describe("Edge Cases", function () {
        it("should revert when attempting to buy more tokens than available", async function () {
            const cids = ["cid1", "cid2"];
            const { batchID } = await setupBatchAndBuy(astaVerde, admin, user, cids, 1n);

            await expect(astaVerde.connect(user).buyBatch(batchID, 2n)).to.be.revertedWith(
                "Not enough tokens in batch"
            );
        });

        it("should revert when attempting to buy zero tokens", async function () {
            const cids = ["cid1", "cid2"];
            const { batchID } = await setupBatchAndBuy(astaVerde, admin, user, cids, 1n);

            await expect(astaVerde.connect(user).buyBatch(batchID, 0n)).to.be.revertedWith(
                "Invalid token amount"
            );
        });

        it("should handle multiple batches with independent price adjustments", async function () {
            const cids1 = ["cid1", "cid2"];
            const cids2 = ["cid3", "cid4"];
            
            await astaVerde.connect(admin).mintBatch(genAddresses(cids1.length), cids1);
            await waitNSeconds(1n * SECONDS_IN_A_DAY);
            await astaVerde.connect(admin).mintBatch(genAddresses(cids2.length), cids2);

            const batch1Price = await astaVerde.getCurrentBatchPrice(0n);
            const batch2Price = await astaVerde.getCurrentBatchPrice(1n);

            expect(batch1Price).to.be.lt(batch2Price);

            await astaVerde.connect(user).buyBatch(0n, 1n);
            await astaVerde.connect(user).buyBatch(1n, 1n);

            const newBatch1Price = await astaVerde.getCurrentBatchPrice(0n);
            const newBatch2Price = await astaVerde.getCurrentBatchPrice(1n);

            expect(newBatch1Price).to.equal(batch1Price);
            expect(newBatch2Price).to.equal(batch2Price);
        });
    });

    describe("Time Manipulation", function () {
        it("should correctly adjust prices over an extended period with multiple sales", async function () {
            const cids = Array(20).fill(0).map((_, i) => `cid${i + 1}`);
            await astaVerde.connect(admin).mintBatch(genAddresses(cids.length), cids);

            const initialBasePrice = await astaVerde.basePrice();
            const priceDelta = await astaVerde.priceDelta();
            const increaseThreshold = await astaVerde.dayIncreaseThreshold();
            const decreaseThreshold = await astaVerde.dayDecreaseThreshold();

            // Simulate multiple sales and time advancements
            for (let i = 0; i < 10; i++) {
                if (i % 2 === 0) {
                    // Simulate a sale within increase threshold
                    await waitNSeconds(increaseThreshold * SECONDS_IN_A_DAY - 1n);
                    await astaVerde.connect(user).buyBatch(0n, 1n);
                } else {
                    // Simulate no sales within decrease threshold
                    await waitNSeconds(decreaseThreshold * SECONDS_IN_A_DAY + 1n);
                    await astaVerde.connect(user).buyBatch(0n, 1n);
                }
            }

            const finalBasePrice = await astaVerde.basePrice();
            expect(finalBasePrice).to.not.equal(initialBasePrice);
            // The exact price will depend on the specific timing of sales, but it should have changed
        });
    });

    describe("Token URI", function () {
        it("should return the correct IPFS URI for a token", async function () {
            const cids = ["QmTest1", "QmTest2"];
            const { batchID } = await setupBatchAndBuy(astaVerde, admin, user, cids, 2n);
            const batchInfo = await astaVerde.getBatchInfo(batchID);
            const tokenId = batchInfo.tokenIds[0];

            const tokenURI = await astaVerde.uri(tokenId);
            expect(tokenURI).to.equal(`ipfs://${cids[0]}.json`);
        });
    });

    describe("Gas Usage", function () {
        it("should have reasonable gas usage for buyBatch function", async function () {
            const cids = ["cid1", "cid2", "cid3", "cid4", "cid5"];
            await astaVerde.connect(admin).mintBatch(genAddresses(cids.length), cids);

            const gasUsed = await astaVerde.connect(user).buyBatch.estimateGas(0n, 3n);
            
            // This is an arbitrary threshold, adjust based on your requirements
            expect(gasUsed).to.be.lt(500000n);
        });
    });
}
