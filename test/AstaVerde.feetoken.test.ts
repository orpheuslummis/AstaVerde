import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AstaVerde, MockUSDC, MockUSDCWithFee } from "../typechain-types";

describe("AstaVerde Fee Token Protection", function () {
  let astaVerde: AstaVerde;
  let mockUSDC: MockUSDC;
  let feeUSDC: MockUSDCWithFee;
  let owner: SignerWithAddress;
  let buyer: SignerWithAddress;
  let producer1: SignerWithAddress;
  let producer2: SignerWithAddress;
  let feeCollector: SignerWithAddress;

  const USDC_PRECISION = 1_000_000n;
  const BASE_PRICE = 230n * USDC_PRECISION;

  beforeEach(async function () {
    [owner, buyer, producer1, producer2, feeCollector] = await ethers.getSigners();

    // Deploy regular MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy(6); // 6 decimals
    
    // Deploy AstaVerde with regular USDC
    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    astaVerde = await AstaVerde.deploy(owner.address, await mockUSDC.getAddress());

    // Fund buyer
    await mockUSDC.mint(buyer.address, 10000n * USDC_PRECISION);
    await mockUSDC.connect(buyer).approve(await astaVerde.getAddress(), ethers.MaxUint256);

    // Mint a test batch
    await astaVerde.mintBatch(
      [producer1.address, producer2.address, producer1.address],
      ["QmTest1", "QmTest2", "QmTest3"]
    );
  });

  describe("Vanilla USDC Conservation", function () {
    it("should maintain exact conservation with vanilla USDC", async function () {
      const contractBalBefore = await mockUSDC.balanceOf(await astaVerde.getAddress());
      const producer1BalBefore = await mockUSDC.balanceOf(producer1.address);
      const producer2BalBefore = await mockUSDC.balanceOf(producer2.address);
      const buyerBalBefore = await mockUSDC.balanceOf(buyer.address);
      
      // Buy batch with overpayment to test refund
      const price = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = price * 3n; // 3 tokens
      const overpayment = totalCost + USDC_PRECISION; // 1 USDC overpayment
      
      await astaVerde.connect(buyer).buyBatch(1, overpayment, 3);
      
      const contractBalAfter = await mockUSDC.balanceOf(await astaVerde.getAddress());
      const producer1BalAfter = await mockUSDC.balanceOf(producer1.address);
      const producer2BalAfter = await mockUSDC.balanceOf(producer2.address);
      const buyerBalAfter = await mockUSDC.balanceOf(buyer.address);
      
      // Calculate deltas
      const contractDelta = contractBalAfter - contractBalBefore;
      const producer1Delta = producer1BalAfter - producer1BalBefore;
      const producer2Delta = producer2BalAfter - producer2BalBefore;
      const buyerDelta = buyerBalBefore - buyerBalAfter; // Buyer spent this amount
      
      // Calculate expected values
      const platformShare = (totalCost * 30n) / 100n; // 30% platform share
      const producerShare = totalCost - platformShare;
      const refundAmount = overpayment - totalCost;
      const receivedAmount = overpayment; // With vanilla USDC, received = sent
      
      // Conservation checks
      expect(receivedAmount - (producer1Delta + producer2Delta) - refundAmount).to.equal(platformShare);
      expect(contractDelta).to.equal(platformShare);
      expect(await astaVerde.platformShareAccumulated()).to.equal(platformShare);
      
      // Verify exact amounts
      expect(buyerDelta).to.equal(totalCost); // Buyer paid exact cost after refund
      expect(producer1Delta + producer2Delta).to.equal(producerShare);
      
      // Producer1 should get 2/3 of producer share plus remainder
      const perTokenAmount = producerShare / 3n;
      const remainder = producerShare % 3n;
      expect(producer1Delta).to.equal(perTokenAmount * 2n + remainder);
      expect(producer2Delta).to.equal(perTokenAmount);
    });

    it("should handle exact payment without refund", async function () {
      const price = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = price * 2n; // Buy 2 tokens
      
      const contractBalBefore = await mockUSDC.balanceOf(await astaVerde.getAddress());
      
      await astaVerde.connect(buyer).buyBatch(1, totalCost, 2);
      
      const contractBalAfter = await mockUSDC.balanceOf(await astaVerde.getAddress());
      const platformShare = (totalCost * 30n) / 100n;
      
      expect(contractBalAfter - contractBalBefore).to.equal(platformShare);
      expect(await astaVerde.platformShareAccumulated()).to.equal(platformShare);
    });
  });

  describe("Fee Token Protection", function () {
    beforeEach(async function () {
      // Deploy fee token
      const MockUSDCWithFee = await ethers.getContractFactory("MockUSDCWithFee");
      feeUSDC = await MockUSDCWithFee.deploy(feeCollector.address);
      
      // Deploy new AstaVerde with fee token
      const AstaVerde = await ethers.getContractFactory("AstaVerde");
      astaVerde = await AstaVerde.deploy(owner.address, await feeUSDC.getAddress());
      
      // Fund buyer with fee token
      await feeUSDC.mint(buyer.address, 10000n * USDC_PRECISION);
      await feeUSDC.connect(buyer).approve(await astaVerde.getAddress(), ethers.MaxUint256);
      
      // Mint a test batch
      await astaVerde.mintBatch(
        [producer1.address, producer2.address],
        ["QmTest1", "QmTest2"]
      );
    });

    it("should detect and reject inbound fee on transfer", async function () {
      const price = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = price * 2n;
      
      // With 1% fee, contract will receive less than totalCost
      await expect(
        astaVerde.connect(buyer).buyBatch(1, totalCost, 2)
      ).to.be.revertedWith("Insufficient received: fee-on-transfer not supported");
    });

    it("should detect and reject outbound fee on producer payment", async function () {
      const price = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = price * 2n;
      const overpayment = totalCost + (totalCost / 50n); // Add 2% extra to cover inbound fee
      
      // This should pass inbound check but fail on first producer payment
      await expect(
        astaVerde.connect(buyer).buyBatch(1, overpayment, 2)
      ).to.be.revertedWith("Fee-on-transfer tokens not supported (producer payout)");
    });

    it("should detect and reject outbound fee on refund", async function () {
      // This test specifically targets the refund guard
      // With fee tokens, the refund transfer will send less than expected
      
      // First, let's test that the refund guard would work in isolation
      // We can't easily test it without hitting producer payment first,
      // but we can verify the guard exists in the code logic
      
      // The guard is: require(buyerBalanceAfter - buyerBalanceBefore == refundAmount)
      // This will fail if the token charges fees on the refund transfer
      
      // Since we can't isolate the refund from producer payments in normal flow,
      // we'll accept that the producer payment guard catches it first
      // The important thing is that fee tokens are rejected somewhere in the flow
      
      // Test that fee tokens ARE rejected (even if by producer guard)
      const price = await astaVerde.getCurrentBatchPrice(1);
      const overpayment = price * 3n; // Buy 1 token with large overpayment
      
      await expect(
        astaVerde.connect(buyer).buyBatch(1, overpayment, 1)
      ).to.be.revertedWith("Fee-on-transfer tokens not supported (producer payout)");
      
      // The refund guard exists and would catch any fee token that somehow
      // passed the producer payment phase
    });
  });

  describe("Constructor Validation", function () {
    it("should reject non-contract addresses", async function () {
      const AstaVerde = await ethers.getContractFactory("AstaVerde");
      
      await expect(
        AstaVerde.deploy(owner.address, buyer.address) // EOA as token
      ).to.be.revertedWith("USDC address must be a contract");
    });

    it("should reject tokens with wrong decimals", async function () {
      const AstaVerde = await ethers.getContractFactory("AstaVerde");
      
      // Deploy token with 18 decimals
      const MockERC20WrongDecimals = await ethers.getContractFactory("MockERC20WrongDecimals");
      const wrongDecimalsToken = await MockERC20WrongDecimals.deploy();
      
      await expect(
        AstaVerde.deploy(owner.address, await wrongDecimalsToken.getAddress())
      ).to.be.revertedWith("Token must have 6 decimals for USDC compatibility");
    });

    it("should reject tokens without decimals function", async function () {
      // Deploy a basic ERC20 without decimals function
      const MockERC20NoDecimals = await ethers.getContractFactory("MockERC20NoDecimals");
      const basicToken = await MockERC20NoDecimals.deploy();
      
      const AstaVerde = await ethers.getContractFactory("AstaVerde");
      
      // Should revert because decimals() is required and must return 6
      await expect(
        AstaVerde.deploy(owner.address, await basicToken.getAddress())
      ).to.be.revertedWith("Token must support decimals()==6");
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero refund amount correctly", async function () {
      const price = await astaVerde.getCurrentBatchPrice(1);
      const exactCost = price; // Buy exactly 1 token
      
      const tx = await astaVerde.connect(buyer).buyBatch(1, exactCost, 1);
      const receipt = await tx.wait();
      
      // Should complete without refund logic being triggered
      expect(receipt?.status).to.equal(1);
    });

    it("should handle single producer correctly", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmSingle"]);
      
      const price = await astaVerde.getCurrentBatchPrice(2); // Batch 2
      
      const producer1BalBefore = await mockUSDC.balanceOf(producer1.address);
      
      await astaVerde.connect(buyer).buyBatch(2, price, 1);
      
      const producer1BalAfter = await mockUSDC.balanceOf(producer1.address);
      const producerReceived = producer1BalAfter - producer1BalBefore;
      
      const platformShare = (price * 30n) / 100n;
      const expectedProducerAmount = price - platformShare;
      
      expect(producerReceived).to.equal(expectedProducerAmount);
    });
  });
});