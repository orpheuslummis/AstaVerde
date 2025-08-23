import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../types";

describe("Partial Batch Vault Interactions", function () {
    async function deployPartialBatchFixture() {
        const [owner, producer1, producer2, userA, userB, userC, userD] = await ethers.getSigners();

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
        await mockUSDC.mint(userA.address, ethers.parseUnits("1000", 6));
        await mockUSDC.mint(userB.address, ethers.parseUnits("1000", 6));
        await mockUSDC.mint(userC.address, ethers.parseUnits("1000", 6));
        await mockUSDC.mint(userD.address, ethers.parseUnits("1000", 6));

        // Mint large batch with 10 NFTs
        const producers = Array(10).fill(producer1.address);
        producers[5] = producer2.address; // Mix producers
        producers[9] = producer2.address;
        
        const cids = Array(10).fill(null).map((_, i) => `QmCID${i + 1}`);
        
        await astaVerde.mintBatch(producers, cids);

        return {
            astaVerde,
            scc,
            ecoStabilizer,
            mockUSDC,
            owner,
            producer1,
            producer2,
            userA,
            userB,
            userC,
            userD,
            MINTER_ROLE,
        };
    }

    describe("Partial Batch and Price Decay Interactions", function () {
        it("Should handle vault operations on partially sold batches with price decay", async function () {
            const { astaVerde, scc, ecoStabilizer, mockUSDC, userA, userB, userC, userD } = 
                await loadFixture(deployPartialBatchFixture);

            // ========== 1. PARTIAL BATCH PURCHASE ==========
            const initialPrice = await astaVerde.getCurrentBatchPrice(1);
            expect(initialPrice).to.equal(ethers.parseUnits("230", 6));

            // UserA buys 3 NFTs (IDs: 1,2,3) at 230 USDC each
            const priceFor3 = initialPrice * 3n;
            await mockUSDC.connect(userA).approve(astaVerde.target, priceFor3);
            await astaVerde.connect(userA).buyBatch(1, priceFor3, 3);

            // UserB buys 2 NFTs (IDs: 4,5) at 230 USDC each
            const priceFor2 = initialPrice * 2n;
            await mockUSDC.connect(userB).approve(astaVerde.target, priceFor2);
            await astaVerde.connect(userB).buyBatch(1, priceFor2, 2);

            // Verify batch state
            const batchInfo = await astaVerde.getBatchInfo(1);
            expect(batchInfo[4]).to.equal(5); // 5 NFTs remain
            expect(batchInfo[3]).to.equal(initialPrice); // Price still 230

            // Verify ownership
            expect(await astaVerde.balanceOf(userA.address, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(userA.address, 2)).to.equal(1);
            expect(await astaVerde.balanceOf(userA.address, 3)).to.equal(1);
            expect(await astaVerde.balanceOf(userB.address, 4)).to.equal(1);
            expect(await astaVerde.balanceOf(userB.address, 5)).to.equal(1);

            // ========== 2. PRICE DECAY PERIOD ==========
            // Advance time by 3 days
            await time.increase(3 * 24 * 60 * 60);

            const decayedPrice = await astaVerde.getCurrentBatchPrice(1);
            expect(decayedPrice).to.equal(ethers.parseUnits("227", 6)); // 230 - 3

            // UserC buys 1 NFT (ID: 6) at decayed price
            await mockUSDC.connect(userC).approve(astaVerde.target, decayedPrice);
            await astaVerde.connect(userC).buyBatch(1, decayedPrice, 1);

            expect(await astaVerde.balanceOf(userC.address, 6)).to.equal(1);

            // ========== 3. MIXED DEPOSITS ==========
            // UserA deposits NFTs #1 and #2 (bought at 230)
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            
            await expect(ecoStabilizer.connect(userA).deposit(1))
                .to.emit(ecoStabilizer, "Deposited")
                .withArgs(userA.address, 1);
            
            await expect(ecoStabilizer.connect(userA).deposit(2))
                .to.emit(ecoStabilizer, "Deposited")
                .withArgs(userA.address, 2);

            // UserC deposits NFT #6 (bought at 227)
            await astaVerde.connect(userC).setApprovalForAll(ecoStabilizer.target, true);
            
            await expect(ecoStabilizer.connect(userC).deposit(6))
                .to.emit(ecoStabilizer, "Deposited")
                .withArgs(userC.address, 6);

            // All receive 20 SCC regardless of purchase price
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("40")); // 2 NFTs
            expect(await scc.balanceOf(userC.address)).to.equal(ethers.parseEther("20")); // 1 NFT

            // Verify vault doesn't track purchase price
            const loan1 = await ecoStabilizer.loans(1);
            const loan6 = await ecoStabilizer.loans(6);
            expect(loan1.active).to.be.true;
            expect(loan6.active).to.be.true;
            // Both loans are identical except for borrower

            // ========== 4. FURTHER DECAY ==========
            // Advance time by 10 more days
            await time.increase(10 * 24 * 60 * 60);

            const furtherDecayedPrice = await astaVerde.getCurrentBatchPrice(1);
            expect(furtherDecayedPrice).to.equal(ethers.parseUnits("217", 6)); // 227 - 10

            // Verify remaining NFTs
            const batchInfoAfterDecay = await astaVerde.getBatchInfo(1);
            expect(batchInfoAfterDecay[4]).to.equal(4); // [7,8,9,10] remain

            // ========== 5. WITHDRAWAL DURING DECAY ==========
            // UserA withdraws NFT #1
            await scc.connect(userA).approve(ecoStabilizer.target, ethers.parseEther("20"));
            
            await expect(ecoStabilizer.connect(userA).withdraw(1))
                .to.emit(ecoStabilizer, "Withdrawn")
                .withArgs(userA.address, 1);

            // Verify withdrawal cost is 20 SCC (not related to current batch price)
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("20")); // Had 40, spent 20

            // UserD buys NFT #7 at current decayed price
            await mockUSDC.connect(userD).approve(astaVerde.target, furtherDecayedPrice);
            await astaVerde.connect(userD).buyBatch(1, furtherDecayedPrice, 1);

            // UserD immediately deposits NFT #7
            await astaVerde.connect(userD).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userD).deposit(7);

            // Verify receives standard 20 SCC
            expect(await scc.balanceOf(userD.address)).to.equal(ethers.parseEther("20"));

            // ========== 6. BATCH COMPLETION IMPACT ==========
            // Buy remaining NFTs to complete batch
            const remainingPrice = furtherDecayedPrice * 3n; // NFTs 8,9,10
            await mockUSDC.connect(userB).approve(astaVerde.target, remainingPrice);
            
            await expect(astaVerde.connect(userB).buyBatch(1, remainingPrice, 3))
                .to.emit(astaVerde, "BatchSold")
                .withArgs(1, await time.latest(), 3);

            // Batch is now sold out
            const soldBatchInfo = await astaVerde.getBatchInfo(1);
            expect(soldBatchInfo[4]).to.equal(0); // No NFTs remaining

            // Check if base price adjusted (depends on sale timing)
            const currentBasePrice = await astaVerde.basePrice();
            // Price may have adjusted based on sale velocity

            // Existing vault loans unaffected
            const loan2 = await ecoStabilizer.loans(2);
            const loan6AfterCompletion = await ecoStabilizer.loans(6);
            expect(loan2.active).to.be.true;
            expect(loan6AfterCompletion.active).to.be.true;

            // Mint new batch at potentially adjusted price
            await astaVerde.connect(await ethers.getSigner(await astaVerde.owner()))
                .mintBatch([userA.address], ["QmNewBatch"]);

            const newBatchPrice = await astaVerde.getCurrentBatchPrice(2);
            // New batch uses current base price (may be adjusted)

            // Old batch depositors unaffected by new price
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("20"));
            expect(await scc.balanceOf(userC.address)).to.equal(ethers.parseEther("20"));

            // ========== 7. PARTIAL BATCH REDEMPTION ==========
            // UserB redeems NFT #4
            await expect(astaVerde.connect(userB).redeemToken(4))
                .to.emit(astaVerde, "TokenRedeemed")
                .withArgs(4, userB.address, await time.latest());

            // UserB attempts to deposit redeemed #4
            await astaVerde.connect(userB).setApprovalForAll(ecoStabilizer.target, true);
            await expect(ecoStabilizer.connect(userB).deposit(4))
                .to.be.revertedWith("redeemed asset");

            // UserB successfully deposits unredeemed #5
            await expect(ecoStabilizer.connect(userB).deposit(5))
                .to.emit(ecoStabilizer, "Deposited")
                .withArgs(userB.address, 5);

            expect(await scc.balanceOf(userB.address)).to.equal(ethers.parseEther("20"));
        });

        it("Should maintain vault independence from batch price changes", async function () {
            const { astaVerde, scc, ecoStabilizer, mockUSDC, userA } = 
                await loadFixture(deployPartialBatchFixture);

            // Buy NFT at starting price
            const startPrice = await astaVerde.getCurrentBatchPrice(1);
            await mockUSDC.connect(userA).approve(astaVerde.target, startPrice);
            await astaVerde.connect(userA).buyBatch(1, startPrice, 1);

            // Deposit NFT
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userA).deposit(1);

            const initialSCC = await scc.balanceOf(userA.address);
            expect(initialSCC).to.equal(ethers.parseEther("20"));

            // Advance time significantly (50 days)
            await time.increase(50 * 24 * 60 * 60);

            // Price has decayed to floor
            const floorPrice = await astaVerde.getCurrentBatchPrice(1);
            const expectedFloor = ethers.parseUnits("40", 6); // Floor price
            const decayedCalc = ethers.parseUnits("180", 6); // 230 - 50
            expect(floorPrice).to.equal(decayedCalc > expectedFloor ? decayedCalc : expectedFloor);

            // Withdrawal still costs 20 SCC
            await scc.connect(userA).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(userA).withdraw(1);

            // Verify correct SCC burned
            expect(await scc.balanceOf(userA.address)).to.equal(0);
            expect(await scc.totalSupply()).to.equal(0);
        });

        it("Should handle rapid partial purchases during decay", async function () {
            const { astaVerde, mockUSDC, userA, userB, userC } = 
                await loadFixture(deployPartialBatchFixture);

            // Initial purchase
            const day0Price = await astaVerde.getCurrentBatchPrice(1);
            await mockUSDC.connect(userA).approve(astaVerde.target, day0Price);
            await astaVerde.connect(userA).buyBatch(1, day0Price, 1);

            // Day 1 purchase
            await time.increase(24 * 60 * 60);
            const day1Price = await astaVerde.getCurrentBatchPrice(1);
            expect(day1Price).to.equal(ethers.parseUnits("229", 6));
            await mockUSDC.connect(userB).approve(astaVerde.target, day1Price);
            await astaVerde.connect(userB).buyBatch(1, day1Price, 1);

            // Day 2 purchase
            await time.increase(24 * 60 * 60);
            const day2Price = await astaVerde.getCurrentBatchPrice(1);
            expect(day2Price).to.equal(ethers.parseUnits("228", 6));
            await mockUSDC.connect(userC).approve(astaVerde.target, day2Price);
            await astaVerde.connect(userC).buyBatch(1, day2Price, 1);

            // All users paid different prices
            expect(day0Price).to.be.greaterThan(day1Price);
            expect(day1Price).to.be.greaterThan(day2Price);

            // Verify each user owns their NFT
            expect(await astaVerde.balanceOf(userA.address, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(userB.address, 2)).to.equal(1);
            expect(await astaVerde.balanceOf(userC.address, 3)).to.equal(1);
        });

        it("Should track batch state correctly during partial operations", async function () {
            const { astaVerde, scc, ecoStabilizer, mockUSDC, userA, userB } = 
                await loadFixture(deployPartialBatchFixture);

            // Initial batch has 10 NFTs
            const initialBatch = await astaVerde.getBatchInfo(1);
            expect(initialBatch[4]).to.equal(10);

            // UserA buys 4 NFTs
            const price4 = (await astaVerde.getCurrentBatchPrice(1)) * 4n;
            await mockUSDC.connect(userA).approve(astaVerde.target, price4);
            await astaVerde.connect(userA).buyBatch(1, price4, 4);

            // Check partial IDs function
            const afterFirst = await astaVerde.getBatchInfo(1);
            expect(afterFirst[4]).to.equal(6); // 6 remaining

            // UserA deposits 2 of their 4 NFTs
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userA).depositBatch([1, 3]);

            // UserA has 2 in vault, 2 in wallet
            expect(await astaVerde.balanceOf(userA.address, 1)).to.equal(0); // Deposited
            expect(await astaVerde.balanceOf(userA.address, 2)).to.equal(1); // Still owned
            expect(await astaVerde.balanceOf(userA.address, 3)).to.equal(0); // Deposited
            expect(await astaVerde.balanceOf(userA.address, 4)).to.equal(1); // Still owned

            // Batch state unchanged by deposits
            const afterDeposit = await astaVerde.getBatchInfo(1);
            expect(afterDeposit[4]).to.equal(6);

            // UserB buys remaining 6
            const price6 = (await astaVerde.getCurrentBatchPrice(1)) * 6n;
            await mockUSDC.connect(userB).approve(astaVerde.target, price6);
            await astaVerde.connect(userB).buyBatch(1, price6, 6);

            // Batch fully sold
            const fullySold = await astaVerde.getBatchInfo(1);
            expect(fullySold[4]).to.equal(0);
        });
    });
});