import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../typechain-types";

describe("Security & Deployment - Production Readiness Tests", function () {
    async function deploySecurityTestFixture() {
        const [owner, deployer, producer, user1, user2, attacker] = await ethers.getSigners();

        // Deploy MockUSDC
        const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDCFactory.deploy(ethers.parseUnits("1000000", 6));

        // Deploy AstaVerde (Phase 1 - already exists)
        const AstaVerdeFactory = await ethers.getContractFactory("AstaVerde");
        const astaVerde = await AstaVerdeFactory.deploy(owner.address, mockUSDC.target);

        // Deploy StabilizedCarbonCoin
        const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
        const scc = await SCCFactory.connect(deployer).deploy(ethers.ZeroAddress);

        // Deploy EcoStabilizer
        const EcoStabilizerFactory = await ethers.getContractFactory("EcoStabilizer");
        const ecoStabilizer = await EcoStabilizerFactory.connect(deployer).deploy(astaVerde.target, scc.target);

        // Setup test data
        await mockUSDC.mint(user1.address, ethers.parseUnits("1000", 6));
        await astaVerde.mintBatch([producer.address], ["QmTestCID"]);

        const batchPrice = await astaVerde.getCurrentBatchPrice(1);
        await mockUSDC.connect(user1).approve(astaVerde.target, batchPrice);
        await astaVerde.connect(user1).buyBatch(1, batchPrice, 1);

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
            attacker,
        };
    }

    describe("MINTER_ROLE and Admin Role Security", function () {
        it("Should verify correct deployment flow with role management", async function () {
            const { scc, ecoStabilizer, deployer } = await loadFixture(deploySecurityTestFixture);

            const MINTER_ROLE = await scc.MINTER_ROLE();
            const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();

            // Initial state: deployer has DEFAULT_ADMIN_ROLE, no one has MINTER_ROLE
            expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
            expect(await scc.hasRole(MINTER_ROLE, deployer.address)).to.be.false;
            expect(await scc.hasRole(MINTER_ROLE, ecoStabilizer.target)).to.be.false;

            // Step 1: Grant MINTER_ROLE to vault (deployment step)
            await scc.connect(deployer).grantRole(MINTER_ROLE, ecoStabilizer.target);
            expect(await scc.hasRole(MINTER_ROLE, ecoStabilizer.target)).to.be.true;

            // Step 2: Renounce DEFAULT_ADMIN_ROLE (critical security step)
            await scc.connect(deployer).renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
            expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.false;

            // Verify final state: Only vault can mint, no admin exists
            expect(await scc.hasRole(MINTER_ROLE, ecoStabilizer.target)).to.be.true;
            expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.false;
        });

        it("Should prevent granting MINTER_ROLE after admin renunciation", async function () {
            const { scc, ecoStabilizer, deployer, attacker } = await loadFixture(deploySecurityTestFixture);

            const MINTER_ROLE = await scc.MINTER_ROLE();
            const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();

            // Complete deployment flow
            await scc.connect(deployer).grantRole(MINTER_ROLE, ecoStabilizer.target);
            await scc.connect(deployer).renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);

            // Attacker should not be able to grant MINTER_ROLE to themselves
            await expect(scc.connect(attacker).grantRole(MINTER_ROLE, attacker.address)).to.be.revertedWithCustomError(
                scc,
                "AccessControlUnauthorizedAccount",
            );

            // Even deployer can't grant roles anymore
            await expect(scc.connect(deployer).grantRole(MINTER_ROLE, attacker.address)).to.be.revertedWithCustomError(
                scc,
                "AccessControlUnauthorizedAccount",
            );
        });

        it("Should ensure only vault can mint SCC after deployment", async function () {
            const { scc, ecoStabilizer, astaVerde, deployer, user1, attacker } =
                await loadFixture(deploySecurityTestFixture);

            const MINTER_ROLE = await scc.MINTER_ROLE();
            const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();

            // Complete deployment
            await scc.connect(deployer).grantRole(MINTER_ROLE, ecoStabilizer.target);
            await scc.connect(deployer).renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);

            // Vault can mint through deposit
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);
            expect(await scc.balanceOf(user1.address)).to.equal(ethers.parseEther("20"));

            // Direct mint attempts should fail
            await expect(
                scc.connect(attacker).mint(attacker.address, ethers.parseEther("1000")),
            ).to.be.revertedWithCustomError(scc, "AccessControlUnauthorizedAccount");

            await expect(
                scc.connect(deployer).mint(deployer.address, ethers.parseEther("1000")),
            ).to.be.revertedWithCustomError(scc, "AccessControlUnauthorizedAccount");
        });

        it("Should test complete production deployment scenario", async function () {
            // Fresh deployment simulating production
            const [deployer, vault_owner, user] = await ethers.getSigners();

            // Deploy contracts as they would be in production
            const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
            const mockUSDC = await MockUSDCFactory.deploy(ethers.parseUnits("1000000", 6));

            const AstaVerdeFactory = await ethers.getContractFactory("AstaVerde");
            const astaVerde = await AstaVerdeFactory.deploy(vault_owner.address, mockUSDC.target);

            // Step 1: Deploy SCC
            const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
            const scc = await SCCFactory.connect(deployer).deploy(ethers.ZeroAddress);

            // Step 2: Deploy Vault
            const EcoStabilizerFactory = await ethers.getContractFactory("EcoStabilizer");
            const ecoStabilizer = await EcoStabilizerFactory.connect(deployer).deploy(astaVerde.target, scc.target);

            // Step 3: Grant MINTER_ROLE to vault
            const MINTER_ROLE = await scc.MINTER_ROLE();
            await scc.connect(deployer).grantRole(MINTER_ROLE, ecoStabilizer.target);

            // Step 4: Renounce admin roles (CRITICAL)
            const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();
            await scc.connect(deployer).renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);

            // Step 5: Verify production state
            expect(await scc.hasRole(MINTER_ROLE, ecoStabilizer.target)).to.be.true;
            expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.false;
            expect(await ecoStabilizer.owner()).to.equal(deployer.address);

            // Step 6: Test functionality works (vault_owner owns AstaVerde)
            await astaVerde.connect(vault_owner).mintBatch([user.address], ["QmProdTest"]);
            await mockUSDC.mint(user.address, ethers.parseUnits("300", 6));

            const batchPrice = await astaVerde.getCurrentBatchPrice(1);
            await mockUSDC.connect(user).approve(astaVerde.target, batchPrice);
            await astaVerde.connect(user).buyBatch(1, batchPrice, 1);

            await astaVerde.connect(user).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user).deposit(1);

            expect(await scc.balanceOf(user.address)).to.equal(ethers.parseEther("20"));
        });
    });

    describe("Vault Ownership Security", function () {
        it("Should handle vault ownership transfer correctly", async function () {
            const { ecoStabilizer, astaVerde, deployer, user1, user2 } = await loadFixture(deploySecurityTestFixture);

            // Initial owner is deployer
            expect(await ecoStabilizer.owner()).to.equal(deployer.address);

            // Transfer ownership
            await ecoStabilizer.connect(deployer).transferOwnership(user1.address);
            expect(await ecoStabilizer.owner()).to.equal(user1.address);

            // New owner can admin functions
            await ecoStabilizer.connect(user1).pause();
            expect(await ecoStabilizer.paused()).to.be.true;

            // Old owner cannot admin
            await expect(ecoStabilizer.connect(deployer).unpause()).to.be.revertedWithCustomError(
                ecoStabilizer,
                "OwnableUnauthorizedAccount",
            );

            // New owner can unpause
            await ecoStabilizer.connect(user1).unpause();
            expect(await ecoStabilizer.paused()).to.be.false;

            // Test adminSweepNFT with new owner
            // First transfer NFT from user1 (who bought it) to vault directly
            await astaVerde.connect(user1).safeTransferFrom(user1.address, ecoStabilizer.target, 1, 1, "0x");
            await ecoStabilizer.connect(user1).adminSweepNFT(1, user1.address);
            expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
        });

        it("Should reject admin functions from non-owner", async function () {
            const { ecoStabilizer, attacker } = await loadFixture(deploySecurityTestFixture);

            await expect(ecoStabilizer.connect(attacker).pause()).to.be.revertedWithCustomError(
                ecoStabilizer,
                "OwnableUnauthorizedAccount",
            );

            await expect(
                ecoStabilizer.connect(attacker).adminSweepNFT(1, attacker.address),
            ).to.be.revertedWithCustomError(ecoStabilizer, "OwnableUnauthorizedAccount");

            await expect(
                ecoStabilizer.connect(attacker).transferOwnership(attacker.address),
            ).to.be.revertedWithCustomError(ecoStabilizer, "OwnableUnauthorizedAccount");
        });
    });

    describe("Failed Transaction Recovery", function () {
        it("Should handle failed SCC burns gracefully", async function () {
            const { ecoStabilizer, astaVerde, scc, deployer, user1 } = await loadFixture(deploySecurityTestFixture);

            // Complete deployment
            const MINTER_ROLE = await scc.MINTER_ROLE();
            const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();
            await scc.connect(deployer).grantRole(MINTER_ROLE, ecoStabilizer.target);
            await scc.connect(deployer).renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);

            // User deposits NFT
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            const initialSCCBalance = await scc.balanceOf(user1.address);
            expect(initialSCCBalance).to.equal(ethers.parseEther("20"));

            // User burns some SCC directly (not through withdraw)
            await scc.connect(user1).burn(ethers.parseEther("10"));
            expect(await scc.balanceOf(user1.address)).to.equal(ethers.parseEther("10"));

            // Attempt withdraw with insufficient SCC should fail
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("10"));
            await expect(ecoStabilizer.connect(user1).withdraw(1)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );

            // Verify loan state unchanged
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.true;
            expect(loan.borrower).to.equal(user1.address);

            // Verify NFT still in vault
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(0);
        });

        it("Should handle zero balance withdraw attempts", async function () {
            const { ecoStabilizer, scc, user1 } = await loadFixture(deploySecurityTestFixture);

            // User has no SCC, try to withdraw non-existent loan
            await expect(ecoStabilizer.connect(user1).withdraw(999)).to.be.revertedWith("not borrower");

            // User has no SCC balance
            expect(await scc.balanceOf(user1.address)).to.equal(0);
        });
    });

    describe("Access Control Edge Cases", function () {
        it("Should handle role admin changes correctly", async function () {
            const { scc, deployer, user1 } = await loadFixture(deploySecurityTestFixture);

            const MINTER_ROLE = await scc.MINTER_ROLE();
            const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();

            // Initially deployer is admin
            expect(await scc.getRoleAdmin(MINTER_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
            expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;

            // After renouncing admin role, no one can manage MINTER_ROLE
            await scc.connect(deployer).renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);

            // Verify no one can grant/revoke MINTER_ROLE
            await expect(scc.connect(user1).grantRole(MINTER_ROLE, user1.address)).to.be.revertedWithCustomError(
                scc,
                "AccessControlUnauthorizedAccount",
            );
        });

        it("Should verify role member enumeration works correctly", async function () {
            const { scc, ecoStabilizer, deployer } = await loadFixture(deploySecurityTestFixture);

            const MINTER_ROLE = await scc.MINTER_ROLE();
            const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();

            // Initially: deployer is admin, no minters
            expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
            expect(await scc.hasRole(MINTER_ROLE, ecoStabilizer.target)).to.be.false;

            // Grant MINTER_ROLE
            await scc.connect(deployer).grantRole(MINTER_ROLE, ecoStabilizer.target);
            expect(await scc.hasRole(MINTER_ROLE, ecoStabilizer.target)).to.be.true;

            // Renounce admin
            await scc.connect(deployer).renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
            expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.false;

            // Minter still works
            expect(await scc.hasRole(MINTER_ROLE, ecoStabilizer.target)).to.be.true;
        });
    });
});
