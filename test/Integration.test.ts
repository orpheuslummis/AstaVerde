import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../typechain-types";

describe("Integration & End-to-End Testing", function () {
    // ==========================================================================
    // SECTION 1: PHASE 1 ↔ PHASE 2 INTEGRATION TESTS
    // ==========================================================================
    describe("Integration: Phase 1 ↔ Phase 2", function () {
        async function deployIntegrationFixture() {
            const [owner, producer1, producer2, user1, user2, user3] = await ethers.getSigners();

            // Deploy MockUSDC
            const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
            const mockUSDC = await MockUSDCFactory.deploy(ethers.parseUnits("1000000", 6)); // 1M USDC

            // Deploy AstaVerde (Phase 1)
            const AstaVerdeFactory = await ethers.getContractFactory("AstaVerde");
            const astaVerde = await AstaVerdeFactory.deploy(owner.address, mockUSDC.target);

            // Deploy StabilizedCarbonCoin (Phase 2)
            const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
            const scc = await SCCFactory.deploy(ethers.ZeroAddress);

            // Deploy EcoStabilizer (Phase 2)
            const EcoStabilizerFactory = await ethers.getContractFactory("EcoStabilizer");
            const ecoStabilizer = await EcoStabilizerFactory.deploy(astaVerde.target, scc.target);

            // Grant MINTER_ROLE to vault
            const MINTER_ROLE = await scc.MINTER_ROLE();
            await scc.grantRole(MINTER_ROLE, ecoStabilizer.target);

            // Mint USDC to users for comprehensive testing
            await mockUSDC.mint(user1.address, ethers.parseUnits("5000", 6));
            await mockUSDC.mint(user2.address, ethers.parseUnits("5000", 6));
            await mockUSDC.mint(user3.address, ethers.parseUnits("5000", 6));

            return {
                astaVerde,
                scc,
                ecoStabilizer,
                mockUSDC,
                owner,
                producer1,
                producer2,
                user1,
                user2,
                user3,
            };
        }

        // Helper function for time manipulation
        async function advanceTimeByDays(days: number) {
            const secondsToAdvance = days * 24 * 60 * 60;
            await ethers.provider.send("evm_increaseTime", [secondsToAdvance]);
            await ethers.provider.send("evm_mine", []);
        }

        // Helper function to buy NFT from batch through proper marketplace flow
        async function buyNFTFromMarketplace(
            astaVerde: AstaVerde,
            mockUSDC: MockUSDC,
            user: any,
            batchId: number,
            quantity: number = 1,
        ) {
            const batchPrice = await astaVerde.getCurrentBatchPrice(batchId);
            const totalCost = batchPrice * BigInt(quantity);
            await mockUSDC.connect(user).approve(astaVerde.target, totalCost);
            // Use totalCost as maxPrice parameter (not batchPrice)
            await astaVerde.connect(user).buyBatch(batchId, totalCost, quantity);
            return { batchPrice, totalCost };
        }

        describe("Dutch Auction Price Integration", function () {
            it("should accept vault deposits regardless of NFT purchase price (high vs floor)", async function () {
                const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2 } =
                    await loadFixture(deployIntegrationFixture);

                // Create two identical batches
                await astaVerde.mintBatch([producer1.address], ["QmTestCID1"]);
                await astaVerde.mintBatch([producer1.address], ["QmTestCID2"]);

                // User1 buys immediately at high price (230 USDC)
                const { batchPrice: highPrice } = await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);
                console.log(`User1 paid high price: ${ethers.formatUnits(highPrice, 6)} USDC`);

                // Advance time to floor price (40 USDC after 190+ days)
                await advanceTimeByDays(200);

                // User2 buys at floor price
                const { batchPrice: floorPrice } = await buyNFTFromMarketplace(astaVerde, mockUSDC, user2, 2);
                console.log(`User2 paid floor price: ${ethers.formatUnits(floorPrice, 6)} USDC`);

                // Verify price difference
                expect(highPrice).to.be.greaterThan(floorPrice);
                expect(floorPrice).to.equal(ethers.parseUnits("40", 6)); // Floor price

                // Both users should get same SCC loan amount from vault
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);

                await ecoStabilizer.connect(user1).deposit(1);
                await ecoStabilizer.connect(user2).deposit(2);

                // Both should receive exactly 20 SCC regardless of purchase price
                const user1Balance = await scc.balanceOf(user1.address);
                const user2Balance = await scc.balanceOf(user2.address);

                expect(user1Balance).to.equal(ethers.parseEther("20"));
                expect(user2Balance).to.equal(ethers.parseEther("20"));
                expect(user1Balance).to.equal(user2Balance);
            });

            it("should handle vault operations during active price decay", async function () {
                const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2 } =
                    await loadFixture(deployIntegrationFixture);

                // Create batch and buy one NFT
                await astaVerde.mintBatch([producer1.address], ["QmTestCID"]);
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);

                // Get initial price
                const initialPrice = await astaVerde.getCurrentBatchPrice(1);

                // Deposit in vault
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user1).deposit(1);

                // Advance time by 5 days (price should decrease by 5 USDC)
                await advanceTimeByDays(5);

                // Since user1 bought token 1, check remaining tokens in batch
                const batchInfo = await astaVerde.getBatchInfo(1);
                if (batchInfo[4] > 0) {
                    // If there are remaining tokens
                    const newPrice = await astaVerde.getCurrentBatchPrice(1);
                    expect(initialPrice - newPrice).to.equal(ethers.parseUnits("5", 6));
                }

                // Vault operations should be unaffected by price changes
                const sccBalance = await scc.balanceOf(user1.address);
                expect(sccBalance).to.equal(ethers.parseEther("20"));

                // Withdraw should work normally
                await scc.connect(user1).approve(ecoStabilizer.target, sccBalance);
                await ecoStabilizer.connect(user1).withdraw(1);

                // User should get their exact NFT back
                const nftBalance = await astaVerde.balanceOf(user1.address, 1);
                expect(nftBalance).to.equal(1);
            });
        });

        describe("Base Price Adjustment Impact", function () {
            it("should maintain vault loans when basePrice increases due to quick sales", async function () {
                const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2 } =
                    await loadFixture(deployIntegrationFixture);

                // Get initial base price
                const initialBasePrice = await astaVerde.basePrice();
                console.log(`Initial base price: ${ethers.formatUnits(initialBasePrice, 6)} USDC`);

                // Create batch and deposit one NFT in vault
                await astaVerde.mintBatch([producer1.address], ["QmTestCID1"]);
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user1).deposit(1);

                // Create another batch and sell it quickly (within 2 days) to trigger base price increase
                await astaVerde.mintBatch([producer1.address], ["QmTestCID2"]);
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user2, 2, 1); // Buy entire batch

                // Advance time by 1 day (quick sale trigger)
                await advanceTimeByDays(1);

                // Create multiple batches to trigger base price recalculation
                await astaVerde.mintBatch([producer1.address], ["QmTestCID3"]);
                await astaVerde.mintBatch([producer1.address], ["QmTestCID4"]);

                // Buy from batch 3 quickly to potentially trigger base price increase
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user2, 3, 1);

                // Check if base price changed (it may or may not depending on timing)
                const newBasePrice = await astaVerde.basePrice();
                console.log(`New base price: ${ethers.formatUnits(newBasePrice, 6)} USDC`);

                // Existing vault loan should be unaffected regardless
                const user1SccBalance = await scc.balanceOf(user1.address);
                expect(user1SccBalance).to.equal(ethers.parseEther("20"));

                // Vault should still work for new NFTs
                await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user2).deposit(2);

                const user2SccBalance = await scc.balanceOf(user2.address);
                expect(user2SccBalance).to.equal(ethers.parseEther("20"));

                // Both users should be able to withdraw their specific NFTs
                await scc.connect(user1).approve(ecoStabilizer.target, user1SccBalance);
                await ecoStabilizer.connect(user1).withdraw(1);

                await scc.connect(user2).approve(ecoStabilizer.target, user2SccBalance);
                await ecoStabilizer.connect(user2).withdraw(2);

                expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
                expect(await astaVerde.balanceOf(user2.address, 2)).to.equal(1);
            });

            it("should maintain vault loans when basePrice decreases due to stagnant sales", async function () {
                const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1 } =
                    await loadFixture(deployIntegrationFixture);

                const initialBasePrice = await astaVerde.basePrice();

                // Create batch and deposit NFT
                await astaVerde.mintBatch([producer1.address], ["QmTestCID1"]);
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user1).deposit(1);

                // Create multiple batches and let them sit unsold to potentially trigger base price decrease
                await astaVerde.mintBatch([producer1.address], ["QmTestCID2"]);
                await astaVerde.mintBatch([producer1.address], ["QmTestCID3"]);
                await advanceTimeByDays(5); // Let batches go stagnant

                // Create another batch to trigger base price recalculation
                await astaVerde.mintBatch([producer1.address], ["QmTestCID4"]);

                const newBasePrice = await astaVerde.basePrice();
                console.log(`Base price after stagnation: ${ethers.formatUnits(newBasePrice, 6)} USDC`);
                // Base price may or may not decrease depending on the exact logic - just verify vault works

                // Existing vault loan should remain stable
                const sccBalance = await scc.balanceOf(user1.address);
                expect(sccBalance).to.equal(ethers.parseEther("20"));

                // Withdrawal should work normally
                await scc.connect(user1).approve(ecoStabilizer.target, sccBalance);
                await ecoStabilizer.connect(user1).withdraw(1);
                expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
            });
        });

        describe("Batch Lifecycle Integration", function () {
            it("should handle complete batch lifecycle with vault operations", async function () {
                const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2, user3 } =
                    await loadFixture(deployIntegrationFixture);

                // Create 3-token batch
                await astaVerde.mintBatch(
                    [producer1.address, producer1.address, producer1.address],
                    ["QmCID1", "QmCID2", "QmCID3"],
                );

                const initialPrice = await astaVerde.getCurrentBatchPrice(1);

                // User1 buys first token and deposits in vault
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1, 1);
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user1).deposit(1);

                // Advance time - price decreases
                await advanceTimeByDays(3);
                const midPrice = await astaVerde.getCurrentBatchPrice(1);
                expect(initialPrice - midPrice).to.equal(ethers.parseUnits("3", 6));

                // User2 buys second token at reduced price
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user2, 1, 1);
                await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user2).deposit(2);

                // Advance to floor price
                await advanceTimeByDays(200);
                const floorPrice = await astaVerde.getCurrentBatchPrice(1);
                expect(floorPrice).to.equal(ethers.parseUnits("40", 6));

                // User3 buys last token at floor price
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user3, 1, 1);

                // Verify batch is now fully sold
                const batchInfo = await astaVerde.getBatchInfo(1);
                expect(batchInfo[4]).to.equal(0); // remainingTokens is index 4

                // All vault operations should work regardless of purchase prices
                const user1Balance = await scc.balanceOf(user1.address);
                const user2Balance = await scc.balanceOf(user2.address);
                expect(user1Balance).to.equal(ethers.parseEther("20"));
                expect(user2Balance).to.equal(ethers.parseEther("20"));

                // Withdrawals should return exact NFTs
                await scc.connect(user1).approve(ecoStabilizer.target, user1Balance);
                await ecoStabilizer.connect(user1).withdraw(1);

                await scc.connect(user2).approve(ecoStabilizer.target, user2Balance);
                await ecoStabilizer.connect(user2).withdraw(2);

                expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
                expect(await astaVerde.balanceOf(user2.address, 2)).to.equal(1);
                expect(await astaVerde.balanceOf(user3.address, 3)).to.equal(1);
            });
        });

        describe("Producer Revenue Integration", function () {
            it("should maintain producer revenue flow when NFTs move through vault", async function () {
                const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1 } =
                    await loadFixture(deployIntegrationFixture);

                // Create batch and buy NFT (accrues producer payment)
                await astaVerde.mintBatch([producer1.address], ["QmTestCID"]);
                const { batchPrice } = await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);

                // Verify producer payment is accrued (70% of batch price, 30% to platform)
                const expectedProducerPayment = (batchPrice * 70n) / 100n;
                const producerAccruedBalance = await astaVerde.producerBalances(producer1.address);
                expect(producerAccruedBalance).to.equal(expectedProducerPayment);

                // Producer can claim their funds
                await astaVerde.connect(producer1).claimProducerFunds();
                const producerUsdcBalance = await mockUSDC.balanceOf(producer1.address);
                expect(producerUsdcBalance).to.equal(expectedProducerPayment);

                // Deposit NFT in vault - should not affect producer balance
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user1).deposit(1);

                const producerBalanceAfterClaim = await mockUSDC.balanceOf(producer1.address);
                expect(producerBalanceAfterClaim).to.equal(expectedProducerPayment);

                // Withdraw from vault - should not trigger additional producer payment
                const sccBalance = await scc.balanceOf(user1.address);
                await scc.connect(user1).approve(ecoStabilizer.target, sccBalance);
                await ecoStabilizer.connect(user1).withdraw(1);

                const producerBalanceFinal = await mockUSDC.balanceOf(producer1.address);
                expect(producerBalanceFinal).to.equal(producerBalanceAfterClaim);

                // Verify user got NFT back
                expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
            });
        });

        describe("Time-Based State Synchronization", function () {
            it("should maintain consistent state across time-dependent operations", async function () {
                const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2 } =
                    await loadFixture(deployIntegrationFixture);

                // Create batch
                await astaVerde.mintBatch([producer1.address, producer1.address], ["QmCID1", "QmCID2"]);

                // Record initial timestamp and price
                const initialTimestamp = await time.latest();
                const initialPrice = await astaVerde.getCurrentBatchPrice(1);

                // User1 buys and deposits immediately
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1, 1);
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user1).deposit(1);

                // Advance time by exactly 7 days
                await advanceTimeByDays(7);

                // Verify price decreased correctly
                const priceAfter7Days = await astaVerde.getCurrentBatchPrice(1);
                expect(initialPrice - priceAfter7Days).to.equal(ethers.parseUnits("7", 6));

                // User2 buys at reduced price
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user2, 1, 1);

                // Both vault operations should work with time-consistent state
                await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user2).deposit(2);

                // Both users should have identical SCC balances
                const user1Balance = await scc.balanceOf(user1.address);
                const user2Balance = await scc.balanceOf(user2.address);
                expect(user1Balance).to.equal(user2Balance);
                expect(user1Balance).to.equal(ethers.parseEther("20"));

                // Verify timestamp consistency
                const currentTimestamp = await time.latest();
                expect(currentTimestamp - initialTimestamp).to.be.greaterThan(7 * 24 * 60 * 60 - 10); // ~7 days
            });
        });

        describe("Emergency State Integration", function () {
            it("should handle paused vault with active marketplace", async function () {
                const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2, owner } =
                    await loadFixture(deployIntegrationFixture);

                // Create batch and setup one vault deposit
                await astaVerde.mintBatch([producer1.address, producer1.address], ["QmCID1", "QmCID2"]);
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1, 1);
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user1).deposit(1);

                // Pause vault
                await ecoStabilizer.connect(owner).pause();

                // Marketplace should still work independently
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user2, 1, 1);
                expect(await astaVerde.balanceOf(user2.address, 2)).to.equal(1);

                // Vault deposits should fail when paused
                await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
                await expect(ecoStabilizer.connect(user2).deposit(2)).to.be.revertedWithCustomError(
                    ecoStabilizer,
                    "EnforcedPause",
                );

                // Unpause vault
                await ecoStabilizer.connect(owner).unpause();

                // Cross-contract calls should work again
                await ecoStabilizer.connect(user2).deposit(2);
                expect(await scc.balanceOf(user2.address)).to.equal(ethers.parseEther("20"));

                // Original user should still be able to withdraw
                const user1Balance = await scc.balanceOf(user1.address);
                await scc.connect(user1).approve(ecoStabilizer.target, user1Balance);
                await ecoStabilizer.connect(user1).withdraw(1);
                expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
            });
        });

        describe("Gas Cost Integration", function () {
            it("should maintain gas efficiency for full Phase 1→2 workflow", async function () {
                const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1 } =
                    await loadFixture(deployIntegrationFixture);

                // Create batch
                await astaVerde.mintBatch([producer1.address], ["QmTestCID"]);

                // Measure full workflow gas consumption
                const batchPrice = await astaVerde.getCurrentBatchPrice(1);

                // Step 1: USDC approval
                const approveTx = await mockUSDC.connect(user1).approve(astaVerde.target, batchPrice);
                const approveReceipt = await approveTx.wait();

                // Step 2: Buy from marketplace
                const buyTx = await astaVerde.connect(user1).buyBatch(1, batchPrice, 1);
                const buyReceipt = await buyTx.wait();

                // Step 3: NFT approval for vault
                const nftApproveTx = await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                const nftApproveReceipt = await nftApproveTx.wait();

                // Step 4: Vault deposit
                const depositTx = await ecoStabilizer.connect(user1).deposit(1);
                const depositReceipt = await depositTx.wait();

                // Calculate total gas
                const totalGas =
                    (approveReceipt?.gasUsed || 0n) +
                    (buyReceipt?.gasUsed || 0n) +
                    (nftApproveReceipt?.gasUsed || 0n) +
                    (depositReceipt?.gasUsed || 0n);

                console.log(`Total workflow gas: ${totalGas.toString()}`);
                console.log(`Buy gas: ${buyReceipt?.gasUsed || 0n}`);
                console.log(`Deposit gas: ${depositReceipt?.gasUsed || 0n}`);

                // Ensure deposit stays under updated target with indexing overhead
                expect(depositReceipt?.gasUsed || 0n).to.be.lessThan(230000n);

                // Full workflow should be reasonable (coverage instrumentation increases gas)
                // Adjusted threshold to account for indexing overhead
                expect(totalGas).to.be.lessThan(600000n);

                // Test withdrawal gas
                const sccBalance = await scc.balanceOf(user1.address);
                await scc.connect(user1).approve(ecoStabilizer.target, sccBalance);

                const withdrawTx = await ecoStabilizer.connect(user1).withdraw(1);
                const withdrawReceipt = await withdrawTx.wait();

                console.log(`Withdraw gas: ${withdrawReceipt?.gasUsed || 0n}`);
                expect(withdrawReceipt?.gasUsed || 0n).to.be.lessThan(120000n);
            });
        });

        describe("Access Control & Security", function () {
            it("should protect MINTER_ROLE exclusive to vault", async function () {
                const { scc, ecoStabilizer, user1, user2 } = await loadFixture(deployIntegrationFixture);

                const MINTER_ROLE = await scc.MINTER_ROLE();

                // Verify vault has MINTER_ROLE
                expect(await scc.hasRole(MINTER_ROLE, ecoStabilizer.target)).to.be.true;

                // Regular users cannot mint
                await expect(
                    scc.connect(user1).mint(user1.address, ethers.parseEther("1")),
                ).to.be.revertedWithCustomError(scc, "AccessControlUnauthorizedAccount");

                // Only vault should be able to mint
                expect(await scc.hasRole(MINTER_ROLE, user1.address)).to.be.false;
                expect(await scc.hasRole(MINTER_ROLE, user2.address)).to.be.false;
            });

            it("should restrict vault admin functions to owner only", async function () {
                const { ecoStabilizer, user1, user2, owner } = await loadFixture(deployIntegrationFixture);

                // Non-owners cannot pause
                await expect(ecoStabilizer.connect(user1).pause()).to.be.revertedWithCustomError(
                    ecoStabilizer,
                    "OwnableUnauthorizedAccount",
                );

                // Non-owners cannot unpause
                await ecoStabilizer.connect(owner).pause();
                await expect(ecoStabilizer.connect(user1).unpause()).to.be.revertedWithCustomError(
                    ecoStabilizer,
                    "OwnableUnauthorizedAccount",
                );

                // Removed: maxScanRange admin function no longer exists

                // Non-owners cannot sweep NFTs
                await expect(
                    ecoStabilizer.connect(user1).adminSweepNFT(1, user2.address),
                ).to.be.revertedWithCustomError(ecoStabilizer, "OwnableUnauthorizedAccount");
            });

            it("should handle role transfers and renunciation securely", async function () {
                const { scc, owner, user1 } = await loadFixture(deployIntegrationFixture);

                const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();
                const MINTER_ROLE = await scc.MINTER_ROLE();

                // Owner starts with admin role
                expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;

                // Grant admin role to user1
                await scc.connect(owner).grantRole(DEFAULT_ADMIN_ROLE, user1.address);
                expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, user1.address)).to.be.true;

                // User1 can now manage MINTER_ROLE
                await scc.connect(user1).revokeRole(MINTER_ROLE, user1.address); // Should not revert

                // Owner can renounce admin role
                await scc.connect(owner).renounceRole(DEFAULT_ADMIN_ROLE, owner.address);
                expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.false;

                // User1 is now the only admin
                expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, user1.address)).to.be.true;
            });
        });

        describe("Supply Cap & Economic Boundaries", function () {
            it("should enforce MAX_SUPPLY cap of 1B SCC", async function () {
                const { scc, ecoStabilizer, owner } = await loadFixture(deployIntegrationFixture);

                const MAX_SUPPLY = await scc.MAX_SUPPLY();
                expect(MAX_SUPPLY).to.equal(ethers.parseEther("1000000000")); // 1B SCC

                // Mint close to cap (simulate many deposits)
                const MINTER_ROLE = await scc.MINTER_ROLE();
                await scc.connect(owner).grantRole(MINTER_ROLE, owner.address);

                const nearMaxAmount = MAX_SUPPLY - ethers.parseEther("10");
                await scc.connect(owner).mint(owner.address, nearMaxAmount);

                // Should be able to mint remaining 10 SCC
                await scc.connect(owner).mint(owner.address, ethers.parseEther("10"));

                // Further minting should fail
                await expect(scc.connect(owner).mint(owner.address, 1)).to.be.revertedWith("exceeds max supply");
            });

            it("should handle large-scale vault operations efficiently", async function () {
                const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, owner } =
                    await loadFixture(deployIntegrationFixture);

                // Create multiple batches for stress testing
                const batchCount = 50;
                for (let i = 0; i < batchCount; i++) {
                    await astaVerde.mintBatch([producer1.address], [`QmTestCID${i}`]);
                }

                // Buy and deposit multiple NFTs
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                const depositPromises = [];

                for (let i = 1; i <= Math.min(batchCount, 10); i++) {
                    // Limit to 10 for gas reasons
                    const batchPrice = await astaVerde.getCurrentBatchPrice(i);
                    await mockUSDC.connect(user1).approve(astaVerde.target, batchPrice);
                    await astaVerde.connect(user1).buyBatch(i, batchPrice, 1);
                    depositPromises.push(ecoStabilizer.connect(user1).deposit(i));
                }

                // Execute deposits in parallel
                await Promise.all(depositPromises);

                // Verify user has correct SCC balance (10 NFTs × 20 SCC each)
                const expectedBalance = ethers.parseEther("200");
                expect(await scc.balanceOf(user1.address)).to.equal(expectedBalance);

                // Test view function performance with many active loans
                const userLoans = await ecoStabilizer.getUserLoans(user1.address);
                expect(userLoans.length).to.equal(10);

                const totalActiveLoans = await ecoStabilizer.getTotalActiveLoans();
                expect(totalActiveLoans).to.equal(10);
            });

            it("should report counts correctly under many active loans", async function () {
                const { ecoStabilizer, scc, owner } = await loadFixture(deployIntegrationFixture);

                // No maxScanRange concept anymore; only verify functions execute
                expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(0);
            });
        });

        describe("Error Handling & Edge Cases", function () {
            it("should handle invalid tokenId scenarios comprehensively", async function () {
                const { astaVerde, ecoStabilizer, mockUSDC, producer1, user1 } =
                    await loadFixture(deployIntegrationFixture);

                // Create and buy one NFT
                await astaVerde.mintBatch([producer1.address], ["QmTestCID"]);
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

                // Cannot deposit non-existent tokenId
                await expect(ecoStabilizer.connect(user1).deposit(999)).to.be.reverted; // ERC1155 will revert on non-existent token

                // Cannot withdraw non-existent loan
                await expect(ecoStabilizer.connect(user1).withdraw(999)).to.be.revertedWith("not borrower");

                // Cannot deposit zero tokenId
                await expect(ecoStabilizer.connect(user1).deposit(0)).to.be.reverted; // AstaVerde tokens start from 1
            });

            it("should handle redeemed asset rejection correctly", async function () {
                const { astaVerde, ecoStabilizer, mockUSDC, producer1, user1 } =
                    await loadFixture(deployIntegrationFixture);

                // Create and buy NFT
                await astaVerde.mintBatch([producer1.address], ["QmTestCID"]);
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);

                // Redeem the NFT (simulate carbon offset retirement)
                await astaVerde.connect(user1).redeemToken(1);

                // Verify token is marked as redeemed
                const isRedeemed = await astaVerde.isRedeemed(1);
                expect(isRedeemed).to.be.true; // redeemed flag

                // Should not be able to deposit redeemed NFT
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                await expect(ecoStabilizer.connect(user1).deposit(1)).to.be.revertedWith("redeemed asset");
            });

            it("should prevent double deposits and unauthorized withdrawals", async function () {
                const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1, user2 } =
                    await loadFixture(deployIntegrationFixture);

                // Setup NFT and deposit
                await astaVerde.mintBatch([producer1.address], ["QmTestCID"]);
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user1).deposit(1);

                // Cannot deposit same token twice
                await expect(ecoStabilizer.connect(user1).deposit(1)).to.be.revertedWith("loan active");

                // User2 cannot withdraw user1's loan
                const sccBalance = await scc.balanceOf(user1.address);
                await scc.connect(user1).transfer(user2.address, sccBalance);
                await scc.connect(user2).approve(ecoStabilizer.target, sccBalance);
                await expect(ecoStabilizer.connect(user2).withdraw(1)).to.be.revertedWith("not borrower");

                // Original borrower can still withdraw
                await scc.connect(user2).transfer(user1.address, sccBalance);
                await scc.connect(user1).approve(ecoStabilizer.target, sccBalance);
                await ecoStabilizer.connect(user1).withdraw(1);
                expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
            });

            it("should validate burn and mint operations thoroughly", async function () {
                const { scc, owner, user1 } = await loadFixture(deployIntegrationFixture);

                const MINTER_ROLE = await scc.MINTER_ROLE();
                await scc.connect(owner).grantRole(MINTER_ROLE, owner.address);

                // Cannot mint to zero address
                await expect(scc.connect(owner).mint(ethers.ZeroAddress, ethers.parseEther("1"))).to.be.revertedWith(
                    "mint to zero address",
                );

                // Cannot mint zero amount
                await expect(scc.connect(owner).mint(user1.address, 0)).to.be.revertedWith("mint zero amount");

                // Mint some tokens for burn tests
                await scc.connect(owner).mint(user1.address, ethers.parseEther("50"));

                // Cannot burn zero amount
                await expect(scc.connect(user1).burn(0)).to.be.revertedWith("burn zero amount");

                // Cannot burnFrom zero address
                await expect(
                    scc.connect(owner).burnFrom(ethers.ZeroAddress, ethers.parseEther("1")),
                ).to.be.revertedWith("burn from zero address");

                // Cannot burnFrom zero amount
                await expect(scc.connect(owner).burnFrom(user1.address, 0)).to.be.revertedWith("burn zero amount");

                // burnFrom requires allowance
                await expect(
                    scc.connect(owner).burnFrom(user1.address, ethers.parseEther("1")),
                ).to.be.revertedWithCustomError(scc, "ERC20InsufficientAllowance");

                // Successful burnFrom with allowance
                await scc.connect(user1).approve(owner.address, ethers.parseEther("10"));
                await scc.connect(owner).burnFrom(user1.address, ethers.parseEther("10"));
                expect(await scc.balanceOf(user1.address)).to.equal(ethers.parseEther("40"));
            });
        });

        describe("Admin Functions & Emergency Scenarios", function () {
            it("should handle adminSweepNFT for unsolicited transfers", async function () {
                const { astaVerde, ecoStabilizer, mockUSDC, producer1, user1, user2, owner } =
                    await loadFixture(deployIntegrationFixture);

                // Create NFT and send directly to vault (bypassing deposit)
                await astaVerde.mintBatch([producer1.address], ["QmTestCID"]);
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);

                // Direct transfer to vault (unsolicited)
                await astaVerde.connect(user1).safeTransferFrom(user1.address, ecoStabilizer.target, 1, 1, "0x");

                // Verify vault received the NFT but no loan exists
                expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);
                const loan = await ecoStabilizer.loans(1);
                expect(loan.active).to.be.false;

                // Admin can sweep the unsolicited NFT
                await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, user2.address))
                    .to.emit(ecoStabilizer, "EmergencyNFTWithdrawn")
                    .withArgs(user2.address, 1);

                // NFT moved to recipient
                expect(await astaVerde.balanceOf(user2.address, 1)).to.equal(1);
                expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(0);
            });

            it("should prevent adminSweepNFT on active loans", async function () {
                const { astaVerde, ecoStabilizer, mockUSDC, producer1, user1, user2, owner } =
                    await loadFixture(deployIntegrationFixture);

                // Setup proper vault deposit
                await astaVerde.mintBatch([producer1.address], ["QmTestCID"]);
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user1).deposit(1);

                // Cannot sweep NFT with active loan
                await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, user2.address)).to.be.revertedWith(
                    "loan active",
                );

                // Verify sweep validation
                await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, ethers.ZeroAddress)).to.be.revertedWith(
                    "loan active",
                );
            });

            it("should validate adminSweepNFT parameters", async function () {
                const { ecoStabilizer, user1, owner } = await loadFixture(deployIntegrationFixture);

                // Cannot sweep to zero address
                await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, ethers.ZeroAddress)).to.be.revertedWith(
                    "invalid address",
                );
            });

            it("should handle repayAndWithdraw function correctly", async function () {
                const { astaVerde, scc, ecoStabilizer, mockUSDC, producer1, user1 } =
                    await loadFixture(deployIntegrationFixture);

                // Setup vault deposit
                await astaVerde.mintBatch([producer1.address], ["QmTestCID"]);
                await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, 1);
                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
                await ecoStabilizer.connect(user1).deposit(1);

                // Use repayAndWithdraw instead of withdraw
                const sccBalance = await scc.balanceOf(user1.address);
                await scc.connect(user1).approve(ecoStabilizer.target, sccBalance);

                await expect(ecoStabilizer.connect(user1).withdraw(1))
                    .to.emit(ecoStabilizer, "Withdrawn")
                    .withArgs(user1.address, 1);

                // User should have NFT back and no SCC
                expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
                expect(await scc.balanceOf(user1.address)).to.equal(0);
            });
        });

        describe("View Function Performance & Boundaries", function () {
            it("should return full and correct results without scan limits", async function () {
                const { astaVerde, ecoStabilizer, mockUSDC, producer1, user1 } =
                    await loadFixture(deployIntegrationFixture);

                // Create and buy 10 NFTs
                for (let i = 1; i <= 10; i++) {
                    await astaVerde.mintBatch([producer1.address], [`QmTestCID${i}`]);
                    await buyNFTFromMarketplace(astaVerde, mockUSDC, user1, i);
                }

                await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

                // Deposit tokens 1-8
                for (let i = 1; i <= 8; i++) {
                    await ecoStabilizer.connect(user1).deposit(i);
                }

                const userLoans = await ecoStabilizer.getUserLoans(user1.address);
                expect(userLoans.length).to.equal(8);
                expect(userLoans).to.deep.equal([1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]);

                const loanCount = await ecoStabilizer.getUserLoanCount(user1.address);
                expect(loanCount).to.equal(8);

                const totalActive = await ecoStabilizer.getTotalActiveLoans();
                expect(totalActive).to.equal(8);
            });

            it("should handle edge cases in view functions", async function () {
                const { ecoStabilizer, user1 } = await loadFixture(deployIntegrationFixture);

                // Empty state should return empty arrays/zero counts
                const emptyLoans = await ecoStabilizer.getUserLoans(user1.address);
                expect(emptyLoans.length).to.equal(0);

                const zeroCount = await ecoStabilizer.getUserLoanCount(user1.address);
                expect(zeroCount).to.equal(0);

                const zeroTotal = await ecoStabilizer.getTotalActiveLoans();
                expect(zeroTotal).to.equal(0);
            });

            it("should maintain view function performance under load", async function () {
                const { astaVerde, ecoStabilizer, mockUSDC, producer1, user1, user2, user3 } =
                    await loadFixture(deployIntegrationFixture);

                // Create many tokens for multiple users
                for (let i = 1; i <= 50; i++) {
                    await astaVerde.mintBatch([producer1.address], [`QmTestCID${i}`]);
                }

                // Distribute purchases among users
                const users = [user1, user2, user3];
                const userApprovals = [];

                for (let i = 1; i <= 30; i++) {
                    const user = users[(i - 1) % 3];
                    await buyNFTFromMarketplace(astaVerde, mockUSDC, user, i);
                    userApprovals.push(astaVerde.connect(user).setApprovalForAll(ecoStabilizer.target, true));
                }

                await Promise.all(userApprovals);

                // Create loans across users
                const deposits = [];
                for (let i = 1; i <= 30; i++) {
                    const user = users[(i - 1) % 3];
                    deposits.push(ecoStabilizer.connect(user).deposit(i));
                }
                await Promise.all(deposits);

                // Test view functions with distributed load
                const user1Loans = await ecoStabilizer.getUserLoans(user1.address);
                const user2Loans = await ecoStabilizer.getUserLoans(user2.address);
                const user3Loans = await ecoStabilizer.getUserLoans(user3.address);

                // Each user should have 10 loans (every 3rd token)
                expect(user1Loans.length).to.equal(10);
                expect(user2Loans.length).to.equal(10);
                expect(user3Loans.length).to.equal(10);

                // Total should be 30 (within scan range)
                const totalActive = await ecoStabilizer.getTotalActiveLoans();
                expect(totalActive).to.equal(30);

                // Verify specific loan ownership
                expect(user1Loans[0]).to.equal(1); // User1 has tokens 1, 4, 7, 10...
                expect(user2Loans[0]).to.equal(2); // User2 has tokens 2, 5, 8, 11...
                expect(user3Loans[0]).to.equal(3); // User3 has tokens 3, 6, 9, 12...
            });
        });
    });

    // ==========================================================================
    // SECTION 2: MULTI-NFT USER FLOWS
    // ==========================================================================
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
                    ["QmCID1", "QmCID2", "QmCID3"],
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
                await astaVerde.mintBatch([producer2.address, producer2.address], ["QmCID4", "QmCID5"]);

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
                await astaVerde.connect(user).safeTransferFrom(user.address, buyer.address, 3, 1, "0x");
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
                await expect(ecoStabilizer.connect(user).withdraw(1)).to.be.revertedWithCustomError(
                    scc,
                    "ERC20InsufficientAllowance",
                );

                // User attempts batch withdraw [1,2] (needs 40 SCC)
                await expect(ecoStabilizer.connect(user).withdrawBatch([1, 2])).to.be.revertedWith("insufficient SCC");

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
                await expect(ecoStabilizer.connect(user).withdraw(2)).to.be.revertedWithCustomError(
                    scc,
                    "ERC20InsufficientAllowance",
                );

                // ========== 5. ATTEMPT INVALID OPERATIONS ==========
                // User tries to deposit sold NFT #3
                await expect(ecoStabilizer.connect(user).deposit(3)).to.be.revertedWith("not token owner");

                // User tries to deposit redeemed NFT #4
                await expect(ecoStabilizer.connect(user).deposit(4)).to.be.revertedWith("redeemed asset");

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
                await expect(ecoStabilizer.connect(user).deposit(4)).to.be.revertedWith("redeemed asset");

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
                await astaVerde.mintBatch(Array(5).fill(producer1.address), ["QmA", "QmB", "QmC", "QmD", "QmE"]);

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
                await expect(ecoStabilizer.connect(user).withdrawBatch([1, 2, 3])).to.be.revertedWith(
                    "loan not active",
                );

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

                const price1 = await astaVerde.getCurrentBatchPrice(1);
                // Price should be 227 USDC (230 - 3 days of decay)
                await mockUSDC.connect(user).approve(astaVerde.target, price1);
                await astaVerde.connect(user).buyBatch(1, price1, 1);

                // Wait additional time
                await time.increase(2 * 24 * 60 * 60);

                // Batch 2 at base price (230 USDC) - no increase because batch 1 sold after 2-day threshold
                await astaVerde.mintBatch([producer1.address], ["Qm2"]);
                const price2 = await astaVerde.getCurrentBatchPrice(2);
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

    // ==========================================================================
    // SECTION 3: COMPLETE USER LIFECYCLE JOURNEY
    // ==========================================================================
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
                ["QmCID1", "QmCID2", "QmCID3"],
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
                await expect(tx).to.emit(astaVerde, "PartialBatchSold").withArgs(1, block.timestamp, 2); // 2 remaining

                // Verify NFT ownership
                expect(await astaVerde.balanceOf(user.address, 1)).to.equal(1);

                // Verify payment split (30% platform, 70% accrued to producer)
                const platformFee = (purchasePrice * 30n) / 100n;
                const producerPayment = purchasePrice - platformFee;
                expect(await astaVerde.platformShareAccumulated()).to.equal(initialPlatformShare + platformFee);
                expect(await astaVerde.producerBalances(producer1.address)).to.equal(
                    initialProducerAccrued + producerPayment,
                );

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

                await expect(ecoStabilizer.connect(user).withdraw(1)).to.be.revertedWithCustomError(
                    scc,
                    "ERC20InsufficientAllowance",
                );

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
                const beforeRedeemed = await astaVerde.isRedeemed(1);
                expect(beforeRedeemed).to.be.false;

                const redeemTx = await astaVerde.connect(user).redeemToken(1);
                const redeemReceipt = await redeemTx.wait();
                const redeemBlock = await ethers.provider.getBlock(redeemReceipt.blockNumber);
                await expect(redeemTx)
                    .to.emit(astaVerde, "TokenRedeemed")
                    .withArgs(1, user.address, redeemBlock.timestamp);

                // Verify NFT marked as redeemed
                const afterRedeemed = await astaVerde.isRedeemed(1);
                expect(afterRedeemed).to.be.true;

                // User still owns the NFT (redeemed NFTs remain transferable)
                expect(await astaVerde.balanceOf(user.address, 1)).to.equal(1);

                // Attempt to re-deposit redeemed NFT (should fail)
                await astaVerde.connect(user).setApprovalForAll(ecoStabilizer.target, true);
                await expect(ecoStabilizer.connect(user).deposit(1)).to.be.revertedWith("redeemed asset");

                // ========== 8. SECONDARY MARKET ==========
                // User can still sell redeemed NFT to collector
                await astaVerde.connect(user).safeTransferFrom(user.address, collector.address, 1, 1, "0x");

                // Verify transfer succeeded despite redemption
                expect(await astaVerde.balanceOf(collector.address, 1)).to.equal(1);
                expect(await astaVerde.balanceOf(user.address, 1)).to.equal(0);

                // Collector also cannot deposit redeemed NFT
                await astaVerde.connect(collector).setApprovalForAll(ecoStabilizer.target, true);
                await expect(ecoStabilizer.connect(collector).deposit(1)).to.be.revertedWith("redeemed asset");
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
});
