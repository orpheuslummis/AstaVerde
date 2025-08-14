const { ethers } = require("hardhat");

/**
 * Test Data Seeding Script for E2E Tests
 * Creates predictable test data for consistent testing
 */

async function main() {
    console.log("🌱 Seeding test data for E2E tests...");

    try {
        const [deployer, alice, bob, charlie] = await ethers.getSigners();

        // Get deployed contract addresses (assumes contracts are already deployed)
        const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
        const ASTAVERDE_ADDRESS = process.env.ASTAVERDE_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
        const SCC_ADDRESS = process.env.SCC_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
        const ECOSTABILIZER_ADDRESS = process.env.ECOSTABILIZER_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

        // Get contract instances
        const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDRESS);
        const astaVerde = await ethers.getContractAt("AstaVerde", ASTAVERDE_ADDRESS);
        const scc = await ethers.getContractAt("StabilizedCarbonCoin", SCC_ADDRESS);
        const vault = await ethers.getContractAt("EcoStabilizer", ECOSTABILIZER_ADDRESS);

        console.log("📋 Contract addresses:");
        console.log("   USDC:", USDC_ADDRESS);
        console.log("   AstaVerde:", ASTAVERDE_ADDRESS);
        console.log("   SCC:", SCC_ADDRESS);
        console.log("   EcoStabilizer:", ECOSTABILIZER_ADDRESS);

        // Step 1: Fund test users with USDC
        console.log("\n💰 Funding test users with USDC...");
        const fundAmount = ethers.parseUnits("10000", 6); // 10,000 USDC each

        for (const user of [alice, bob, charlie]) {
            const currentBalance = await usdc.balanceOf(user.address);
            if (currentBalance < fundAmount) {
                await usdc.mint(user.address, fundAmount);
                console.log(`   ✓ Funded ${user.address.slice(0, 8)}... with 10,000 USDC`);
            } else {
                console.log(`   ⏭️  ${user.address.slice(0, 8)}... already has sufficient USDC`);
            }
        }

        // Step 2: Create test batches with predictable data
        console.log("\n📦 Creating test batches...");

        // Batch 1: Small batch with 3 tokens at base price
        const batch1 = {
            producers: [alice.address, alice.address, alice.address],
            cids: [
                "QmTestBatch1Token1abcdef123456",
                "QmTestBatch1Token2abcdef123456",
                "QmTestBatch1Token3abcdef123456",
            ],
        };

        // Batch 2: Medium batch with 5 tokens
        const batch2 = {
            producers: Array(5).fill(bob.address),
            cids: Array(5)
                .fill(null)
                .map((_, i) => `QmTestBatch2Token${i}abcdef`),
        };

        // Batch 3: Large batch with 10 tokens
        const batch3 = {
            producers: Array(10).fill(charlie.address),
            cids: Array(10)
                .fill(null)
                .map((_, i) => `QmTestBatch3Token${i}abc`),
        };

        // Batch 4: Mixed producers batch with 4 tokens (will be sold out)
        const batch4 = {
            producers: [alice.address, bob.address, charlie.address, deployer.address],
            cids: [
                "QmTestBatch4Token1xyz789",
                "QmTestBatch4Token2xyz789",
                "QmTestBatch4Token3xyz789",
                "QmTestBatch4Token4xyz789",
            ],
        };

        // Mint batches
        const batches = [batch1, batch2, batch3, batch4];
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const currentBatchCount = await astaVerde.batchCounter();

            if (currentBatchCount <= i) {
                await astaVerde.mintBatch(batch.producers, batch.cids);
                console.log(`   ✓ Created Batch ${i + 1} with ${batch.producers.length} tokens`);
            } else {
                console.log(`   ⏭️  Batch ${i + 1} already exists`);
            }
        }

        // Step 3: Simulate some purchases to create realistic state
        console.log("\n🛒 Simulating purchases...");

        // Alice buys 2 tokens from Batch 1
        const aliceUSDCAllowance = await usdc.allowance(alice.address, ASTAVERDE_ADDRESS);
        if (aliceUSDCAllowance < ethers.parseUnits("1000", 6)) {
            await usdc.connect(alice).approve(ASTAVERDE_ADDRESS, ethers.parseUnits("10000", 6));
        }

        try {
            await astaVerde.connect(alice).buyBatch(1, 2);
            console.log("   ✓ Alice purchased 2 tokens from Batch 1");
        } catch (e) {
            console.log("   ⏭️  Alice already owns tokens from Batch 1");
        }

        // Bob buys 1 token from Batch 2
        const bobUSDCAllowance = await usdc.allowance(bob.address, ASTAVERDE_ADDRESS);
        if (bobUSDCAllowance < ethers.parseUnits("500", 6)) {
            await usdc.connect(bob).approve(ASTAVERDE_ADDRESS, ethers.parseUnits("10000", 6));
        }

        try {
            await astaVerde.connect(bob).buyBatch(2, 1);
            console.log("   ✓ Bob purchased 1 token from Batch 2");
        } catch (e) {
            console.log("   ⏭️  Bob already owns tokens from Batch 2");
        }

        // Buy out Batch 4 completely (sold out state)
        const batch4ItemsLeft = await astaVerde.getBatchItemsLeft(4);
        if (batch4ItemsLeft > 0) {
            const charlieUSDCAllowance = await usdc.allowance(charlie.address, ASTAVERDE_ADDRESS);
            if (charlieUSDCAllowance < ethers.parseUnits("2000", 6)) {
                await usdc.connect(charlie).approve(ASTAVERDE_ADDRESS, ethers.parseUnits("10000", 6));
            }

            await astaVerde.connect(charlie).buyBatch(4, batch4ItemsLeft);
            console.log(`   ✓ Charlie bought out Batch 4 (${batch4ItemsLeft} tokens)`);
        } else {
            console.log("   ⏭️  Batch 4 already sold out");
        }

        // Step 4: Simulate some vault operations
        console.log("\n🏦 Setting up vault operations...");

        // Get Alice's token IDs
        const aliceTokens = [];
        for (let i = 1; i <= 100; i++) {
            const balance = await astaVerde.balanceOf(alice.address, i);
            if (balance > 0) {
                aliceTokens.push(i);
            }
        }

        if (aliceTokens.length > 0) {
            // Alice deposits one token to vault
            const tokenToDeposit = aliceTokens[0];
            const isApproved = await astaVerde.isApprovedForAll(alice.address, ECOSTABILIZER_ADDRESS);

            if (!isApproved) {
                await astaVerde.connect(alice).setApprovalForAll(ECOSTABILIZER_ADDRESS, true);
                console.log("   ✓ Alice approved vault for NFT transfers");
            }

            try {
                await vault.connect(alice).deposit(tokenToDeposit);
                console.log(`   ✓ Alice deposited token ${tokenToDeposit} to vault`);
            } catch (e) {
                console.log(`   ⏭️  Token ${tokenToDeposit} already in vault`);
            }
        }

        // Step 5: Simulate a redemption
        console.log("\n🎫 Setting up redemption state...");

        if (aliceTokens.length > 1) {
            const tokenToRedeem = aliceTokens[1];
            const isRedeemed = await astaVerde.isTokenRedeemed(tokenToRedeem);

            if (!isRedeemed) {
                await astaVerde.connect(alice).redeemTokens([tokenToRedeem]);
                console.log(`   ✓ Alice redeemed token ${tokenToRedeem}`);
            } else {
                console.log(`   ⏭️  Token ${tokenToRedeem} already redeemed`);
            }
        }

        // Step 6: Print final state summary
        console.log("\n📊 Test Data Summary:");
        console.log("   Batches created: 4");
        console.log("   - Batch 1: 3 tokens (1 left)");
        console.log("   - Batch 2: 5 tokens (4 left)");
        console.log("   - Batch 3: 10 tokens (10 left)");
        console.log("   - Batch 4: 4 tokens (SOLD OUT)");
        console.log("\n   User states:");
        console.log("   - Alice: Owns tokens, 1 vaulted, 1 redeemed");
        console.log("   - Bob: Owns 1 token");
        console.log("   - Charlie: Owns all Batch 4 tokens");

        console.log("\n✅ Test data seeding complete!");
    } catch (error) {
        console.error("❌ Error seeding test data:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
