import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AstaVerde - Producer DoS Prevention", function () {
  let astaVerde: Contract;
  let mockUSDC: Contract;
  let maliciousReceiver: Contract;
  let owner: Signer;
  let buyer: Signer;
  let normalProducer: Signer;
  let producer2: Signer;
  let maliciousProducer: Signer;

  const INITIAL_USDC_BALANCE = ethers.parseUnits("10000", 6);
  const BASE_PRICE = ethers.parseUnits("230", 6);

  async function deployFixture() {
    [owner, buyer, normalProducer, producer2, maliciousProducer] = await ethers.getSigners();

    // Deploy Mock USDC (with unused initialSupply parameter for compatibility)
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy(0); // initialSupply is ignored but required

    // Deploy AstaVerde with updated pull payment pattern
    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    astaVerde = await AstaVerde.deploy(await owner.getAddress(), await mockUSDC.getAddress());

    // Deploy malicious producer contract that always reverts on token receipt
    const MaliciousProducer = await ethers.getContractFactory("MaliciousProducer");
    maliciousReceiver = await MaliciousProducer.deploy();

    // Fund buyer with USDC
    await mockUSDC.mint(await buyer.getAddress(), INITIAL_USDC_BALANCE);
    await mockUSDC.connect(buyer).approve(await astaVerde.getAddress(), ethers.MaxUint256);

    return { astaVerde, mockUSDC, maliciousReceiver, owner, buyer, normalProducer, producer2 };
  }

  describe("Producer Payment DoS Prevention", function () {
    it("Should NOT block sales when a producer is a malicious contract", async function () {
      const { astaVerde, mockUSDC, maliciousReceiver, owner, buyer, normalProducer } = await loadFixture(deployFixture);

      // Mint batch with malicious producer
      const producers = [
        await maliciousReceiver.getAddress(),
        await normalProducer.getAddress()
      ];
      const cids = ["QmTest1", "QmTest2"];
      
      await astaVerde.connect(owner).mintBatch(producers, cids);

      // Get batch price
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = batchPrice * 2n; // Buying 2 tokens

      // This should succeed with pull payment pattern (previously would fail)
      await expect(
        astaVerde.connect(buyer).buyBatch(1, totalCost, 2)
      ).to.emit(astaVerde, "ProducerPaymentAccrued");

      // Verify funds are accrued, not transferred
      const maliciousBalance = await astaVerde.producerBalances(await maliciousReceiver.getAddress());
      const normalBalance = await astaVerde.producerBalances(await normalProducer.getAddress());
      
      expect(maliciousBalance).to.be.gt(0);
      expect(normalBalance).to.be.gt(0);
    });

    it("Should allow producers to claim their accrued funds", async function () {
      const { astaVerde, mockUSDC, owner, buyer, normalProducer } = await loadFixture(deployFixture);

      // Mint and sell batch
      const producers = [await normalProducer.getAddress()];
      const cids = ["QmTest1"];
      
      await astaVerde.connect(owner).mintBatch(producers, cids);
      
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer).buyBatch(1, batchPrice, 1);

      // Check accrued balance
      const accruedBalance = await astaVerde.producerBalances(await normalProducer.getAddress());
      expect(accruedBalance).to.be.gt(0);

      // Producer claims funds
      const producerUSDCBefore = await mockUSDC.balanceOf(await normalProducer.getAddress());
      
      await expect(astaVerde.connect(normalProducer).claimProducerFunds())
        .to.emit(astaVerde, "ProducerPaymentClaimed")
        .withArgs(await normalProducer.getAddress(), accruedBalance);

      const producerUSDCAfter = await mockUSDC.balanceOf(await normalProducer.getAddress());
      expect(producerUSDCAfter - producerUSDCBefore).to.equal(accruedBalance);

      // Balance should be zero after claim
      expect(await astaVerde.producerBalances(await normalProducer.getAddress())).to.equal(0);
    });

    it("Should correctly track totalProducerBalances", async function () {
      const { astaVerde, owner, buyer, normalProducer, producer2 } = await loadFixture(deployFixture);

      // Mint batch with multiple producers
      const producers = [
        await normalProducer.getAddress(),
        await producer2.getAddress()
      ];
      const cids = ["QmTest1", "QmTest2"];
      
      await astaVerde.connect(owner).mintBatch(producers, cids);
      
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer).buyBatch(1, batchPrice * 2n, 2);

      // Check total producer balances
      const totalBalances = await astaVerde.totalProducerBalances();
      const platformShare = await astaVerde.platformSharePercentage();
      const expectedProducerShare = (batchPrice * 2n * (100n - platformShare)) / 100n;
      
      expect(totalBalances).to.equal(expectedProducerShare);

      // After one producer claims
      await astaVerde.connect(normalProducer).claimProducerFunds();
      const remainingTotal = await astaVerde.totalProducerBalances();
      expect(remainingTotal).to.be.lt(totalBalances);
    });

    it("Should prevent claiming with zero balance", async function () {
      const { astaVerde, normalProducer } = await loadFixture(deployFixture);

      await expect(
        astaVerde.connect(normalProducer).claimProducerFunds()
      ).to.be.revertedWith("No funds to claim");
    });

    it("Should correctly handle recoverSurplusUSDC with producer balances", async function () {
      const { astaVerde, mockUSDC, owner, buyer, normalProducer } = await loadFixture(deployFixture);

      // Mint and sell to create producer balance
      const producers = [await normalProducer.getAddress()];
      const cids = ["QmTest1"];
      
      await astaVerde.connect(owner).mintBatch(producers, cids);
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer).buyBatch(1, batchPrice, 1);

      // Send surplus USDC directly to contract
      const surplusAmount = ethers.parseUnits("100", 6);
      await mockUSDC.mint(await astaVerde.getAddress(), surplusAmount);

      // Should only recover the surplus, not producer balances
      const platformShare = await astaVerde.platformShareAccumulated();
      const producerBalances = await astaVerde.totalProducerBalances();
      
      await expect(
        astaVerde.connect(owner).recoverSurplusUSDC(await owner.getAddress())
      ).to.emit(astaVerde, "SurplusUSDCRecovered")
        .withArgs(await owner.getAddress(), surplusAmount);

      // Verify accounting remains intact
      expect(await astaVerde.platformShareAccumulated()).to.equal(platformShare);
      expect(await astaVerde.totalProducerBalances()).to.equal(producerBalances);
    });

    it("Should handle multiple sales to same producer correctly", async function () {
      const { astaVerde, owner, buyer, normalProducer } = await loadFixture(deployFixture);

      // Mint multiple batches with same producer
      const producers = [await normalProducer.getAddress()];
      const cids = ["QmTest1"];
      
      await astaVerde.connect(owner).mintBatch(producers, cids);
      await astaVerde.connect(owner).mintBatch(producers, cids);

      // Buy from both batches
      const batch1Price = await astaVerde.getCurrentBatchPrice(1);
      const batch2Price = await astaVerde.getCurrentBatchPrice(2);
      
      await astaVerde.connect(buyer).buyBatch(1, batch1Price, 1);
      await astaVerde.connect(buyer).buyBatch(2, batch2Price, 1);

      // Producer balance should be sum of both sales
      const producerBalance = await astaVerde.producerBalances(await normalProducer.getAddress());
      const platformShare = await astaVerde.platformSharePercentage();
      
      const expectedBalance1 = (batch1Price * (100n - platformShare)) / 100n;
      const expectedBalance2 = (batch2Price * (100n - platformShare)) / 100n;
      
      expect(producerBalance).to.equal(expectedBalance1 + expectedBalance2);
    });

    it("Should emit correct events for accrual and claiming", async function () {
      const { astaVerde, owner, buyer, normalProducer } = await loadFixture(deployFixture);

      // Setup
      const producers = [await normalProducer.getAddress()];
      const cids = ["QmTest1"];
      await astaVerde.connect(owner).mintBatch(producers, cids);
      
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      const platformShare = await astaVerde.platformSharePercentage();
      const expectedProducerAmount = (batchPrice * (100n - platformShare)) / 100n;

      // Check accrual event
      await expect(astaVerde.connect(buyer).buyBatch(1, batchPrice, 1))
        .to.emit(astaVerde, "ProducerPaymentAccrued")
        .withArgs(await normalProducer.getAddress(), expectedProducerAmount);

      // Check claim event
      await expect(astaVerde.connect(normalProducer).claimProducerFunds())
        .to.emit(astaVerde, "ProducerPaymentClaimed")
        .withArgs(await normalProducer.getAddress(), expectedProducerAmount);
    });

    it("Should maintain correct USDC balance invariant", async function () {
      const { astaVerde, mockUSDC, owner, buyer, normalProducer, producer2 } = await loadFixture(deployFixture);

      // Create complex scenario with multiple producers and sales
      const producers = [
        await normalProducer.getAddress(),
        await producer2.getAddress(),
        await normalProducer.getAddress() // Same producer twice
      ];
      const cids = ["QmTest1", "QmTest2", "QmTest3"];
      
      await astaVerde.connect(owner).mintBatch(producers, cids);
      
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer).buyBatch(1, batchPrice * 3n, 3);

      // Check invariant: contract balance >= platform + all producer balances
      const contractBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());
      const platformAccumulated = await astaVerde.platformShareAccumulated();
      const totalProducerBalances = await astaVerde.totalProducerBalances();
      
      expect(contractBalance).to.equal(platformAccumulated + totalProducerBalances);

      // After partial claims, invariant should still hold
      await astaVerde.connect(normalProducer).claimProducerFunds();
      
      const newContractBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());
      const newPlatformAccumulated = await astaVerde.platformShareAccumulated();
      const newTotalProducerBalances = await astaVerde.totalProducerBalances();
      
      expect(newContractBalance).to.equal(newPlatformAccumulated + newTotalProducerBalances);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle producer being the buyer", async function () {
      const { astaVerde, mockUSDC, owner, normalProducer } = await loadFixture(deployFixture);

      // Producer is also the buyer
      await mockUSDC.mint(await normalProducer.getAddress(), INITIAL_USDC_BALANCE);
      await mockUSDC.connect(normalProducer).approve(await astaVerde.getAddress(), ethers.MaxUint256);

      const producers = [await normalProducer.getAddress()];
      const cids = ["QmTest1"];
      
      await astaVerde.connect(owner).mintBatch(producers, cids);
      
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(normalProducer).buyBatch(1, batchPrice, 1);

      // Producer can claim their own payment
      const accruedBalance = await astaVerde.producerBalances(await normalProducer.getAddress());
      expect(accruedBalance).to.be.gt(0);
      
      await expect(astaVerde.connect(normalProducer).claimProducerFunds())
        .to.not.be.reverted;
    });

    it("Should handle zero-address producer rejection at mint", async function () {
      const { astaVerde, owner } = await loadFixture(deployFixture);

      const producers = [ethers.ZeroAddress];
      const cids = ["QmTest1"];
      
      await expect(
        astaVerde.connect(owner).mintBatch(producers, cids)
      ).to.be.revertedWith("Invalid producer address");
    });
  });
});