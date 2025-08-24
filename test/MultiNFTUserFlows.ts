import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../types";

describe("Multi-NFT User Flows", function () {
    async function deployMultiNFTFixture() {
        const [owner, producer1, producer2, user, buyer, dexUser] = await ethers.getSigners();

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

        // Fund user with 1200 USDC (enough for all purchases)
        await mockUSDC.mint(user.address, ethers.parseUnits("1200", 6));
        await mockUSDC.mint(buyer.address, ethers.parseUnits("500", 6));
        await mockUSDC.mint(dexUser.address, ethers.parseUnits("100", 6));

        return {
            astaVerde,
            scc,
            ecoStabilizer,
            mockUSDC,
            owner,
            producer1,
            producer2,
            user,
            buyer,
            dexUser,
            MINTER_ROLE,
        };
    }

    describe("Multiple NFT Management", function () {
        it("Should manage users with multiple NFTs in different states", async function () {
            const { astaVerde, scc, ecoStabilizer, mockUSDC, owner, producer1, producer2, user, buyer, dexUser } = 
                await loadFixture(deployMultiNFTFixture);

            // ========== 1. ACCUMULATION PHASE ==========
            // Mint batch 1 with 3 NFTs at 230 USDC
            await astaVerde.mintBatch(
                [producer1.address, producer1.address, producer2.address],
                ["QmCID1", "QmCID2", "QmCID3"]
            );

            const batch1Price = await astaVerde.getCurrentBatchPrice(1);
            expect(batch1Price).to.equal(ethers.parseUnits("230", 6));

            // User buys all 3 NFTs from batch 1
            const totalBatch1Cost = batch1Price * 3n;
            await mockUSDC.connect(user).approve(astaVerde.target, totalBatch1Cost);
            await astaVerde.connect(user).buyBatch(1, totalBatch1Cost, 3);

            // Simulate price increase by quick sale
            await time.increase(1 * 24 * 60 * 60); // 1 day passes

            // Mint batch 2 with 2 NFTs (price should increase if batch 1 sold quickly)
            await astaVerde.mintBatch(
                [producer2.address, producer2.address],
                ["QmCID4", "QmCID5"]
            );

            const batch2Price = await astaVerde.getCurrentBatchPrice(2);
            // Price may have increased due to quick sale of batch 1

            // User buys both NFTs from batch 2
            const totalBatch2Cost = batch2Price * 2n;
            await mockUSDC.connect(user).approve(astaVerde.target, totalBatch2Cost);
            await astaVerde.connect(user).buyBatch(2, totalBatch2Cost, 2);

            // Verify user owns 5 NFTs total
            expect(await astaVerde.balanceOf(user.address, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(user.address, 2)).to.equal(1);
            expect(await astaVerde.balanceOf(user.address, 3)).to.equal(1);
            expect(await astaVerde.balanceOf(user.address, 4)).to.equal(1);
            expect(await astaVerde.balanceOf(user.address, 5)).to.equal(1);

            // Check total spent
            const totalSpent = totalBatch1Cost + totalBatch2Cost;
            // Should be around 230*3 + 230*2 = 1150 USDC (may vary with price adjustments)

            // ========== 2. MIXED OPERATIONS ==========
            // User deposits NFTs #1 and #2 using batch deposit
            await astaVerde.connect(user).setApprovalForAll(ecoStabilizer.target, true);
            
            await expect(ecoStabilizer.connect(user).depositBatch([1, 2]))
                .to.emit(ecoStabilizer, "Deposited")
                .withArgs(user.address, 1)
                .to.emit(ecoStabilizer, "Deposited")
                .withArgs(user.address, 2);

            // Verify receives 40 SCC total
            expect(await scc.balanceOf(user.address)).to.equal(ethers.parseEther("40"));

            // User sells NFT #3 to another user
            await astaVerde.connect(user).safeTransferFrom(
                user.address,
                buyer.address,
                3,
                1,
                "0x"
            );
            expect(await astaVerde.balanceOf(buyer.address, 3)).to.equal(1);

            // User redeems NFT #4 for carbon offset
            const redeemTx = await astaVerde.connect(user).redeemToken(4);
            const redeemReceipt = await redeemTx.wait();
            const redeemBlock = await ethers.provider.getBlock(redeemReceipt.blockNumber);
            await expect(redeemTx)
                .to.emit(astaVerde, "TokenRedeemed")
                .withArgs(4, user.address, redeemBlock.timestamp);

            // User keeps NFT #5 as collectible (unredeemed, not deposited)
            expect(await astaVerde.balanceOf(user.address, 5)).to.equal(1);

            // State check: 2 in vault, 1 sold, 1 redeemed, 1 held
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 2)).to.equal(1);
            expect(await astaVerde.balanceOf(buyer.address, 3)).to.equal(1);
            expect(await astaVerde.balanceOf(user.address, 4)).to.equal(1); // Redeemed but still owned
            expect(await astaVerde.balanceOf(user.address, 5)).to.equal(1);

            // ========== 3. SCC MANAGEMENT ==========
            // User has 40 SCC from deposits
            expect(await scc.balanceOf(user.address)).to.equal(ethers.parseEther("40"));

            // User spends 25 SCC in DeFi (simulated by transfer)
            await scc.connect(user).transfer(dexUser.address, ethers.parseEther("25"));

            // Balance: 15 SCC remaining
            expect(await scc.balanceOf(user.address)).to.equal(ethers.parseEther("15"));

            // User attempts to withdraw NFT #1 (needs 20 SCC)
            await scc.connect(user).approve(ecoStabilizer.target, ethers.parseEther("15"));
            await expect(ecoStabilizer.connect(user).withdraw(1))
                .to.be.revertedWithCustomError(scc, "ERC20InsufficientAllowance");

            // User attempts batch withdraw [1,2] (needs 40 SCC)
            await expect(ecoStabilizer.connect(user).withdrawBatch([1, 2]))
                .to.be.revertedWith("insufficient SCC");

            // ========== 4. PARTIAL RECOVERY ==========
            // User acquires 5 more SCC (total: 20)
            await scc.connect(dexUser).transfer(user.address, ethers.parseEther("5"));
            expect(await scc.balanceOf(user.address)).to.equal(ethers.parseEther("20"));

            // User withdraws NFT #1 successfully
            await scc.connect(user).approve(ecoStabilizer.target, ethers.parseEther("20"));
            
            await expect(ecoStabilizer.connect(user).withdraw(1))
                .to.emit(ecoStabilizer, "Withdrawn")
                .withArgs(user.address, 1);

            // Verify NFT #1 returned, 20 SCC burned
            expect(await astaVerde.balanceOf(user.address, 1)).to.equal(1);
            expect(await scc.balanceOf(user.address)).to.equal(0);

            // User still has NFT #2 in vault
            const loan2 = await ecoStabilizer.loans(2);
            expect(loan2.active).to.be.true;
            expect(loan2.borrower).to.equal(user.address);

            // Can't withdraw #2 (0 SCC left)
            await expect(ecoStabilizer.connect(user).withdraw(2))
                .to.be.revertedWithCustomError(scc, "ERC20InsufficientAllowance");

            // ========== 5. ATTEMPT INVALID OPERATIONS ==========
            // User tries to deposit sold NFT #3
            await expect(ecoStabilizer.connect(user).deposit(3))
                .to.be.revertedWith("not token owner");

            // User tries to deposit redeemed NFT #4
            await expect(ecoStabilizer.connect(user).deposit(4))
                .to.be.revertedWith("redeemed asset");

            // User successfully deposits NFT #5
            await expect(ecoStabilizer.connect(user).deposit(5))
                .to.emit(ecoStabilizer, "Deposited")
                .withArgs(user.address, 5);

            // Verify receives 20 SCC
            expect(await scc.balanceOf(user.address)).to.equal(ethers.parseEther("20"));

            // ========== 6. VIEW FUNCTION VALIDATION ==========
            // Call getUserLoans(user)
            const userLoans = await ecoStabilizer.getUserLoans(user.address);
            expect(userLoans.length).to.equal(2);
            expect(userLoans[0]).to.equal(2); // NFT #2 still in vault
            expect(userLoans[1]).to.equal(5); // NFT #5 just deposited

            // Call getUserLoanCount(user)
            const loanCount = await ecoStabilizer.getUserLoanCount(user.address);
            expect(loanCount).to.equal(2);

            // Check individual loan states
            const loan2State = await ecoStabilizer.loans(2);
            expect(loan2State.active).to.be.true;
            expect(loan2State.borrower).to.equal(user.address);

            const loan5State = await ecoStabilizer.loans(5);
            expect(loan5State.active).to.be.true;
            expect(loan5State.borrower).to.equal(user.address);

            // ========== 7. FINAL STATE RECONCILIATION ==========
            // Current state:
            // User owns: #1 (withdrawn), #4 (redeemed)
            // Vault holds: #2, #5 (active loans)
            // Sold: #3 (to buyer)
            // SCC balance: 20 (from #5 deposit)

            // User acquires 20 more SCC
            await scc.connect(dexUser).transfer(user.address, ethers.parseEther("20"));
            expect(await scc.balanceOf(user.address)).to.equal(ethers.parseEther("40"));

            // Batch withdraw [2,5]
            await scc.connect(user).approve(ecoStabilizer.target, ethers.parseEther("40"));
            
            await expect(ecoStabilizer.connect(user).withdrawBatch([2, 5]))
                .to.emit(ecoStabilizer, "Withdrawn")
                .withArgs(user.address, 2)
                .to.emit(ecoStabilizer, "Withdrawn")
                .withArgs(user.address, 5);

            // Verify both NFTs returned, 40 SCC burned
            expect(await astaVerde.balanceOf(user.address, 2)).to.equal(1);
            expect(await astaVerde.balanceOf(user.address, 5)).to.equal(1);
            expect(await scc.balanceOf(user.address)).to.equal(0);
            expect(await scc.totalSupply()).to.equal(0);

            // ========== 8. EDGE CASE: RE-DEPOSIT ATTEMPT ==========
            // User tries to re-deposit #1 (not redeemed)
            await expect(ecoStabilizer.connect(user).deposit(1))
                .to.emit(ecoStabilizer, "Deposited")
                .withArgs(user.address, 1);

            // Success - receives 20 SCC
            expect(await scc.balanceOf(user.address)).to.equal(ethers.parseEther("20"));

            // User tries to re-deposit #4 (redeemed)
            await expect(ecoStabilizer.connect(user).deposit(4))
                .to.be.revertedWith("redeemed asset");

            // Final verification of user's NFT holdings
            expect(await astaVerde.balanceOf(user.address, 1)).to.equal(0); // Re-deposited
            expect(await astaVerde.balanceOf(user.address, 2)).to.equal(1); // Withdrawn
            expect(await astaVerde.balanceOf(user.address, 3)).to.equal(0); // Sold
            expect(await astaVerde.balanceOf(user.address, 4)).to.equal(1); // Redeemed
            expect(await astaVerde.balanceOf(user.address, 5)).to.equal(1); // Withdrawn
        });

        it("Should handle complex batch operations with multiple NFTs", async function () {
            const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user } = 
                await loadFixture(deployMultiNFTFixture);

            // Mint batch with 5 NFTs
            await astaVerde.mintBatch(
                Array(5).fill(producer1.address),
                ["QmA", "QmB", "QmC", "QmD", "QmE"]
            );

            // User buys all 5
            const price = await astaVerde.getCurrentBatchPrice(1);
            const total = price * 5n;
            await mockUSDC.connect(user).approve(astaVerde.target, total);
            await astaVerde.connect(user).buyBatch(1, total, 5);

            // Batch deposit 3 NFTs
            await astaVerde.connect(user).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user).depositBatch([1, 3, 5]);

            expect(await scc.balanceOf(user.address)).to.equal(ethers.parseEther("60"));

            // Try to batch withdraw with mixed ownership
            await scc.connect(user).approve(ecoStabilizer.target, ethers.parseEther("60"));
            
            // This should fail because NFT #2 is not deposited
            await expect(ecoStabilizer.connect(user).withdrawBatch([1, 2, 3]))
                .to.be.revertedWith("loan not active");

            // Successful batch withdraw of deposited NFTs
            await ecoStabilizer.connect(user).withdrawBatch([1, 3, 5]);

            // All NFTs back to user
            expect(await astaVerde.balanceOf(user.address, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(user.address, 3)).to.equal(1);
            expect(await astaVerde.balanceOf(user.address, 5)).to.equal(1);
        });

        it("Should track loan history correctly through multiple deposit/withdraw cycles", async function () {
            const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user } = 
                await loadFixture(deployMultiNFTFixture);

            // Mint and buy NFT
            await astaVerde.mintBatch([producer1.address], ["QmTest"]);
            const price = await astaVerde.getCurrentBatchPrice(1);
            await mockUSDC.connect(user).approve(astaVerde.target, price);
            await astaVerde.connect(user).buyBatch(1, price, 1);

            await astaVerde.connect(user).setApprovalForAll(ecoStabilizer.target, true);

            // Cycle 1: Deposit and withdraw
            await ecoStabilizer.connect(user).deposit(1);
            let loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.true;

            await scc.connect(user).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(user).withdraw(1);
            loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.false;

            // Cycle 2: Re-deposit same NFT
            await ecoStabilizer.connect(user).deposit(1);
            loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.true;
            expect(loan.borrower).to.equal(user.address);

            // Supply invariant holds
            const activeLoans = await ecoStabilizer.getTotalActiveLoans();
            const sccSupply = await scc.totalSupply();
            expect(sccSupply).to.equal(activeLoans * ethers.parseEther("20"));
        });

        it("Should handle user with NFTs from different batches at different prices", async function () {
            const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user } = 
                await loadFixture(deployMultiNFTFixture);

            // Batch 1 at 230 USDC
            await astaVerde.mintBatch([producer1.address], ["Qm1"]);
            
            // Wait 3 days before buying to avoid quick sale trigger
            await time.increase(3 * 24 * 60 * 60);
            
            let price1 = await astaVerde.getCurrentBatchPrice(1);
            // Price should be 227 USDC (230 - 3 days of decay)
            await mockUSDC.connect(user).approve(astaVerde.target, price1);
            await astaVerde.connect(user).buyBatch(1, price1, 1);

            // Wait additional time
            await time.increase(2 * 24 * 60 * 60);

            // Batch 2 at base price (230 USDC) - no increase because batch 1 sold after 2-day threshold
            await astaVerde.mintBatch([producer1.address], ["Qm2"]);
            let price2 = await astaVerde.getCurrentBatchPrice(2);
            // Price2 should be at base (230) or possibly decreased if batch 1 didn't sell quickly
            expect(price2).to.be.at.most(ethers.parseUnits("230", 6));
            await mockUSDC.connect(user).approve(astaVerde.target, price2);
            await astaVerde.connect(user).buyBatch(2, price2, 1);

            // Both NFTs give same 20 SCC when deposited
            await astaVerde.connect(user).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user).depositBatch([1, 2]);

            expect(await scc.balanceOf(user.address)).to.equal(ethers.parseEther("40"));

            // Withdrawal cost is same regardless of purchase price
            await scc.connect(user).approve(ecoStabilizer.target, ethers.parseEther("40"));
            await ecoStabilizer.connect(user).withdrawBatch([1, 2]);

            expect(await scc.balanceOf(user.address)).to.equal(0);
        });
    });
});