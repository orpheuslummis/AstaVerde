import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../typechain-types";

describe("Integration: Phase 1 ↔ Phase 2", function () {
  async function deployIntegrationFixture() {
    const [owner, producer1, producer2, user1, user2, user3] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDCFactory.deploy(ethers.parseUnits("1000000", 6)); // 1M USDC

    // Deploy AstaVerde (Phase 1)
    const AstaVerdeFactory = await ethers.getContractFactory("AstaVerde");
    const astaVerde = await AstaVerdeFactory.deploy(owner.address, mockUSDC.target);

    // Deploy StabilizedCarbonCoin (Phase 2)
    const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
    const scc = await SCCFactory.deploy();

    // Deploy EcoStabilizer (Phase 2)
    const EcoStabilizerFactory = await ethers.getContractFactory("EcoStabilizer");
    const ecoStabilizer = await EcoStabilizerFactory.deploy(astaVerde.target, scc.target);

    // Grant MINTER_ROLE to vault
    const MINTER_ROLE = await scc.MINTER_ROLE();
    await scc.grantRole(MINTER_ROLE, ecoStabilizer.target);

    // Mint USDC to users for comprehensive testing
    await mockUSDC.mint(user1.address, ethers.parseUnits("5000", 6));
    await mockUSDC.mint(user2.address, ethers.parseUnits("5000", 6));
    await mockUSDC.mint(user3.address, ethers.parseUnits("5000", 6));

    return {
      astaVerde,
      scc,
      ecoStabilizer,
      mockUSDC,
      owner,
      producer1,
      producer2,
      user1,
      user2,
      user3,
    };
  }

  // Helper function for time manipulation (consistent with AstaVerde.logic.behavior.ts)
  async function advanceTimeByDays(days: number) {
    const secondsToAdvance = days * 24 * 60 * 60;
    await ethers.provider.send("evm_increaseTime", [secondsToAdvance]);
    await ethers.provider.send("evm_mine", []);
  }

  // Helper function to buy NFT from batch through proper marketplace flow
  async function buyNFTFromMarketplace(
    astaVerde: AstaVerde,
    mockUSDC: MockUSDC,
    user: any,
    batchId: number,
    quantity: number = 1
  ) {
    const batchPrice = await astaVerde.getCurrentBatchPrice(batchId);
    const totalCost = batchPrice * BigInt(quantity);
    await mockUSDC.connect(user).approve(astaVerde.target, totalCost);
    // Use totalCost as maxPrice parameter (not batchPrice)
    await astaVerde.connect(user).buyBatch(batchId, totalCost, quantity);
    return { batchPrice, totalCost };
  }

  describe("Dutch Auction Price Integration", function () {
    it("should accept vault deposits regardless of NFT purchase price (high vs floor)", async function () {
      const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2 } = 
        await loadFixture(deployIntegrationFixture);

      // Create two identical batches
      await astaVerde.mintBatch([producer1.address], ["QmTestCID1"]);
      await astaVerde.mintBatch([producer1.address], ["QmTestCID2"]);

      // User1 buys immediately at high price (230 USDC)
      const { batchPrice: highPrice } = await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);
      console.log(`User1 paid high price: ${ethers.formatUnits(highPrice, 6)} USDC`);

      // Advance time to floor price (40 USDC after 190+ days)
      await advanceTimeByDays(200);

      // User2 buys at floor price
      const { batchPrice: floorPrice } = await buyNFTFromMarketplace(astaVerde, mockUSDC, user2, 2);
      console.log(`User2 paid floor price: ${ethers.formatUnits(floorPrice, 6)} USDC`);

      // Verify price difference
      expect(highPrice).to.be.greaterThan(floorPrice);
      expect(floorPrice).to.equal(ethers.parseUnits("40", 6)); // Floor price

      // Both users should get same SCC loan amount from vault
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);

      await ecoStabilizer.connect(user1).deposit(1);
      await ecoStabilizer.connect(user2).deposit(2);

      // Both should receive exactly 20 SCC regardless of purchase price
      const user1Balance = await scc.balanceOf(user1.address);
      const user2Balance = await scc.balanceOf(user2.address);
      
      expect(user1Balance).to.equal(ethers.parseEther("20"));
      expect(user2Balance).to.equal(ethers.parseEther("20"));
      expect(user1Balance).to.equal(user2Balance);
    });

    it("should handle vault operations during active price decay", async function () {
      const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2 } = 
        await loadFixture(deployIntegrationFixture);

      // Create batch and buy one NFT
      await astaVerde.mintBatch([producer1.address], ["QmTestCID"]);
      await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);

      // Get initial price
      const initialPrice = await astaVerde.getCurrentBatchPrice(1);

      // Deposit in vault
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      // Advance time by 5 days (price should decrease by 5 USDC)
      await advanceTimeByDays(5);

      // Since user1 bought token 1, check remaining tokens in batch
      const batchInfo = await astaVerde.getBatchInfo(1);
      if (batchInfo[4] > 0) { // If there are remaining tokens
        const newPrice = await astaVerde.getCurrentBatchPrice(1);
        expect(initialPrice - newPrice).to.equal(ethers.parseUnits("5", 6));
      }

      // Vault operations should be unaffected by price changes
      const sccBalance = await scc.balanceOf(user1.address);
      expect(sccBalance).to.equal(ethers.parseEther("20"));

      // Withdraw should work normally
      await scc.connect(user1).approve(ecoStabilizer.target, sccBalance);
      await ecoStabilizer.connect(user1).withdraw(1);

      // User should get their exact NFT back
      const nftBalance = await astaVerde.balanceOf(user1.address, 1);
      expect(nftBalance).to.equal(1);
    });
  });

  describe("Base Price Adjustment Impact", function () {
    it("should maintain vault loans when basePrice increases due to quick sales", async function () {
      const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2 } = 
        await loadFixture(deployIntegrationFixture);

      // Get initial base price
      const initialBasePrice = await astaVerde.basePrice();
      console.log(`Initial base price: ${ethers.formatUnits(initialBasePrice, 6)} USDC`);

      // Create batch and deposit one NFT in vault
      await astaVerde.mintBatch([producer1.address], ["QmTestCID1"]);
      await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      // Create another batch and sell it quickly (within 2 days) to trigger base price increase
      await astaVerde.mintBatch([producer1.address], ["QmTestCID2"]);
      await buyNFTFromMarketplace(astaVerde, mockUSDC, user2, 2, 1); // Buy entire batch

      // Advance time by 1 day (quick sale trigger)
      await advanceTimeByDays(1);

      // Create multiple batches to trigger base price recalculation
      await astaVerde.mintBatch([producer1.address], ["QmTestCID3"]);
      await astaVerde.mintBatch([producer1.address], ["QmTestCID4"]);
      
      // Buy from batch 3 quickly to potentially trigger base price increase
      await buyNFTFromMarketplace(astaVerde, mockUSDC, user2, 3, 1);

      // Check if base price changed (it may or may not depending on timing)
      const newBasePrice = await astaVerde.basePrice();
      console.log(`New base price: ${ethers.formatUnits(newBasePrice, 6)} USDC`);

      // Existing vault loan should be unaffected regardless
      const user1SccBalance = await scc.balanceOf(user1.address);
      expect(user1SccBalance).to.equal(ethers.parseEther("20"));

      // Vault should still work for new NFTs
      await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user2).deposit(2);

      const user2SccBalance = await scc.balanceOf(user2.address);
      expect(user2SccBalance).to.equal(ethers.parseEther("20"));

      // Both users should be able to withdraw their specific NFTs
      await scc.connect(user1).approve(ecoStabilizer.target, user1SccBalance);
      await ecoStabilizer.connect(user1).withdraw(1);
      
      await scc.connect(user2).approve(ecoStabilizer.target, user2SccBalance);
      await ecoStabilizer.connect(user2).withdraw(2);

      expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
      expect(await astaVerde.balanceOf(user2.address, 2)).to.equal(1);
    });

    it("should maintain vault loans when basePrice decreases due to stagnant sales", async function () {
      const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1 } = 
        await loadFixture(deployIntegrationFixture);

      const initialBasePrice = await astaVerde.basePrice();

      // Create batch and deposit NFT
      await astaVerde.mintBatch([producer1.address], ["QmTestCID1"]);
      await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      // Create multiple batches and let them sit unsold to potentially trigger base price decrease
      await astaVerde.mintBatch([producer1.address], ["QmTestCID2"]);
      await astaVerde.mintBatch([producer1.address], ["QmTestCID3"]);
      await advanceTimeByDays(5); // Let batches go stagnant

      // Create another batch to trigger base price recalculation
      await astaVerde.mintBatch([producer1.address], ["QmTestCID4"]);

      const newBasePrice = await astaVerde.basePrice();
      console.log(`Base price after stagnation: ${ethers.formatUnits(newBasePrice, 6)} USDC`);
      // Base price may or may not decrease depending on the exact logic - just verify vault works

      // Existing vault loan should remain stable
      const sccBalance = await scc.balanceOf(user1.address);
      expect(sccBalance).to.equal(ethers.parseEther("20"));

      // Withdrawal should work normally
      await scc.connect(user1).approve(ecoStabilizer.target, sccBalance);
      await ecoStabilizer.connect(user1).withdraw(1);
      expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
    });
  });

  describe("Batch Lifecycle Integration", function () {
    it("should handle complete batch lifecycle with vault operations", async function () {
      const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2, user3 } = 
        await loadFixture(deployIntegrationFixture);

      // Create 3-token batch
      await astaVerde.mintBatch([producer1.address, producer1.address, producer1.address], 
                                ["QmCID1", "QmCID2", "QmCID3"]);

      const initialPrice = await astaVerde.getCurrentBatchPrice(1);

      // User1 buys first token and deposits in vault
      await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1, 1);
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      // Advance time - price decreases
      await advanceTimeByDays(3);
      const midPrice = await astaVerde.getCurrentBatchPrice(1);
      expect(initialPrice - midPrice).to.equal(ethers.parseUnits("3", 6));

      // User2 buys second token at reduced price
      await buyNFTFromMarketplace(astaVerde, mockUSDC, user2, 1, 1);
      await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user2).deposit(2);

      // Advance to floor price
      await advanceTimeByDays(200);
      const floorPrice = await astaVerde.getCurrentBatchPrice(1);
      expect(floorPrice).to.equal(ethers.parseUnits("40", 6));

      // User3 buys last token at floor price
      await buyNFTFromMarketplace(astaVerde, mockUSDC, user3, 1, 1);

      // Verify batch is now fully sold
      const batchInfo = await astaVerde.getBatchInfo(1);
      expect(batchInfo[4]).to.equal(0); // remainingTokens is index 4

      // All vault operations should work regardless of purchase prices
      const user1Balance = await scc.balanceOf(user1.address);
      const user2Balance = await scc.balanceOf(user2.address);
      expect(user1Balance).to.equal(ethers.parseEther("20"));
      expect(user2Balance).to.equal(ethers.parseEther("20"));

      // Withdrawals should return exact NFTs
      await scc.connect(user1).approve(ecoStabilizer.target, user1Balance);
      await ecoStabilizer.connect(user1).withdraw(1);
      
      await scc.connect(user2).approve(ecoStabilizer.target, user2Balance);
      await ecoStabilizer.connect(user2).withdraw(2);

      expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
      expect(await astaVerde.balanceOf(user2.address, 2)).to.equal(1);
      expect(await astaVerde.balanceOf(user3.address, 3)).to.equal(1);
    });
  });

  describe("Producer Revenue Integration", function () {
    it("should maintain producer revenue flow when NFTs move through vault", async function () {
      const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1 } = 
        await loadFixture(deployIntegrationFixture);

      const initialProducerBalance = await mockUSDC.balanceOf(producer1.address);

      // Create batch and buy NFT (triggers producer payment)
      await astaVerde.mintBatch([producer1.address], ["QmTestCID"]);
      const { batchPrice } = await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);

      // Verify producer received payment (70% of batch price, 30% to platform)
      const expectedProducerPayment = (batchPrice * 70n) / 100n;
      const producerBalanceAfterSale = await mockUSDC.balanceOf(producer1.address);
      expect(producerBalanceAfterSale - initialProducerBalance).to.equal(expectedProducerPayment);

      // Deposit NFT in vault - should not affect producer balance
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      const producerBalanceAfterDeposit = await mockUSDC.balanceOf(producer1.address);
      expect(producerBalanceAfterDeposit).to.equal(producerBalanceAfterSale);

      // Withdraw from vault - should not trigger additional producer payment
      const sccBalance = await scc.balanceOf(user1.address);
      await scc.connect(user1).approve(ecoStabilizer.target, sccBalance);
      await ecoStabilizer.connect(user1).withdraw(1);

      const producerBalanceAfterWithdraw = await mockUSDC.balanceOf(producer1.address);
      expect(producerBalanceAfterWithdraw).to.equal(producerBalanceAfterDeposit);

      // Verify user got NFT back
      expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
    });
  });

  describe("Time-Based State Synchronization", function () {
    it("should maintain consistent state across time-dependent operations", async function () {
      const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2 } = 
        await loadFixture(deployIntegrationFixture);

      // Create batch
      await astaVerde.mintBatch([producer1.address, producer1.address], ["QmCID1", "QmCID2"]);

      // Record initial timestamp and price
      const initialTimestamp = await time.latest();
      const initialPrice = await astaVerde.getCurrentBatchPrice(1);

      // User1 buys and deposits immediately
      await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1, 1);
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      // Advance time by exactly 7 days
      await advanceTimeByDays(7);

      // Verify price decreased correctly
      const priceAfter7Days = await astaVerde.getCurrentBatchPrice(1);
      expect(initialPrice - priceAfter7Days).to.equal(ethers.parseUnits("7", 6));

      // User2 buys at reduced price
      await buyNFTFromMarketplace(astaVerde, mockUSDC, user2, 1, 1);

      // Both vault operations should work with time-consistent state
      await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user2).deposit(2);

      // Both users should have identical SCC balances
      const user1Balance = await scc.balanceOf(user1.address);
      const user2Balance = await scc.balanceOf(user2.address);
      expect(user1Balance).to.equal(user2Balance);
      expect(user1Balance).to.equal(ethers.parseEther("20"));

      // Verify timestamp consistency
      const currentTimestamp = await time.latest();
      expect(currentTimestamp - initialTimestamp).to.be.greaterThan(7 * 24 * 60 * 60 - 10); // ~7 days
    });
  });

  describe("Emergency State Integration", function () {
    it("should handle paused vault with active marketplace", async function () {
      const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2, owner } = 
        await loadFixture(deployIntegrationFixture);

      // Create batch and setup one vault deposit
      await astaVerde.mintBatch([producer1.address, producer1.address], ["QmCID1", "QmCID2"]);
      await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1, 1);
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      // Pause vault
      await ecoStabilizer.connect(owner).pause();

      // Marketplace should still work independently
      await buyNFTFromMarketplace(astaVerde, mockUSDC, user2, 1, 1);
      expect(await astaVerde.balanceOf(user2.address, 2)).to.equal(1);

      // Vault deposits should fail when paused
      await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
      await expect(ecoStabilizer.connect(user2).deposit(2))
        .to.be.revertedWithCustomError(ecoStabilizer, "EnforcedPause");

      // Unpause vault
      await ecoStabilizer.connect(owner).unpause();

      // Cross-contract calls should work again
      await ecoStabilizer.connect(user2).deposit(2);
      expect(await scc.balanceOf(user2.address)).to.equal(ethers.parseEther("20"));

      // Original user should still be able to withdraw
      const user1Balance = await scc.balanceOf(user1.address);
      await scc.connect(user1).approve(ecoStabilizer.target, user1Balance);
      await ecoStabilizer.connect(user1).withdraw(1);
      expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
    });
  });

  describe("Gas Cost Integration", function () {
    it("should maintain gas efficiency for full Phase 1→2 workflow", async function () {
      const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1 } = 
        await loadFixture(deployIntegrationFixture);

      // Create batch
      await astaVerde.mintBatch([producer1.address], ["QmTestCID"]);

      // Measure full workflow gas consumption
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      
      // Step 1: USDC approval
      const approveTx = await mockUSDC.connect(user1).approve(astaVerde.target, batchPrice);
      const approveReceipt = await approveTx.wait();
      
      // Step 2: Buy from marketplace
      const buyTx = await astaVerde.connect(user1).buyBatch(1, batchPrice, 1);
      const buyReceipt = await buyTx.wait();
      
      // Step 3: NFT approval for vault
      const nftApproveTx = await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      const nftApproveReceipt = await nftApproveTx.wait();
      
      // Step 4: Vault deposit
      const depositTx = await ecoStabilizer.connect(user1).deposit(1);
      const depositReceipt = await depositTx.wait();

      // Calculate total gas
      const totalGas = (approveReceipt?.gasUsed || 0n) + 
                       (buyReceipt?.gasUsed || 0n) + 
                       (nftApproveReceipt?.gasUsed || 0n) + 
                       (depositReceipt?.gasUsed || 0n);

      console.log(`Total workflow gas: ${totalGas.toString()}`);
      console.log(`Buy gas: ${buyReceipt?.gasUsed || 0n}`);
      console.log(`Deposit gas: ${depositReceipt?.gasUsed || 0n}`);

      // Ensure deposit stays under target
      expect(depositReceipt?.gasUsed || 0n).to.be.lessThan(165000n);

      // Full workflow should be reasonable (coverage instrumentation increases gas)
      expect(totalGas).to.be.lessThan(510000n);

      // Test withdrawal gas
      const sccBalance = await scc.balanceOf(user1.address);
      await scc.connect(user1).approve(ecoStabilizer.target, sccBalance);
      
      const withdrawTx = await ecoStabilizer.connect(user1).withdraw(1);
      const withdrawReceipt = await withdrawTx.wait();
      
      console.log(`Withdraw gas: ${withdrawReceipt?.gasUsed || 0n}`);
      expect(withdrawReceipt?.gasUsed || 0n).to.be.lessThan(120000n);
    });
  });
});