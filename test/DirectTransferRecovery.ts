import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../types";

describe("Direct Transfer Recovery", function () {
    async function deployDirectTransferFixture() {
        const [owner, producer, userA, userB, userC, userD, userE, userF, attacker] = await ethers.getSigners();

        // Deploy MockUSDC
        const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDCFactory.deploy(ethers.parseUnits("1000000", 6));

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

        // Fund users with USDC
        const users = [userA, userB, userC, userD, userE, userF];
        for (const user of users) {
            await mockUSDC.mint(user.address, ethers.parseUnits("1000", 6));
        }

        // Mint initial batch with 8 NFTs
        const producers = Array(8).fill(producer.address);
        const cids = Array(8)
            .fill(null)
            .map((_, i) => `QmCID${i + 1}`);
        await astaVerde.mintBatch(producers, cids);

        // Users buy NFTs
        const price = await astaVerde.getCurrentBatchPrice(1);
        for (let i = 0; i < users.length; i++) {
            await mockUSDC.connect(users[i]).approve(astaVerde.target, price);
            await astaVerde.connect(users[i]).buyBatch(1, price, 1);
        }

        return {
            astaVerde,
            scc,
            ecoStabilizer,
            mockUSDC,
            owner,
            producer,
            userA,
            userB,
            userC,
            userD,
            userE,
            userF,
            attacker,
            MINTER_ROLE,
        };
    }

    describe("Direct NFT Transfer Recovery Flows", function () {
        it("Should handle NFTs sent directly to vault without deposit", async function () {
            const { astaVerde, scc, ecoStabilizer, userA, owner } = await loadFixture(deployDirectTransferFixture);

            // ========== 1. ACCIDENTAL DIRECT TRANSFER ==========
            // UserA owns NFT #1
            expect(await astaVerde.balanceOf(userA.address, 1)).to.equal(1);

            // UserA mistakenly transfers NFT #1 directly to vault address
            await astaVerde.connect(userA).safeTransferFrom(userA.address, ecoStabilizer.target, 1, 1, "0x");

            // Verify vault received NFT but no loan created
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(userA.address, 1)).to.equal(0);

            // Check no loan exists
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.false;
            expect(loan.borrower).to.equal(ethers.ZeroAddress);

            // UserA has no SCC
            expect(await scc.balanceOf(userA.address)).to.equal(0);

            // UserA attempts withdrawal (should fail)
            await expect(ecoStabilizer.connect(userA).withdraw(1)).to.be.revertedWith("not borrower");

            // ========== 2. ADMIN SWEEP RECOVERY ==========
            // Admin calls adminSweepNFT to return NFT to UserA
            await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, userA.address))
                .to.emit(ecoStabilizer, "EmergencyNFTWithdrawn")
                .withArgs(userA.address, 1);

            // Verify NFT returned to UserA
            expect(await astaVerde.balanceOf(userA.address, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(0);

            // No SCC was minted
            expect(await scc.balanceOf(userA.address)).to.equal(0);
            expect(await scc.totalSupply()).to.equal(0);

            // ========== 3. PROPER DEPOSIT AFTER RECOVERY ==========
            // UserA now deposits properly
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);

            await expect(ecoStabilizer.connect(userA).deposit(1))
                .to.emit(ecoStabilizer, "Deposited")
                .withArgs(userA.address, 1);

            // Verify loan created and SCC minted
            const loanAfterDeposit = await ecoStabilizer.loans(1);
            expect(loanAfterDeposit.active).to.be.true;
            expect(loanAfterDeposit.borrower).to.equal(userA.address);
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("20"));

            // Normal withdrawal works
            await scc.connect(userA).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(userA).withdraw(1);
            expect(await astaVerde.balanceOf(userA.address, 1)).to.equal(1);
        });

        it("Should handle mixed scenario with active loans and direct transfers", async function () {
            const { astaVerde, scc, ecoStabilizer, userB, userC, userD, owner } =
                await loadFixture(deployDirectTransferFixture);

            // ========== 4. MIXED SCENARIO ==========
            // UserB deposits NFT #2 properly (creates active loan)
            await astaVerde.connect(userB).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userB).deposit(2);

            // UserC sends NFT #3 directly to vault (no loan)
            await astaVerde.connect(userC).safeTransferFrom(userC.address, ecoStabilizer.target, 3, 1, "0x");

            // UserD deposits NFT #4 properly (creates active loan)
            await astaVerde.connect(userD).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userD).deposit(4);

            // Verify vault holds all 3 NFTs
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 2)).to.equal(1);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 3)).to.equal(1);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 4)).to.equal(1);

            // But only 2 loans exist
            expect((await ecoStabilizer.loans(2)).active).to.be.true;
            expect((await ecoStabilizer.loans(3)).active).to.be.false;
            expect((await ecoStabilizer.loans(4)).active).to.be.true;

            // Admin attempts to sweep NFT #2 (should fail - active loan)
            await expect(ecoStabilizer.connect(owner).adminSweepNFT(2, userB.address)).to.be.revertedWith(
                "loan active",
            );

            // Admin successfully sweeps NFT #3 (no loan)
            await expect(ecoStabilizer.connect(owner).adminSweepNFT(3, userC.address))
                .to.emit(ecoStabilizer, "EmergencyNFTWithdrawn")
                .withArgs(userC.address, 3);

            // Admin cannot sweep NFT #4 (active loan)
            await expect(ecoStabilizer.connect(owner).adminSweepNFT(4, userD.address)).to.be.revertedWith(
                "loan active",
            );

            // Verify final state
            expect(await astaVerde.balanceOf(userC.address, 3)).to.equal(1); // Returned
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 2)).to.equal(1); // Still in vault
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 4)).to.equal(1); // Still in vault
        });

        it("Should handle malicious dust attack scenario", async function () {
            const { astaVerde, ecoStabilizer, owner, attacker, mockUSDC } =
                await loadFixture(deployDirectTransferFixture);

            // ========== 5. MALICIOUS DUST ATTACK ==========
            // Simplified test: Attacker gets some NFTs through a secondary batch
            // Mint small batch for attacker demonstration
            const junkProducers = Array(12).fill(attacker.address);
            const junkCids = Array(12)
                .fill(null)
                .map((_, i) => `QmJunk${i}`);

            await astaVerde.connect(owner).mintBatch(junkProducers, junkCids);

            // For test simplicity, have owner buy and transfer to attacker
            // (In real scenario, attacker would buy or have their own NFTs)
            const junkPrice = await astaVerde.getCurrentBatchPrice(2);
            const totalJunkPrice = junkPrice * 12n;
            await mockUSDC.mint(owner.address, totalJunkPrice);
            await mockUSDC.connect(owner).approve(astaVerde.target, totalJunkPrice);
            await astaVerde.connect(owner).buyBatch(2, totalJunkPrice, 12);

            // Transfer junk NFTs to attacker
            for (let i = 9; i <= 20; i++) {
                await astaVerde.connect(owner).safeTransferFrom(owner.address, attacker.address, i, 1, "0x");
            }

            // Attacker sends all junk NFTs directly to vault
            for (let i = 9; i <= 20; i++) {
                await astaVerde.connect(attacker).safeTransferFrom(attacker.address, ecoStabilizer.target, i, 1, "0x");
            }

            // Verify vault received but no loans created
            for (let i = 9; i <= 20; i++) {
                expect(await astaVerde.balanceOf(ecoStabilizer.target, i)).to.equal(1);
                expect((await ecoStabilizer.loans(i)).active).to.be.false;
            }

            // Admin can sweep them back or to burn address
            const burnAddress = "0x000000000000000000000000000000000000dEaD";

            // Sweep first few back to attacker
            await ecoStabilizer.connect(owner).adminSweepNFT(9, attacker.address);
            await ecoStabilizer.connect(owner).adminSweepNFT(10, attacker.address);

            // Sweep rest to burn address
            for (let i = 11; i <= 15; i++) {
                await ecoStabilizer.connect(owner).adminSweepNFT(i, burnAddress);
            }

            // Active loans remain completely unaffected
            // (Would need to create one to verify, but point is made)
        });

        it("Should handle direct batch transfer correctly", async function () {
            const { astaVerde, ecoStabilizer, userE, owner, mockUSDC } = await loadFixture(deployDirectTransferFixture);

            // ========== 6. DIRECT BATCH TRANSFER ==========
            // UserE owns NFT #5 already
            expect(await astaVerde.balanceOf(userE.address, 5)).to.equal(1);

            // Buy additional NFTs from remaining batch 1
            const price = await astaVerde.getCurrentBatchPrice(1);
            await mockUSDC.connect(userE).approve(astaVerde.target, price);
            await astaVerde.connect(userE).buyBatch(1, price, 1); // Gets NFT #7

            // Mint and buy one more NFT for userE
            await astaVerde.connect(owner).mintBatch([owner.address], ["QmExtra"]);
            const price2 = await astaVerde.getCurrentBatchPrice(2);
            await mockUSDC.connect(userE).approve(astaVerde.target, price2);
            await astaVerde.connect(userE).buyBatch(2, price2, 1); // Gets NFT #9

            // UserE batch transfers [5,7,9] to vault directly
            await astaVerde
                .connect(userE)
                .safeBatchTransferFrom(userE.address, ecoStabilizer.target, [5, 7, 9], [1, 1, 1], "0x");

            // Verify all received but no loans created
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 5)).to.equal(1);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 7)).to.equal(1);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 9)).to.equal(1);

            expect((await ecoStabilizer.loans(5)).active).to.be.false;
            expect((await ecoStabilizer.loans(7)).active).to.be.false;
            expect((await ecoStabilizer.loans(9)).active).to.be.false;

            // Admin must sweep each individually
            await ecoStabilizer.connect(owner).adminSweepNFT(5, userE.address);
            await ecoStabilizer.connect(owner).adminSweepNFT(7, userE.address);
            await ecoStabilizer.connect(owner).adminSweepNFT(9, userE.address);

            // All returned to UserE
            expect(await astaVerde.balanceOf(userE.address, 5)).to.equal(1);
            expect(await astaVerde.balanceOf(userE.address, 7)).to.equal(1);
            expect(await astaVerde.balanceOf(userE.address, 9)).to.equal(1);
        });

        it("Should handle race condition with direct transfer and deposit attempt", async function () {
            const { astaVerde, ecoStabilizer, userF, owner } = await loadFixture(deployDirectTransferFixture);

            // ========== 7. RACE CONDITION ==========
            // UserF owns NFT #6
            expect(await astaVerde.balanceOf(userF.address, 6)).to.equal(1);

            // UserF sends NFT #6 directly to vault
            await astaVerde.connect(userF).safeTransferFrom(userF.address, ecoStabilizer.target, 6, 1, "0x");

            // UserF immediately tries to deposit #6 (forgetting they already sent it)
            await astaVerde.connect(userF).setApprovalForAll(ecoStabilizer.target, true);

            // Deposit fails because UserF doesn't own it anymore
            await expect(ecoStabilizer.connect(userF).deposit(6)).to.be.revertedWith("not token owner");

            // Vault already owns it
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 6)).to.equal(1);
            expect(await astaVerde.balanceOf(userF.address, 6)).to.equal(0);

            // Admin sweeps back to UserF
            await ecoStabilizer.connect(owner).adminSweepNFT(6, userF.address);

            // Now UserF can deposit properly
            await expect(ecoStabilizer.connect(userF).deposit(6))
                .to.emit(ecoStabilizer, "Deposited")
                .withArgs(userF.address, 6);

            // Loan created successfully
            const loan = await ecoStabilizer.loans(6);
            expect(loan.active).to.be.true;
            expect(loan.borrower).to.equal(userF.address);
        });

        it("Should prevent admin sweep to zero address", async function () {
            const { astaVerde, ecoStabilizer, userA, owner } = await loadFixture(deployDirectTransferFixture);

            // Send NFT directly to vault
            await astaVerde.connect(userA).safeTransferFrom(userA.address, ecoStabilizer.target, 1, 1, "0x");

            // Admin cannot sweep to zero address
            await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, ethers.ZeroAddress)).to.be.revertedWith(
                "invalid address",
            );
        });

        it("Should handle sweep after loan is cleared", async function () {
            const { astaVerde, scc, ecoStabilizer, userA, owner } = await loadFixture(deployDirectTransferFixture);

            // UserA deposits NFT properly
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userA).deposit(1);

            // Cannot sweep while loan active
            await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, userA.address)).to.be.revertedWith(
                "loan active",
            );

            // UserA withdraws NFT
            await scc.connect(userA).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(userA).withdraw(1);

            // UserA sends it back directly (by mistake)
            await astaVerde.connect(userA).safeTransferFrom(userA.address, ecoStabilizer.target, 1, 1, "0x");

            // Now admin can sweep (loan no longer active)
            await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, userA.address))
                .to.emit(ecoStabilizer, "EmergencyNFTWithdrawn")
                .withArgs(userA.address, 1);
        });
    });
});
