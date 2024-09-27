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

/*
TODO

Edge Cases:

Over-Purchasing: Attempt to buy more tokens than available to ensure proper error handling.
Zero Purchases: Try purchasing zero tokens to confirm that the contract rejects such attempts.
Multiple Batches:

Test scenarios involving multiple batches to ensure that price adjustments and share allocations work independently across batches.
Time Manipulation:

Test various time advancements to verify that price increases and decreases trigger as expected.
*/

const SECONDS_IN_A_DAY = 86400n;
const MAX_BATCH_SIZE = 50;
const PLATFORM_SHARE_PERCENTAGE = 30;
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
            const { batchID, price } = await setupBatchAndBuy(astaVerde, admin, user, cids, 2);
            const currentBasePrice = await astaVerde.basePrice();
            const currentBatchPrice = await astaVerde.getCurrentBatchPrice(batchID);

            expect(currentBatchPrice).to.equal(currentBasePrice);

            await astaVerde.mintBatch(genAddresses(cids.length), cids);
            const newBatchID = await astaVerde.lastBatchID();
            expect(newBatchID).to.equal(batchID + 1);
        });

        it("should revert when getting price for non-existent batch", async function () {
            const nonExistentBatchID = 999n;
            await expect(astaVerde.getCurrentBatchPrice(nonExistentBatchID)).to.be.revertedWith(
                "Batch ID is out of bounds",
            );
        });

        it("should correctly set and get parameters", async function () {
            const parameterTests = [
                { method: "setBasePrice", value: BASE_PRICE + 10n * BigInt(USDC_PRECISION), getter: "basePrice" },
                { method: "setPriceFloor", value: PRICE_FLOOR + 10n * BigInt(USDC_PRECISION), getter: "priceFloor" },
                { method: "setPriceDecreaseRate", value: 2n * BigInt(USDC_PRECISION), getter: "priceDecreaseRate" },
                { method: "setMaxBatchSize", value: 100, getter: "maxBatchSize" },
                { method: "setPlatformSharePercentage", value: 40, getter: "platformSharePercentage" },
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
            await expect(astaVerde.connect(user).buyBatch(batchID, 1)).to.be.reverted;
        });
    });

    describe("Token redemption", function () {
        it("should allow token owner to redeem tokens", async function () {
            const { batchID, price, producers } = await setupBatchAndBuy(astaVerde, admin, user, ["cid1", "cid2"], 2);
            const batchInfo = await astaVerde.getBatchInfo(batchID);
            const tokenIds = [...batchInfo.tokenIds]; // Mutable copy

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
            const { batchID } = await setupBatchAndBuy(astaVerde, admin, user, ["cid1", "cid2"], 2);
            const batchInfo = await astaVerde.getBatchInfo(batchID);
            const tokenIds = [...batchInfo.tokenIds]; // Mutable copy
            const nonOwner = user1;

            await expect(astaVerde.connect(nonOwner).redeemTokens(tokenIds)).to.be.revertedWith(
                "Caller is not the token owner",
            );
        });

        it("should revert attempt to redeem already redeemed tokens", async function () {
            const { batchID, producers } = await setupBatchAndBuy(astaVerde, admin, user, ["cid1", "cid2"], 2);
            const batchInfo = await astaVerde.getBatchInfo(batchID);
            const tokenIds = [...batchInfo.tokenIds]; // Mutable copy

            // First redemption attempt
            await astaVerde.connect(user).redeemTokens(tokenIds);

            // Second redemption attempt should fail
            await expect(astaVerde.connect(user).redeemTokens(tokenIds)).to.be.revertedWith(
                "Token is already redeemed",
            );
        });

        it("should revert attempt to redeem non-existent tokens", async function () {
            const nonExistentTokenId = 999n;
            await expect(astaVerde.connect(admin).redeemTokens([nonExistentTokenId])).to.be.revertedWith(
                "Batch ID is out of bounds",
            );
        });

        it("should emit TokenRedeemed event", async function () {
            // Arrange: Mint a batch and purchase a token
            const cids = ["cid_new", "cid_new2"]; // Increased to 2 CIDs
            const { batchID } = await setupBatchAndBuy(astaVerde, admin, user, cids, 2);
            const batchInfo = await astaVerde.getBatchInfo(batchID);
            const tokenId = batchInfo.tokenIds[0];

            // Act & Assert: Redeem the token and expect the event
            await expect(astaVerde.connect(user).redeemTokens([tokenId]))
                .to.emit(astaVerde, "TokenRedeemed")
                .withArgs(tokenId, await user.getAddress(), anyValue);
        });
    });

    describe("Base Price Adjustment Logic", function () {
        it.only("should increase basePrice by priceDelta once when conditions are met", async function () {
            const cids = ["cid1", "cid2"];
            const tokenAmount = 1;

            // Mint and buy initially
            await astaVerde.connect(admin).mintBatch(genAddresses(cids.length), cids);
            await astaVerde.connect(user).buyBatch(0, tokenAmount);

            const initialBasePrice = await astaVerde.basePrice();
            const priceDelta = await astaVerde.priceDelta();
            expect(priceDelta).to.equal(10n * BigInt(USDC_PRECISION));

            // Advance time by just under 2 days
            await waitNSeconds(2n * SECONDS_IN_A_DAY - 1n);

            // Perform another purchase
            await astaVerde.connect(user).buyBatch(0, tokenAmount);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(initialBasePrice + priceDelta);
        });
    });

    describe("Price Adjustments", function () {
        it.only("should increase price when sales occur within dayIncreaseThreshold", async function () {
            const cids = ["cid1", "cid2"];
            const tokenAmount = 1;

            // Setup batch and initial purchase
            const { batchID, price, producers } = await setupBatchAndBuy(astaVerde, admin, user, cids, tokenAmount);

            // Capture the initial base price before advancing time
            const initialBasePrice = await astaVerde.basePrice();
            console.log(`Initial basePrice: ${initialBasePrice.toString()}`); // Should be 230000000

            // Define PRICE_DELTA based on contract's priceDelta
            const priceDelta = await astaVerde.priceDelta();
            console.log(`priceDelta: ${priceDelta.toString()
                
            }`); // Should be 10000000

            // Assert priceDelta is 10 USDC
            expect(priceDelta).to.equal(10n * BigInt(USDC_PRECISION));

            // Advance time just before the increase threshold
            const increaseThreshold = await astaVerde.dayIncreaseThreshold();
            await waitNSeconds(increaseThreshold * SECONDS_IN_A_DAY - 1n);
            console.log(`Time advanced by ${(increaseThreshold * SECONDS_IN_A_DAY - 1n).toString()} seconds`);

            // Act: Perform a purchase within the increase threshold
            await expect(astaVerde.connect(user).buyBatch(batchID, tokenAmount))
                .to.emit(astaVerde, "BasePriceAdjusted")
                .withArgs(initialBasePrice + priceDelta, anyValue, "increase");

            // Assert: Check if the base price has increased
            const newBasePrice = await astaVerde.basePrice();
            console.log(`New basePrice: ${newBasePrice.toString()}`); // Should be 240000000
            expect(newBasePrice).to.equal(initialBasePrice + priceDelta);
        });

        it("should not reduce price below priceFloor", async function () {
            const cids = ["cid2", "cid3"];
            const tokenAmount = 1;

            // Mint and buy 1 token
            const { batchID, price, producers } = await setupBatchAndBuy(astaVerde, admin, user, cids, tokenAmount);

            // Set basePrice just above priceFloor to allow decrement
            const newBasePrice = 41n * BigInt(USDC_PRECISION); // 41 USDC
            await astaVerde.connect(admin).setBasePrice(newBasePrice);

            // Verify basePrice is set correctly
            expect(await astaVerde.basePrice()).to.equal(newBasePrice);

            // Advance time beyond dayDecreaseThreshold
            await advancePastThreshold(astaVerde, "dayDecreaseThreshold");

            // Act: Perform the second purchase within the threshold
            await expect(astaVerde.connect(user).buyBatch(batchID, tokenAmount))
                .to.emit(astaVerde, "BasePriceAdjusted")
                .withArgs(await astaVerde.basePrice(), anyValue, "floor");

            // Assert: Check if the base price has not fallen below the price floor
            const finalBasePrice = await astaVerde.basePrice();
            expect(finalBasePrice).to.equal(PRICE_FLOOR); // Should be 40 USDC
        });
    });

    describe("USDC Splitting and Balances", function () {
        it("should correctly split USDC between producer and platform with explicit rounding", async function () {
            const cids = ["cid1", "cid2", "cid3"];
            const tokenAmount = cids.length;
            const { batchID, price, producers } = await setupBatchAndBuy(astaVerde, admin, user, cids, tokenAmount);

            const { platformShare, producerShare } = calculateShares(
                price * BigInt(tokenAmount),
                PLATFORM_SHARE_PERCENTAGE,
            );

            await expectBalancesAfterPurchase(
                mockUSDC,
                producers,
                await astaVerde.getAddress(),
                platformShare,
                producerShare,
            );

            // Get the batch info to retrieve the tokenIds
            const batchInfo = await astaVerde.getBatchInfo(batchID);
            const tokenIds = batchInfo.tokenIds;

            // Check user's token balance
            for (const tokenId of tokenIds) {
                expect(await astaVerde.balanceOf(await user.getAddress(), tokenId)).to.equal(1);
            }
        });
    });
}
