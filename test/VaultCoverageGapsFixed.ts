import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../typechain-types";

describe("Vault Contracts - Coverage Gap Tests (Fixed)", function () {
  async function deployEcoStabilizerFixture() {
    const [owner, producer, user1, user2, nonMinter] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDCFactory.deploy(ethers.parseUnits("1000000", 6)); // 1M USDC

    // Deploy AstaVerde
    const AstaVerdeFactory = await ethers.getContractFactory("AstaVerde");
    const astaVerde = await AstaVerdeFactory.deploy(owner.address, mockUSDC.target);

    // Deploy StabilizedCarbonCoin
    const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
    const scc = await SCCFactory.deploy();

    // Deploy EcoStabilizer
    const EcoStabilizerFactory = await ethers.getContractFactory("EcoStabilizer");
    const ecoStabilizer = await EcoStabilizerFactory.deploy(astaVerde.target, scc.target);

    // Grant MINTER_ROLE to vault
    const MINTER_ROLE = await scc.MINTER_ROLE();
    await scc.grantRole(MINTER_ROLE, ecoStabilizer.target);

    // Mint some USDC to users for testing
    await mockUSDC.mint(user1.address, ethers.parseUnits("2000", 6));
    await mockUSDC.mint(user2.address, ethers.parseUnits("2000", 6));

    // Mint test batches of NFTs (2 separate batches to ensure user1 and user2 each get different tokens)
    await astaVerde.mintBatch([producer.address], ["QmTestCID1"]);
    await astaVerde.mintBatch([producer.address], ["QmTestCID2"]);
    
    // User1 buys from batch 1 (gets token ID 1)
    const batch1Price = await astaVerde.getCurrentBatchPrice(1);
    await mockUSDC.connect(user1).approve(astaVerde.target, batch1Price);
    await astaVerde.connect(user1).buyBatch(1, batch1Price, 1);
    
    // User2 buys from batch 2 (gets token ID 2)
    const batch2Price = await astaVerde.getCurrentBatchPrice(2);
    await mockUSDC.connect(user2).approve(astaVerde.target, batch2Price);
    await astaVerde.connect(user2).buyBatch(2, batch2Price, 1);

    return {
      astaVerde,
      scc,
      ecoStabilizer,
      mockUSDC,
      owner,
      producer,
      user1,
      user2,
      nonMinter,
      MINTER_ROLE
    };
  }

  describe("StabilizedCarbonCoin Coverage Gaps", function () {
    it("Should test burn() function", async function () {
      const { scc, owner, ecoStabilizer } = await loadFixture(deployEcoStabilizerFixture);

      // First grant owner MINTER_ROLE temporarily to mint tokens for testing
      const MINTER_ROLE = await scc.MINTER_ROLE();
      await scc.grantRole(MINTER_ROLE, owner.address);

      const mintAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("30");
      
      await scc.connect(owner).mint(owner.address, mintAmount);
      
      // Check initial balance
      expect(await scc.balanceOf(owner.address)).to.equal(mintAmount);
      
      // Test burn function
      await expect(scc.connect(owner).burn(burnAmount))
        .to.emit(scc, "Transfer")
        .withArgs(owner.address, ethers.ZeroAddress, burnAmount);
      
      // Verify balance after burn
      expect(await scc.balanceOf(owner.address)).to.equal(mintAmount - burnAmount);
      expect(await scc.totalSupply()).to.equal(mintAmount - burnAmount);

      // Clean up: revoke the temporary role
      await scc.revokeRole(MINTER_ROLE, owner.address);
    });

    it("Should test burn() function with insufficient balance", async function () {
      const { scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

      // Try to burn tokens without having any
      const burnAmount = ethers.parseEther("10");
      
      await expect(scc.connect(user1).burn(burnAmount))
        .to.be.revertedWithCustomError(scc, "ERC20InsufficientBalance");
    });

    it("Should test decimals() function", async function () {
      const { scc } = await loadFixture(deployEcoStabilizerFixture);

      // Test the decimals function
      expect(await scc.decimals()).to.equal(18);
    });

    it("Should test mint() access control - reject non-minter", async function () {
      const { scc, nonMinter } = await loadFixture(deployEcoStabilizerFixture);

      const mintAmount = ethers.parseEther("50");
      
      // Test that non-minter cannot mint
      await expect(scc.connect(nonMinter).mint(nonMinter.address, mintAmount))
        .to.be.revertedWithCustomError(scc, "AccessControlUnauthorizedAccount");
    });

    it("Should test burnFrom with zero allowance", async function () {
      const { scc, owner, user1 } = await loadFixture(deployEcoStabilizerFixture);

      // Grant owner MINTER_ROLE temporarily
      const MINTER_ROLE = await scc.MINTER_ROLE();
      await scc.grantRole(MINTER_ROLE, owner.address);

      // Mint tokens to owner
      const mintAmount = ethers.parseEther("100");
      await scc.connect(owner).mint(owner.address, mintAmount);
      
      // Try to burnFrom without allowance
      const burnAmount = ethers.parseEther("10");
      await expect(scc.connect(user1).burnFrom(owner.address, burnAmount))
        .to.be.revertedWithCustomError(scc, "ERC20InsufficientAllowance");

      // Clean up
      await scc.revokeRole(MINTER_ROLE, owner.address);
    });

    it("Should test complete SCC workflow with all functions", async function () {
      const { scc, owner, user1 } = await loadFixture(deployEcoStabilizerFixture);

      // Grant owner MINTER_ROLE temporarily
      const MINTER_ROLE = await scc.MINTER_ROLE();
      await scc.grantRole(MINTER_ROLE, owner.address);

      const mintAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("20");
      const burnFromAmount = ethers.parseEther("30");
      
      // 1. Mint tokens
      await scc.connect(owner).mint(owner.address, mintAmount);
      expect(await scc.balanceOf(owner.address)).to.equal(mintAmount);
      
      // 2. Test standard burn
      await scc.connect(owner).burn(burnAmount);
      expect(await scc.balanceOf(owner.address)).to.equal(mintAmount - burnAmount);
      
      // 3. Approve for burnFrom
      await scc.connect(owner).approve(user1.address, burnFromAmount);
      expect(await scc.allowance(owner.address, user1.address)).to.equal(burnFromAmount);
      
      // 4. Test burnFrom
      await scc.connect(user1).burnFrom(owner.address, burnFromAmount);
      expect(await scc.balanceOf(owner.address)).to.equal(mintAmount - burnAmount - burnFromAmount);
      expect(await scc.allowance(owner.address, user1.address)).to.equal(0);
      
      // 5. Verify total supply
      const finalSupply = mintAmount - burnAmount - burnFromAmount;
      expect(await scc.totalSupply()).to.equal(finalSupply);
      
      // 6. Test decimals
      expect(await scc.decimals()).to.equal(18);

      // Clean up
      await scc.revokeRole(MINTER_ROLE, owner.address);
    });
  });

  describe("EcoStabilizer Coverage Gaps", function () {
    it("Should test getUserLoanCount function", async function () {
      const { ecoStabilizer, astaVerde, user1, user2 } = await loadFixture(deployEcoStabilizerFixture);

      // Initially no loans
      expect(await ecoStabilizer.getUserLoanCount(user1.address)).to.equal(0);
      expect(await ecoStabilizer.getUserLoanCount(user2.address)).to.equal(0);

      // User1 deposits their NFT (token ID 1)
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);
      
      expect(await ecoStabilizer.getUserLoanCount(user1.address)).to.equal(1);
      expect(await ecoStabilizer.getUserLoanCount(user2.address)).to.equal(0);

      // User2 deposits their NFT (token ID 2)
      await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user2).deposit(2);
      
      expect(await ecoStabilizer.getUserLoanCount(user1.address)).to.equal(1);
      expect(await ecoStabilizer.getUserLoanCount(user2.address)).to.equal(1);
    });

    it("Should test view functions with single user multiple loans", async function () {
      const { ecoStabilizer, astaVerde, scc, user1, user2 } = await loadFixture(deployEcoStabilizerFixture);

      // User1 deposits their NFT
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      // User2 deposits their NFT, then transfers it to user1 so user1 can deposit it too
      await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
      await astaVerde.connect(user2).safeTransferFrom(user2.address, user1.address, 2, 1, "0x");
      
      // Now user1 deposits the second NFT
      await ecoStabilizer.connect(user1).deposit(2);

      // Check counts
      expect(await ecoStabilizer.getUserLoanCount(user1.address)).to.equal(2);
      expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(2);

      // Get user loans list
      const userLoans = await ecoStabilizer.getUserLoans(user1.address);
      expect(userLoans.length).to.equal(2);
      expect(userLoans).to.include(1n);
      expect(userLoans).to.include(2n);

      // Withdraw one loan
      await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));
      await ecoStabilizer.connect(user1).withdraw(1);

      // Check updated counts
      expect(await ecoStabilizer.getUserLoanCount(user1.address)).to.equal(1);
      expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(1);

      // Verify the remaining loan
      const remainingLoans = await ecoStabilizer.getUserLoans(user1.address);
      expect(remainingLoans.length).to.equal(1);
      expect(remainingLoans[0]).to.equal(2n);
    });

    it("Should test edge cases for view functions", async function () {
      const { ecoStabilizer, user1 } = await loadFixture(deployEcoStabilizerFixture);

      // Test with address that has no loans
      expect(await ecoStabilizer.getUserLoanCount(user1.address)).to.equal(0);
      expect(await ecoStabilizer.getUserLoans(user1.address)).to.deep.equal([]);
      
      // Test total loans when no loans exist
      expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(0);
    });

    it("Should test pause functionality in edge cases", async function () {
      const { ecoStabilizer, astaVerde, scc, owner, user1, user2 } = await loadFixture(deployEcoStabilizerFixture);

      // First make a deposit with user1's NFT
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      // Pause the contract
      await ecoStabilizer.connect(owner).pause();
      expect(await ecoStabilizer.paused()).to.be.true;

      // Try to deposit user2's NFT while paused (should fail)
      await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
      await expect(ecoStabilizer.connect(user2).deposit(2))
        .to.be.revertedWithCustomError(ecoStabilizer, "EnforcedPause");

      // Try to withdraw while paused (should fail)
      await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));
      await expect(ecoStabilizer.connect(user1).withdraw(1))
        .to.be.revertedWithCustomError(ecoStabilizer, "EnforcedPause");

      // Try repayAndWithdraw while paused (should fail)
      await expect(ecoStabilizer.connect(user1).repayAndWithdraw(1))
        .to.be.revertedWithCustomError(ecoStabilizer, "EnforcedPause");

      // Unpause and verify functionality returns
      await ecoStabilizer.connect(owner).unpause();
      expect(await ecoStabilizer.paused()).to.be.false;

      // Now withdraw should work
      await ecoStabilizer.connect(user1).withdraw(1);
      
      // Verify loan is closed
      const loan = await ecoStabilizer.loans(1);
      expect(loan.active).to.be.false;
    });

    it("Should test gas efficiency of view functions", async function () {
      const { ecoStabilizer, astaVerde, user1, user2 } = await loadFixture(deployEcoStabilizerFixture);

      // Setup loans: user1 gets both NFTs and deposits them
      await astaVerde.connect(user2).safeTransferFrom(user2.address, user1.address, 2, 1, "0x");
      
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);
      await ecoStabilizer.connect(user1).deposit(2);

      // Test that view functions don't consume gas (they're view/pure)
      // These should not revert and should return correct values
      const userLoanCount = await ecoStabilizer.getUserLoanCount(user1.address);
      const totalLoans = await ecoStabilizer.getTotalActiveLoans();
      const userLoans = await ecoStabilizer.getUserLoans(user1.address);

      expect(userLoanCount).to.equal(2);
      expect(totalLoans).to.equal(2);
      expect(userLoans.length).to.equal(2);
    });
  });

  describe("Integration Coverage Tests", function () {
    it("Should test complete deposit-withdraw cycle with all functions", async function () {
      const { ecoStabilizer, astaVerde, scc, owner, user1 } = await loadFixture(deployEcoStabilizerFixture);

      // 1. Initial state
      expect(await ecoStabilizer.getUserLoanCount(user1.address)).to.equal(0);
      expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(0);

      // 2. Deposit NFT
      await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
      await ecoStabilizer.connect(user1).deposit(1);

      // 3. Verify state changes
      expect(await ecoStabilizer.getUserLoanCount(user1.address)).to.equal(1);
      expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(1);
      expect(await scc.balanceOf(user1.address)).to.equal(ethers.parseEther("20"));

      // 4. Test burn functionality
      const burnAmount = ethers.parseEther("5");
      await scc.connect(user1).burn(burnAmount);
      expect(await scc.balanceOf(user1.address)).to.equal(ethers.parseEther("15"));

      // 5. Grant owner MINTER_ROLE temporarily to mint replacement SCC
      const MINTER_ROLE = await scc.MINTER_ROLE();
      await scc.grantRole(MINTER_ROLE, owner.address);
      await scc.connect(owner).mint(user1.address, ethers.parseEther("5"));
      expect(await scc.balanceOf(user1.address)).to.equal(ethers.parseEther("20"));

      // 6. Approve and withdraw
      await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));
      await ecoStabilizer.connect(user1).withdraw(1);

      // 7. Verify final state
      expect(await ecoStabilizer.getUserLoanCount(user1.address)).to.equal(0);
      expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(0);
      expect(await scc.balanceOf(user1.address)).to.equal(0);
      expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);

      // Clean up
      await scc.revokeRole(MINTER_ROLE, owner.address);
    });
  });
}); 