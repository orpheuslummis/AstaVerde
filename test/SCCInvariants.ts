import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../typechain-types";

describe("SCC Supply Invariants & Ghost Supply Tests", function () {
    async function deployInvariantTestFixture() {
        const [owner, deployer, producer, user1, user2, user3] = await ethers.getSigners();

        // Deploy MockUSDC
        const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDCFactory.deploy(ethers.parseUnits("1000000", 6));

        // Deploy AstaVerde
        const AstaVerdeFactory = await ethers.getContractFactory("AstaVerde");
        const astaVerde = await AstaVerdeFactory.deploy(owner.address, mockUSDC.target);

        // Deploy StabilizedCarbonCoin
        const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
        const scc = await SCCFactory.connect(deployer).deploy(ethers.ZeroAddress);

        // Deploy EcoStabilizer
        const EcoStabilizerFactory = await ethers.getContractFactory("EcoStabilizer");
        const ecoStabilizer = await EcoStabilizerFactory.connect(deployer).deploy(astaVerde.target, scc.target);

        // Complete deployment setup
        const MINTER_ROLE = await scc.MINTER_ROLE();
        const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();
        await scc.connect(deployer).grantRole(MINTER_ROLE, ecoStabilizer.target);
        await scc.connect(deployer).renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);

        // Setup test data: mint multiple NFTs for testing
        await mockUSDC.mint(user1.address, ethers.parseUnits("2000", 6));
        await mockUSDC.mint(user2.address, ethers.parseUnits("2000", 6));
        await mockUSDC.mint(user3.address, ethers.parseUnits("2000", 6));

        // Create multiple batches
        await astaVerde.mintBatch(
            [producer.address, producer.address, producer.address],
            ["QmCID1", "QmCID2", "QmCID3"],
        );
        await astaVerde.mintBatch([producer.address, producer.address], ["QmCID4", "QmCID5"]);

        // Users buy NFTs
        const batch1Price = await astaVerde.getCurrentBatchPrice(1);
        await mockUSDC.connect(user1).approve(astaVerde.target, batch1Price * 2n);
        await astaVerde.connect(user1).buyBatch(1, batch1Price * 2n, 2); // Gets tokens 1,2

        await mockUSDC.connect(user2).approve(astaVerde.target, batch1Price);
        await astaVerde.connect(user2).buyBatch(1, batch1Price, 1); // Gets token 3

        const batch2Price = await astaVerde.getCurrentBatchPrice(2);
        await mockUSDC.connect(user3).approve(astaVerde.target, batch2Price * 2n);
        await astaVerde.connect(user3).buyBatch(2, batch2Price * 2n, 2); // Gets tokens 4,5

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
            user3,
        };
    }

    describe("Core Supply Invariant: SCC Supply = 20 * Active Loans", function () {
        it("Should maintain supply invariant during normal deposit/withdraw cycles", async function () {
            const { ecoStabilizer, astaVerde, scc, user1, user2, user3 } =
                await loadFixture(deployInvariantTestFixture);

            // Initial state: no loans, no SCC supply
            expect(await scc.totalSupply()).to.equal(0);
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(0);

            // User1 deposits token 1
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            // Verify invariant: 1 loan = 20 SCC
            expect(await scc.totalSupply()).to.equal(ethers.parseEther("20"));
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(1);
            expect(await scc.totalSupply()).to.equal(
                (await ecoStabilizer.getTotalActiveLoans()) * ethers.parseEther("20"),
            );

            // User2 deposits token 3
            await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user2).deposit(3);

            // Verify invariant: 2 loans = 40 SCC
            expect(await scc.totalSupply()).to.equal(ethers.parseEther("40"));
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(2);
            expect(await scc.totalSupply()).to.equal(
                (await ecoStabilizer.getTotalActiveLoans()) * ethers.parseEther("20"),
            );

            // User3 deposits both tokens 4 and 5
            await astaVerde.connect(user3).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user3).deposit(4);
            await ecoStabilizer.connect(user3).deposit(5);

            // Verify invariant: 4 loans = 80 SCC
            expect(await scc.totalSupply()).to.equal(ethers.parseEther("80"));
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(4);
            expect(await scc.totalSupply()).to.equal(
                (await ecoStabilizer.getTotalActiveLoans()) * ethers.parseEther("20"),
            );

            // User1 withdraws token 1
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(user1).withdraw(1);

            // Verify invariant: 3 loans = 60 SCC
            expect(await scc.totalSupply()).to.equal(ethers.parseEther("60"));
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(3);
            expect(await scc.totalSupply()).to.equal(
                (await ecoStabilizer.getTotalActiveLoans()) * ethers.parseEther("20"),
            );

            // User3 withdraws token 5
            await scc.connect(user3).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(user3).withdraw(5);

            // Verify final invariant: 2 loans = 40 SCC
            expect(await scc.totalSupply()).to.equal(ethers.parseEther("40"));
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(2);
            expect(await scc.totalSupply()).to.equal(
                (await ecoStabilizer.getTotalActiveLoans()) * ethers.parseEther("20"),
            );
        });

        it("Should maintain invariant during mixed operations", async function () {
            const { ecoStabilizer, astaVerde, scc, user1, user2, user3 } =
                await loadFixture(deployInvariantTestFixture);

            // Helper function to verify invariant
            async function verifyInvariant() {
                const totalSupply = await scc.totalSupply();
                const activeLoans = await ecoStabilizer.getTotalActiveLoans();
                const expectedSupply = activeLoans * ethers.parseEther("20");
                expect(totalSupply).to.equal(expectedSupply);
                return { totalSupply, activeLoans, expectedSupply };
            }

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
            await astaVerde.connect(user3).setApprovalForAll(ecoStabilizer.target, true);

            // Mixed sequence of operations
            await ecoStabilizer.connect(user1).deposit(1);
            await verifyInvariant(); // 1 loan, 20 SCC

            await ecoStabilizer.connect(user2).deposit(3);
            await ecoStabilizer.connect(user3).deposit(4);
            await verifyInvariant(); // 3 loans, 60 SCC

            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(user1).withdraw(1);
            await verifyInvariant(); // 2 loans, 40 SCC

            await ecoStabilizer.connect(user1).deposit(2);
            await ecoStabilizer.connect(user3).deposit(5);
            await verifyInvariant(); // 4 loans, 80 SCC

            await scc.connect(user2).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(user2).withdraw(3);
            await scc.connect(user3).approve(ecoStabilizer.target, ethers.parseEther("40"));
            await ecoStabilizer.connect(user3).withdraw(4);
            await ecoStabilizer.connect(user3).withdraw(5);
            await verifyInvariant(); // 1 loan, 20 SCC
        });
    });

    describe("Ghost Supply Scenarios (Orphaned Collateral)", function () {
        it("Should create ghost supply when user burns SCC without withdrawing", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployInvariantTestFixture);

            // User deposits NFT and gets 20 SCC
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            // Verify initial state
            expect(await scc.totalSupply()).to.equal(ethers.parseEther("20"));
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(1);

            // User burns SCC directly (simulating lost keys or intentional burn)
            await scc.connect(user1).burn(ethers.parseEther("20"));

            // Now we have ghost supply: 0 SCC supply but 1 active loan
            expect(await scc.totalSupply()).to.equal(0);
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(1);

            // The NFT is permanently locked (orphaned collateral)
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(0);

            // User cannot withdraw anymore (no SCC to burn)
            await expect(ecoStabilizer.connect(user1).withdraw(1)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );

            // Loan remains active forever
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.true;
            expect(loan.borrower).to.equal(user1.address);
        });

        it("Should handle partial SCC burns creating incomplete ghost supply", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployInvariantTestFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            // User burns only part of their SCC
            await scc.connect(user1).burn(ethers.parseEther("15"));

            // State: 5 SCC supply, 1 active loan (partial ghost supply)
            expect(await scc.totalSupply()).to.equal(ethers.parseEther("5"));
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(1);
            expect(await scc.balanceOf(user1.address)).to.equal(ethers.parseEther("5"));

            // User cannot withdraw (needs 20 SCC, only has 5)
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("5"));
            await expect(ecoStabilizer.connect(user1).withdraw(1)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );

            // NFT remains locked until user somehow gets 15 more SCC
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);
        });

        it("Should demonstrate ghost supply accumulation across multiple users", async function () {
            const { ecoStabilizer, astaVerde, scc, user1, user2, user3 } =
                await loadFixture(deployInvariantTestFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
            await astaVerde.connect(user3).setApprovalForAll(ecoStabilizer.target, true);

            // Three users deposit NFTs
            await ecoStabilizer.connect(user1).deposit(1);
            await ecoStabilizer.connect(user2).deposit(3);
            await ecoStabilizer.connect(user3).deposit(4);

            // Initial state: 60 SCC supply, 3 active loans
            expect(await scc.totalSupply()).to.equal(ethers.parseEther("60"));
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(3);

            // User1 burns their SCC (simulating lost keys)
            await scc.connect(user1).burn(ethers.parseEther("20"));

            // User3 burns their SCC (simulating another lost key scenario)
            await scc.connect(user3).burn(ethers.parseEther("20"));

            // Now: 20 SCC supply, 3 active loans (40 SCC worth of ghost supply)
            expect(await scc.totalSupply()).to.equal(ethers.parseEther("20"));
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(3);

            // Only user2 can withdraw their NFT
            await scc.connect(user2).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(user2).withdraw(3);

            // Final state: 0 SCC supply, 2 active loans (full ghost supply for 2 NFTs)
            expect(await scc.totalSupply()).to.equal(0);
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(2);

            // Two NFTs permanently locked
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1); // user1's NFT
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 4)).to.equal(1); // user3's NFT
        });
    });

    describe("Supply Invariant Edge Cases", function () {
        it("Should handle rapid deposit/withdraw sequences", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployInvariantTestFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

            // Rapid sequence: deposit-withdraw-deposit-withdraw
            await ecoStabilizer.connect(user1).deposit(1);
            expect(await scc.totalSupply()).to.equal(ethers.parseEther("20"));

            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(user1).withdraw(1);
            expect(await scc.totalSupply()).to.equal(0);

            await ecoStabilizer.connect(user1).deposit(1);
            expect(await scc.totalSupply()).to.equal(ethers.parseEther("20"));

            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(user1).withdraw(1);
            expect(await scc.totalSupply()).to.equal(0);

            // Final state should be clean
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(0);
        });

        it("Should maintain invariant when users transfer SCC between addresses", async function () {
            const { ecoStabilizer, astaVerde, scc, user1, user2 } = await loadFixture(deployInvariantTestFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            const initialSupply = await scc.totalSupply();
            const initialLoans = await ecoStabilizer.getTotalActiveLoans();

            // User1 transfers 10 SCC to user2
            await scc.connect(user1).transfer(user2.address, ethers.parseEther("10"));

            // Total supply unchanged, loans unchanged
            expect(await scc.totalSupply()).to.equal(initialSupply);
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(initialLoans);

            // User1 can't withdraw anymore (insufficient SCC)
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("10"));
            await expect(ecoStabilizer.connect(user1).withdraw(1)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );

            // But if user2 sends SCC back, user1 can withdraw
            await scc.connect(user2).transfer(user1.address, ethers.parseEther("10"));
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(user1).withdraw(1);

            // Final state: invariant maintained
            expect(await scc.totalSupply()).to.equal(0);
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(0);
        });
    });

    describe("Supply Monitoring & Health Checks", function () {
        it("Should provide accurate supply health metrics", async function () {
            const { ecoStabilizer, astaVerde, scc, user1, user2 } = await loadFixture(deployInvariantTestFixture);

            // Helper function to calculate supply health
            async function getSupplyHealth() {
                const totalSupply = await scc.totalSupply();
                const activeLoans = await ecoStabilizer.getTotalActiveLoans();
                const expectedSupply = activeLoans * ethers.parseEther("20");
                const ghostSupply = expectedSupply - totalSupply;
                const isHealthy = totalSupply == expectedSupply;

                return {
                    totalSupply,
                    activeLoans,
                    expectedSupply,
                    ghostSupply,
                    isHealthy,
                };
            }

            // Initial healthy state
            let health = await getSupplyHealth();
            expect(health.isHealthy).to.be.true;
            expect(health.ghostSupply).to.equal(0);

            // Create loans
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);

            await ecoStabilizer.connect(user1).deposit(1);
            await ecoStabilizer.connect(user2).deposit(3);

            health = await getSupplyHealth();
            expect(health.isHealthy).to.be.true;
            expect(health.ghostSupply).to.equal(0);

            // Create ghost supply
            await scc.connect(user1).burn(ethers.parseEther("15"));

            health = await getSupplyHealth();
            expect(health.isHealthy).to.be.false;
            expect(health.ghostSupply).to.equal(ethers.parseEther("15"));
            expect(health.totalSupply).to.equal(ethers.parseEther("25")); // 40 - 15
            expect(health.expectedSupply).to.equal(ethers.parseEther("40")); // 2 * 20
        });

        it("Should handle zero loan state correctly", async function () {
            const { ecoStabilizer, scc } = await loadFixture(deployInvariantTestFixture);

            // No loans should mean zero supply
            expect(await scc.totalSupply()).to.equal(0);
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(0);

            // View functions should work with zero loans
            expect(await ecoStabilizer.getUserLoans(ethers.ZeroAddress)).to.deep.equal([]);
            expect(await ecoStabilizer.getUserLoanCount(ethers.ZeroAddress)).to.equal(0);
        });

        it("Should handle maximum realistic loan scenarios", async function () {
            const { ecoStabilizer, astaVerde, scc, user1, user2, user3 } =
                await loadFixture(deployInvariantTestFixture);

            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await astaVerde.connect(user2).setApprovalForAll(ecoStabilizer.target, true);
            await astaVerde.connect(user3).setApprovalForAll(ecoStabilizer.target, true);

            // Deposit all available NFTs (5 total)
            await ecoStabilizer.connect(user1).deposit(1);
            await ecoStabilizer.connect(user1).deposit(2);
            await ecoStabilizer.connect(user2).deposit(3);
            await ecoStabilizer.connect(user3).deposit(4);
            await ecoStabilizer.connect(user3).deposit(5);

            // Maximum loans: 5 loans = 100 SCC
            expect(await scc.totalSupply()).to.equal(ethers.parseEther("100"));
            expect(await ecoStabilizer.getTotalActiveLoans()).to.equal(5);

            // Verify individual user loan counts
            expect(await ecoStabilizer.getUserLoanCount(user1.address)).to.equal(2);
            expect(await ecoStabilizer.getUserLoanCount(user2.address)).to.equal(1);
            expect(await ecoStabilizer.getUserLoanCount(user3.address)).to.equal(2);

            // Verify total SCC distributed correctly
            expect(await scc.balanceOf(user1.address)).to.equal(ethers.parseEther("40"));
            expect(await scc.balanceOf(user2.address)).to.equal(ethers.parseEther("20"));
            expect(await scc.balanceOf(user3.address)).to.equal(ethers.parseEther("40"));
        });
    });
});
