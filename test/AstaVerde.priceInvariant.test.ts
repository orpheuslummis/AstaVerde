import { expect } from "chai";
import { ethers } from "hardhat";
import { AstaVerde, MockUSDC } from "../types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AstaVerde Price Invariant Tests", function () {
  let astaVerde: AstaVerde;
  let mockUSDC: MockUSDC;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  
  const USDC_PRECISION = 1_000_000n;
  const INITIAL_BASE_PRICE = 230n * USDC_PRECISION;
  const INITIAL_PRICE_FLOOR = 40n * USDC_PRECISION;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy(ethers.parseUnits("1000000", 6)); // 1M USDC
    await mockUSDC.waitForDeployment();

    // Deploy AstaVerde
    const AstaVerdeFactory = await ethers.getContractFactory("AstaVerde");
    astaVerde = await AstaVerdeFactory.deploy(owner.address, await mockUSDC.getAddress());
    await astaVerde.waitForDeployment();
  });

  describe("Price Invariant: basePrice >= priceFloor", function () {
    it("Should have valid initial prices", async function () {
      const basePrice = await astaVerde.basePrice();
      const priceFloor = await astaVerde.priceFloor();
      
      expect(basePrice).to.equal(INITIAL_BASE_PRICE);
      expect(priceFloor).to.equal(INITIAL_PRICE_FLOOR);
      expect(basePrice).to.be.gte(priceFloor);
    });

    describe("setPriceFloor validation", function () {
      it("Should allow setting price floor below base price", async function () {
        const newFloor = 200n * USDC_PRECISION;
        await expect(astaVerde.setPriceFloor(newFloor))
          .to.emit(astaVerde, "PlatformPriceFloorAdjusted")
          .withArgs(newFloor, await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1));
        
        expect(await astaVerde.priceFloor()).to.equal(newFloor);
      });

      it("Should allow setting price floor equal to base price", async function () {
        const newFloor = INITIAL_BASE_PRICE; // Equal to base price
        await expect(astaVerde.setPriceFloor(newFloor))
          .to.emit(astaVerde, "PlatformPriceFloorAdjusted");
        
        expect(await astaVerde.priceFloor()).to.equal(newFloor);
      });

      it("Should revert when setting price floor above base price", async function () {
        const newFloor = 250n * USDC_PRECISION; // Above initial base price of 230
        await expect(astaVerde.setPriceFloor(newFloor))
          .to.be.revertedWith("Price floor cannot exceed base price");
      });

      it("Should revert when setting price floor to zero", async function () {
        await expect(astaVerde.setPriceFloor(0))
          .to.be.revertedWith("Invalid price floor");
      });
    });

    describe("setBasePrice validation", function () {
      it("Should allow setting base price above price floor", async function () {
        const newBase = 300n * USDC_PRECISION;
        await expect(astaVerde.setBasePrice(newBase))
          .to.emit(astaVerde, "BasePriceForNewBatchesAdjusted")
          .withArgs(newBase, await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1), 0, 0);
        
        expect(await astaVerde.basePrice()).to.equal(newBase);
      });

      it("Should allow setting base price equal to price floor", async function () {
        const newBase = INITIAL_PRICE_FLOOR; // Equal to price floor
        await expect(astaVerde.setBasePrice(newBase))
          .to.emit(astaVerde, "BasePriceForNewBatchesAdjusted");
        
        expect(await astaVerde.basePrice()).to.equal(newBase);
      });

      it("Should revert when setting base price below price floor", async function () {
        const newBase = 30n * USDC_PRECISION; // Below initial floor of 40
        await expect(astaVerde.setBasePrice(newBase))
          .to.be.revertedWith("Base price must be at least price floor");
      });

      it("Should revert when setting base price to zero", async function () {
        await expect(astaVerde.setBasePrice(0))
          .to.be.revertedWith("Invalid starting price");
      });
    });

    describe("Proper ordering for price changes", function () {
      it("Should allow lowering floor then lowering base", async function () {
        // Lower floor first
        const newFloor = 20n * USDC_PRECISION;
        await astaVerde.setPriceFloor(newFloor);
        
        // Then lower base
        const newBase = 25n * USDC_PRECISION;
        await astaVerde.setBasePrice(newBase);
        
        expect(await astaVerde.priceFloor()).to.equal(newFloor);
        expect(await astaVerde.basePrice()).to.equal(newBase);
        expect(await astaVerde.basePrice()).to.be.gte(await astaVerde.priceFloor());
      });

      it("Should allow raising base then raising floor", async function () {
        // Raise base first
        const newBase = 400n * USDC_PRECISION;
        await astaVerde.setBasePrice(newBase);
        
        // Then raise floor
        const newFloor = 350n * USDC_PRECISION;
        await astaVerde.setPriceFloor(newFloor);
        
        expect(await astaVerde.basePrice()).to.equal(newBase);
        expect(await astaVerde.priceFloor()).to.equal(newFloor);
        expect(await astaVerde.basePrice()).to.be.gte(await astaVerde.priceFloor());
      });

      it("Should handle complex price adjustments maintaining invariant", async function () {
        // Start: base=230, floor=40
        
        // Set both to middle value
        await astaVerde.setBasePrice(150n * USDC_PRECISION);
        await astaVerde.setPriceFloor(150n * USDC_PRECISION);
        
        // Lower floor
        await astaVerde.setPriceFloor(100n * USDC_PRECISION);
        
        // Raise base
        await astaVerde.setBasePrice(200n * USDC_PRECISION);
        
        // Try invalid operations
        await expect(astaVerde.setPriceFloor(250n * USDC_PRECISION))
          .to.be.revertedWith("Price floor cannot exceed base price");
        
        await expect(astaVerde.setBasePrice(50n * USDC_PRECISION))
          .to.be.revertedWith("Base price must be at least price floor");
        
        // Final state should maintain invariant
        const finalBase = await astaVerde.basePrice();
        const finalFloor = await astaVerde.priceFloor();
        expect(finalBase).to.be.gte(finalFloor);
      });
    });

    describe("Non-owner restrictions", function () {
      it("Should not allow non-owner to set price floor", async function () {
        await expect(astaVerde.connect(addr1).setPriceFloor(50n * USDC_PRECISION))
          .to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount");
      });

      it("Should not allow non-owner to set base price", async function () {
        await expect(astaVerde.connect(addr1).setBasePrice(250n * USDC_PRECISION))
          .to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount");
      });
    });
  });
});