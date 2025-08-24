import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import type { StabilizedCarbonCoin, AstaVerde, EcoStabilizer, MockUSDC } from "../types";

describe("StabilizedCarbonCoin", function () {
    // ============================================================================
    // FIXTURES
    // ============================================================================

    async function deploySCCFixture() {
        const [owner, minter, user1, user2] = await ethers.getSigners();

        const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
        const scc = await SCCFactory.deploy(ethers.ZeroAddress);

        const MINTER_ROLE = await scc.MINTER_ROLE();
        const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();

        return {
            scc,
            owner,
            minter,
            user1,
            user2,
            MINTER_ROLE,
            DEFAULT_ADMIN_ROLE,
        };
    }

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
            ["QmCID1", "QmCID2", "QmCID3"],
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

    // ============================================================================
    // CORE ERC20 FUNCTIONALITY TESTS
    // ============================================================================

    describe("Deployment", function () {
        it("Should have correct name, symbol, and decimals", async function () {
            const { scc } = await loadFixture(deploySCCFixture);

            expect(await scc.name()).to.equal("Stabilized Carbon Coin");
            expect(await scc.symbol()).to.equal("SCC");
            expect(await scc.decimals()).to.equal(18);
        });

        it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
            const { scc, owner, DEFAULT_ADMIN_ROLE } = await loadFixture(deploySCCFixture);

            expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });

        it("Should not grant MINTER_ROLE to deployer initially", async function () {
            const { scc, owner, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            expect(await scc.hasRole(MINTER_ROLE, owner.address)).to.be.false;
        });
    });

    describe("Standard ERC20 Functions", function () {
        it("Should support transfers between users", async function () {
            const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

            const amount = ethers.parseEther("100");
            const transferAmount = ethers.parseEther("30");

            await scc.connect(minter).mint(user1.address, amount);
            await scc.connect(user1).transfer(user2.address, transferAmount);

            expect(await scc.balanceOf(user1.address)).to.equal(amount - transferAmount);
            expect(await scc.balanceOf(user2.address)).to.equal(transferAmount);
        });

        it("Should support allowances and transferFrom", async function () {
            const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

            const amount = ethers.parseEther("100");
            const transferAmount = ethers.parseEther("30");

            await scc.connect(minter).mint(user1.address, amount);
            await scc.connect(user1).approve(user2.address, transferAmount);
            await scc.connect(user2).transferFrom(user1.address, user2.address, transferAmount);

            expect(await scc.balanceOf(user1.address)).to.equal(amount - transferAmount);
            expect(await scc.balanceOf(user2.address)).to.equal(transferAmount);
            expect(await scc.allowance(user1.address, user2.address)).to.equal(0);
        });
    });

    // ============================================================================
    // ACCESS CONTROL & ROLE MANAGEMENT TESTS
    // ============================================================================

    describe("Role Management", function () {
        it("Should allow admin to grant MINTER_ROLE", async function () {
            const { scc, owner, minter, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
            expect(await scc.hasRole(MINTER_ROLE, minter.address)).to.be.true;
        });

        it("Should allow admin to revoke MINTER_ROLE", async function () {
            const { scc, owner, minter, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
            await scc.connect(owner).revokeRole(MINTER_ROLE, minter.address);
            expect(await scc.hasRole(MINTER_ROLE, minter.address)).to.be.false;
        });

        it("Should reject role management by non-admin", async function () {
            const { scc, user1, minter, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await expect(scc.connect(user1).grantRole(MINTER_ROLE, minter.address)).to.be.revertedWithCustomError(
                scc,
                "AccessControlUnauthorizedAccount",
            );
        });
    });

    describe("Constructor Race Condition Fix", function () {
        it("Should allow deployment with vault address", async function () {
            const [owner, vault] = await ethers.getSigners();

            const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
            const scc = await SCCFactory.deploy(vault.address);

            const MINTER_ROLE = await scc.MINTER_ROLE();

            // Vault should have MINTER_ROLE immediately
            expect(await scc.hasRole(MINTER_ROLE, vault.address)).to.be.true;

            // Deployer should still have admin role
            const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();
            expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });

        it("Should allow deployment without vault address", async function () {
            const [owner] = await ethers.getSigners();

            const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
            const scc = await SCCFactory.deploy(ethers.ZeroAddress);

            const MINTER_ROLE = await scc.MINTER_ROLE();

            // No one should have MINTER_ROLE initially
            expect(await scc.hasRole(MINTER_ROLE, ethers.ZeroAddress)).to.be.false;
            expect(await scc.hasRole(MINTER_ROLE, owner.address)).to.be.false;

            // Deployer should have admin role
            const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();
            expect(await scc.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });
    });

    // ============================================================================
    // MINTING & BURNING FUNCTIONALITY TESTS
    // ============================================================================

    describe("Minting", function () {
        it("Should allow minter to mint tokens", async function () {
            const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

            const amount = ethers.parseEther("100");
            await scc.connect(minter).mint(user1.address, amount);

            expect(await scc.balanceOf(user1.address)).to.equal(amount);
            expect(await scc.totalSupply()).to.equal(amount);
        });

        it("Should reject minting by non-minter", async function () {
            const { scc, user1, user2 } = await loadFixture(deploySCCFixture);

            const amount = ethers.parseEther("100");

            await expect(scc.connect(user1).mint(user2.address, amount)).to.be.revertedWithCustomError(
                scc,
                "AccessControlUnauthorizedAccount",
            );
        });

        it("Should emit Transfer event on mint", async function () {
            const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

            const amount = ethers.parseEther("100");

            await expect(scc.connect(minter).mint(user1.address, amount))
                .to.emit(scc, "Transfer")
                .withArgs(ethers.ZeroAddress, user1.address, amount);
        });
    });

    describe("Burning", function () {
        it("Should allow token holder to burn their tokens", async function () {
            const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

            const mintAmount = ethers.parseEther("100");
            const burnAmount = ethers.parseEther("30");

            await scc.connect(minter).mint(user1.address, mintAmount);
            await scc.connect(user1).burn(burnAmount);

            expect(await scc.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
            expect(await scc.totalSupply()).to.equal(mintAmount - burnAmount);
        });

        it("Should reject burning more than balance", async function () {
            const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

            const mintAmount = ethers.parseEther("100");
            const burnAmount = ethers.parseEther("150");

            await scc.connect(minter).mint(user1.address, mintAmount);

            await expect(scc.connect(user1).burn(burnAmount)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientBalance",
            );
        });

        it("Should emit Transfer event on burn", async function () {
            const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

            const mintAmount = ethers.parseEther("100");
            const burnAmount = ethers.parseEther("30");

            await scc.connect(minter).mint(user1.address, mintAmount);

            await expect(scc.connect(user1).burn(burnAmount))
                .to.emit(scc, "Transfer")
                .withArgs(user1.address, ethers.ZeroAddress, burnAmount);
        });
    });

    describe("BurnFrom Functionality", function () {
        it("Should allow approved spender to burn tokens from user", async function () {
            const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

            const mintAmount = ethers.parseEther("100");
            const burnAmount = ethers.parseEther("30");

            await scc.connect(minter).mint(user1.address, mintAmount);
            await scc.connect(user1).approve(user2.address, burnAmount);

            await scc.connect(user2).burnFrom(user1.address, burnAmount);

            expect(await scc.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
            expect(await scc.totalSupply()).to.equal(mintAmount - burnAmount);
            expect(await scc.allowance(user1.address, user2.address)).to.equal(0);
        });

        it("Should reject burnFrom with insufficient allowance", async function () {
            const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

            const mintAmount = ethers.parseEther("100");
            const burnAmount = ethers.parseEther("30");
            const lowAllowance = ethers.parseEther("10");

            await scc.connect(minter).mint(user1.address, mintAmount);
            await scc.connect(user1).approve(user2.address, lowAllowance);

            await expect(scc.connect(user2).burnFrom(user1.address, burnAmount)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );
        });

        it("Should reject burnFrom with no allowance", async function () {
            const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

            const mintAmount = ethers.parseEther("100");
            const burnAmount = ethers.parseEther("30");

            await scc.connect(minter).mint(user1.address, mintAmount);
            // No approval given

            await expect(scc.connect(user2).burnFrom(user1.address, burnAmount)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );
        });

        it("Should emit Transfer event on burnFrom", async function () {
            const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

            await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

            const mintAmount = ethers.parseEther("100");
            const burnAmount = ethers.parseEther("30");

            await scc.connect(minter).mint(user1.address, mintAmount);
            await scc.connect(user1).approve(user2.address, burnAmount);

            await expect(scc.connect(user2).burnFrom(user1.address, burnAmount))
                .to.emit(scc, "Transfer")
                .withArgs(user1.address, ethers.ZeroAddress, burnAmount);
        });
    });

    // ============================================================================
    // SECURITY FEATURES TESTS
    // ============================================================================

    describe("Security Features", function () {
        describe("Supply Cap", function () {
            it("Should have correct MAX_SUPPLY constant", async function () {
                const { scc } = await loadFixture(deploySCCFixture);

                expect(await scc.MAX_SUPPLY()).to.equal(ethers.parseEther("1000000000")); // 1B SCC
            });

            it("Should reject minting beyond MAX_SUPPLY", async function () {
                const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

                await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

                const maxSupply = await scc.MAX_SUPPLY();
                const exceedAmount = maxSupply + 1n;

                await expect(scc.connect(minter).mint(user1.address, exceedAmount)).to.be.revertedWith(
                    "exceeds max supply",
                );
            });

            it("Should allow minting up to MAX_SUPPLY", async function () {
                const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

                await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

                const maxSupply = await scc.MAX_SUPPLY();

                await scc.connect(minter).mint(user1.address, maxSupply);
                expect(await scc.totalSupply()).to.equal(maxSupply);
                expect(await scc.balanceOf(user1.address)).to.equal(maxSupply);
            });
        });

        describe("Input Validation", function () {
            it("Should reject minting to zero address", async function () {
                const { scc, owner, minter, MINTER_ROLE } = await loadFixture(deploySCCFixture);

                await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

                const amount = ethers.parseEther("100");

                await expect(scc.connect(minter).mint(ethers.ZeroAddress, amount)).to.be.revertedWith(
                    "mint to zero address",
                );
            });

            it("Should reject minting zero amount", async function () {
                const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

                await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

                await expect(scc.connect(minter).mint(user1.address, 0)).to.be.revertedWith("mint zero amount");
            });

            it("Should reject burning zero amount", async function () {
                const { scc, owner, minter, user1, MINTER_ROLE } = await loadFixture(deploySCCFixture);

                await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
                await scc.connect(minter).mint(user1.address, ethers.parseEther("100"));

                await expect(scc.connect(user1).burn(0)).to.be.revertedWith("burn zero amount");
            });

            it("Should reject burnFrom from zero address", async function () {
                const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

                await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);

                const amount = ethers.parseEther("100");

                await expect(scc.connect(user2).burnFrom(ethers.ZeroAddress, amount)).to.be.revertedWith(
                    "burn from zero address",
                );
            });

            it("Should reject burnFrom zero amount", async function () {
                const { scc, owner, minter, user1, user2, MINTER_ROLE } = await loadFixture(deploySCCFixture);

                await scc.connect(owner).grantRole(MINTER_ROLE, minter.address);
                await scc.connect(minter).mint(user1.address, ethers.parseEther("100"));
                await scc.connect(user1).approve(user2.address, ethers.parseEther("100"));

                await expect(scc.connect(user2).burnFrom(user1.address, 0)).to.be.revertedWith("burn zero amount");
            });
        });
    });

    // ============================================================================
    // SUPPLY INVARIANT TESTS (SCC Supply = 20 * Active Loans)
    // ============================================================================

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

    // ============================================================================
    // GHOST SUPPLY SCENARIOS (ORPHANED COLLATERAL)
    // ============================================================================

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

    // ============================================================================
    // TRANSFER SCENARIOS TESTS
    // ============================================================================

    describe("SCC Transfer Impact on Withdrawals", function () {
        it("Should prevent withdrawal when SCC is transferred away - Complete Transfer", async function () {
            const { astaVerde, scc, ecoStabilizer, userA, userB } = await loadFixture(deploySCCTransferFixture);

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
            await expect(ecoStabilizer.connect(userA).withdraw(1)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );

            // UserB attempts withdrawal (should fail - not borrower)
            await scc.connect(userB).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await expect(ecoStabilizer.connect(userB).withdraw(1)).to.be.revertedWith("not borrower");

            // Loan remains active
            const loanAfterFailure = await ecoStabilizer.loans(1);
            expect(loanAfterFailure.active).to.be.true;
        });

        it("Should prevent withdrawal with partial SCC transfer", async function () {
            const { astaVerde, scc, ecoStabilizer, userA, userB } = await loadFixture(deploySCCTransferFixture);

            // UserA deposits NFT #1
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userA).deposit(1);

            // ========== SCENARIO B: PARTIAL TRANSFER ==========
            // UserA transfers 10 SCC to UserB
            await scc.connect(userA).transfer(userB.address, ethers.parseEther("10"));
            expect(await scc.balanceOf(userA.address)).to.equal(ethers.parseEther("10"));

            // UserA attempts withdrawal with only 10 SCC (should fail)
            await scc.connect(userA).approve(ecoStabilizer.target, ethers.parseEther("10"));
            await expect(ecoStabilizer.connect(userA).withdraw(1)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );

            // Verify loan still active
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.true;
        });

        it("Should allow withdrawal after SCC is returned", async function () {
            const { astaVerde, scc, ecoStabilizer, userA, userB } = await loadFixture(deploySCCTransferFixture);

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
            const { astaVerde, scc, ecoStabilizer, userA, userB } = await loadFixture(deploySCCTransferFixture);

            // ========== DELEGATION SCENARIO ==========
            // UserA deposits NFT #2
            await astaVerde.connect(userA).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(userA).deposit(2);

            // UserA approves UserB for 20 SCC (delegation, not transfer)
            await scc.connect(userA).approve(userB.address, ethers.parseEther("20"));

            // UserB attempts to use delegated SCC for withdrawal (should fail)
            // Even though UserB has approval, they are not the borrower
            await expect(ecoStabilizer.connect(userB).withdraw(2)).to.be.revertedWith("not borrower");

            // UserA can still withdraw normally despite delegation
            await scc.connect(userA).approve(ecoStabilizer.target, ethers.parseEther("20"));

            await expect(ecoStabilizer.connect(userA).withdraw(2))
                .to.emit(ecoStabilizer, "Withdrawn")
                .withArgs(userA.address, 2);

            // Verify successful withdrawal
            expect(await astaVerde.balanceOf(userA.address, 2)).to.equal(1);
        });

        it("Should create ghost collateral when SCC is permanently lost", async function () {
            const { astaVerde, scc, ecoStabilizer, userA } = await loadFixture(deploySCCTransferFixture);

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
            await expect(ecoStabilizer.connect(userA).withdraw(3)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );

            // NFT is permanently locked (ghost collateral)
            const loan = await ecoStabilizer.loans(3);
            expect(loan.active).to.be.true;
            expect(loan.borrower).to.equal(userA.address);

            // Verify NFT still in vault
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 3)).to.equal(1);

            // Admin cannot help - no liquidation mechanism
            // adminSweepNFT fails because loan is active
            await expect(
                ecoStabilizer
                    .connect(await ethers.getSigner(await ecoStabilizer.owner()))
                    .adminSweepNFT(3, userA.address),
            ).to.be.revertedWith("loan active");

            // Ghost collateral detected: SCC burned but NFT locked
            const remainingSupply = await scc.totalSupply();
            const activeLoans = await ecoStabilizer.getTotalActiveLoans();

            // Supply is less than it should be for active loans
            const expectedSupply = activeLoans * ethers.parseEther("20");
            expect(remainingSupply).to.be.lessThan(expectedSupply);
        });

        it("Should handle complex SCC movement chains", async function () {
            const { astaVerde, scc, ecoStabilizer, userA, userB, userC } = await loadFixture(deploySCCTransferFixture);

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
            await astaVerde
                .connect(await ethers.getSigner(await astaVerde.owner()))
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
            await expect(ecoStabilizer.connect(userB).withdraw(1)).to.be.revertedWith("not borrower");

            // UserB can withdraw their own NFT
            await ecoStabilizer.connect(userB).withdraw(4);
            expect(await astaVerde.balanceOf(userB.address, 4)).to.equal(1);

            // UserA cannot withdraw their NFT (no SCC)
            await expect(ecoStabilizer.connect(userA).withdraw(1)).to.be.revertedWithCustomError(
                scc,
                "ERC20InsufficientAllowance",
            );
        });
    });
});
