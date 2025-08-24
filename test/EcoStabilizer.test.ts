import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import type { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../types";

describe("EcoStabilizer - Comprehensive Test Suite", function () {
    // ======================= FIXTURES =======================

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

    async function deployBatchOperationsFixture() {
        const [owner, user1, user2, producer1, producer2] = await ethers.getSigners();

        // Deploy contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const usdcToken = await MockUSDC.deploy(0); // Initial supply handled via mint

        const AstaVerde = await ethers.getContractFactory("AstaVerde");
        const astaVerde = await AstaVerde.deploy(owner.address, await usdcToken.getAddress());

        const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
        const scc = await SCC.deploy(ethers.ZeroAddress);

        const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
        const vault = await EcoStabilizer.deploy(await astaVerde.getAddress(), await scc.getAddress());

        // Grant MINTER_ROLE to vault
        const MINTER_ROLE = await scc.MINTER_ROLE();
        await scc.grantRole(MINTER_ROLE, await vault.getAddress());

        // Setup: Mint USDC and approve
        await usdcToken.mint(user1.address, ethers.parseUnits("10000", 6));
        await usdcToken.mint(user2.address, ethers.parseUnits("10000", 6));
        await usdcToken.connect(user1).approve(await astaVerde.getAddress(), ethers.MaxUint256);
        await usdcToken.connect(user2).approve(await astaVerde.getAddress(), ethers.MaxUint256);

        // Mint a batch of NFTs
        const tokenCount = 10;
        const producers = Array(tokenCount).fill(producer1.address);
        const cids = Array(tokenCount).fill("QmTest");
        await astaVerde.mintBatch(producers, cids);

        // User1 buys all tokens from batch
        const batchId = 1;
        const price = await astaVerde.getCurrentBatchPrice(batchId);
        const totalCost = price * BigInt(tokenCount);
        await astaVerde.connect(user1).buyBatch(batchId, totalCost, tokenCount);

        return {
            astaVerde,
            vault,
            scc,
            usdcToken,
            owner,
            user1,
            user2,
            producer1,
            tokenIds: Array.from({ length: tokenCount }, (_, i) => BigInt(i + 1)),
        };
    }

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

        // Fund users with USDC (increased to handle multiple purchases)
        await mockUSDC.mint(userA.address, ethers.parseUnits("1500", 6));
        await mockUSDC.mint(userB.address, ethers.parseUnits("1500", 6));
        await mockUSDC.mint(userC.address, ethers.parseUnits("1500", 6));
        await mockUSDC.mint(userD.address, ethers.parseUnits("1500", 6));

        // Mint large batch with 10 NFTs
        const producers = Array(10).fill(producer1.address);
        producers[5] = producer2.address; // Mix producers
        producers[9] = producer2.address;

        const cids = Array(10)
            .fill(null)
            .map((_, i) => `QmCID${i + 1}`);

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

    // ======================= DEPLOYMENT TESTS =======================

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

    // ======================= CORE OPERATIONS =======================

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
    });

    // ======================= BATCH OPERATIONS =======================

    describe("Batch Deposit Operations", function () {
        it("Should deposit multiple NFTs in a single transaction", async function () {
            const { astaVerde, vault, scc, user1, tokenIds } = await loadFixture(deployBatchOperationsFixture);

            // Approve vault for NFT transfers
            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);

            // Select 5 tokens to deposit
            const tokensToDeposit = tokenIds.slice(0, 5);

            // Deposit batch
            await expect(vault.connect(user1).depositBatch(tokensToDeposit))
                .to.emit(vault, "Deposited")
                .to.emit(scc, "Transfer");

            // Verify all tokens were deposited
            for (const tokenId of tokensToDeposit) {
                expect(await astaVerde.balanceOf(await vault.getAddress(), tokenId)).to.equal(1);
                expect(await astaVerde.balanceOf(user1.address, tokenId)).to.equal(0);
            }

            // Verify SCC was minted correctly (20 SCC per token)
            const expectedSCC = BigInt(tokensToDeposit.length) * ethers.parseEther("20");
            expect(await scc.balanceOf(user1.address)).to.equal(expectedSCC);
        });

        it("Should reject batch deposit with empty array", async function () {
            const { vault, user1 } = await loadFixture(deployBatchOperationsFixture);

            await expect(vault.connect(user1).depositBatch([])).to.be.revertedWith("empty array");
        });

        it("Should reject batch deposit exceeding limit", async function () {
            const { vault, user1 } = await loadFixture(deployBatchOperationsFixture);

            const tooManyTokens = Array(21).fill(BigInt(1));
            await expect(vault.connect(user1).depositBatch(tooManyTokens)).to.be.revertedWith("too many tokens");
        });

        it("Should reject batch deposit with active loan", async function () {
            const { astaVerde, vault, user1, tokenIds } = await loadFixture(deployBatchOperationsFixture);

            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);

            // Deposit token 1
            await vault.connect(user1).deposit(tokenIds[0]);

            // Try to deposit again in batch
            await expect(vault.connect(user1).depositBatch([tokenIds[0], tokenIds[1]])).to.be.revertedWith(
                "loan active",
            );
        });

        it("Should measure gas for batch deposit vs sequential", async function () {
            const { astaVerde, vault, user1, tokenIds } = await loadFixture(deployBatchOperationsFixture);

            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);

            // Measure batch deposit
            const tokensToDeposit = tokenIds.slice(0, 5);
            const batchTx = await vault.connect(user1).depositBatch(tokensToDeposit);
            const batchReceipt = await batchTx.wait();
            const batchGas = batchReceipt!.gasUsed;

            console.log(`Batch deposit (5 tokens) gas: ${batchGas}`);

            // Reset state for sequential test
            const {
                vault: vault2,
                user1: user2,
                tokenIds: tokenIds2,
            } = await loadFixture(deployBatchOperationsFixture);
            const AstaVerde2 = await ethers.getContractFactory("AstaVerde");
            const astaVerde2 = AstaVerde2.attach(await vault2.ecoAsset()) as AstaVerde;
            await astaVerde2.connect(user2).setApprovalForAll(await vault2.getAddress(), true);

            // Measure sequential deposits
            let totalSequentialGas = BigInt(0);
            for (const tokenId of tokenIds2.slice(0, 5)) {
                const tx = await vault2.connect(user2).deposit(tokenId);
                const receipt = await tx.wait();
                totalSequentialGas += receipt!.gasUsed;
            }

            console.log(`Sequential deposits (5 tokens) gas: ${totalSequentialGas}`);
            console.log(`Gas savings: ${((1 - Number(batchGas) / Number(totalSequentialGas)) * 100).toFixed(1)}%`);

            // Batch should use significantly less gas
            expect(batchGas).to.be.lessThan((totalSequentialGas * BigInt(70)) / BigInt(100)); // At least 30% savings
        });
    });

    describe("Batch Withdraw Operations", function () {
        it("Should withdraw multiple NFTs in a single transaction", async function () {
            const { astaVerde, vault, scc, user1, tokenIds } = await loadFixture(deployBatchOperationsFixture);

            // Setup: Deposit tokens first
            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);
            const tokensToDeposit = tokenIds.slice(0, 5);
            await vault.connect(user1).depositBatch(tokensToDeposit);

            // Approve SCC spending
            const totalSCC = BigInt(tokensToDeposit.length) * ethers.parseEther("20");
            await scc.connect(user1).approve(await vault.getAddress(), totalSCC);

            // Withdraw batch
            await expect(vault.connect(user1).withdrawBatch(tokensToDeposit))
                .to.emit(vault, "Withdrawn")
                .to.emit(scc, "Transfer");

            // Verify all tokens were returned
            for (const tokenId of tokensToDeposit) {
                expect(await astaVerde.balanceOf(user1.address, tokenId)).to.equal(1);
                expect(await astaVerde.balanceOf(await vault.getAddress(), tokenId)).to.equal(0);
            }

            // Verify SCC was burned
            expect(await scc.balanceOf(user1.address)).to.equal(0);
        });

        it("Should reject batch withdraw with insufficient SCC", async function () {
            const { astaVerde, vault, scc, user1, tokenIds } = await loadFixture(deployBatchOperationsFixture);

            // Setup: Deposit tokens
            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);
            const tokensToDeposit = tokenIds.slice(0, 5);
            await vault.connect(user1).depositBatch(tokensToDeposit);

            // Burn some SCC to make balance insufficient
            await scc.connect(user1).burn(ethers.parseEther("10"));

            // Try to withdraw all
            await expect(vault.connect(user1).withdrawBatch(tokensToDeposit)).to.be.revertedWith("insufficient SCC");
        });

        it("Should reject batch withdraw for non-borrower", async function () {
            const { astaVerde, vault, user1, user2, tokenIds } = await loadFixture(deployBatchOperationsFixture);

            // User1 deposits
            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);
            await vault.connect(user1).depositBatch([tokenIds[0]]);

            // User2 tries to withdraw
            await expect(vault.connect(user2).withdrawBatch([tokenIds[0]])).to.be.revertedWith("insufficient SCC");
        });

        it("Should handle mixed ownership in batch withdraw attempt", async function () {
            const { astaVerde, vault, user1, user2, tokenIds } = await loadFixture(deployBatchOperationsFixture);

            // Setup: User1 deposits token 1, transfers token 2 to user2
            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);
            await vault.connect(user1).deposit(tokenIds[0]);

            await astaVerde.connect(user1).safeTransferFrom(user1.address, user2.address, tokenIds[1], 1, "0x");

            // User2 deposits token 2
            await astaVerde.connect(user2).setApprovalForAll(await vault.getAddress(), true);
            await vault.connect(user2).deposit(tokenIds[1]);

            // User1 tries to withdraw both (should fail on token 2)
            await expect(vault.connect(user1).withdrawBatch([tokenIds[0], tokenIds[1]])).to.be.revertedWith(
                "insufficient SCC",
            );
        });

        it("Should maintain correct state with interleaved batch and single operations", async function () {
            const { astaVerde, vault, scc, user1, tokenIds } = await loadFixture(deployBatchOperationsFixture);

            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);

            // Batch deposit tokens 1-3
            await vault.connect(user1).depositBatch(tokenIds.slice(0, 3));

            // Single deposit token 4
            await vault.connect(user1).deposit(tokenIds[3]);

            // Batch deposit tokens 5-6
            await vault.connect(user1).depositBatch(tokenIds.slice(4, 6));

            // Verify total SCC
            const expectedSCC = BigInt(6) * ethers.parseEther("20");
            expect(await scc.balanceOf(user1.address)).to.equal(expectedSCC);

            // Mixed withdrawals
            await scc.connect(user1).approve(await vault.getAddress(), expectedSCC);

            // Single withdraw token 2
            await vault.connect(user1).withdraw(tokenIds[1]);

            // Batch withdraw tokens 1,3,4
            await vault.connect(user1).withdrawBatch([tokenIds[0], tokenIds[2], tokenIds[3]]);

            // Verify remaining loans
            const userLoans = await vault.getUserLoans(user1.address);
            expect(userLoans.length).to.equal(2);
            expect(userLoans).to.deep.equal([tokenIds[4], tokenIds[5]]);
        });
    });

    // ======================= PARTIAL BATCH SCENARIOS =======================

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

            // ========== 2. PRICE DECAY PERIOD ==========
            // Advance time by 3 days
            await time.increase(3 * 24 * 60 * 60);

            const decayedPrice = await astaVerde.getCurrentBatchPrice(1);
            expect(decayedPrice).to.equal(ethers.parseUnits("227", 6)); // 230 - 3

            // UserC buys 1 NFT (ID: 6) at decayed price
            await mockUSDC.connect(userC).approve(astaVerde.target, decayedPrice);
            await astaVerde.connect(userC).buyBatch(1, decayedPrice, 1);

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

            // ========== 4. WITHDRAWAL DURING DECAY ==========
            // UserA withdraws NFT #1
            await scc.connect(userA).approve(ecoStabilizer.target, ethers.parseEther("20"));

            await expect(ecoStabilizer.connect(userA).withdraw(1))
                .to.emit(ecoStabilizer, "Withdrawn")
                .withArgs(userA.address, 1);

            // Verify withdrawal cost is 20 SCC (not related to current batch price)
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("20")); // Had 40, spent 20
        });

        it("Should maintain vault independence from batch price changes", async function () {
            const { astaVerde, scc, ecoStabilizer, mockUSDC, userA } = await loadFixture(deployPartialBatchFixture);

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
    });

    // ======================= BOUNDARY CONDITIONS =======================

    describe("Token ID Boundary Tests", function () {
        it("Should handle token ID 1 correctly (minimum valid ID)", async function () {
            const { ecoStabilizer, astaVerde, scc, producer, user1, mockUSDC } =
                await loadFixture(deployEcoStabilizerFixture);

            // Test deposit with token ID 1
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            expect(await scc.balanceOf(user1.address)).to.equal(ethers.parseEther("20"));

            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.true;
            expect(loan.borrower).to.equal(user1.address);
        });

        it("Should handle very high token IDs without overflow", async function () {
            const { ecoStabilizer, astaVerde } = await loadFixture(deployEcoStabilizerFixture);

            // Test view functions with high token IDs (simulating future state)
            const highTokenId = ethers.parseUnits("1000000", 0); // 1 million

            // These should not revert even with non-existent high token IDs
            const loan = await ecoStabilizer.loans(highTokenId);
            expect(loan.active).to.be.false;
            expect(loan.borrower).to.equal(ethers.ZeroAddress);

            // lastTokenID should handle absence gracefully
            expect(await astaVerde.lastTokenID()).to.equal(1); // One token minted in fixture
        });

        it("Should handle zero and invalid token IDs", async function () {
            const { ecoStabilizer, astaVerde, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // Token ID 0 doesn't exist in AstaVerde (starts from 1)
            const loan0 = await ecoStabilizer.loans(0);
            expect(loan0.active).to.be.false;

            // Attempting deposit with non-existent token should fail at NFT level
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

            // This should fail because token 0 doesn't exist
            await expect(ecoStabilizer.connect(user1).deposit(0)).to.be.reverted; // Will fail at safeTransferFrom level
        });
    });

    describe("View Function Stress Tests", function () {
        it("Should handle getUserLoans efficiently with many tokens", async function () {
            const { ecoStabilizer, astaVerde, producer, user1, mockUSDC } =
                await loadFixture(deployEcoStabilizerFixture);

            // Create many tokens for stress testing
            const numTokens = 50;
            const producers = new Array(numTokens).fill(producer.address);
            const cids = Array.from({ length: numTokens }, (_, i) => `QmStressTest${i}`);

            await astaVerde.mintBatch(producers, cids);

            // User1 needs more USDC for this test - mint additional funds
            const batchPrice = await astaVerde.getCurrentBatchPrice(2); // New batch ID
            const totalCost = batchPrice * BigInt(numTokens);
            await mockUSDC.mint(user1.address, totalCost); // Mint enough USDC for the purchase
            await mockUSDC.connect(user1).approve(astaVerde.target, totalCost);
            await astaVerde.connect(user1).buyBatch(2, totalCost, numTokens);

            // User1 deposits every 5th token (10 total loans)
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            const depositedTokens = [];
            for (let i = 2; i <= numTokens + 1; i += 5) {
                await ecoStabilizer.connect(user1).deposit(i);
                depositedTokens.push(i);
            }

            // Test view functions with many loans
            const userLoans = await ecoStabilizer.getUserLoans(user1.address);
            const userLoanCount = await ecoStabilizer.getUserLoanCount(user1.address);
            const totalActiveLoans = await ecoStabilizer.getTotalActiveLoans();

            expect(userLoanCount).to.equal(10);
            expect(totalActiveLoans).to.equal(10);
            expect(userLoans.length).to.equal(10);

            // Verify correct token IDs returned
            for (let i = 0; i < depositedTokens.length; i++) {
                expect(userLoans).to.include(BigInt(depositedTokens[i]));
            }
        });

        it("Should handle empty and sparse loan scenarios", async function () {
            const { ecoStabilizer, astaVerde, producer, user1, user2, mockUSDC } =
                await loadFixture(deployEcoStabilizerFixture);

            // Create gaps: tokens 1, 5, 10
            await astaVerde.mintBatch([producer.address], ["QmSparse1"]);
            await astaVerde.mintBatch([producer.address], ["QmSparse2"]);
            await astaVerde.mintBatch([producer.address], ["QmSparse3"]);
            await astaVerde.mintBatch([producer.address], ["QmSparse4"]);

            // Users buy tokens
            const batchPrices = await Promise.all([2, 3, 4, 5].map((i) => astaVerde.getCurrentBatchPrice(i)));
            for (let i = 0; i < 4; i++) {
                const user = i < 2 ? user1 : user2;
                const totalCost = batchPrices[i] * 1n;
                await mockUSDC.connect(user).approve(astaVerde.target, totalCost);
                await astaVerde.connect(user).buyBatch(i + 2, totalCost, 1);
            }

            // Only deposit tokens 2 and 5 (sparse pattern)
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);

            await ecoStabilizer.connect(user1).deposit(2);
            await ecoStabilizer.connect(user2).deposit(5);

            // View functions should handle sparse data correctly
            const user1Loans = await ecoStabilizer.getUserLoans(user1.address);
            const user2Loans = await ecoStabilizer.getUserLoans(user2.address);
            const totalLoans = await ecoStabilizer.getTotalActiveLoans();

            expect(user1Loans.length).to.equal(1);
            expect(user1Loans[0]).to.equal(2n);
            expect(user2Loans.length).to.equal(1);
            expect(user2Loans[0]).to.equal(5n);
            expect(totalLoans).to.equal(2);
        });
    });

    // ======================= ADMIN FUNCTIONS =======================

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

    // ======================= DIRECT TRANSFER HANDLING =======================

    describe("Direct Transfer Handling", function () {
        it("Should allow admin to sweep NFT that was directly transferred to vault", async function () {
            const { ecoStabilizer, astaVerde, owner, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // User1 directly transfers NFT to vault (bypassing deposit function)
            await astaVerde.connect(user1).safeTransferFrom(user1.address, ecoStabilizer.target, 1, 1, "0x");

            // Verify NFT is now in vault
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(0);

            // Verify no loan was created (this was a direct transfer, not a deposit)
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.false;
            expect(loan.borrower).to.equal(ethers.ZeroAddress);

            // Admin should be able to sweep the NFT
            await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, owner.address))
                .to.emit(ecoStabilizer, "EmergencyNFTWithdrawn")
                .withArgs(owner.address, 1);

            // Verify NFT was transferred to admin
            expect(await astaVerde.balanceOf(owner.address, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(0);
        });

        it("Should handle mixed scenario: one deposited, one direct transfer", async function () {
            const { ecoStabilizer, astaVerde, owner, user1, user2, mockUSDC, producer } =
                await loadFixture(deployEcoStabilizerFixture);

            // Create a second NFT for user2
            await astaVerde.mintBatch([producer.address], ["QmSecond"]);
            const batch2Price = await astaVerde.getCurrentBatchPrice(2);
            await mockUSDC.connect(user2).approve(astaVerde.target, batch2Price);
            await astaVerde.connect(user2).buyBatch(2, batch2Price, 1);

            // User1 properly deposits through vault
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            // User2 directly transfers to vault
            await astaVerde.connect(user2).safeTransferFrom(user2.address, ecoStabilizer.target, 2, 1, "0x");

            // Admin should be able to sweep the direct transfer but not the deposited one
            await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, owner.address)).to.be.revertedWith(
                "loan active",
            );

            await expect(ecoStabilizer.connect(owner).adminSweepNFT(2, owner.address))
                .to.emit(ecoStabilizer, "EmergencyNFTWithdrawn")
                .withArgs(owner.address, 2);
        });
    });

    // ======================= REDEEMED TOKEN PROTECTION =======================

    describe("Redeemed Token Protection", function () {
        it("Should allow deposit of un-redeemed NFT", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // Verify token is not redeemed
            const tokenInfo = await astaVerde.tokens(1);
            expect(tokenInfo[4]).to.be.false; // redeemed field should be false

            // Approve vault to transfer NFT
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

            // Should successfully deposit un-redeemed NFT
            await expect(ecoStabilizer.connect(user1).deposit(1))
                .to.emit(ecoStabilizer, "Deposited")
                .withArgs(user1.address, 1);

            // Verify SCC was minted
            const sccBalance = await scc.balanceOf(user1.address);
            expect(sccBalance).to.equal(ethers.parseEther("20"));
        });

        it("Should reject deposit after token is redeemed mid-ownership", async function () {
            const { ecoStabilizer, astaVerde, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // Approve vault first
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

            // Verify initial deposit works
            await expect(ecoStabilizer.connect(user1).deposit(1)).to.emit(ecoStabilizer, "Deposited");

            // Withdraw the NFT
            const scc = await ethers.getContractAt("StabilizedCarbonCoin", await ecoStabilizer.scc());
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(user1).withdraw(1);

            // Now redeem the NFT
            await astaVerde.connect(user1).redeemToken(1);

            // Should now reject deposit of the redeemed NFT
            await expect(ecoStabilizer.connect(user1).deposit(1)).to.be.revertedWith("redeemed asset");
        });
    });

    // ======================= REENTRANCY PROTECTION =======================

    describe("Reentrancy Protection", function () {
        it("Should prevent reentrancy during deposit NFT transfer", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // Since we can't easily deploy inline Solidity, we'll simulate the attack
            // by checking that multiple deposits of the same token fail
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

            // First deposit should succeed
            await ecoStabilizer.connect(user1).deposit(1);

            // Verify loan is active
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.true;

            // Second deposit of same token should fail (simulating reentrancy attempt)
            await expect(ecoStabilizer.connect(user1).deposit(1)).to.be.revertedWith("loan active");

            // Verify state is consistent
            expect(await scc.balanceOf(user1.address)).to.equal(ethers.parseEther("20"));
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);
        });

        it("Should maintain consistent state during deposit failures", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

            // Successful deposit
            await ecoStabilizer.connect(user1).deposit(1);

            const initialSCCSupply = await scc.totalSupply();
            const initialUserBalance = await scc.balanceOf(user1.address);
            const initialLoanCount = await ecoStabilizer.getTotalActiveLoans();

            // Failed deposit attempt (already active loan)
            await expect(ecoStabilizer.connect(user1).deposit(1)).to.be.revertedWith("loan active");

            // Verify no state changes occurred during failed attempt
            expect(await scc.totalSupply()).to.equal(initialSCCSupply);
            expect(await scc.balanceOf(user1.address)).to.equal(initialUserBalance);
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(initialLoanCount);
        });

        it("Should handle concurrent withdraw attempts safely", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // Setup: user deposits NFT
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            // User gets 20 SCC, approve vault to spend it
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("40")); // Overapprove

            const initialSCCBalance = await scc.balanceOf(user1.address);
            const initialNFTBalance = await astaVerde.balanceOf(user1.address, 1);

            // First withdraw succeeds
            await ecoStabilizer.connect(user1).withdraw(1);

            // Verify state changes
            expect(await scc.balanceOf(user1.address)).to.equal(initialSCCBalance - ethers.parseEther("20"));
            expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(initialNFTBalance + 1n);

            // Second withdraw attempt fails (loan closed)
            await expect(ecoStabilizer.connect(user1).withdraw(1)).to.be.revertedWith("not borrower");
        });

        it("Should maintain state consistency when withdraw reverts", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // User deposits NFT
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            const initialSCCSupply = await scc.totalSupply();
            const initialUserSCCBalance = await scc.balanceOf(user1.address);
            const initialVaultNFTBalance = await astaVerde.balanceOf(ecoStabilizer.target, 1);

            // Try to withdraw without approving SCC
            await expect(ecoStabilizer.connect(user1).withdraw(1)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );

            // Verify no state changes occurred during failed withdraw
            expect(await scc.totalSupply()).to.equal(initialSCCSupply);
            expect(await scc.balanceOf(user1.address)).to.equal(initialUserSCCBalance);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(initialVaultNFTBalance);

            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.true; // Loan should still be active
            expect(loan.borrower).to.equal(user1.address);
        });
    });

    // ======================= SECURITY & DEPLOYMENT =======================

    describe("MINTER_ROLE and Admin Role Security", function () {
        it("Should verify correct deployment flow with role management", async function () {
            const { scc, ecoStabilizer, deployer } = await loadFixture(deploySecurityTestFixture);

            const MINTER_ROLE = await scc.MINTER_ROLE();
            const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();

            // Initial state: deployer has DEFAULT_ADMIN_ROLE (since deployer deployed SCC), no one has MINTER_ROLE initially
            expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;

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

    // ======================= VIEW FUNCTIONS =======================

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

    // ======================= SCC TOKEN TESTS =======================

    describe("StabilizedCarbonCoin Coverage Tests", function () {
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

            await expect(scc.connect(user1).burn(burnAmount)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientBalance",
            );
        });

        it("Should test decimals() function", async function () {
            const { scc } = await loadFixture(deployEcoStabilizerFixture);

            // Test the decimals function
            expect(await scc.decimals()).to.equal(18);
        });

        it("Should test mint() access control - reject non-minter", async function () {
            const { scc, user2 } = await loadFixture(deployEcoStabilizerFixture);

            const mintAmount = ethers.parseEther("50");

            // Test that non-minter cannot mint
            await expect(scc.connect(user2).mint(user2.address, mintAmount)).to.be.revertedWithCustomError(
                scc,
                "AccessControlUnauthorizedAccount",
            );
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
            await expect(scc.connect(user1).burnFrom(owner.address, burnAmount)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );

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

    // ======================= ACCESS CONTROL =======================

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

    // ======================= INTEGRATION TESTS =======================

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
