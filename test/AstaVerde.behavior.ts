import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { AddressLike } from "ethers";
import { ethers, network } from "hardhat";
import { AstaVerde, MockUSDC } from "../types";
import { deployAstaVerdeFixture } from "./AstaVerde.fixture";
import { genAddresses, USDC_PRECISION } from "./lib";

const SECONDS_IN_A_DAY = 86400;
const MAX_BATCH_SIZE = 50;
const PLATFORM_SHARE_PERCENTAGE = 30;
const PRICE_DECREASE_RATE = 1n * USDC_PRECISION;
const PRICE_FLOOR = 40n * USDC_PRECISION;
const BASE_PRICE = 230n * USDC_PRECISION;

async function waitNSeconds(n: number) {
    console.log(`Advancing time by ${n} seconds`);
    await network.provider.send("evm_increaseTime", [n]);
    await network.provider.send("evm_mine");
}

async function mintBuyAndAdvance(
    astaVerde: AstaVerde,
    user: SignerWithAddress,
    cids: string[],
    tokenAmount: number,
    advanceTimeSeconds: number = 0,
) {
    const producers = genAddresses(cids.length);
    await astaVerde.mintBatch(producers, cids);
    const batchID = await astaVerde.lastBatchID();
    const { price } = await astaVerde.getBatchInfo(batchID);
    const usdcAmount = price * BigInt(tokenAmount);

    await astaVerde.connect(user).buyBatch(batchID, usdcAmount, tokenAmount);

    if (advanceTimeSeconds > 0) {
        await waitNSeconds(advanceTimeSeconds);
        await astaVerde.updateBasePrice();
    }

    return { batchID, price, usdcAmount, producers };
}

async function expectBalancesAfterPurchase(
    astaVerde: AstaVerde,
    mockUSDC: MockUSDC,
    user: string,
    producers: string[],
    tokenIds: bigint[],
    usdcAmount: bigint,
) {
    for (const tokenId of tokenIds) {
        expect(await astaVerde.balanceOf(user, tokenId)).to.equal(1);
    }

    const expectedProducerShare =
        (usdcAmount * (100n - BigInt(PLATFORM_SHARE_PERCENTAGE))) / (100n * BigInt(producers.length));
    for (const producer of producers) {
        const producerBalance = await mockUSDC.balanceOf(producer);
        expect(producerBalance).to.equal(expectedProducerShare);
    }

    const platformBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());
    expect(platformBalance).to.equal((usdcAmount * BigInt(PLATFORM_SHARE_PERCENTAGE)) / 100n);
}

// New helper function to calculate expected shares
function calculateShares(usdcAmount: bigint, platformSharePercentage: number) {
    const platformShare = (usdcAmount * BigInt(platformSharePercentage)) / 100n;
    const producerShare = usdcAmount - platformShare;
    return { platformShare, producerShare };
}

export function shouldBehaveLikeAstaVerde(): void {
    let astaVerde: AstaVerde;
    let mockUSDC: MockUSDC;
    let admin: SignerWithAddress;
    let user: SignerWithAddress;
    let user1: SignerWithAddress;

    async function setupBatchAndBuy(cids: string[], tokenAmount: number) {
        const producers = genAddresses(cids.length);
        await astaVerde.mintBatch(producers, cids);
        const batchID = await astaVerde.lastBatchID();
        const { price } = await astaVerde.getBatchInfo(batchID);
        const usdcAmount = price * BigInt(tokenAmount);
        return { batchID, price, usdcAmount, user, producers };
    }

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
            const params = [
                "basePrice",
                "priceFloor",
                "priceDecreaseRate",
                "maxBatchSize",
                "platformSharePercentage",
            ] as const;
            const expectedValues = [
                BASE_PRICE,
                PRICE_FLOOR,
                PRICE_DECREASE_RATE,
                MAX_BATCH_SIZE,
                PLATFORM_SHARE_PERCENTAGE,
            ];

            for (let i = 0; i < params.length; i++) {
                expect(await astaVerde[params[i]]()).to.equal(expectedValues[i]);
            }
        });

        it("should return current price and increment batchID after minting a batch", async function () {
            const cids = ["cid1", "cid2"];
            await astaVerde.mintBatch(genAddresses(cids.length), cids);
            const batchID = await astaVerde.lastBatchID();

            const currentBasePrice = await astaVerde.basePrice();

            const currentBatchPrice = await astaVerde.getCurrentBatchPrice(batchID);

            expect(currentBatchPrice).to.equal(currentBasePrice);

            await astaVerde.mintBatch(genAddresses(cids.length), cids);
            expect(await astaVerde.lastBatchID()).to.equal(batchID + 1n);
        });

        it("should revert when getting price for non-existent batch", async function () {
            await expect(astaVerde.getCurrentBatchPrice(999)).to.be.revertedWith("Batch does not exist");
        });
    });

    describe("Batch minting and buying", function () {
        it("should revert batch minting under specific invalid conditions", async function () {
            const scenarios = [
                {
                    desc: "without producers",
                    producers: [] as AddressLike[],
                    cids: ["abc", "xyz"],
                    error: "No producers provided",
                },
                {
                    desc: "with mismatched producers and cids",
                    producers: genAddresses(2),
                    cids: ["cid"],
                    error: "Mismatch between producers and cids lengths",
                },
                {
                    desc: "with batch size too large",
                    producers: genAddresses(MAX_BATCH_SIZE + 1),
                    cids: Array(MAX_BATCH_SIZE + 1).fill("cid"),
                    error: "Batch size exceeds max batch size",
                },
            ];

            for (const scenario of scenarios) {
                await expect(astaVerde.mintBatch(scenario.producers, scenario.cids)).to.be.revertedWith(scenario.error);
            }
        });

        it("should mint a batch and assign tokens to contract", async function () {
            const cids = ["cid1", "cid2"];
            await astaVerde.mintBatch(genAddresses(cids.length), cids);
            const batchID = await astaVerde.lastBatchID();
            const { tokenIds } = await astaVerde.getBatchInfo(batchID);
            expect(tokenIds.length).to.equal(cids.length);
            expect(await astaVerde.balanceOf(await astaVerde.getAddress(), tokenIds[0])).to.equal(1);
        });

        it("should mint a small batch and return expected batch information", async function () {
            await astaVerde.mintBatch(genAddresses(2), ["cid1", "cid2"]);
            const batchID = await astaVerde.lastBatchID();
            const { tokenIds, creationTime, price } = await astaVerde.getBatchInfo(batchID);
            expect(tokenIds.length).to.equal(2);
            expect(creationTime).to.be.gt(0);
            expect(price).to.be.gt(0);
        });

        it("should allow user to buy tokens from a batch and update balances", async function () {
            await mintBuyAndAdvance(astaVerde, user1, ["cid1", "cid2"], 1);
            const batchID = await astaVerde.lastBatchID();
            const { tokenIds } = await astaVerde.getBatchInfo(batchID);

            console.log("BatchID:", batchID.toString());
            console.log(
                "TokenIDs:",
                tokenIds.map((id) => id.toString()),
            );
            console.log("User1 address:", user1.address);

            const balance = await astaVerde.balanceOf(user1.address, tokenIds[0]);
            console.log("User1 balance of token:", balance.toString());

            expect(balance).to.equal(1);
        });

        it("should revert batch purchase when sent funds are insufficient", async function () {
            await astaVerde.mintBatch(genAddresses(2), ["cid1", "cid2"]);
            const batchID = await astaVerde.lastBatchID();
            await expect(astaVerde.buyBatch(batchID, 100, 1)).to.be.revertedWith("Insufficient funds sent");
        });

        it("should allow purchase of full batch and distribute funds accurately", async function () {
            const { batchID, usdcAmount, producers } = await mintBuyAndAdvance(
                astaVerde,
                user,
                ["cid1", "cid2", "cid3"],
                3,
            );
            const { tokenIds } = await astaVerde.getBatchInfo(batchID);

            await expectBalancesAfterPurchase(astaVerde, mockUSDC, user.address, producers, tokenIds, usdcAmount);
        });

        it("should handle batch purchase with non-standard base price", async function () {
            await astaVerde.setBasePrice(97n * USDC_PRECISION);

            const { batchID, usdcAmount, producers } = await mintBuyAndAdvance(
                astaVerde,
                user,
                ["cid1", "cid2", "cid3"],
                3,
            );
            const { tokenIds } = await astaVerde.getBatchInfo(batchID);

            await expectBalancesAfterPurchase(astaVerde, mockUSDC, user.address, producers, tokenIds, usdcAmount);
        });

        it("should allow partial batch purchase and update token balances accordingly", async function () {
            const { batchID, usdcAmount, producers } = await mintBuyAndAdvance(
                astaVerde,
                user,
                ["cid1", "cid2", "cid3"],
                2,
            );
            const { tokenIds } = await astaVerde.getBatchInfo(batchID);

            expect(await astaVerde.balanceOf(user.address, tokenIds[0])).to.equal(1);
            expect(await astaVerde.balanceOf(user.address, tokenIds[1])).to.equal(1);
            expect(await astaVerde.balanceOf(user.address, tokenIds[2])).to.equal(0);
        });

        it("should revert when attempting to buy more tokens than available in batch", async function () {
            const { batchID } = await mintBuyAndAdvance(astaVerde, user, ["cid1", "cid2", "cid3", "cid4", "cid5"], 2);

            await expect(astaVerde.connect(user).buyBatch(batchID, 1000, 4)).to.be.revertedWith(
                "Not enough tokens in batch",
            );
        });

        it("should allow purchase of remaining tokens in a partially sold batch", async function () {
            const { batchID, price } = await mintBuyAndAdvance(
                astaVerde,
                user,
                ["cid1", "cid2", "cid3", "cid4", "cid5"],
                2,
            );

            const usdcAmount = price * 3n;
            const tx = await astaVerde.connect(user).buyBatch(batchID, usdcAmount, 3);
            const receipt = await tx.wait();
            if (receipt === null) {
                throw new Error("Transaction receipt is null");
            }
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            if (block === null) {
                throw new Error("Block is null");
            }
            const timestamp = block.timestamp;
            await expect(tx).to.emit(astaVerde, "BatchSold").withArgs(batchID, timestamp, 5);
        });

        // New test to ensure accurate and correct calculations
        it("should correctly split USDC between producer and platform with explicit rounding", async function () {
            const cids = ["cid1", "cid2", "cid3"];
            const { batchID, usdcAmount, producers } = await mintBuyAndAdvance(astaVerde, user, cids, cids.length);
            const { tokenIds } = await astaVerde.getBatchInfo(batchID);

            const { platformShare, producerShare } = calculateShares(usdcAmount, PLATFORM_SHARE_PERCENTAGE);

            // Check producer balances
            for (const producer of producers) {
                const producerBalance = await mockUSDC.balanceOf(producer);
                expect(producerBalance).to.equal(producerShare / BigInt(producers.length));
            }

            // Check platform balance
            const platformBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());
            expect(platformBalance).to.equal(platformShare);

            // Check user token balances
            for (const tokenId of tokenIds) {
                expect(await astaVerde.balanceOf(user.address, tokenId)).to.equal(1);
            }
        });
    });

    describe("Price Adjustment Mechanism", function () {
        it("should increase price when sales occur within dayIncreaseThreshold", async function () {
            const initialBasePrice = await astaVerde.basePrice();
            const priceDelta = await astaVerde.priceDelta();
            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();

            await mintBuyAndAdvance(astaVerde, user, ["cid1"], 1, Number(dayIncreaseThreshold) * SECONDS_IN_A_DAY - 1);

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(initialBasePrice + priceDelta);
        });

        it("should not reduce price below priceFloor", async function () {
            const priceFloor = await astaVerde.priceFloor();
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();
            await astaVerde.setBasePrice(priceFloor + 1n);

            await waitNSeconds(Number(dayDecreaseThreshold) * SECONDS_IN_A_DAY);
            await astaVerde.updateBasePrice();

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(priceFloor);
        });

        it("should maintain priceFloor when price is at floor and time passes without sales", async function () {
            const priceFloor = await astaVerde.priceFloor();
            await astaVerde.setBasePrice(priceFloor);

            await waitNSeconds(SECONDS_IN_A_DAY * 7);
            await astaVerde.updateBasePrice();

            const newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(priceFloor);
        });

        it("should adjust price up and down based on sales activity over time", async function () {
            const initialBasePrice = await astaVerde.basePrice();
            const priceDelta = await astaVerde.priceDelta();
            const dayIncreaseThreshold = await astaVerde.dayIncreaseThreshold();
            const dayDecreaseThreshold = await astaVerde.dayDecreaseThreshold();

            await mintBuyAndAdvance(astaVerde, user, ["cid1"], 1, Number(dayIncreaseThreshold) * SECONDS_IN_A_DAY - 1);
            let newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.equal(initialBasePrice + priceDelta);

            await waitNSeconds(Number(dayDecreaseThreshold) * SECONDS_IN_A_DAY);
            await astaVerde.updateBasePrice();
            newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.be.lt(initialBasePrice + priceDelta);

            await mintBuyAndAdvance(astaVerde, user, ["cid2"], 1, Number(dayIncreaseThreshold) * SECONDS_IN_A_DAY - 1);
            newBasePrice = await astaVerde.basePrice();
            expect(newBasePrice).to.be.gt(initialBasePrice);
        });
    });

    describe("Revenue splitting", function () {
        it("should distribute revenue between producers and platform according to set percentages", async function () {
            const { batchID, usdcAmount, producers } = await mintBuyAndAdvance(
                astaVerde,
                user,
                ["cid1", "cid2", "cid3"],
                3,
            );
            const { tokenIds } = await astaVerde.getBatchInfo(batchID);

            await expectBalancesAfterPurchase(astaVerde, mockUSDC, user.address, producers, tokenIds, usdcAmount);
        });
    });

    describe("Contract management", function () {
        const parameterTests = [
            { method: "setPlatformSharePercentage", value: 11, getter: "platformSharePercentage" },
            { method: "setPriceFloor", value: PRICE_FLOOR + 1n, getter: "priceFloor" },
            { method: "setMaxBatchSize", value: MAX_BATCH_SIZE + 1, getter: "maxBatchSize" },
            { method: "setBasePrice", value: BASE_PRICE + 1n, getter: "basePrice" },
        ] as const;

        parameterTests.forEach(({ method, value, getter }) => {
            it(`should correctly set ${getter}`, async function () {
                await astaVerde[method](value);
                expect(await astaVerde[getter]()).to.equal(value);
            });
        });

        it("should revert when setting parameters to invalid values", async function () {
            const scenarios = [
                { method: "setPlatformSharePercentage", value: 101, error: "Share must be between 0 and 100" },
                { method: "setPriceFloor", value: 0, error: "Invalid price floor" },
                { method: "setBasePrice", value: 0, error: "Invalid starting price" },
                { method: "setMaxBatchSize", value: 0, error: "Invalid batch size" },
            ] as const;

            for (const scenario of scenarios) {
                await expect(astaVerde[scenario.method](scenario.value)).to.be.revertedWith(scenario.error);
            }
        });

        it("should revert pause attempt by non-owner account", async function () {
            const nonOwner = (await ethers.getSigners())[1];
            await expect(astaVerde.connect(nonOwner).pause()).to.be.reverted;
        });

        it("should revert unpause attempt by non-owner account", async function () {
            const nonOwner = (await ethers.getSigners())[1];
            await expect(astaVerde.connect(nonOwner).unpause()).to.be.reverted;
        });

        it("should prevent batch purchases when contract is paused", async function () {
            await astaVerde.pause();
            const batchID = await astaVerde.lastBatchID();
            await expect(astaVerde.buyBatch(batchID, 1000, 1)).to.be.reverted;
        });
    });

    describe("Token redemption", function () {
        it("should allow token owner to redeem tokens and emit events", async function () {
            const cids = ["cid1", "cid2", "cid3"];
            const { batchID, usdcAmount } = await setupBatchAndBuy(cids, cids.length);
            await astaVerde.connect(user).buyBatch(batchID, usdcAmount, cids.length);

            const { tokenIds } = await astaVerde.getBatchInfo(batchID);

            const redeemTx = await astaVerde.connect(user).redeemTokens([...tokenIds]);

            for (let i = 0; i < tokenIds.length; i++) {
                await expect(redeemTx)
                    .to.emit(astaVerde, "TokenReedemed")
                    .withArgs(
                        tokenIds[i],
                        user.address,
                        await ethers.provider.getBlock("latest").then((b) => b!.timestamp),
                    );
            }

            for (let i = 0; i < tokenIds.length; i++) {
                const tokenInfo = await astaVerde.tokens(tokenIds[i]);
                expect(tokenInfo.isRedeemed).to.be.true;
            }
        });
        it("should revert redemption attempt by non-owner of tokens", async function () {
            const cids = ["cid1", "cid2"];
            const { batchID, usdcAmount } = await setupBatchAndBuy(cids, cids.length);
            await astaVerde.connect(user).buyBatch(batchID, usdcAmount, cids.length);

            const { tokenIds } = await astaVerde.getBatchInfo(batchID);

            const nonOwner = (await ethers.getSigners())[2];
            await expect(astaVerde.connect(nonOwner).redeemTokens([...tokenIds])).to.be.revertedWith(
                "Only the owner or approved operator can perform this action",
            );
        });

        it("should revert attempt to redeem already redeemed tokens", async function () {
            const cids = ["cid1"];
            const { batchID, usdcAmount } = await setupBatchAndBuy(cids, cids.length);
            await astaVerde.connect(user).buyBatch(batchID, usdcAmount, cids.length);

            const { tokenIds } = await astaVerde.getBatchInfo(batchID);

            await astaVerde.connect(user).redeemTokens([...tokenIds]);

            await expect(astaVerde.connect(user).redeemTokens([...tokenIds])).to.be.revertedWith(
                "Token is already redeemed",
            );
        });

        it("should revert attempt to redeem non-existent tokens", async function () {
            const nonExistentTokenId = 9999;
            const owner = await ethers.provider.getSigner(0);
            await expect(astaVerde.connect(owner).redeemTokens([nonExistentTokenId])).to.be.revertedWith(
                "Token does not exist",
            );
        });
    });
}
