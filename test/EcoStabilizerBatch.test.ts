import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { AstaVerde, EcoStabilizer, StabilizedCarbonCoin, MockUSDC } from "../types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EcoStabilizer Batch Operations", function () {
    async function deployFixture() {
        const [owner, user1, user2, producer1, producer2] = await ethers.getSigners();

        // Deploy contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const usdcToken = await MockUSDC.deploy(0); // Initial supply handled via mint

        const AstaVerde = await ethers.getContractFactory("AstaVerde");
        const astaVerde = await AstaVerde.deploy(owner.address, await usdcToken.getAddress());

        const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
        const scc = await SCC.deploy(ethers.ZeroAddress);

        const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
        const vault = await EcoStabilizer.deploy(
            await astaVerde.getAddress(),
            await scc.getAddress()
        );

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
            tokenIds: Array.from({ length: tokenCount }, (_, i) => BigInt(i + 1))
        };
    }

    describe("Batch Deposit Operations", function () {
        it("Should deposit multiple NFTs in a single transaction", async function () {
            const { astaVerde, vault, scc, user1, tokenIds } = await loadFixture(deployFixture);

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
            const { vault, user1 } = await loadFixture(deployFixture);

            await expect(vault.connect(user1).depositBatch([]))
                .to.be.revertedWith("empty array");
        });

        it("Should reject batch deposit exceeding limit", async function () {
            const { vault, user1 } = await loadFixture(deployFixture);

            const tooManyTokens = Array(21).fill(BigInt(1));
            await expect(vault.connect(user1).depositBatch(tooManyTokens))
                .to.be.revertedWith("too many tokens");
        });

        it("Should reject batch deposit with active loan", async function () {
            const { astaVerde, vault, user1, tokenIds } = await loadFixture(deployFixture);

            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);

            // Deposit token 1
            await vault.connect(user1).deposit(tokenIds[0]);

            // Try to deposit again in batch
            await expect(vault.connect(user1).depositBatch([tokenIds[0], tokenIds[1]]))
                .to.be.revertedWith("loan active");
        });

        it("Should measure gas for batch deposit vs sequential", async function () {
            const { astaVerde, vault, user1, tokenIds } = await loadFixture(deployFixture);

            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);

            // Measure batch deposit
            const tokensToDeposit = tokenIds.slice(0, 5);
            const batchTx = await vault.connect(user1).depositBatch(tokensToDeposit);
            const batchReceipt = await batchTx.wait();
            const batchGas = batchReceipt!.gasUsed;

            console.log(`Batch deposit (5 tokens) gas: ${batchGas}`);

            // Reset state for sequential test
            const { vault: vault2, user1: user2, tokenIds: tokenIds2 } = await loadFixture(deployFixture);
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
            expect(batchGas).to.be.lessThan(totalSequentialGas * BigInt(70) / BigInt(100)); // At least 30% savings
        });
    });

    describe("Batch Withdraw Operations", function () {
        it("Should withdraw multiple NFTs in a single transaction", async function () {
            const { astaVerde, vault, scc, user1, tokenIds } = await loadFixture(deployFixture);

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
            const { astaVerde, vault, scc, user1, tokenIds } = await loadFixture(deployFixture);

            // Setup: Deposit tokens
            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);
            const tokensToDeposit = tokenIds.slice(0, 5);
            await vault.connect(user1).depositBatch(tokensToDeposit);

            // Burn some SCC to make balance insufficient
            await scc.connect(user1).burn(ethers.parseEther("10"));

            // Try to withdraw all
            await expect(vault.connect(user1).withdrawBatch(tokensToDeposit))
                .to.be.revertedWith("insufficient SCC");
        });

        it("Should reject batch withdraw for non-borrower", async function () {
            const { astaVerde, vault, user1, user2, tokenIds } = await loadFixture(deployFixture);

            // User1 deposits
            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);
            await vault.connect(user1).depositBatch([tokenIds[0]]);

            // User2 tries to withdraw
            await expect(vault.connect(user2).withdrawBatch([tokenIds[0]]))
                .to.be.revertedWith("insufficient SCC");
        });

        it("Should handle mixed ownership in batch withdraw attempt", async function () {
            const { astaVerde, vault, user1, user2, tokenIds } = await loadFixture(deployFixture);

            // Setup: User1 deposits token 1, transfers token 2 to user2
            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);
            await vault.connect(user1).deposit(tokenIds[0]);

            await astaVerde.connect(user1).safeTransferFrom(
                user1.address,
                user2.address,
                tokenIds[1],
                1,
                "0x"
            );

            // User2 deposits token 2
            await astaVerde.connect(user2).setApprovalForAll(await vault.getAddress(), true);
            await vault.connect(user2).deposit(tokenIds[1]);

            // User1 tries to withdraw both (should fail on token 2)
            await expect(vault.connect(user1).withdrawBatch([tokenIds[0], tokenIds[1]]))
                .to.be.revertedWith("insufficient SCC");
        });
    });

    describe("Batch Operations Edge Cases", function () {
        it("Should handle deposit and withdraw of maximum batch size", async function () {
            const { astaVerde, vault, scc, user1, tokenIds } = await loadFixture(deployFixture);

            // Mint more tokens if needed
            const producer1 = (await ethers.getSigners())[3];
            const additionalTokens = 20 - tokenIds.length;
            if (additionalTokens > 0) {
                const producers = Array(additionalTokens).fill(producer1.address);
                const cids = Array(additionalTokens).fill("QmTest");
                await astaVerde.mintBatch(producers, cids);

                // Buy additional tokens
                const batchId = 2;
                const price = await astaVerde.getCurrentBatchPrice(batchId);
                const totalCost = price * BigInt(additionalTokens);
                await astaVerde.connect(user1).buyBatch(batchId, totalCost, additionalTokens);
            }

            // Prepare 20 tokens
            const allTokenIds = Array.from({ length: 20 }, (_, i) => BigInt(i + 1));

            // Deposit max batch
            await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);
            await vault.connect(user1).depositBatch(allTokenIds);

            // Verify SCC balance
            const expectedSCC = BigInt(20) * ethers.parseEther("20");
            expect(await scc.balanceOf(user1.address)).to.equal(expectedSCC);

            // Withdraw max batch
            await scc.connect(user1).approve(await vault.getAddress(), expectedSCC);
            await vault.connect(user1).withdrawBatch(allTokenIds);

            // Verify all returned
            for (const tokenId of allTokenIds) {
                expect(await astaVerde.balanceOf(user1.address, tokenId)).to.equal(1);
            }
        });

        it("Should maintain correct state with interleaved batch and single operations", async function () {
            const { astaVerde, vault, scc, user1, tokenIds } = await loadFixture(deployFixture);

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
});