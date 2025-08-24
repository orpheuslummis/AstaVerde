import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AstaVerde, MockUSDC } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("AstaVerde V2 Specific Tests", function () {
  let astaVerde: AstaVerde;
  let usdc: MockUSDC;
  let owner: SignerWithAddress;
  let buyer: SignerWithAddress;
  let producer1: SignerWithAddress;
  let producer2: SignerWithAddress;
  let vault: SignerWithAddress;

  const USDC_PRECISION = 1_000_000n;
  const BASE_PRICE = 230n * USDC_PRECISION;
  const PRICE_FLOOR = 40n * USDC_PRECISION;
  const DAILY_DECAY = 1n * USDC_PRECISION;

  beforeEach(async function () {
    [owner, buyer, producer1, producer2, vault] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy(0); // MockUSDC requires initial supply parameter (ignored)

    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    astaVerde = await AstaVerde.deploy(owner.address, await usdc.getAddress());

    // Fund buyer with USDC
    await usdc.mint(buyer.address, 10000n * USDC_PRECISION);
    await usdc.connect(buyer).approve(await astaVerde.getAddress(), ethers.MaxUint256);
  });

  describe("Price Decay Underflow Protection", function () {
    it("should return price floor instead of reverting when decay exceeds starting price", async function () {
      // Mint a batch
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);

      // Advance time by 300 days (decay would be 300 USDC, exceeding 230 starting price)
      await time.increase(300 * 86400);

      // Should not revert, should return price floor
      const price = await astaVerde.getCurrentBatchPrice(1);
      expect(price).to.equal(PRICE_FLOOR);
    });

    it("should handle exact boundary where decay equals starting price", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      
      // Advance exactly 230 days (decay = 230 USDC = starting price)
      await time.increase(230 * 86400);
      
      const price = await astaVerde.getCurrentBatchPrice(1);
      expect(price).to.equal(PRICE_FLOOR);
    });
  });

  describe("Refund Siphon Fix", function () {
    it("should correctly refund excess payment", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      
      const price = await astaVerde.getCurrentBatchPrice(1);
      const excessAmount = price + (100n * USDC_PRECISION);
      
      const buyerBalanceBefore = await usdc.balanceOf(buyer.address);
      
      await astaVerde.connect(buyer).buyBatch(1, excessAmount, 1);
      
      const buyerBalanceAfter = await usdc.balanceOf(buyer.address);
      const spent = buyerBalanceBefore - buyerBalanceAfter;
      
      expect(spent).to.equal(price);
    });

    it("should handle exact payment amount", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      
      const price = await astaVerde.getCurrentBatchPrice(1);
      
      await expect(
        astaVerde.connect(buyer).buyBatch(1, price, 1)
      ).to.not.be.reverted;
    });

    it("should revert with insufficient payment", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      
      const price = await astaVerde.getCurrentBatchPrice(1);
      const insufficientAmount = price - 1n;
      
      await expect(
        astaVerde.connect(buyer).buyBatch(1, insufficientAmount, 1)
      ).to.be.revertedWith("Insufficient funds sent");
    });
  });

  /* VAULT TESTS REMOVED - replaced with emergencyRescue
  describe("Trusted Vault During Pause - REMOVED", function () {
    // Tests removed - vault mechanism replaced with emergencyRescue
  });
  */

  describe("Iteration Limit for DoS Protection", function () {
    it("should emit event when iteration limit is reached", async function () {
      // Create many batches
      for (let i = 0; i < 105; i++) {
        await astaVerde.mintBatch([producer1.address], [`QmTest${i}`]);
      }
      
      // Advance time to trigger price decrease check
      await time.increase(5 * 86400);
      
      // Next mint should trigger updateBasePrice with iteration limit
      await expect(
        astaVerde.mintBatch([producer1.address], ["QmTestNew"])
      ).to.emit(astaVerde, "PriceUpdateIterationLimitReached")
        .withArgs(100, 105); // 100 iterations processed, 105 total batches (before the new mint)
    });

    it("should allow configuring max price update iterations", async function () {
      // Should reject values outside bounds
      await expect(
        astaVerde.setMaxPriceUpdateIterations(0)
      ).to.be.revertedWith("Iteration limit must be between 1 and 1000");
      
      await expect(
        astaVerde.setMaxPriceUpdateIterations(1001)
      ).to.be.revertedWith("Iteration limit must be between 1 and 1000");
      
      // Should accept valid values and emit event
      await expect(
        astaVerde.setMaxPriceUpdateIterations(50)
      ).to.emit(astaVerde, "MaxPriceUpdateIterationsSet")
        .withArgs(50);
      
      // Verify the change took effect by creating batches and checking iteration limit
      for (let i = 0; i < 55; i++) {
        await astaVerde.mintBatch([producer1.address], [`QmTest${i}`]);
      }
      
      await time.increase(5 * 86400);
      
      await expect(
        astaVerde.mintBatch([producer1.address], ["QmTestNew"])
      ).to.emit(astaVerde, "PriceUpdateIterationLimitReached")
        .withArgs(50, 55); // Now limited to 50 iterations
    });
  });

  describe("Economic Changes", function () {
    it("should enforce 50% platform share cap", async function () {
      await expect(
        astaVerde.setPlatformSharePercentage(51)
      ).to.be.revertedWith("Platform share cannot exceed 50%");
      
      await expect(
        astaVerde.setPlatformSharePercentage(50)
      ).to.not.be.reverted;
    });

    it("should distribute rounding remainder to first producer", async function () {
      // Set platform share to create rounding scenario
      await astaVerde.setPlatformSharePercentage(33);
      
      // Mint batch with multiple producers
      await astaVerde.mintBatch(
        [producer1.address, producer2.address, producer1.address],
        ["QmTest1", "QmTest2", "QmTest3"]
      );
      
      const price = await astaVerde.getCurrentBatchPrice(1);
      const totalPrice = price * 3n;
      const platformShare = (totalPrice * 33n) / 100n;
      const producerShare = totalPrice - platformShare;
      
      // Execute purchase - funds are now accrued, not transferred directly
      await astaVerde.connect(buyer).buyBatch(1, totalPrice, 3);
      
      // Check accrued balances (pull payment pattern)
      const producer1Accrued = await astaVerde.producerBalances(producer1.address);
      const producer2Accrued = await astaVerde.producerBalances(producer2.address);
      
      // Verify total distribution
      expect(producer1Accrued + producer2Accrued).to.equal(producerShare);
      
      // Producer1 should get 2/3 of base amount plus any remainder
      const perToken = producerShare / 3n;
      const remainder = producerShare % 3n;
      expect(producer1Accrued).to.equal(perToken * 2n + remainder);
      expect(producer2Accrued).to.equal(perToken);
      
      // Now verify claims work correctly
      const producer1Before = await usdc.balanceOf(producer1.address);
      const producer2Before = await usdc.balanceOf(producer2.address);
      
      await astaVerde.connect(producer1).claimProducerFunds();
      await astaVerde.connect(producer2).claimProducerFunds();
      
      const producer1After = await usdc.balanceOf(producer1.address);
      const producer2After = await usdc.balanceOf(producer2.address);
      
      expect(producer1After - producer1Before).to.equal(producer1Accrued);
      expect(producer2After - producer2Before).to.equal(producer2Accrued);
    });
  });

  describe("Additional Validations", function () {
    it("should reject zero address producers", async function () {
      await expect(
        astaVerde.mintBatch([ethers.ZeroAddress], ["QmTest1"])
      ).to.be.revertedWith("Invalid producer address");
    });

    it("should reject CIDs longer than MAX_CID_LENGTH", async function () {
      const longCID = "Qm" + "x".repeat(99); // 101 characters total
      await expect(
        astaVerde.mintBatch([producer1.address], [longCID])
      ).to.be.revertedWith("CID too long");
      
      // Exactly 100 characters should work
      const maxCID = "Qm" + "x".repeat(98); // 100 characters total
      await expect(
        astaVerde.mintBatch([producer1.address], [maxCID])
      ).to.not.be.reverted;
      
      // 99 characters should also work
      const shortCID = "Qm" + "x".repeat(97); // 99 characters total  
      await expect(
        astaVerde.mintBatch([producer1.address], [shortCID])
      ).to.not.be.reverted;
    });

    it("should validate all CIDs in batch", async function () {
      const validCID = "QmValidCID";
      const longCID = "Qm" + "x".repeat(99); // 101 characters
      
      // Should fail if any CID is too long
      await expect(
        astaVerde.mintBatch(
          [producer1.address, producer2.address],
          [validCID, longCID]
        )
      ).to.be.revertedWith("CID too long");
      
      // Should succeed if all CIDs are valid length
      await expect(
        astaVerde.mintBatch(
          [producer1.address, producer2.address],
          [validCID, validCID]
        )
      ).to.not.be.reverted;
    });

    it("should validate token existence in redeem", async function () {
      await expect(
        astaVerde.connect(buyer).redeemToken(999)
      ).to.be.revertedWith("Token does not exist");
    });

    it("should prevent returning tokens to contract and skip redeemed tokens", async function () {
      // Mint batch with 3 tokens
      await astaVerde.mintBatch(
        [producer1.address, producer1.address, producer1.address],
        ["QmTest1", "QmTest2", "QmTest3"]
      );
      
      // Buy and redeem the first token
      await astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1);
      const tokenId = 1; // First token in batch
      await astaVerde.connect(buyer).redeemToken(tokenId);
      
      // Verify that returning tokens to contract is prevented (security feature)
      await expect(
        astaVerde.connect(buyer).safeTransferFrom(
          buyer.address,
          await astaVerde.getAddress(),
          tokenId,
          1,
          "0x"
        )
      ).to.be.revertedWith("No external returns");
      
      // Buy remaining tokens - they will be tokens 2 and 3
      await astaVerde.connect(buyer).buyBatch(1, BASE_PRICE * 2n, 2);
      
      // Verify buyer got tokens 2 and 3
      expect(await astaVerde.balanceOf(buyer.address, 2)).to.equal(1);
      expect(await astaVerde.balanceOf(buyer.address, 3)).to.equal(1);
      
      // The redeemed token 1 remains with the original buyer (can't be returned)
      expect(await astaVerde.balanceOf(buyer.address, 1)).to.equal(1);
    });

    it("should enforce max batch size of 100", async function () {
      const producers = Array(101).fill(producer1.address);
      const cids = Array(101).fill("QmTest");
      
      await expect(
        astaVerde.mintBatch(producers, cids)
      ).to.be.revertedWith("Batch size exceeds max batch size");
      
      // 100 should work
      // Set max batch size first
      await astaVerde.setMaxBatchSize(100);
      await expect(
        astaVerde.mintBatch(producers.slice(0, 100), cids.slice(0, 100))
      ).to.not.be.reverted;
    });
  });
});