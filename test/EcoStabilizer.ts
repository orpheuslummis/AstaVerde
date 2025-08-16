import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import type { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../types";

describe("EcoStabilizer", function () {
    async function deployEcoStabilizerFixture() {
        const [owner, producer, user1, user2] = await ethers.getSigners();

        // Deploy MockUSDC
        const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDCFactory.deploy(ethers.parseUnits("1000000", 6)); // 1M USDC

        // Deploy AstaVerde
        const AstaVerdeFactory = await ethers.getContractFactory("AstaVerde");
        const astaVerde = await AstaVerdeFactory.deploy(owner.address, mockUSDC.target);

        // Deploy StabilizedCarbonCoin
        const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
        const scc = await SCCFactory.deploy(ethers.ZeroAddress);

        // Deploy EcoStabilizer
        const EcoStabilizerFactory = await ethers.getContractFactory("EcoStabilizer");
        const ecoStabilizer = await EcoStabilizerFactory.deploy(astaVerde.target, scc.target);

        // Grant MINTER_ROLE to vault
        const MINTER_ROLE = await scc.MINTER_ROLE();
        await scc.grantRole(MINTER_ROLE, ecoStabilizer.target);

        // Mint some USDC to users for testing
        await mockUSDC.mint(user1.address, ethers.parseUnits("1000", 6));
        await mockUSDC.mint(user2.address, ethers.parseUnits("1000", 6));

        // Mint a test batch of NFTs
        await astaVerde.mintBatch([producer.address], ["QmTestCID"]);

        // User1 buys the NFT properly through the AstaVerde contract
        const batchPrice = await astaVerde.getCurrentBatchPrice(1);
        await mockUSDC.connect(user1).approve(astaVerde.target, batchPrice);
        await astaVerde.connect(user1).buyBatch(1, batchPrice, 1);

        return {
            astaVerde,
            scc,
            ecoStabilizer,
            mockUSDC,
            owner,
            producer,
            user1,
            user2,
            MINTER_ROLE,
        };
    }

    describe("Deployment", function () {
        it("Should set the correct AstaVerde and SCC addresses", async function () {
            const { astaVerde, scc, ecoStabilizer } = await loadFixture(deployEcoStabilizerFixture);

            expect(await ecoStabilizer.ecoAsset()).to.equal(astaVerde.target);
            expect(await ecoStabilizer.scc()).to.equal(scc.target);
        });

        it("Should set correct constants", async function () {
            const { ecoStabilizer } = await loadFixture(deployEcoStabilizerFixture);

            expect(await ecoStabilizer.SCC_PER_ASSET()).to.equal(ethers.parseEther("20"));
        });
    });

    describe("Core Deposit Functionality", function () {
        it("Should allow deposit of un-redeemed NFT and mint SCC", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // Approve vault to transfer NFT
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

            // Initial balances
            const initialSCCBalance = await scc.balanceOf(user1.address);
            const initialNFTBalance = await astaVerde.balanceOf(user1.address, 1);

            // Deposit NFT
            const tx = await ecoStabilizer.connect(user1).deposit(1);

            // Check SCC was minted
            const finalSCCBalance = await scc.balanceOf(user1.address);
            expect(finalSCCBalance - initialSCCBalance).to.equal(ethers.parseEther("20"));

            // Check NFT was transferred to vault
            const finalNFTBalance = await astaVerde.balanceOf(user1.address, 1);
            expect(initialNFTBalance - finalNFTBalance).to.equal(1);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);

            // Check loan state
            const loan = await ecoStabilizer.loans(1);
            expect(loan.borrower).to.equal(user1.address);
            expect(loan.active).to.be.true;

            // Check event emission
            await expect(tx).to.emit(ecoStabilizer, "Deposited").withArgs(user1.address, 1);
        });

        it("Should measure gas consumption for deposit (target: <165k)", async function () {
            const { ecoStabilizer, astaVerde, user1 } = await loadFixture(deployEcoStabilizerFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

            const tx = await ecoStabilizer.connect(user1).deposit(1);
            const receipt = await tx.wait();

            expect(receipt!.gasUsed).to.be.lessThan(165000);
            console.log(`Deposit gas used: ${receipt!.gasUsed}`);
        });

        it("Should reject deposit of already active loan", async function () {
            const { ecoStabilizer, astaVerde, user1 } = await loadFixture(deployEcoStabilizerFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            await expect(ecoStabilizer.connect(user1).deposit(1)).to.be.revertedWith("loan active");
        });

        it("Should reject deposit of redeemed NFT", async function () {
            const { ecoStabilizer, astaVerde, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // Redeem the NFT first
            await astaVerde.connect(user1).redeemToken(1);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

            await expect(ecoStabilizer.connect(user1).deposit(1)).to.be.revertedWith("redeemed asset");
        });
    });

    describe("Core Withdraw Functionality", function () {
        it("Should allow withdraw by burning SCC and returning exact NFT", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // First deposit
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            // Approve SCC spending for withdraw
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));

            // Initial balances
            const initialSCCBalance = await scc.balanceOf(user1.address);
            const initialNFTBalance = await astaVerde.balanceOf(user1.address, 1);

            // Withdraw
            const tx = await ecoStabilizer.connect(user1).withdraw(1);

            // Check SCC was burned
            const finalSCCBalance = await scc.balanceOf(user1.address);
            expect(initialSCCBalance - finalSCCBalance).to.equal(ethers.parseEther("20"));

            // Check NFT was returned
            const finalNFTBalance = await astaVerde.balanceOf(user1.address, 1);
            expect(finalNFTBalance - initialNFTBalance).to.equal(1);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(0);

            // Check loan state
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.false;

            // Check event emission
            await expect(tx).to.emit(ecoStabilizer, "Withdrawn").withArgs(user1.address, 1);
        });

        it("Should measure gas consumption for withdraw (target: <120k)", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));

            const tx = await ecoStabilizer.connect(user1).withdraw(1);
            const receipt = await tx.wait();

            expect(receipt!.gasUsed).to.be.lessThan(120000);
            console.log(`Withdraw gas used: ${receipt!.gasUsed}`);
        });

        it("Should reject withdraw by non-borrower", async function () {
            const { ecoStabilizer, astaVerde, scc, user1, user2 } = await loadFixture(deployEcoStabilizerFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            // Mint SCC to user2 and try to withdraw user1's loan
            await scc.grantRole(await scc.MINTER_ROLE(), user2.address);
            await scc.connect(user2).mint(user2.address, ethers.parseEther("20"));
            await scc.connect(user2).approve(ecoStabilizer.target, ethers.parseEther("20"));

            await expect(ecoStabilizer.connect(user2).withdraw(1)).to.be.revertedWith("not borrower");
        });

        it("Should reject withdraw of inactive loan", async function () {
            const { ecoStabilizer, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            await scc.grantRole(await scc.MINTER_ROLE(), user1.address);
            await scc.connect(user1).mint(user1.address, ethers.parseEther("20"));
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));

            await expect(ecoStabilizer.connect(user1).withdraw(1)).to.be.revertedWith("not borrower");
        });

        it("Should reject withdraw with insufficient SCC allowance", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            // Approve insufficient amount
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("10"));

            await expect(ecoStabilizer.connect(user1).withdraw(1)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );
        });

        it("Should allow withdraw via single entrypoint", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // First deposit
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            // Approve SCC spending for withdraw (still required for convenience function)
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));

            // Initial balances
            const initialSCCBalance = await scc.balanceOf(user1.address);
            const initialNFTBalance = await astaVerde.balanceOf(user1.address, 1);

            // Use single entrypoint
            const tx = await ecoStabilizer.connect(user1).withdraw(1);

            // Check SCC was burned
            const finalSCCBalance = await scc.balanceOf(user1.address);
            expect(initialSCCBalance - finalSCCBalance).to.equal(ethers.parseEther("20"));

            // Check NFT was returned
            const finalNFTBalance = await astaVerde.balanceOf(user1.address, 1);
            expect(finalNFTBalance - initialNFTBalance).to.equal(1);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(0);

            // Check loan state
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.false;

            // Check event emission
            await expect(tx).to.emit(ecoStabilizer, "Withdrawn").withArgs(user1.address, 1);
        });

        it("Should measure gas consumption for withdraw (single entrypoint)", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));

            const tx = await ecoStabilizer.connect(user1).withdraw(1);
            const receipt = await tx.wait();

            console.log(`withdraw gas used: ${receipt!.gasUsed}`);
            expect(receipt!.gasUsed).to.be.lessThan(150000); // Should be efficient
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to pause/unpause", async function () {
            const { ecoStabilizer, owner } = await loadFixture(deployEcoStabilizerFixture);

            await ecoStabilizer.connect(owner).pause();
            expect(await ecoStabilizer.paused()).to.be.true;

            await ecoStabilizer.connect(owner).unpause();
            expect(await ecoStabilizer.paused()).to.be.false;
        });

        it("Should reject deposits when paused", async function () {
            const { ecoStabilizer, astaVerde, owner, user1 } = await loadFixture(deployEcoStabilizerFixture);

            await ecoStabilizer.connect(owner).pause();
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

            await expect(ecoStabilizer.connect(user1).deposit(1)).to.be.revertedWithCustomError(
                ecoStabilizer,
                "EnforcedPause",
            );
        });

        it("Should allow admin to sweep NFTs not in active loans", async function () {
            const { ecoStabilizer, astaVerde, owner, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // Send NFT directly to vault (simulating unsolicited transfer)
            await astaVerde.connect(user1).safeTransferFrom(user1.address, ecoStabilizer.target, 1, 1, "0x");

            const tx = await ecoStabilizer.connect(owner).adminSweepNFT(1, owner.address);

            expect(await astaVerde.balanceOf(owner.address, 1)).to.equal(1);
            await expect(tx).to.emit(ecoStabilizer, "EmergencyNFTWithdrawn").withArgs(owner.address, 1);
        });

        it("Should reject admin sweep of active loan NFT", async function () {
            const { ecoStabilizer, astaVerde, owner, user1 } = await loadFixture(deployEcoStabilizerFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, owner.address)).to.be.revertedWith(
                "loan active",
            );
        });
    });

    describe("View Functions", function () {
        it("Should return correct user loans", async function () {
            const { ecoStabilizer, astaVerde, mockUSDC, owner, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // Mint additional NFTs and user1 buys them
            await astaVerde.mintBatch([owner.address], ["QmTest2"]);

            const batch2Price = await astaVerde.getCurrentBatchPrice(2);
            await mockUSDC.connect(user1).approve(astaVerde.target, batch2Price);
            await astaVerde.connect(user1).buyBatch(2, batch2Price, 1);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

            // Deposit multiple NFTs
            await ecoStabilizer.connect(user1).deposit(1);
            await ecoStabilizer.connect(user1).deposit(2);

            const userLoans = await ecoStabilizer.getUserLoans(user1.address);
            expect(userLoans.length).to.equal(2);
            expect(userLoans).to.include(1n);
            expect(userLoans).to.include(2n);
        });

        it("Should return correct total active loans", async function () {
            const { ecoStabilizer, astaVerde, mockUSDC, owner, user1, user2 } =
                await loadFixture(deployEcoStabilizerFixture);

            // Mint additional NFTs and user2 buys them
            await astaVerde.mintBatch([owner.address], ["QmTest2"]);

            const batch2Price = await astaVerde.getCurrentBatchPrice(2);
            await mockUSDC.connect(user2).approve(astaVerde.target, batch2Price);
            await astaVerde.connect(user2).buyBatch(2, batch2Price, 1);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);

            await ecoStabilizer.connect(user1).deposit(1);
            await ecoStabilizer.connect(user2).deposit(2);

            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(2);
        });
    });

    describe("Access Control", function () {
        it("Should reject non-owner admin functions", async function () {
            const { ecoStabilizer, user1 } = await loadFixture(deployEcoStabilizerFixture);

            await expect(ecoStabilizer.connect(user1).pause()).to.be.revertedWithCustomError(
                ecoStabilizer,
                "OwnableUnauthorizedAccount",
            );

            await expect(ecoStabilizer.connect(user1).adminSweepNFT(1, user1.address)).to.be.revertedWithCustomError(
                ecoStabilizer,
                "OwnableUnauthorizedAccount",
            );
        });
    });

    describe("Dynamic Range View Functions", function () {
        it("Should use dynamic range based on AstaVerde.lastTokenID instead of hardcoded 10,000", async function () {
            const { ecoStabilizer, astaVerde, mockUSDC, owner, user1, user2 } =
                await loadFixture(deployEcoStabilizerFixture);

            // Initially only 1 token exists (minted in fixture)
            expect(await astaVerde.lastTokenID()).to.equal(1);
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(0);

            // Mint more batches to exceed what would have been the old range
            await astaVerde.mintBatch([owner.address], ["QmTest2"]);
            await astaVerde.mintBatch([owner.address], ["QmTest3"]);

            // Buy the new tokens
            const batch2Price = await astaVerde.getCurrentBatchPrice(2);
            const batch3Price = await astaVerde.getCurrentBatchPrice(3);

            await mockUSDC.connect(user2).approve(astaVerde.target, batch2Price);
            await astaVerde.connect(user2).buyBatch(2, batch2Price, 1);

            await mockUSDC.connect(user2).approve(astaVerde.target, batch3Price);
            await astaVerde.connect(user2).buyBatch(3, batch3Price, 1);

            // Now we have tokens 1, 2, 3 - lastTokenID should be 3
            expect(await astaVerde.lastTokenID()).to.equal(3);

            // Deposit tokens
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);

            await ecoStabilizer.connect(user1).deposit(1);
            await ecoStabilizer.connect(user2).deposit(2);
            await ecoStabilizer.connect(user2).deposit(3);

            // Test dynamic range functions
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(3);
            expect(await ecoStabilizer.getUserLoanCount(user1.address)).to.equal(1);
            expect(await ecoStabilizer.getUserLoanCount(user2.address)).to.equal(2);

            const user1Loans = await ecoStabilizer.getUserLoans(user1.address);
            const user2Loans = await ecoStabilizer.getUserLoans(user2.address);

            expect([...user1Loans]).to.deep.equal([1n]);
            expect([...user2Loans]).to.have.members([2n, 3n]);
        });

        it("Should handle empty case when no tokens exist", async function () {
            const { scc, astaVerde, mockUSDC, owner } = await loadFixture(deployEcoStabilizerFixture);

            // Deploy fresh contracts with no tokens minted
            const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
            const freshSCC = await SCCFactory.deploy(ethers.ZeroAddress);

            const AstaVerdeFactory = await ethers.getContractFactory("AstaVerde");
            const freshAstaVerde = await AstaVerdeFactory.deploy(owner.address, mockUSDC.target);

            const EcoStabilizerFactory = await ethers.getContractFactory("EcoStabilizer");
            const freshEcoStabilizer = await EcoStabilizerFactory.deploy(freshAstaVerde.target, freshSCC.target);

            // Grant MINTER_ROLE
            const MINTER_ROLE = await freshSCC.MINTER_ROLE();
            await freshSCC.grantRole(MINTER_ROLE, freshEcoStabilizer.target);

            // lastTokenID should be 0 initially
            expect(await freshAstaVerde.lastTokenID()).to.equal(0);

            // View functions should work even with 0 tokens
            expect(await freshEcoStabilizer.getTotalActiveLoans()).to.equal(0);
            expect(await freshEcoStabilizer.getUserLoanCount(owner.address)).to.equal(0);
            expect(await freshEcoStabilizer.getUserLoans(owner.address)).to.deep.equal([]);
        });
    });
});
