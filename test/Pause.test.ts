import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
    AstaVerde, 
    EcoStabilizer, 
    StabilizedCarbonCoin, 
    MockUSDC 
} from "../typechain-types";

describe("Pause Functionality Tests", function () {
    let astaVerde: AstaVerde;
    let ecoStabilizer: EcoStabilizer;
    let scc: StabilizedCarbonCoin;
    let usdc: MockUSDC;
    
    let owner: SignerWithAddress;
    let producer: SignerWithAddress;
    let buyer: SignerWithAddress;
    let other: SignerWithAddress;
    
    const USDC_DECIMALS = 6;
    const SCC_PER_ASSET = ethers.parseEther("20");
    const PRICE_FLOOR = ethers.parseUnits("10", USDC_DECIMALS);
    const BASE_PRICE = ethers.parseUnits("15", USDC_DECIMALS);
    
    beforeEach(async function () {
        [owner, producer, buyer, other] = await ethers.getSigners();
        
        // Deploy contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        usdc = await MockUSDC.deploy(0); // initialSupply not used but required for backwards compat
        
        const AstaVerde = await ethers.getContractFactory("AstaVerde");
        astaVerde = await AstaVerde.deploy(
            owner.address,
            await usdc.getAddress()
        );
        
        // Set initial pricing parameters (now whenNotPaused)
        await astaVerde.setPriceFloor(PRICE_FLOOR);
        await astaVerde.setBasePrice(BASE_PRICE);
        
        const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
        scc = await SCC.deploy(owner.address);
        
        const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
        ecoStabilizer = await EcoStabilizer.deploy(
            await astaVerde.getAddress(),
            await scc.getAddress()
        );
        
        // Grant minter role to vault
        await scc.grantRole(await scc.MINTER_ROLE(), await ecoStabilizer.getAddress());
        
        // Mint test NFTs
        await astaVerde.mintBatch(
            [producer.address, producer.address],
            ["cid1", "cid2"]
        );
        
        // Fund buyer with USDC
        await usdc.mint(buyer.address, ethers.parseUnits("10000", USDC_DECIMALS));
        await usdc.connect(buyer).approve(
            await astaVerde.getAddress(), 
            ethers.MaxUint256
        );
    });
    
    describe("AstaVerde Pause Behavior", function () {
        
        beforeEach(async function () {
            // Pause the contract
            await astaVerde.pause();
        });
        
        it("Should allow reading functions during pause", async function () {
            // These should all work during pause
            expect(await astaVerde.getTokenProducer(1)).to.equal(producer.address);
            expect(await astaVerde.getTokenCid(1)).to.equal("cid1");
            await expect(astaVerde.getCurrentBatchPrice(1)).to.not.be.reverted;
            await expect(astaVerde.getBatchInfo(1)).to.not.be.reverted;
            await expect(astaVerde.isRedeemed(1)).to.not.be.reverted;
            await expect(astaVerde.getProducerBalance(producer.address)).to.not.be.reverted;
        });
        
        it("Should block trading functions during pause", async function () {
            await expect(
                astaVerde.buyBatch(1, ethers.parseUnits("30", USDC_DECIMALS), 2)
            ).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
            
            await expect(
                astaVerde.mintBatch([producer.address], ["cid3"])
            ).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
            
            await expect(
                astaVerde.connect(producer).redeemToken(1)
            ).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
        });
        
        it("Should block admin pricing setters during pause", async function () {
            await expect(
                astaVerde.setPlatformSharePercentage(10)
            ).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
            
            await expect(
                astaVerde.setPriceFloor(ethers.parseUnits("5", USDC_DECIMALS))
            ).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
            
            await expect(
                astaVerde.setBasePrice(ethers.parseUnits("20", USDC_DECIMALS))
            ).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
            
            await expect(
                astaVerde.setMaxBatchSize(50)
            ).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
            
            await expect(
                astaVerde.setAuctionDayThresholds(60, 30)
            ).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
            
            await expect(
                astaVerde.setPriceDelta(ethers.parseUnits("2", USDC_DECIMALS))
            ).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
            
            await expect(
                astaVerde.setDailyPriceDecay(ethers.parseUnits("0.5", USDC_DECIMALS))
            ).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
        });
        
        it("Should allow emergency recovery functions during pause", async function () {
            // Send some USDC directly to contract (simulating accidental transfer)
            await usdc.mint(await astaVerde.getAddress(), ethers.parseUnits("100", USDC_DECIMALS));
            
            // recoverSurplusUSDC should work during pause
            await expect(
                astaVerde.recoverSurplusUSDC(owner.address)
            ).to.not.be.reverted;
            
            // claimPlatformFunds should work during pause
            // First need to have some platform funds
            await astaVerde.unpause();
            await astaVerde.connect(buyer).buyBatch(1, ethers.parseUnits("30", USDC_DECIMALS), 2);
            await astaVerde.pause();
            
            await expect(
                astaVerde.claimPlatformFunds(owner.address)
            ).to.not.be.reverted;
        });
        
        it("Should allow recoverERC20 during pause", async function () {
            // Deploy another ERC20 token  
            const MockToken = await ethers.getContractFactory("MockUSDC");
            const otherToken = await MockToken.deploy(0); // initialSupply not used
            await otherToken.mint(await astaVerde.getAddress(), ethers.parseEther("100"));
            
            // Should work during pause now
            await expect(
                astaVerde.recoverERC20(
                    await otherToken.getAddress(), 
                    ethers.parseEther("100"), 
                    owner.address
                )
            ).to.not.be.reverted;
        });
        
        it("Should allow producer fund claims during pause", async function () {
            // Setup: Create producer balance
            await astaVerde.unpause();
            await astaVerde.connect(buyer).buyBatch(1, ethers.parseUnits("30", USDC_DECIMALS), 2);
            await astaVerde.pause();
            
            // Producer should be able to claim during pause
            const producerBalance = await astaVerde.getProducerBalance(producer.address);
            expect(producerBalance).to.be.gt(0);
            
            await expect(
                astaVerde.connect(producer).claimProducerFunds()
            ).to.not.be.reverted;
        });
        
        it("Should allow pause/unpause by owner only", async function () {
            // Owner can unpause
            await expect(astaVerde.unpause()).to.not.be.reverted;
            
            // Non-owner cannot pause
            await expect(
                astaVerde.connect(buyer).pause()
            ).to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount");
            
            // Owner can pause again
            await expect(astaVerde.pause()).to.not.be.reverted;
            
            // Non-owner cannot unpause
            await expect(
                astaVerde.connect(buyer).unpause()
            ).to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount");
        });
        
        it("Should block ERC1155 transfers during pause", async function () {
            // First get some tokens to transfer
            await astaVerde.unpause();
            await astaVerde.connect(buyer).buyBatch(1, ethers.parseUnits("30", USDC_DECIMALS), 2);
            await astaVerde.pause();
            
            // Transfer should be blocked during pause
            await expect(
                astaVerde.connect(buyer).safeTransferFrom(
                    buyer.address,
                    other.address,
                    1,
                    1,
                    "0x"
                )
            ).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
        });
    });
    
    describe("EcoStabilizer Pause Behavior", function () {
        
        beforeEach(async function () {
            // Setup: Transfer NFTs to users for testing
            await astaVerde.connect(buyer).buyBatch(1, ethers.parseUnits("30", USDC_DECIMALS), 2);
            await astaVerde.connect(buyer).setApprovalForAll(await ecoStabilizer.getAddress(), true);
            
            // Pause the vault
            await ecoStabilizer.pause();
        });
        
        it("Should block deposits during pause", async function () {
            await expect(
                ecoStabilizer.connect(buyer).deposit(1)
            ).to.be.revertedWithCustomError(ecoStabilizer, "EnforcedPause");
            
            await expect(
                ecoStabilizer.connect(buyer).depositBatch([1, 2])
            ).to.be.revertedWithCustomError(ecoStabilizer, "EnforcedPause");
        });
        
        it("Should block withdrawals during pause", async function () {
            // Setup: Make a deposit first
            await ecoStabilizer.unpause();
            await ecoStabilizer.connect(buyer).deposit(1);
            
            // Approve SCC for withdrawal
            await scc.connect(buyer).approve(await ecoStabilizer.getAddress(), ethers.MaxUint256);
            
            await ecoStabilizer.pause();
            
            await expect(
                ecoStabilizer.connect(buyer).withdraw(1)
            ).to.be.revertedWithCustomError(ecoStabilizer, "EnforcedPause");
            
            await expect(
                ecoStabilizer.connect(buyer).withdrawBatch([1])
            ).to.be.revertedWithCustomError(ecoStabilizer, "EnforcedPause");
        });
        
        
        it("Should allow adminSweepNFT regardless of pause state", async function () {
            // Send an NFT to the vault without depositing
            await astaVerde.connect(buyer).safeTransferFrom(
                buyer.address,
                await ecoStabilizer.getAddress(),
                2,
                1,
                "0x"
            );
            
            // Should work during pause (vault is paused from beforeEach)
            await expect(
                ecoStabilizer.adminSweepNFT(2, owner.address)
            ).to.not.be.reverted;
            
            // Test with unpause too
            // Send token 1 to vault (buyer owns it from buyBatch)
            await astaVerde.connect(buyer).safeTransferFrom(
                buyer.address,
                await ecoStabilizer.getAddress(),
                1,
                1,
                "0x"
            );
            
            // Should also work when not paused
            await ecoStabilizer.unpause();
            await expect(
                ecoStabilizer.adminSweepNFT(1, owner.address)
            ).to.not.be.reverted;
        });
        
        it("Should allow reading functions during pause", async function () {
            // Setup a deposit first
            await ecoStabilizer.unpause();
            await ecoStabilizer.connect(buyer).deposit(1);
            await ecoStabilizer.pause();
            
            // All view functions should work during pause
            // These view functions don't exist, using the correct ones
            await expect(ecoStabilizer.loans(1)).to.not.be.reverted;
            await expect(ecoStabilizer.getUserLoans(buyer.address)).to.not.be.reverted;
            await expect(ecoStabilizer.getTotalActiveLoans()).to.not.be.reverted;
            await expect(ecoStabilizer.getUserLoanCount(buyer.address)).to.not.be.reverted;
        });
    });
    
    describe("Pause State Transitions", function () {
        
        it("Should maintain correct state through pause/unpause cycles", async function () {
            // Make some transactions
            await astaVerde.connect(buyer).buyBatch(1, ethers.parseUnits("30", USDC_DECIMALS), 2);
            
            const initialProducerBalance = await astaVerde.getProducerBalance(producer.address);
            const initialPlatformShare = await astaVerde.platformShareAccumulated();
            
            // Pause
            await astaVerde.pause();
            
            // State should be preserved
            expect(await astaVerde.getProducerBalance(producer.address))
                .to.equal(initialProducerBalance);
            expect(await astaVerde.platformShareAccumulated())
                .to.equal(initialPlatformShare);
            
            // Unpause
            await astaVerde.unpause();
            
            // Should be able to continue operations
            await expect(
                astaVerde.mintBatch([producer.address], ["cid3"])
            ).to.not.be.reverted;
        });
        
        it("Should handle multiple pause/unpause cycles", async function () {
            for (let i = 0; i < 3; i++) {
                await astaVerde.pause();
                expect(await astaVerde.paused()).to.be.true;
                
                await astaVerde.unpause();
                expect(await astaVerde.paused()).to.be.false;
            }
        });
        
        it("Should emit pause events", async function () {
            await expect(astaVerde.pause())
                .to.emit(astaVerde, "Paused")
                .withArgs(owner.address);
            
            await expect(astaVerde.unpause())
                .to.emit(astaVerde, "Unpaused")
                .withArgs(owner.address);
        });
    });
});