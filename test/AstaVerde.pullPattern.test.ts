import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("AstaVerde - Pull Payment Pattern Comprehensive Tests", function () {
  let astaVerde: Contract;
  let mockUSDC: Contract;
  let owner: Signer;
  let buyer1: Signer;
  let buyer2: Signer;
  let producer1: Signer;
  let producer2: Signer;
  let producer3: Signer;
  let platformReceiver: Signer;

  const INITIAL_USDC_BALANCE = ethers.parseUnits("10000", 6);
  const BASE_PRICE = ethers.parseUnits("230", 6);
  const PLATFORM_SHARE_PERCENTAGE = 30n;

  async function deployFixture() {
    [owner, buyer1, buyer2, producer1, producer2, producer3, platformReceiver] = await ethers.getSigners();

    // Deploy Mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy(0);

    // Deploy AstaVerde
    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    astaVerde = await AstaVerde.deploy(await owner.getAddress(), await mockUSDC.getAddress());

    // Fund buyers
    await mockUSDC.mint(await buyer1.getAddress(), INITIAL_USDC_BALANCE);
    await mockUSDC.mint(await buyer2.getAddress(), INITIAL_USDC_BALANCE);
    await mockUSDC.connect(buyer1).approve(await astaVerde.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(buyer2).approve(await astaVerde.getAddress(), ethers.MaxUint256);

    return { astaVerde, mockUSDC, owner, buyer1, buyer2, producer1, producer2, producer3, platformReceiver };
  }

  describe("Pull Pattern Core Functionality", function () {
    it("Should accumulate payments for producers instead of direct transfer", async function () {
      const { astaVerde, mockUSDC, owner, buyer1, producer1 } = await loadFixture(deployFixture);

      // Initial producer USDC balance should be 0
      expect(await mockUSDC.balanceOf(await producer1.getAddress())).to.equal(0);

      // Mint and sell
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest1"]);
      const price = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer1).buyBatch(1, price, 1);

      // Producer should NOT have received USDC directly
      expect(await mockUSDC.balanceOf(await producer1.getAddress())).to.equal(0);

      // But should have accrued balance
      const expectedProducerAmount = (price * (100n - PLATFORM_SHARE_PERCENTAGE)) / 100n;
      expect(await astaVerde.producerBalances(await producer1.getAddress())).to.equal(expectedProducerAmount);
    });

    it("Should allow producers to claim accumulated payments", async function () {
      const { astaVerde, mockUSDC, owner, buyer1, producer1 } = await loadFixture(deployFixture);

      // Setup: mint and sell
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest1"]);
      const price = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer1).buyBatch(1, price, 1);

      const accruedBalance = await astaVerde.producerBalances(await producer1.getAddress());
      
      // Claim
      await expect(astaVerde.connect(producer1).claimProducerFunds())
        .to.changeTokenBalance(mockUSDC, producer1, accruedBalance);

      // Balance should be zero after claim
      expect(await astaVerde.producerBalances(await producer1.getAddress())).to.equal(0);
    });

    it("Should prevent double claiming", async function () {
      const { astaVerde, owner, buyer1, producer1 } = await loadFixture(deployFixture);

      // Setup and claim once
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest1"]);
      const price = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer1).buyBatch(1, price, 1);
      await astaVerde.connect(producer1).claimProducerFunds();

      // Second claim should fail
      await expect(astaVerde.connect(producer1).claimProducerFunds())
        .to.be.revertedWith("No funds to claim");
    });
  });

  describe("Payment Accumulation Across Multiple Sales", function () {
    it("Should accumulate payments from multiple batches", async function () {
      const { astaVerde, owner, buyer1, buyer2, producer1 } = await loadFixture(deployFixture);

      // Create and sell multiple batches
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest1"]);
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest2"]);
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest3"]);

      const price1 = await astaVerde.getCurrentBatchPrice(1);
      const price2 = await astaVerde.getCurrentBatchPrice(2);
      const price3 = await astaVerde.getCurrentBatchPrice(3);

      await astaVerde.connect(buyer1).buyBatch(1, price1, 1);
      await astaVerde.connect(buyer2).buyBatch(2, price2, 1);
      await astaVerde.connect(buyer1).buyBatch(3, price3, 1);

      // Calculate expected total
      const expected1 = (price1 * (100n - PLATFORM_SHARE_PERCENTAGE)) / 100n;
      const expected2 = (price2 * (100n - PLATFORM_SHARE_PERCENTAGE)) / 100n;
      const expected3 = (price3 * (100n - PLATFORM_SHARE_PERCENTAGE)) / 100n;
      const expectedTotal = expected1 + expected2 + expected3;

      expect(await astaVerde.producerBalances(await producer1.getAddress())).to.equal(expectedTotal);

      // Single claim should get all accumulated funds
      await expect(astaVerde.connect(producer1).claimProducerFunds())
        .to.changeTokenBalance(mockUSDC, producer1, expectedTotal);
    });

    it("Should handle partial batch sales correctly", async function () {
      const { astaVerde, owner, buyer1, buyer2, producer1, producer2 } = await loadFixture(deployFixture);

      // Mint batch with multiple tokens from different producers
      const producers = [
        await producer1.getAddress(),
        await producer2.getAddress(),
        await producer1.getAddress(),
        await producer2.getAddress()
      ];
      const cids = ["QmTest1", "QmTest2", "QmTest3", "QmTest4"];
      
      await astaVerde.connect(owner).mintBatch(producers, cids);

      const price = await astaVerde.getCurrentBatchPrice(1);

      // Buy 2 tokens (partial batch)
      await astaVerde.connect(buyer1).buyBatch(1, price * 2n, 2);

      // Both producers should have accrued payments
      const producer1Balance = await astaVerde.producerBalances(await producer1.getAddress());
      const producer2Balance = await astaVerde.producerBalances(await producer2.getAddress());

      expect(producer1Balance).to.be.gt(0);
      expect(producer2Balance).to.be.gt(0);

      // Buy remaining 2 tokens
      await astaVerde.connect(buyer2).buyBatch(1, price * 2n, 2);

      // Balances should have increased
      expect(await astaVerde.producerBalances(await producer1.getAddress())).to.be.gt(producer1Balance);
      expect(await astaVerde.producerBalances(await producer2.getAddress())).to.be.gt(producer2Balance);
    });
  });

  describe("Complex Multi-Producer Scenarios", function () {
    it("Should correctly distribute payments among multiple producers in one batch", async function () {
      const { astaVerde, owner, buyer1, producer1, producer2, producer3 } = await loadFixture(deployFixture);

      const producers = [
        await producer1.getAddress(),
        await producer2.getAddress(),
        await producer3.getAddress(),
        await producer1.getAddress() // Producer1 has 2 tokens
      ];
      const cids = ["QmTest1", "QmTest2", "QmTest3", "QmTest4"];
      
      await astaVerde.connect(owner).mintBatch(producers, cids);

      const price = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = price * 4n;
      await astaVerde.connect(buyer1).buyBatch(1, totalCost, 4);

      const totalProducerShare = (totalCost * (100n - PLATFORM_SHARE_PERCENTAGE)) / 100n;
      const perTokenAmount = totalProducerShare / 4n;
      const remainder = totalProducerShare % 4n;

      // Producer1 gets 2 tokens worth + remainder (first producer)
      expect(await astaVerde.producerBalances(await producer1.getAddress()))
        .to.equal(perTokenAmount * 2n + remainder);

      // Producer2 and Producer3 get 1 token worth each
      expect(await astaVerde.producerBalances(await producer2.getAddress()))
        .to.equal(perTokenAmount);
      expect(await astaVerde.producerBalances(await producer3.getAddress()))
        .to.equal(perTokenAmount);
    });

    it("Should handle producer being buyer correctly", async function () {
      const { astaVerde, mockUSDC, owner, producer1 } = await loadFixture(deployFixture);

      // Fund producer to be buyer
      await mockUSDC.mint(await producer1.getAddress(), INITIAL_USDC_BALANCE);
      await mockUSDC.connect(producer1).approve(await astaVerde.getAddress(), ethers.MaxUint256);

      // Producer mints their own token
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest1"]);

      const price = await astaVerde.getCurrentBatchPrice(1);
      
      // Producer buys their own token
      await astaVerde.connect(producer1).buyBatch(1, price, 1);

      // They should have accrued balance
      const accruedBalance = await astaVerde.producerBalances(await producer1.getAddress());
      expect(accruedBalance).to.be.gt(0);

      // They can claim it
      await expect(astaVerde.connect(producer1).claimProducerFunds())
        .to.changeTokenBalance(mockUSDC, producer1, accruedBalance);
    });
  });

  describe("Accounting Invariants and Edge Cases", function () {
    it("Should maintain totalProducerBalances correctly", async function () {
      const { astaVerde, owner, buyer1, producer1, producer2 } = await loadFixture(deployFixture);

      // Initial should be zero
      expect(await astaVerde.totalProducerBalances()).to.equal(0);

      // After first sale
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest1"]);
      const price1 = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer1).buyBatch(1, price1, 1);

      const firstTotal = await astaVerde.totalProducerBalances();
      expect(firstTotal).to.be.gt(0);

      // After second sale
      await astaVerde.connect(owner).mintBatch([await producer2.getAddress()], ["QmTest2"]);
      const price2 = await astaVerde.getCurrentBatchPrice(2);
      await astaVerde.connect(buyer1).buyBatch(2, price2, 1);

      const secondTotal = await astaVerde.totalProducerBalances();
      expect(secondTotal).to.be.gt(firstTotal);

      // After producer1 claims
      const producer1Balance = await astaVerde.producerBalances(await producer1.getAddress());
      await astaVerde.connect(producer1).claimProducerFunds();

      expect(await astaVerde.totalProducerBalances()).to.equal(secondTotal - producer1Balance);

      // After producer2 claims
      await astaVerde.connect(producer2).claimProducerFunds();
      expect(await astaVerde.totalProducerBalances()).to.equal(0);
    });

    it("Should handle USDC balance invariant under all conditions", async function () {
      const { astaVerde, mockUSDC, owner, buyer1, buyer2, producer1, producer2 } = await loadFixture(deployFixture);

      // Complex scenario with multiple sales and claims
      await astaVerde.connect(owner).mintBatch(
        [await producer1.getAddress(), await producer2.getAddress()],
        ["QmTest1", "QmTest2"]
      );

      const price = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer1).buyBatch(1, price * 2n, 2);

      // Check invariant after sale
      let contractBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());
      let platformShare = await astaVerde.platformShareAccumulated();
      let totalProducerBalances = await astaVerde.totalProducerBalances();
      expect(contractBalance).to.equal(platformShare + totalProducerBalances);

      // Producer1 claims
      await astaVerde.connect(producer1).claimProducerFunds();

      // Check invariant after claim
      contractBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());
      platformShare = await astaVerde.platformShareAccumulated();
      totalProducerBalances = await astaVerde.totalProducerBalances();
      expect(contractBalance).to.equal(platformShare + totalProducerBalances);

      // Another sale
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest3"]);
      const price2 = await astaVerde.getCurrentBatchPrice(2);
      await astaVerde.connect(buyer2).buyBatch(2, price2, 1);

      // Check invariant after second sale
      contractBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());
      platformShare = await astaVerde.platformShareAccumulated();
      totalProducerBalances = await astaVerde.totalProducerBalances();
      expect(contractBalance).to.equal(platformShare + totalProducerBalances);

      // Platform claims
      await astaVerde.connect(owner).claimPlatformFunds(await platformReceiver.getAddress());

      // Check invariant after platform claim
      contractBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());
      platformShare = await astaVerde.platformShareAccumulated();
      totalProducerBalances = await astaVerde.totalProducerBalances();
      expect(contractBalance).to.equal(platformShare + totalProducerBalances);
    });

    it("Should prevent fund loss through recoverSurplusUSDC", async function () {
      const { astaVerde, mockUSDC, owner, buyer1, producer1 } = await loadFixture(deployFixture);

      // Create producer balance
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest1"]);
      const price = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer1).buyBatch(1, price, 1);

      const producerBalance = await astaVerde.producerBalances(await producer1.getAddress());
      expect(producerBalance).to.be.gt(0);

      // Try to recover surplus when there is none (should fail)
      await expect(
        astaVerde.connect(owner).recoverSurplusUSDC(await owner.getAddress())
      ).to.be.revertedWith("No surplus to recover");

      // Add actual surplus
      const surplus = ethers.parseUnits("100", 6);
      await mockUSDC.mint(await astaVerde.getAddress(), surplus);

      // Should only recover the surplus, not producer funds
      await expect(
        astaVerde.connect(owner).recoverSurplusUSDC(await owner.getAddress())
      ).to.changeTokenBalance(mockUSDC, owner, surplus);

      // Producer balance should be unchanged
      expect(await astaVerde.producerBalances(await producer1.getAddress())).to.equal(producerBalance);

      // Producer can still claim
      await expect(astaVerde.connect(producer1).claimProducerFunds())
        .to.changeTokenBalance(mockUSDC, producer1, producerBalance);
    });

    it("Should handle claims after long periods correctly", async function () {
      const { astaVerde, mockUSDC, owner, buyer1, producer1 } = await loadFixture(deployFixture);

      // Sale at T0
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest1"]);
      const price = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer1).buyBatch(1, price, 1);

      const initialBalance = await astaVerde.producerBalances(await producer1.getAddress());

      // Advance time significantly (1 year)
      await time.increase(365 * 24 * 60 * 60);

      // Balance should be unchanged
      expect(await astaVerde.producerBalances(await producer1.getAddress())).to.equal(initialBalance);

      // Should still be claimable
      await expect(astaVerde.connect(producer1).claimProducerFunds())
        .to.changeTokenBalance(mockUSDC, producer1, initialBalance);
    });
  });

  describe("Gas Optimization Verification", function () {
    it("Should handle large batches efficiently", async function () {
      const { astaVerde, mockUSDC, owner, buyer1, producer1 } = await loadFixture(deployFixture);

      // Create maximum size batch
      const maxBatchSize = await astaVerde.maxBatchSize();
      const producers = Array(Number(maxBatchSize)).fill(await producer1.getAddress());
      const cids = Array(Number(maxBatchSize)).fill("QmTest");

      await astaVerde.connect(owner).mintBatch(producers, cids);

      const price = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = price * BigInt(producers.length);

      // Fund buyer with enough USDC for large batch
      await mockUSDC.mint(await buyer1.getAddress(), totalCost * 2n);

      // Should complete without gas issues
      const tx = await astaVerde.connect(buyer1).buyBatch(1, totalCost, producers.length);
      const receipt = await tx.wait();

      // Log gas used for reference
      console.log(`        Gas used for ${producers.length} token batch: ${receipt.gasUsed}`);

      // Verify accumulation worked
      const producerBalance = await astaVerde.producerBalances(await producer1.getAddress());
      expect(producerBalance).to.be.gt(0);
    });
  });

  describe("Security and Access Control", function () {
    it("Should not allow claiming other producer's funds", async function () {
      const { astaVerde, owner, buyer1, producer1, producer2 } = await loadFixture(deployFixture);

      // Create balance for producer1
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest1"]);
      const price = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer1).buyBatch(1, price, 1);

      // Producer2 tries to claim (has no balance)
      await expect(
        astaVerde.connect(producer2).claimProducerFunds()
      ).to.be.revertedWith("No funds to claim");

      // Producer1's balance is safe
      expect(await astaVerde.producerBalances(await producer1.getAddress())).to.be.gt(0);
    });

    it("Should maintain producer balances during pause", async function () {
      const { astaVerde, owner, buyer1, producer1 } = await loadFixture(deployFixture);

      // Create balance
      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest1"]);
      const price = await astaVerde.getCurrentBatchPrice(1);
      await astaVerde.connect(buyer1).buyBatch(1, price, 1);

      const balance = await astaVerde.producerBalances(await producer1.getAddress());

      // Pause contract
      await astaVerde.connect(owner).pause();

      // Balance should be unchanged
      expect(await astaVerde.producerBalances(await producer1.getAddress())).to.equal(balance);

      // Claims are allowed during pause (for emergency access to funds)
      // Note: The claimProducerFunds function is not restricted by whenNotPaused
      // This is intentional to allow producers to access their funds even during emergencies
      await expect(astaVerde.connect(producer1).claimProducerFunds())
        .to.changeTokenBalance(mockUSDC, producer1, balance);

      // Balance should be zero after claim
      expect(await astaVerde.producerBalances(await producer1.getAddress())).to.equal(0);
    });
  });

  describe("Event Emissions", function () {
    it("Should emit correct events for full lifecycle", async function () {
      const { astaVerde, owner, buyer1, producer1 } = await loadFixture(deployFixture);

      await astaVerde.connect(owner).mintBatch([await producer1.getAddress()], ["QmTest1"]);
      const price = await astaVerde.getCurrentBatchPrice(1);

      // Check accrual event
      const expectedAmount = (price * (100n - PLATFORM_SHARE_PERCENTAGE)) / 100n;
      await expect(astaVerde.connect(buyer1).buyBatch(1, price, 1))
        .to.emit(astaVerde, "ProducerPaymentAccrued")
        .withArgs(await producer1.getAddress(), expectedAmount);

      // Check claim event
      await expect(astaVerde.connect(producer1).claimProducerFunds())
        .to.emit(astaVerde, "ProducerPaymentClaimed")
        .withArgs(await producer1.getAddress(), expectedAmount);
    });
  });
});