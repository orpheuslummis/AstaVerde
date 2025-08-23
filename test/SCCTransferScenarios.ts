import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../types";

describe("SCC Transfer Scenarios", function () {
    async function deploySCCTransferFixture() {
        const [owner, producer, userA, userB, userC] = await ethers.getSigners();

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
        await mockUSDC.mint(userA.address, ethers.parseUnits("2000", 6));
        await mockUSDC.mint(userB.address, ethers.parseUnits("1000", 6));

        // Mint batch with multiple NFTs
        await astaVerde.mintBatch(
            [producer.address, producer.address, producer.address],
            ["QmCID1", "QmCID2", "QmCID3"]
        );

        // UserA buys all 3 NFTs
        const price = await astaVerde.getCurrentBatchPrice(1);
        const totalPrice = price * 3n;
        await mockUSDC.connect(userA).approve(astaVerde.target, totalPrice);
        await astaVerde.connect(userA).buyBatch(1, totalPrice, 3);

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
            MINTER_ROLE,
        };
    }

    describe("SCC Transfer Impact on Withdrawals", function () {
        it("Should prevent withdrawal when SCC is transferred away - Complete Transfer", async function () {
            const { astaVerde, scc, ecoStabilizer, userA, userB } = 
                await loadFixture(deploySCCTransferFixture);

            // ========== INITIAL DEPOSIT ==========
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userA).deposit(1);

            // Verify UserA receives 20 SCC
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("20"));

            // Check loan is active with UserA as borrower
            const loan = await ecoStabilizer.loans(1);
            expect(loan.borrower).to.equal(userA.address);
            expect(loan.active).to.be.true;

            // ========== SCENARIO A: COMPLETE TRANSFER ==========
            // UserA transfers all 20 SCC to UserB
            await scc.connect(userA).transfer(userB.address, ethers.parseEther("20"));
            expect(await scc.balanceOf(userA.address)).to.equal(0);
            expect(await scc.balanceOf(userB.address)).to.equal(ethers.parseEther("20"));

            // UserA attempts withdrawal (should fail - no SCC)
            await expect(ecoStabilizer.connect(userA).withdraw(1))
                .to.be.revertedWith("ERC20: insufficient allowance");

            // UserB attempts withdrawal (should fail - not borrower)
            await scc.connect(userB).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await expect(ecoStabilizer.connect(userB).withdraw(1))
                .to.be.revertedWith("not borrower");

            // Loan remains active
            const loanAfterFailure = await ecoStabilizer.loans(1);
            expect(loanAfterFailure.active).to.be.true;
        });

        it("Should prevent withdrawal with partial SCC transfer", async function () {
            const { astaVerde, scc, ecoStabilizer, userA, userB } = 
                await loadFixture(deploySCCTransferFixture);

            // UserA deposits NFT #1
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userA).deposit(1);

            // ========== SCENARIO B: PARTIAL TRANSFER ==========
            // UserA transfers 10 SCC to UserB
            await scc.connect(userA).transfer(userB.address, ethers.parseEther("10"));
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("10"));

            // UserA attempts withdrawal with only 10 SCC (should fail)
            await scc.connect(userA).approve(ecoStabilizer.target, ethers.parseEther("10"));
            await expect(ecoStabilizer.connect(userA).withdraw(1))
                .to.be.revertedWith("ERC20: insufficient allowance");

            // Verify loan still active
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.true;
        });

        it("Should allow withdrawal after SCC is returned", async function () {
            const { astaVerde, scc, ecoStabilizer, userA, userB } = 
                await loadFixture(deploySCCTransferFixture);

            // UserA deposits NFT #1
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userA).deposit(1);

            // ========== SCENARIO C: SCC RETURN PATH ==========
            // UserA transfers all SCC to UserB
            await scc.connect(userA).transfer(userB.address, ethers.parseEther("20"));

            // UserB transfers 20 SCC back to UserA
            await scc.connect(userB).transfer(userA.address, ethers.parseEther("20"));
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("20"));

            // UserA approves vault and successfully withdraws
            await scc.connect(userA).approve(ecoStabilizer.target, ethers.parseEther("20"));
            
            await expect(ecoStabilizer.connect(userA).withdraw(1))
                .to.emit(ecoStabilizer, "Withdrawn")
                .withArgs(userA.address, 1);

            // Verify NFT returned and loan cleared
            expect(await astaVerde.balanceOf(userA.address, 1)).to.equal(1);
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.false;
        });

        it("Should handle delegation scenarios correctly", async function () {
            const { astaVerde, scc, ecoStabilizer, userA, userB } = 
                await loadFixture(deploySCCTransferFixture);

            // ========== DELEGATION SCENARIO ==========
            // UserA deposits NFT #2
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userA).deposit(2);

            // UserA approves UserB for 20 SCC (delegation, not transfer)
            await scc.connect(userA).approve(userB.address, ethers.parseEther("20"));

            // UserB attempts to use delegated SCC for withdrawal (should fail)
            // Even though UserB has approval, they are not the borrower
            await expect(ecoStabilizer.connect(userB).withdraw(2))
                .to.be.revertedWith("not borrower");

            // UserA can still withdraw normally despite delegation
            await scc.connect(userA).approve(ecoStabilizer.target, ethers.parseEther("20"));
            
            await expect(ecoStabilizer.connect(userA).withdraw(2))
                .to.emit(ecoStabilizer, "Withdrawn")
                .withArgs(userA.address, 2);

            // Verify successful withdrawal
            expect(await astaVerde.balanceOf(userA.address, 2)).to.equal(1);
        });

        it("Should create ghost collateral when SCC is permanently lost", async function () {
            const { astaVerde, scc, ecoStabilizer, userA } = 
                await loadFixture(deploySCCTransferFixture);

            // ========== LOST SCC SCENARIO ==========
            // UserA deposits NFT #3
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userA).deposit(3);

            const initialSupply = await scc.totalSupply();
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("20"));

            // UserA accidentally burns 10 SCC
            await scc.connect(userA).burn(ethers.parseEther("10"));
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("10"));
            expect(await scc.totalSupply()).to.equal(initialSupply - ethers.parseEther("10"));

            // UserA can never withdraw NFT #3 (insufficient SCC)
            await scc.connect(userA).approve(ecoStabilizer.target, ethers.parseEther("10"));
            await expect(ecoStabilizer.connect(userA).withdraw(3))
                .to.be.revertedWith("ERC20: insufficient allowance");

            // NFT is permanently locked (ghost collateral)
            const loan = await ecoStabilizer.loans(3);
            expect(loan.active).to.be.true;
            expect(loan.borrower).to.equal(userA.address);

            // Verify NFT still in vault
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 3)).to.equal(1);

            // Admin cannot help - no liquidation mechanism
            // adminSweepNFT fails because loan is active
            await expect(ecoStabilizer.connect(await ethers.getSigner(await ecoStabilizer.owner()))
                .adminSweepNFT(3, userA.address))
                .to.be.revertedWith("loan active");

            // Ghost collateral detected: SCC burned but NFT locked
            const remainingSupply = await scc.totalSupply();
            const activeLoans = await ecoStabilizer.getTotalActiveLoans();
            
            // Supply is less than it should be for active loans
            const expectedSupply = activeLoans * ethers.parseEther("20");
            expect(remainingSupply).to.be.lessThan(expectedSupply);
        });

        it("Should handle complex SCC movement chains", async function () {
            const { astaVerde, scc, ecoStabilizer, userA, userB, userC } = 
                await loadFixture(deploySCCTransferFixture);

            // UserA deposits NFT #1
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userA).deposit(1);

            // Complex transfer chain: A → B → C → B → A
            await scc.connect(userA).transfer(userB.address, ethers.parseEther("20"));
            await scc.connect(userB).transfer(userC.address, ethers.parseEther("15"));
            await scc.connect(userC).transfer(userB.address, ethers.parseEther("15"));
            await scc.connect(userB).transfer(userA.address, ethers.parseEther("20"));

            // Final balances
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("20"));
            expect(await scc.balanceOf(userB.address)).to.equal(0);
            expect(await scc.balanceOf(userC.address)).to.equal(0);

            // Only UserA (original borrower) can withdraw
            await scc.connect(userA).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(userA).withdraw(1);

            // Verify successful withdrawal
            expect(await astaVerde.balanceOf(userA.address, 1)).to.equal(1);
        });

        it("Should enforce borrower identity regardless of SCC ownership", async function () {
            const { astaVerde, scc, ecoStabilizer, mockUSDC, userA, userB, producer } = 
                await loadFixture(deploySCCTransferFixture);

            // Both users deposit different NFTs
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userA).deposit(1); // UserA deposits NFT #1

            // Mint new batch for UserB
            await astaVerde.connect(await ethers.getSigner(await astaVerde.owner()))
                .mintBatch([producer.address], ["QmCID4"]);
            
            const price = await astaVerde.getCurrentBatchPrice(2);
            await mockUSDC.connect(userB).approve(astaVerde.target, price);
            await astaVerde.connect(userB).buyBatch(2, price, 1); // UserB gets NFT #4

            await astaVerde.connect(userB).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userB).deposit(4); // UserB deposits NFT #4

            // Both have 20 SCC
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("20"));
            expect(await scc.balanceOf(userB.address)).to.equal(ethers.parseEther("20"));

            // UserA sends their SCC to UserB (now UserB has 40 SCC)
            await scc.connect(userA).transfer(userB.address, ethers.parseEther("20"));

            // UserB cannot withdraw UserA's NFT even with sufficient SCC
            await scc.connect(userB).approve(ecoStabilizer.target, ethers.parseEther("40"));
            await expect(ecoStabilizer.connect(userB).withdraw(1))
                .to.be.revertedWith("not borrower");

            // UserB can withdraw their own NFT
            await ecoStabilizer.connect(userB).withdraw(4);
            expect(await astaVerde.balanceOf(userB.address, 4)).to.equal(1);

            // UserA cannot withdraw their NFT (no SCC)
            await expect(ecoStabilizer.connect(userA).withdraw(1))
                .to.be.revertedWith("ERC20: insufficient allowance");
        });
    });
});