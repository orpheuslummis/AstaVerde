import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../types";

describe("User Journey - Complete Lifecycle", function () {
    async function deployUserJourneyFixture() {
        const [owner, producer1, producer2, user, dexUser, collector] = await ethers.getSigners();

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

        // Fund user with USDC
        await mockUSDC.mint(user.address, ethers.parseUnits("1000", 6));
        await mockUSDC.mint(dexUser.address, ethers.parseUnits("100", 6));

        // Mint batch with 3 NFTs
        await astaVerde.mintBatch(
            [producer1.address, producer1.address, producer2.address],
            ["QmCID1", "QmCID2", "QmCID3"]
        );

        return {
            astaVerde,
            scc,
            ecoStabilizer,
            mockUSDC,
            owner,
            producer1,
            producer2,
            user,
            dexUser,
            collector,
            MINTER_ROLE,
        };
    }

    describe("Complete User Lifecycle", function () {
        it("Should handle complete user lifecycle from purchase to redemption", async function () {
            const { astaVerde, scc, ecoStabilizer, mockUSDC, user, producer1, dexUser, collector } = 
                await loadFixture(deployUserJourneyFixture);

            // ========== 1. PURCHASE PHASE ==========
            const initialBatchInfo = await astaVerde.getBatchInfo(1);
            expect(initialBatchInfo[4]).to.equal(3); // 3 NFTs in batch

            const purchasePrice = await astaVerde.getCurrentBatchPrice(1);
            expect(purchasePrice).to.equal(ethers.parseUnits("230", 6)); // Starting price

            // Record initial balances
            const initialPlatformShare = await astaVerde.platformShareAccumulated();
            const initialProducerAccrued = await astaVerde.producerBalances(producer1.address);

            // User buys 1 NFT (tokenId 1)
            await mockUSDC.connect(user).approve(astaVerde.target, purchasePrice);
            const tx = await astaVerde.connect(user).buyBatch(1, purchasePrice, 1);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            await expect(tx)
                .to.emit(astaVerde, "PartialBatchSold")
                .withArgs(1, block.timestamp, 2); // 2 remaining

            // Verify NFT ownership
            expect(await astaVerde.balanceOf(user.address, 1)).to.equal(1);

            // Verify payment split (30% platform, 70% accrued to producer)
            const platformFee = (purchasePrice * 30n) / 100n;
            const producerPayment = purchasePrice - platformFee;
            expect(await astaVerde.platformShareAccumulated()).to.equal(initialPlatformShare + platformFee);
            expect(await astaVerde.producerBalances(producer1.address)).to.equal(initialProducerAccrued + producerPayment);
            
            // Producer can claim their funds
            await astaVerde.connect(producer1).claimProducerFunds();
            expect(await mockUSDC.balanceOf(producer1.address)).to.equal(producerPayment);

            // Verify batch state
            const postPurchaseBatch = await astaVerde.getBatchInfo(1);
            expect(postPurchaseBatch[4]).to.equal(2); // 2 remaining

            // ========== 2. DEPOSIT PHASE ==========
            // User approves vault for NFT
            await astaVerde.connect(user).setApprovalForAll(ecoStabilizer.target, true);

            // User deposits NFT into vault
            const initialSCCBalance = await scc.balanceOf(user.address);
            expect(initialSCCBalance).to.equal(0);

            await expect(ecoStabilizer.connect(user).deposit(1))
                .to.emit(ecoStabilizer, "Deposited")
                .withArgs(user.address, 1);

            // Verify SCC minted
            const postDepositSCCBalance = await scc.balanceOf(user.address);
            expect(postDepositSCCBalance).to.equal(ethers.parseEther("20"));

            // Verify NFT transferred to vault
            expect(await astaVerde.balanceOf(user.address, 1)).to.equal(0);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);

            // Verify loan record
            const loan = await ecoStabilizer.loans(1);
            expect(loan.borrower).to.equal(user.address);
            expect(loan.active).to.be.true;

            // ========== 3. SCC USAGE PHASE ==========
            // User transfers 15 SCC to another address (simulating DeFi usage)
            await scc.connect(user).transfer(dexUser.address, ethers.parseEther("15"));
            
            const remainingSCC = await scc.balanceOf(user.address);
            expect(remainingSCC).to.equal(ethers.parseEther("5"));

            // ========== 4. FAILED WITHDRAWAL ==========
            // User attempts to withdraw with insufficient SCC
            await scc.connect(user).approve(ecoStabilizer.target, ethers.parseEther("5"));
            
            await expect(ecoStabilizer.connect(user).withdraw(1))
                .to.be.revertedWithCustomError(scc, "ERC20InsufficientAllowance");

            // Verify loan remains active
            const loanAfterFailedWithdraw = await ecoStabilizer.loans(1);
            expect(loanAfterFailedWithdraw.active).to.be.true;
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);

            // ========== 5. SCC ACQUISITION ==========
            // User acquires 15 more SCC (simulating DEX purchase or transfer back)
            await scc.connect(dexUser).transfer(user.address, ethers.parseEther("15"));
            
            const totalSCC = await scc.balanceOf(user.address);
            expect(totalSCC).to.equal(ethers.parseEther("20"));

            // ========== 6. SUCCESSFUL WITHDRAWAL ==========
            // User approves vault for 20 SCC
            await scc.connect(user).approve(ecoStabilizer.target, ethers.parseEther("20"));

            // User withdraws NFT from vault
            const sccSupplyBefore = await scc.totalSupply();
            
            await expect(ecoStabilizer.connect(user).withdraw(1))
                .to.emit(ecoStabilizer, "Withdrawn")
                .withArgs(user.address, 1);

            // Verify NFT returned
            expect(await astaVerde.balanceOf(user.address, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(0);

            // Verify SCC burned
            expect(await scc.balanceOf(user.address)).to.equal(0);
            expect(await scc.totalSupply()).to.equal(sccSupplyBefore - ethers.parseEther("20"));

            // Verify loan cleared
            const loanAfterWithdraw = await ecoStabilizer.loans(1);
            expect(loanAfterWithdraw.active).to.be.false;

            // ========== 7. REDEMPTION PHASE ==========
            // User redeems NFT for carbon offset
            const tokenBefore = await astaVerde.tokens(1);
            expect(tokenBefore.redeemed).to.be.false;

            const redeemTx = await astaVerde.connect(user).redeemToken(1);
            const redeemReceipt = await redeemTx.wait();
            const redeemBlock = await ethers.provider.getBlock(redeemReceipt.blockNumber);
            await expect(redeemTx)
                .to.emit(astaVerde, "TokenRedeemed")
                .withArgs(1, user.address, redeemBlock.timestamp);

            // Verify NFT marked as redeemed
            const tokenAfter = await astaVerde.tokens(1);
            expect(tokenAfter.redeemed).to.be.true;

            // User still owns the NFT (redeemed NFTs remain transferable)
            expect(await astaVerde.balanceOf(user.address, 1)).to.equal(1);

            // Attempt to re-deposit redeemed NFT (should fail)
            await astaVerde.connect(user).setApprovalForAll(ecoStabilizer.target, true);
            await expect(ecoStabilizer.connect(user).deposit(1))
                .to.be.revertedWith("redeemed asset");

            // ========== 8. SECONDARY MARKET ==========
            // User can still sell redeemed NFT to collector
            await astaVerde.connect(user).safeTransferFrom(
                user.address,
                collector.address,
                1,
                1,
                "0x"
            );

            // Verify transfer succeeded despite redemption
            expect(await astaVerde.balanceOf(collector.address, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(user.address, 1)).to.equal(0);

            // Collector also cannot deposit redeemed NFT
            await astaVerde.connect(collector).setApprovalForAll(ecoStabilizer.target, true);
            await expect(ecoStabilizer.connect(collector).deposit(1))
                .to.be.revertedWith("redeemed asset");
        });

        it("Should track state consistency throughout lifecycle", async function () {
            const { astaVerde, scc, ecoStabilizer, mockUSDC, user, producer1 } = 
                await loadFixture(deployUserJourneyFixture);

            // Buy NFT
            const price = await astaVerde.getCurrentBatchPrice(1);
            await mockUSDC.connect(user).approve(astaVerde.target, price);
            await astaVerde.connect(user).buyBatch(1, price, 1);

            // Check initial state
            const userLoansBeforeDeposit = await ecoStabilizer.getUserLoans(user.address);
            expect(userLoansBeforeDeposit.length).to.equal(0);

            // Deposit and check state
            await astaVerde.connect(user).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user).deposit(1);

            const userLoansAfterDeposit = await ecoStabilizer.getUserLoans(user.address);
            expect(userLoansAfterDeposit.length).to.equal(1);
            expect(userLoansAfterDeposit[0]).to.equal(1);

            const totalActiveLoans = await ecoStabilizer.getTotalActiveLoans();
            expect(totalActiveLoans).to.equal(1);

            // Check SCC supply invariant
            const sccSupply = await scc.totalSupply();
            expect(sccSupply).to.equal(ethers.parseEther("20")); // 20 SCC per loan

            // Withdraw and verify state cleared
            await scc.connect(user).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(user).withdraw(1);

            const userLoansAfterWithdraw = await ecoStabilizer.getUserLoans(user.address);
            expect(userLoansAfterWithdraw.length).to.equal(0);

            const totalActiveLoansAfter = await ecoStabilizer.getTotalActiveLoans();
            expect(totalActiveLoansAfter).to.equal(0);

            const sccSupplyAfter = await scc.totalSupply();
            expect(sccSupplyAfter).to.equal(0); // All burned
        });
    });
});