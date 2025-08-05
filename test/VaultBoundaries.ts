import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../typechain-types";

describe("Vault Boundary & Edge Case Tests", function () {
  async function deployBoundaryTestFixture() {
    const [owner, deployer, producer, user1, user2, user3] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDCFactory.deploy(ethers.parseUnits("1000000", 6));

    // Deploy AstaVerde
    const AstaVerdeFactory = await ethers.getContractFactory("AstaVerde");
    const astaVerde = await AstaVerdeFactory.deploy(owner.address, mockUSDC.target);

    // Deploy StabilizedCarbonCoin
    const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
    const scc = await SCCFactory.connect(deployer).deploy();

    // Deploy EcoStabilizer
    const EcoStabilizerFactory = await ethers.getContractFactory("EcoStabilizer");
    const ecoStabilizer = await EcoStabilizerFactory.connect(deployer).deploy(astaVerde.target, scc.target);

    // Complete deployment setup
    const MINTER_ROLE = await scc.MINTER_ROLE();
    const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();
    await scc.connect(deployer).grantRole(MINTER_ROLE, ecoStabilizer.target);
    await scc.connect(deployer).renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);

    // Setup test data - give users more USDC for large purchases
    await mockUSDC.mint(user1.address, ethers.parseUnits("20000", 6)); // 20k USDC
    await mockUSDC.mint(user2.address, ethers.parseUnits("20000", 6));
    await mockUSDC.mint(user3.address, ethers.parseUnits("20000", 6));

    return {
      astaVerde,
      scc,
      ecoStabilizer,
      mockUSDC,
      owner,
      deployer,
      producer,
      user1,
      user2,
      user3,
    };
  }

  describe("Token ID Boundary Tests", function () {
    it("Should handle token ID 1 correctly (minimum valid ID)", async function () {
      const { ecoStabilizer, astaVerde, scc, producer, user1, mockUSDC } = await loadFixture(deployBoundaryTestFixture);

      // Create token ID 1
      await astaVerde.mintBatch([producer.address], ["QmTokenID1"]);
      
      const batch1Price = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = batch1Price * 1n;
      await mockUSDC.connect(user1).approve(astaVerde.target, totalCost);
      await astaVerde.connect(user1).buyBatch(1, totalCost, 1);

      // Test deposit with token ID 1
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      expect(await scc.balanceOf(user1.address)).to.equal(ethers.parseEther("20"));
      
      const loan = await ecoStabilizer.loans(1);
      expect(loan.active).to.be.true;
      expect(loan.borrower).to.equal(user1.address);
    });

    it("Should handle very high token IDs without overflow", async function () {
      const { ecoStabilizer, astaVerde } = await loadFixture(deployBoundaryTestFixture);

      // Test view functions with high token IDs (simulating future state)
      const highTokenId = ethers.parseUnits("1000000", 0); // 1 million

      // These should not revert even with non-existent high token IDs
      const loan = await ecoStabilizer.loans(highTokenId);
      expect(loan.active).to.be.false;
      expect(loan.borrower).to.equal(ethers.ZeroAddress);

      // lastTokenID should handle absence gracefully
      expect(await astaVerde.lastTokenID()).to.equal(0); // No tokens minted yet
    });

    it("Should handle zero and invalid token IDs", async function () {
      const { ecoStabilizer, astaVerde, user1 } = await loadFixture(deployBoundaryTestFixture);

      // Token ID 0 doesn't exist in AstaVerde (starts from 1)
      const loan0 = await ecoStabilizer.loans(0);
      expect(loan0.active).to.be.false;

      // Attempting deposit with non-existent token should fail at NFT level
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      
      // This should fail because token 0 doesn't exist
      await expect(ecoStabilizer.connect(user1).deposit(0))
        .to.be.reverted; // Will fail at safeTransferFrom level
    });
  });

  describe("View Function Stress Tests", function () {
    it("Should handle getUserLoans efficiently with many tokens", async function () {
      const { ecoStabilizer, astaVerde, producer, user1, mockUSDC } = await loadFixture(deployBoundaryTestFixture);

      // Create many tokens for stress testing
      const numTokens = 50;
      const producers = new Array(numTokens).fill(producer.address);
      const cids = Array.from({length: numTokens}, (_, i) => `QmStressTest${i}`);
      
      await astaVerde.mintBatch(producers, cids);

      // User1 buys multiple tokens
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = batchPrice * BigInt(numTokens);
      await mockUSDC.connect(user1).approve(astaVerde.target, totalCost);
      await astaVerde.connect(user1).buyBatch(1, totalCost, numTokens);

      // User1 deposits every 5th token (10 total loans)
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      const depositedTokens = [];
      for (let i = 1; i <= numTokens; i += 5) {
        await ecoStabilizer.connect(user1).deposit(i);
        depositedTokens.push(i);
      }

      // Test view functions with many loans
      const userLoans = await ecoStabilizer.getUserLoans(user1.address);
      const userLoanCount = await ecoStabilizer.getUserLoanCount(user1.address);
      const totalActiveLoans = await ecoStabilizer.getTotalActiveLoans();

      expect(userLoanCount).to.equal(10);
      expect(totalActiveLoans).to.equal(10);
      expect(userLoans.length).to.equal(10);

      // Verify correct token IDs returned
      for (let i = 0; i < depositedTokens.length; i++) {
        expect(userLoans).to.include(BigInt(depositedTokens[i]));
      }
    });

    it("Should handle empty and sparse loan scenarios", async function () {
      const { ecoStabilizer, astaVerde, producer, user1, user2, mockUSDC } = await loadFixture(deployBoundaryTestFixture);

      // Create gaps: tokens 1, 5, 10
      await astaVerde.mintBatch([producer.address], ["QmSparse1"]);
      await astaVerde.mintBatch([producer.address], ["QmSparse2"]);
      await astaVerde.mintBatch([producer.address], ["QmSparse3"]);
      await astaVerde.mintBatch([producer.address], ["QmSparse4"]);
      await astaVerde.mintBatch([producer.address], ["QmSparse5"]);

      // Users buy tokens
      const batchPrices = await Promise.all([1,2,3,4,5].map(i => astaVerde.getCurrentBatchPrice(i)));
      for (let i = 0; i < 5; i++) {
        const user = i < 3 ? user1 : user2;
        const totalCost = batchPrices[i] * 1n;
        await mockUSDC.connect(user).approve(astaVerde.target, totalCost);
        await astaVerde.connect(user).buyBatch(i + 1, totalCost, 1);
      }

      // Only deposit tokens 1 and 5 (sparse pattern)
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
      
      await ecoStabilizer.connect(user1).deposit(1);
      await ecoStabilizer.connect(user2).deposit(5);

      // View functions should handle sparse data correctly
      const user1Loans = await ecoStabilizer.getUserLoans(user1.address);
      const user2Loans = await ecoStabilizer.getUserLoans(user2.address);
      const totalLoans = await ecoStabilizer.getTotalActiveLoans();

      expect(user1Loans.length).to.equal(1);
      expect(user1Loans[0]).to.equal(1n);
      expect(user2Loans.length).to.equal(1);
      expect(user2Loans[0]).to.equal(5n);
      expect(totalLoans).to.equal(2);
    });
  });

  describe("ERC1155Receiver Edge Cases", function () {
    it("Should accept valid EcoAsset transfers", async function () {
      const { ecoStabilizer, astaVerde, producer, user1, mockUSDC } = await loadFixture(deployBoundaryTestFixture);

      await astaVerde.mintBatch([producer.address], ["QmValidNFT"]);
      
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = batchPrice * 1n;
      await mockUSDC.connect(user1).approve(astaVerde.target, totalCost);
      await astaVerde.connect(user1).buyBatch(1, totalCost, 1);

      // Direct safeTransferFrom should work (ERC1155Receiver implemented)
      await astaVerde.connect(user1).safeTransferFrom(
        user1.address, 
        ecoStabilizer.target, 
        1, 
        1, 
        "0x"
      );

      expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);
    });

    it("Should handle batch transfers correctly", async function () {
      const { ecoStabilizer, astaVerde, producer, user1, mockUSDC } = await loadFixture(deployBoundaryTestFixture);

      await astaVerde.mintBatch([producer.address, producer.address], ["QmBatch1", "QmBatch2"]);
      
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = batchPrice * 2n;
      await mockUSDC.connect(user1).approve(astaVerde.target, totalCost);
      await astaVerde.connect(user1).buyBatch(1, totalCost, 2);

      // Batch transfer
      await astaVerde.connect(user1).safeBatchTransferFrom(
        user1.address,
        ecoStabilizer.target,
        [1, 2],
        [1, 1],
        "0x"
      );

      expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);
      expect(await astaVerde.balanceOf(ecoStabilizer.target, 2)).to.equal(1);
    });

    it("Should handle transfers with data payload", async function () {
      const { ecoStabilizer, astaVerde, producer, user1, mockUSDC } = await loadFixture(deployBoundaryTestFixture);

      await astaVerde.mintBatch([producer.address], ["QmDataNFT"]);
      
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = batchPrice * 1n;
      await mockUSDC.connect(user1).approve(astaVerde.target, totalCost);
      await astaVerde.connect(user1).buyBatch(1, totalCost, 1);

      // Transfer with data (should still work)
      const testData = ethers.toUtf8Bytes("test transfer data");
      await astaVerde.connect(user1).safeTransferFrom(
        user1.address,
        ecoStabilizer.target,
        1,
        1,
        testData
      );

      expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);
    });
  });

  describe("Gas Limit & DoS Protection", function () {
    it("Should handle view functions within reasonable gas limits", async function () {
      const { ecoStabilizer, astaVerde, producer, user1, mockUSDC } = await loadFixture(deployBoundaryTestFixture);

      // Create moderate number of tokens for gas testing
      const numTokens = 20;
      const producers = new Array(numTokens).fill(producer.address);
      const cids = Array.from({length: numTokens}, (_, i) => `QmGasTest${i}`);
      
      await astaVerde.mintBatch(producers, cids);

      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = batchPrice * BigInt(numTokens);
      await mockUSDC.connect(user1).approve(astaVerde.target, totalCost);
      await astaVerde.connect(user1).buyBatch(1, totalCost, numTokens);

      // Deposit all tokens
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      for (let i = 1; i <= numTokens; i++) {
        await ecoStabilizer.connect(user1).deposit(i);
      }

      // Test view function gas consumption (these are view functions, so gas is estimated)
      const gasEstimates = await Promise.all([
        ecoStabilizer.getUserLoans.estimateGas(user1.address),
        ecoStabilizer.getUserLoanCount.estimateGas(user1.address),
        ecoStabilizer.getTotalActiveLoans.estimateGas(),
      ]);

      // View functions should be reasonable (under 150k gas during coverage)
      gasEstimates.forEach((gas, index) => {
        console.log(`View function ${index} gas estimate: ${gas.toString()}`);
        expect(gas).to.be.lessThan(150000); // Higher limit for coverage instrumentation
      });
    });

    it("Should prevent DoS through excessive admin operations", async function () {
      const { ecoStabilizer, astaVerde, producer, deployer, user1, mockUSDC } = await loadFixture(deployBoundaryTestFixture);

      // Create many direct transfers to test admin sweep limits
      await astaVerde.mintBatch([producer.address, producer.address, producer.address], 
                                ["QmDoS1", "QmDoS2", "QmDoS3"]);

      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = batchPrice * 3n;
      await mockUSDC.connect(user1).approve(astaVerde.target, totalCost);
      await astaVerde.connect(user1).buyBatch(1, totalCost, 3);

      // Direct transfer all NFTs (simulating unsolicited transfers)
      await astaVerde.connect(user1).safeTransferFrom(user1.address, ecoStabilizer.target, 1, 1, "0x");
      await astaVerde.connect(user1).safeTransferFrom(user1.address, ecoStabilizer.target, 2, 1, "0x");
      await astaVerde.connect(user1).safeTransferFrom(user1.address, ecoStabilizer.target, 3, 1, "0x");

      // Admin can sweep each one individually (deployer is the owner)
      await ecoStabilizer.connect(deployer).adminSweepNFT(1, deployer.address);
      await ecoStabilizer.connect(deployer).adminSweepNFT(2, deployer.address);
      await ecoStabilizer.connect(deployer).adminSweepNFT(3, deployer.address);

      expect(await astaVerde.balanceOf(deployer.address, 1)).to.equal(1);
      expect(await astaVerde.balanceOf(deployer.address, 2)).to.equal(1);
      expect(await astaVerde.balanceOf(deployer.address, 3)).to.equal(1);
    });
  });

  describe("Numerical Boundary Tests", function () {
    it("Should handle SCC amount boundaries correctly", async function () {
      const { ecoStabilizer, astaVerde, scc, producer, user1, mockUSDC } = await loadFixture(deployBoundaryTestFixture);

      await astaVerde.mintBatch([producer.address], ["QmBoundaryTest"]);
      
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = batchPrice * 1n;
      await mockUSDC.connect(user1).approve(astaVerde.target, totalCost);
      await astaVerde.connect(user1).buyBatch(1, totalCost, 1);

      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      // Verify exact SCC amount (20.000000000000000000)
      const sccBalance = await scc.balanceOf(user1.address);
      const expectedAmount = ethers.parseEther("20");
      expect(sccBalance).to.equal(expectedAmount);
      expect(sccBalance.toString()).to.equal("20000000000000000000");

      // Test burnFrom with exact amount
      await scc.connect(user1).approve(ecoStabilizer.target, expectedAmount);
      await ecoStabilizer.connect(user1).withdraw(1);

      expect(await scc.balanceOf(user1.address)).to.equal(0);
    });

    it("Should handle edge cases in SCC allowances", async function () {
      const { ecoStabilizer, astaVerde, scc, producer, user1, user2, mockUSDC } = await loadFixture(deployBoundaryTestFixture);

      await astaVerde.mintBatch([producer.address], ["QmAllowanceTest"]);
      
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = batchPrice * 1n;
      await mockUSDC.connect(user1).approve(astaVerde.target, totalCost);
      await astaVerde.connect(user1).buyBatch(1, totalCost, 1);

      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      // Test maximum uint256 allowance
      const maxUint256 = ethers.MaxUint256;
      await scc.connect(user1).approve(ecoStabilizer.target, maxUint256);
      
      const allowance = await scc.allowance(user1.address, ecoStabilizer.target);
      expect(allowance).to.equal(maxUint256);

      // Withdraw should work even with max allowance
      await ecoStabilizer.connect(user1).withdraw(1);
      
      // After spending exactly 20 SCC, allowance should decrease  
      // Note: ERC20 standard treats max uint256 allowance specially - it doesn't decrease
      const remainingAllowance = await scc.allowance(user1.address, ecoStabilizer.target);
      expect(remainingAllowance).to.equal(maxUint256); // Max allowance stays max
    });

    it("Should handle zero amounts gracefully", async function () {
      const { scc, user1 } = await loadFixture(deployBoundaryTestFixture);

      // Burning zero should work (no-op)
      await scc.connect(user1).burn(0);
      expect(await scc.balanceOf(user1.address)).to.equal(0);

      // Approving zero should work
      await scc.connect(user1).approve(user1.address, 0);
      expect(await scc.allowance(user1.address, user1.address)).to.equal(0);
    });
  });

  describe("Contract State Boundaries", function () {
    it("Should handle paused state during various operations", async function () {
      const { ecoStabilizer, astaVerde, scc, producer, deployer, user1, mockUSDC } = await loadFixture(deployBoundaryTestFixture);

      await astaVerde.mintBatch([producer.address], ["QmPauseTest"]);
      
      const batchPrice = await astaVerde.getCurrentBatchPrice(1);
      const totalCost = batchPrice * 1n;
      await mockUSDC.connect(user1).approve(astaVerde.target, totalCost);
      await astaVerde.connect(user1).buyBatch(1, totalCost, 1);

      // Pause before any operations (deployer is the owner)
      await ecoStabilizer.connect(deployer).pause();

      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

      // All vault operations should fail when paused
      await expect(ecoStabilizer.connect(user1).deposit(1))
        .to.be.revertedWithCustomError(ecoStabilizer, "EnforcedPause");

      // Admin operations should still work when paused
      await ecoStabilizer.connect(deployer).unpause();
      expect(await ecoStabilizer.paused()).to.be.false;

      // Operations should work after unpausing
      await ecoStabilizer.connect(user1).deposit(1);
      expect(await scc.balanceOf(user1.address)).to.equal(ethers.parseEther("20"));
    });

    it("Should handle ownership transfer edge cases", async function () {
      const { ecoStabilizer, deployer, user1, user2 } = await loadFixture(deployBoundaryTestFixture);

      // Transfer to zero address should fail (deployer is the owner)
      await expect(ecoStabilizer.connect(deployer).transferOwnership(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(ecoStabilizer, "OwnableInvalidOwner");

      // Transfer to same owner should work (no-op)
      await ecoStabilizer.connect(deployer).transferOwnership(deployer.address);
      expect(await ecoStabilizer.owner()).to.equal(deployer.address);

      // Normal transfer should work
      await ecoStabilizer.connect(deployer).transferOwnership(user1.address);
      expect(await ecoStabilizer.owner()).to.equal(user1.address);

      // Old owner can't transfer anymore
      await expect(ecoStabilizer.connect(deployer).transferOwnership(user2.address))
        .to.be.revertedWithCustomError(ecoStabilizer, "OwnableUnauthorizedAccount");
    });
  });
});