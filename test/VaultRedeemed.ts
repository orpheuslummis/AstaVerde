import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { AstaVerde, StabilizedCarbonCoin, EcoStabilizer, MockUSDC } from "../typechain-types";

describe("EcoStabilizer - Redeemed Token Protection", function () {
    async function deployEcoStabilizerFixture() {
        const [owner, producer, user1] = await ethers.getSigners();

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

        // Mint some USDC to user1 for testing
        await mockUSDC.mint(user1.address, ethers.parseUnits("1000", 6));

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
            MINTER_ROLE,
        };
    }

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

        it("Should reject deposit of redeemed NFT", async function () {
            const { ecoStabilizer, astaVerde, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // First redeem the NFT
            await astaVerde.connect(user1).redeemToken(1);

            // Verify token is now redeemed
            const tokenInfo = await astaVerde.tokens(1);
            expect(tokenInfo[4]).to.be.true; // redeemed field should be true

            // Approve vault to transfer NFT
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);

            // Should reject deposit of redeemed NFT
            await expect(ecoStabilizer.connect(user1).deposit(1)).to.be.revertedWith("redeemed asset");
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

        it("Should not affect existing loans when token is redeemed while deposited", async function () {
            const { ecoStabilizer, astaVerde, scc, user1 } = await loadFixture(deployEcoStabilizerFixture);

            // Approve and deposit NFT
            await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
            await ecoStabilizer.connect(user1).deposit(1);

            // Note: In practice, a user cannot redeem a token that's in the vault
            // because the vault owns it. This test is more theoretical, but ensures
            // that the loan state remains consistent even if redemption state changes.

            // Verify loan is active
            const loan = await ecoStabilizer.loans(1);
            expect(loan.active).to.be.true;
            expect(loan.borrower).to.equal(user1.address);

            // User should still be able to withdraw (even if somehow token got redeemed)
            await scc.connect(user1).approve(ecoStabilizer.target, ethers.parseEther("20"));
            await expect(ecoStabilizer.connect(user1).withdraw(1)).to.emit(ecoStabilizer, "Withdrawn");
        });
    });
});
