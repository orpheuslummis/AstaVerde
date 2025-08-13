import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../typechain-types";

describe("EcoStabilizer - Direct Transfer Handling", function () {
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

        // Mint test batches of NFTs
        await astaVerde.mintBatch([producer.address, producer.address], ["QmTestCID1", "QmTestCID2"]);

        // Users buy NFTs properly through the AstaVerde contract
        const batch1Price = await astaVerde.getCurrentBatchPrice(1);
        await mockUSDC.connect(user1).approve(astaVerde.target, batch1Price);
        await astaVerde.connect(user1).buyBatch(1, batch1Price, 1);

        await mockUSDC.connect(user2).approve(astaVerde.target, batch1Price);
        await astaVerde.connect(user2).buyBatch(1, batch1Price, 1);

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

        it("Should reject admin sweep of NFT with active loan", async function () {
            const { ecoStabilizer, astaVerde, owner, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // User1 properly deposits NFT through vault
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            // Verify loan was created
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.true;
            expect(loan.borrower).to.equal(user1.address);

            // Admin should NOT be able to sweep NFT with active loan
            await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, owner.address)).to.be.revertedWith(
                "loan active",
            );
        });

        it("Should allow admin sweep after loan is closed", async function () {
            const { ecoStabilizer, astaVerde, scc, owner, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // User1 deposits NFT, then withdraws it
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await ecoStabilizer.connect(user1).withdraw(1);

            // Now user1 directly transfers the NFT back to vault (unusual but possible)
            await astaVerde.connect(user1).safeTransferFrom(user1.address, ecoStabilizer.target, 1, 1, "0x");

            // Verify no active loan exists
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.false;

            // Admin should be able to sweep it
            await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, owner.address))
                .to.emit(ecoStabilizer, "EmergencyNFTWithdrawn")
                .withArgs(owner.address, 1);
        });

        it("Should reject admin sweep by non-owner", async function () {
            const { ecoStabilizer, astaVerde, user1, user2 } = await loadFixture(deployEcoStabilizerFixture);

            // User1 directly transfers NFT to vault
            await astaVerde.connect(user1).safeTransferFrom(user1.address, ecoStabilizer.target, 1, 1, "0x");

            // User2 (non-owner) should not be able to sweep
            await expect(ecoStabilizer.connect(user2).adminSweepNFT(1, user2.address)).to.be.revertedWithCustomError(
                ecoStabilizer,
                "OwnableUnauthorizedAccount",
            );
        });

        it("Should handle multiple direct transfers correctly", async function () {
            const { ecoStabilizer, astaVerde, owner, user1, user2 } = await loadFixture(deployEcoStabilizerFixture);

            // Both users directly transfer their NFTs to vault
            await astaVerde.connect(user1).safeTransferFrom(user1.address, ecoStabilizer.target, 1, 1, "0x");
            await astaVerde.connect(user2).safeTransferFrom(user2.address, ecoStabilizer.target, 2, 1, "0x");

            // Verify both NFTs are in vault
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(ecoStabilizer.target, 2)).to.equal(1);

            // Verify no loans were created
            const loan1 = await ecoStabilizer.loans(1);
            const loan2 = await ecoStabilizer.loans(2);
            expect(loan1.active).to.be.false;
            expect(loan2.active).to.be.false;

            // Admin should be able to sweep both
            await expect(ecoStabilizer.connect(owner).adminSweepNFT(1, owner.address))
                .to.emit(ecoStabilizer, "EmergencyNFTWithdrawn")
                .withArgs(owner.address, 1);

            await expect(ecoStabilizer.connect(owner).adminSweepNFT(2, owner.address))
                .to.emit(ecoStabilizer, "EmergencyNFTWithdrawn")
                .withArgs(owner.address, 2);

            // Verify admin now owns both NFTs
            expect(await astaVerde.balanceOf(owner.address, 1)).to.equal(1);
            expect(await astaVerde.balanceOf(owner.address, 2)).to.equal(1);
        });

        it("Should handle mixed scenario: one deposited, one direct transfer", async function () {
            const { ecoStabilizer, astaVerde, owner, user1, user2 } = await loadFixture(deployEcoStabilizerFixture);

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
});
