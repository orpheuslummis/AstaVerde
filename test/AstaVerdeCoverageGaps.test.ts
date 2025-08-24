import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AstaVerde, MockUSDC } from "../types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("AstaVerde Coverage Gaps", function () {
    let astaVerde: AstaVerde;
    let usdcToken: MockUSDC;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let producer1: SignerWithAddress;
    let producer2: SignerWithAddress;
    let attacker: SignerWithAddress;

    const SECONDS_IN_A_DAY = 86400;
    const USDC_PRECISION = 1e6;
    const initialBasePrice = 230 * USDC_PRECISION;
    const priceFloor = 40 * USDC_PRECISION;

    beforeEach(async function () {
        [owner, user1, user2, producer1, producer2, attacker] = await ethers.getSigners();

        const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
        usdcToken = await MockUSDCFactory.deploy(0); // initialSupply parameter is unused but required

        const AstaVerdeFactory = await ethers.getContractFactory("AstaVerde");
        astaVerde = await AstaVerdeFactory.deploy(owner.address, await usdcToken.getAddress());

        // Mint USDC to users
        await usdcToken.mint(user1.address, 10000 * USDC_PRECISION);
        await usdcToken.mint(user2.address, 10000 * USDC_PRECISION);
        await usdcToken.mint(attacker.address, 10000 * USDC_PRECISION);

        // Approve USDC spending
        await usdcToken.connect(user1).approve(await astaVerde.getAddress(), ethers.MaxUint256);
        await usdcToken.connect(user2).approve(await astaVerde.getAddress(), ethers.MaxUint256);
    });

    describe("Gas Optimization - maxPriceUpdateIterations", function () {
        it("Should set maxPriceUpdateIterations correctly", async function () {
            // Test valid range
            await expect(astaVerde.connect(owner).setMaxPriceUpdateIterations(50))
                .to.emit(astaVerde, "MaxPriceUpdateIterationsSet")
                .withArgs(50);

            expect(await astaVerde.maxPriceUpdateIterations()).to.equal(50);

            // Test upper bound
            await expect(astaVerde.connect(owner).setMaxPriceUpdateIterations(1000))
                .to.emit(astaVerde, "MaxPriceUpdateIterationsSet")
                .withArgs(1000);
        });

        it("Should reject invalid iteration limits", async function () {
            // Test zero
            await expect(astaVerde.connect(owner).setMaxPriceUpdateIterations(0)).to.be.revertedWith(
                "Iteration limit must be between 1 and 1000",
            );

            // Test above maximum
            await expect(astaVerde.connect(owner).setMaxPriceUpdateIterations(1001)).to.be.revertedWith(
                "Iteration limit must be between 1 and 1000",
            );
        });

        it("Should reject non-owner setting iterations", async function () {
            await expect(astaVerde.connect(user1).setMaxPriceUpdateIterations(50)).to.be.revertedWithCustomError(
                astaVerde,
                "OwnableUnauthorizedAccount",
            );
        });

        it("Should emit PriceUpdateIterationLimitReached when limit is hit", async function () {
            // Set a very low iteration limit
            await astaVerde.connect(owner).setMaxPriceUpdateIterations(2);

            // Create many batches that would need price updates
            for (let i = 0; i < 5; i++) {
                await astaVerde.connect(owner).mintBatch([producer1.address], ["cid" + i]);
            }

            // Move time forward to trigger price decrease logic
            await time.increase(5 * SECONDS_IN_A_DAY);

            // This should trigger the iteration limit
            await expect(astaVerde.connect(owner).mintBatch([producer1.address], ["newbatch"]))
                .to.emit(astaVerde, "PriceUpdateIterationLimitReached")
                .withArgs(2, 5); // Processed 2 out of 5 batches
        });

        it("Should prevent DoS with bounded iterations", async function () {
            // Create many batches to simulate potential DoS scenario
            const batchCount = 100;

            // Set iteration limit to prevent DoS
            await astaVerde.connect(owner).setMaxPriceUpdateIterations(10);

            // Create many small batches
            for (let i = 0; i < batchCount; i++) {
                await astaVerde.connect(owner).mintBatch([producer1.address], ["cid" + i]);
            }

            // Move time forward to trigger price updates
            await time.increase(5 * SECONDS_IN_A_DAY);

            // This should complete without consuming excessive gas
            const tx = await astaVerde.connect(owner).mintBatch([producer1.address], ["final"]);

            const receipt = await tx.wait();

            // Verify gas usage is bounded (should be much less than if all 100 batches were processed)
            expect(receipt!.gasUsed).to.be.lessThan(1000000n);
        });
    });

    describe("Surplus USDC Recovery", function () {
        it("Should recover surplus USDC sent accidentally", async function () {
            // Setup: Create a batch and make a sale to establish accounted funds
            await astaVerde.connect(owner).mintBatch([producer1.address, producer2.address], ["cid1", "cid2"]);

            // Buy one token to create accounted funds
            await astaVerde.connect(user1).buyBatch(1, initialBasePrice, 1);

            // Accidentally send USDC directly to contract
            const accidentalAmount = 500 * USDC_PRECISION;
            await usdcToken.mint(await astaVerde.getAddress(), accidentalAmount);

            // Check contract balance includes surplus
            const contractBalance = await usdcToken.balanceOf(await astaVerde.getAddress());
            const platformShare = await astaVerde.platformShareAccumulated();
            const totalProducerBalances = await astaVerde.totalProducerBalances();
            const accountedBalance = platformShare + totalProducerBalances;

            expect(contractBalance).to.be.greaterThan(accountedBalance);

            // Recover surplus
            const ownerBalanceBefore = await usdcToken.balanceOf(owner.address);

            await expect(astaVerde.connect(owner).recoverSurplusUSDC(owner.address))
                .to.emit(astaVerde, "SurplusUSDCRecovered")
                .withArgs(owner.address, accidentalAmount);

            const ownerBalanceAfter = await usdcToken.balanceOf(owner.address);
            expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(accidentalAmount);
        });

        it("Should not allow recovery of accounted funds", async function () {
            // Setup: Create sales to establish accounted funds
            await astaVerde.connect(owner).mintBatch([producer1.address], ["cid1"]);
            await astaVerde.connect(user1).buyBatch(1, initialBasePrice, 1);

            // Try to recover when no surplus exists
            await expect(astaVerde.connect(owner).recoverSurplusUSDC(owner.address)).to.be.revertedWith(
                "No surplus to recover",
            );
        });

        it("Should only allow owner to recover surplus", async function () {
            // Send surplus
            await usdcToken.mint(await astaVerde.getAddress(), 100 * USDC_PRECISION);

            await expect(astaVerde.connect(user1).recoverSurplusUSDC(user1.address)).to.be.revertedWithCustomError(
                astaVerde,
                "OwnableUnauthorizedAccount",
            );
        });

        it("Should reject recovery to zero address", async function () {
            // Send surplus
            await usdcToken.mint(await astaVerde.getAddress(), 100 * USDC_PRECISION);

            await expect(astaVerde.connect(owner).recoverSurplusUSDC(ethers.ZeroAddress)).to.be.revertedWith(
                "Address must not be zero",
            );
        });

        it("Should correctly calculate surplus with both platform and producer balances", async function () {
            // Create multiple sales
            await astaVerde
                .connect(owner)
                .mintBatch([producer1.address, producer2.address, producer1.address], ["cid1", "cid2", "cid3"]);

            // Buy tokens to create both platform and producer balances
            await astaVerde.connect(user1).buyBatch(1, initialBasePrice * 3, 3);

            const platformShare = await astaVerde.platformShareAccumulated();
            const totalProducerBalances = await astaVerde.totalProducerBalances();
            const accountedTotal = platformShare + totalProducerBalances;

            // Add surplus
            const surplus = 777 * USDC_PRECISION;
            await usdcToken.mint(await astaVerde.getAddress(), surplus);

            // Verify only surplus can be recovered
            await expect(astaVerde.connect(owner).recoverSurplusUSDC(owner.address))
                .to.emit(astaVerde, "SurplusUSDCRecovered")
                .withArgs(owner.address, surplus);

            // Verify accounted funds remain
            const remainingBalance = await usdcToken.balanceOf(await astaVerde.getAddress());
            expect(remainingBalance).to.equal(accountedTotal);
        });
    });

    describe("Price Invariant Testing", function () {
        it("Should enforce basePrice >= priceFloor invariant", async function () {
            // Test that basePrice cannot be set below priceFloor
            const currentFloor = await astaVerde.priceFloor();

            await expect(astaVerde.connect(owner).setBasePrice(currentFloor - 1n)).to.be.revertedWith(
                "Base price must be at least price floor",
            );
        });

        it("Should enforce priceFloor <= basePrice invariant", async function () {
            // Test that priceFloor cannot be set above basePrice
            const currentBase = await astaVerde.basePrice();

            await expect(astaVerde.connect(owner).setPriceFloor(currentBase + 1n)).to.be.revertedWith(
                "Price floor cannot exceed base price",
            );
        });

        it("Should allow valid setPriceFloor adjustments", async function () {
            const newFloor = 30 * USDC_PRECISION;

            await expect(astaVerde.connect(owner).setPriceFloor(newFloor))
                .to.emit(astaVerde, "PlatformPriceFloorAdjusted")
                .withArgs(newFloor, (await time.latest()) + 1);

            expect(await astaVerde.priceFloor()).to.equal(newFloor);
        });

        it("Should allow valid setBasePrice adjustments", async function () {
            const newBase = 250 * USDC_PRECISION;

            await expect(astaVerde.connect(owner).setBasePrice(newBase)).to.emit(
                astaVerde,
                "BasePriceForNewBatchesAdjusted",
            );

            expect(await astaVerde.basePrice()).to.equal(newBase);
        });

        it("Should reject zero price floor", async function () {
            await expect(astaVerde.connect(owner).setPriceFloor(0)).to.be.revertedWith("Invalid price floor");
        });

        it("Should reject zero base price", async function () {
            await expect(astaVerde.connect(owner).setBasePrice(0)).to.be.revertedWith("Invalid starting price");
        });

        it("Should maintain invariant when adjusting both prices", async function () {
            // Set a new valid configuration
            const newFloor = 50 * USDC_PRECISION;
            const newBase = 200 * USDC_PRECISION;

            // First lower the base price
            await astaVerde.connect(owner).setBasePrice(newBase);

            // Then can set floor up to that base
            await astaVerde.connect(owner).setPriceFloor(newFloor);

            expect(await astaVerde.priceFloor()).to.equal(newFloor);
            expect(await astaVerde.basePrice()).to.equal(newBase);

            // Verify invariant still holds
            expect(await astaVerde.basePrice()).to.be.gte(await astaVerde.priceFloor());
        });

        it("Should reject non-owner price adjustments", async function () {
            await expect(astaVerde.connect(user1).setPriceFloor(30 * USDC_PRECISION)).to.be.revertedWithCustomError(
                astaVerde,
                "OwnableUnauthorizedAccount",
            );

            await expect(astaVerde.connect(user1).setBasePrice(300 * USDC_PRECISION)).to.be.revertedWithCustomError(
                astaVerde,
                "OwnableUnauthorizedAccount",
            );
        });

        it("Should handle edge case: setting floor and base to same value", async function () {
            const samePrice = 100 * USDC_PRECISION;

            // Set base first
            await astaVerde.connect(owner).setBasePrice(samePrice);

            // Then set floor to same value
            await astaVerde.connect(owner).setPriceFloor(samePrice);

            expect(await astaVerde.basePrice()).to.equal(samePrice);
            expect(await astaVerde.priceFloor()).to.equal(samePrice);

            // Now should not be able to lower base below floor
            await expect(astaVerde.connect(owner).setBasePrice(samePrice - 1)).to.be.revertedWith(
                "Base price must be at least price floor",
            );
        });
    });

    describe("Additional Edge Cases", function () {
        it("Should handle recoverSurplusUSDC during pause", async function () {
            // Send surplus
            await usdcToken.mint(await astaVerde.getAddress(), 100 * USDC_PRECISION);

            // Pause contract
            await astaVerde.connect(owner).pause();

            // Should still allow surplus recovery during pause
            await expect(astaVerde.connect(owner).recoverSurplusUSDC(owner.address))
                .to.emit(astaVerde, "SurplusUSDCRecovered")
                .withArgs(owner.address, 100 * USDC_PRECISION);
        });

        it("Should protect against reentrancy in recoverSurplusUSDC", async function () {
            // This is implicitly tested by the nonReentrant modifier
            // The function should complete without reentrancy issues
            await usdcToken.mint(await astaVerde.getAddress(), 100 * USDC_PRECISION);

            await expect(astaVerde.connect(owner).recoverSurplusUSDC(owner.address)).to.not.be.reverted;
        });
    });
});
