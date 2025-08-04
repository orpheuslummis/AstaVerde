import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import type { StabilizedCarbonCoin } from "../types";

describe("StabilizedCarbonCoin", function () {
  async function deploySCCFixture() {
    const [owner, minter, user1, user2] = await ethers.getSigners();

    const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
    const scc = await SCCFactory.deploy();

    const MINTER_ROLE = await scc.MINTER_ROLE();
    const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();

    return {
      scc,
      owner,
      minter,
      user1,
      user2,
      MINTER_ROLE,
      DEFAULT_ADMIN_ROLE
    };
  }

  describe("Deployment", function () {
    it("Should have correct name, symbol, and decimals", async function () {
      const { scc } = await loadFixture(deploySCCFixture);

      expect(await scc.name()).to.equal("Stabilized Carbon Coin");
      expect(await scc.symbol()).to.equal("SCC");
      expect(await scc.decimals()).to.equal(18);
    });

    it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const { scc, owner, DEFAULT_ADMIN_ROLE } = await loadFixture(deploySCCFixture);

      expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should not grant MINTER_ROLE to deployer initially", async function () {
      const { scc, owner, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      expect(await scc.hasRole(MINTER_ROLE, owner.address)).to.be.false;
    });
  });

  describe("Role Management", function () {
    it("Should allow admin to grant MINTER_ROLE", async function () {
      const { scc, owner, minter, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      expect(await scc.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("Should allow admin to revoke MINTER_ROLE", async function () {
      const { scc, owner, minter, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      await scc.connect(owner).revokeRole(MINTER_ROLE, minter.address);
      expect(await scc.hasRole(MINTER_ROLE, minter.address)).to.be.false;
    });

    it("Should reject role management by non-admin", async function () {
      const { scc, user1, minter, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await expect(scc.connect(user1).grantRole(MINTER_ROLE, minter.address))
        .to.be.revertedWithCustomError(scc, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Minting", function () {
    it("Should allow minter to mint tokens", async function () {
      const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      
      const amount = ethers.parseEther("100");
      await scc.connect(minter).mint(user1.address, amount);

      expect(await scc.balanceOf(user1.address)).to.equal(amount);
      expect(await scc.totalSupply()).to.equal(amount);
    });

    it("Should reject minting by non-minter", async function () {
      const { scc, user1, user2 } = await loadFixture(deploySCCFixture);

      const amount = ethers.parseEther("100");
      
      await expect(scc.connect(user1).mint(user2.address, amount))
        .to.be.revertedWithCustomError(scc, "AccessControlUnauthorizedAccount");
    });

    it("Should emit Transfer event on mint", async function () {
      const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      
      const amount = ethers.parseEther("100");
      
      await expect(scc.connect(minter).mint(user1.address, amount))
        .to.emit(scc, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, amount);
    });
  });

  describe("Burning", function () {
    it("Should allow token holder to burn their tokens", async function () {
      const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      
      const mintAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("30");
      
      await scc.connect(minter).mint(user1.address, mintAmount);
      await scc.connect(user1).burn(burnAmount);

      expect(await scc.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
      expect(await scc.totalSupply()).to.equal(mintAmount - burnAmount);
    });

    it("Should reject burning more than balance", async function () {
      const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      
      const mintAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("150");
      
      await scc.connect(minter).mint(user1.address, mintAmount);
      
      await expect(scc.connect(user1).burn(burnAmount))
        .to.be.revertedWithCustomError(scc, "ERC20InsufficientBalance");
    });

    it("Should emit Transfer event on burn", async function () {
      const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      
      const mintAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("30");
      
      await scc.connect(minter).mint(user1.address, mintAmount);
      
      await expect(scc.connect(user1).burn(burnAmount))
        .to.emit(scc, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, burnAmount);
    });
  });

  describe("BurnFrom Functionality", function () {
    it("Should allow approved spender to burn tokens from user", async function () {
      const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      
      const mintAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("30");
      
      await scc.connect(minter).mint(user1.address, mintAmount);
      await scc.connect(user1).approve(user2.address, burnAmount);
      
      await scc.connect(user2).burnFrom(user1.address, burnAmount);

      expect(await scc.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
      expect(await scc.totalSupply()).to.equal(mintAmount - burnAmount);
      expect(await scc.allowance(user1.address, user2.address)).to.equal(0);
    });

    it("Should reject burnFrom with insufficient allowance", async function () {
      const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      
      const mintAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("30");
      const lowAllowance = ethers.parseEther("10");
      
      await scc.connect(minter).mint(user1.address, mintAmount);
      await scc.connect(user1).approve(user2.address, lowAllowance);
      
      await expect(scc.connect(user2).burnFrom(user1.address, burnAmount))
        .to.be.revertedWithCustomError(scc, "ERC20InsufficientAllowance");
    });

    it("Should reject burnFrom with no allowance", async function () {
      const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      
      const mintAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("30");
      
      await scc.connect(minter).mint(user1.address, mintAmount);
      // No approval given
      
      await expect(scc.connect(user2).burnFrom(user1.address, burnAmount))
        .to.be.revertedWithCustomError(scc, "ERC20InsufficientAllowance");
    });

    it("Should emit Transfer event on burnFrom", async function () {
      const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      
      const mintAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("30");
      
      await scc.connect(minter).mint(user1.address, mintAmount);
      await scc.connect(user1).approve(user2.address, burnAmount);
      
      await expect(scc.connect(user2).burnFrom(user1.address, burnAmount))
        .to.emit(scc, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, burnAmount);
    });
  });

  describe("Standard ERC20 Functions", function () {
    it("Should support transfers between users", async function () {
      const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      
      const amount = ethers.parseEther("100");
      const transferAmount = ethers.parseEther("30");
      
      await scc.connect(minter).mint(user1.address, amount);
      await scc.connect(user1).transfer(user2.address, transferAmount);

      expect(await scc.balanceOf(user1.address)).to.equal(amount - transferAmount);
      expect(await scc.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("Should support allowances and transferFrom", async function () {
      const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

      await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
      
      const amount = ethers.parseEther("100");
      const transferAmount = ethers.parseEther("30");
      
      await scc.connect(minter).mint(user1.address, amount);
      await scc.connect(user1).approve(user2.address, transferAmount);
      await scc.connect(user2).transferFrom(user1.address, user2.address, transferAmount);

      expect(await scc.balanceOf(user1.address)).to.equal(amount - transferAmount);
      expect(await scc.balanceOf(user2.address)).to.equal(transferAmount);
      expect(await scc.allowance(user1.address, user2.address)).to.equal(0);
    });
  });
}); 