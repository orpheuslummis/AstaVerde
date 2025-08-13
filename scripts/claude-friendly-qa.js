const { ethers } = require("hardhat");

/**
 * Claude Code friendly QA script
 * Non-interactive version that runs comprehensive tests and reports results
 * suitable for agent visibility and debugging
 */

async function setupTestEnvironment() {
    console.log("🔧 Setting up test environment...");

    const [deployer, user1, user2, user3] = await ethers.getSigners();

    // Deploy all contracts
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy(ethers.parseUnits("10000000", 6));
    await usdc.waitForDeployment();

    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    const astaVerde = await AstaVerde.deploy(deployer.address, await usdc.getAddress());
    await astaVerde.waitForDeployment();

    const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
    const scc = await SCC.deploy(ethers.ZeroAddress); // Deploy without vault first
    await scc.waitForDeployment();

    const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
    const vault = await EcoStabilizer.deploy(await astaVerde.getAddress(), await scc.getAddress());
    await vault.waitForDeployment();

    // Setup roles
    const MINTER_ROLE = await scc.MINTER_ROLE();
    await scc.grantRole(MINTER_ROLE, await vault.getAddress());

    // Fund all users
    for (const user of [deployer, user1, user2, user3]) {
        await usdc.mint(user.address, ethers.parseUnits("100000", 6));
    }

    const contracts = { usdc, astaVerde, scc, vault };
    const users = { deployer, user1, user2, user3 };

    console.log("✅ Test environment ready");
    console.log(`📋 Contract addresses:`);
    console.log(`   USDC: ${await usdc.getAddress()}`);
    console.log(`   AstaVerde: ${await astaVerde.getAddress()}`);
    console.log(`   SCC: ${await scc.getAddress()}`);
    console.log(`   Vault: ${await vault.getAddress()}`);

    return { contracts, users };
}

async function runPhase1Tests(contracts, users) {
    const { usdc, astaVerde } = contracts;
    const { deployer, user1 } = users;

    console.log("\n🎯 PHASE 1 TESTING - NFT Marketplace");
    console.log("━".repeat(50));

    const results = {
        batchCreation: false,
        nftPurchase: false,
        nftRedemption: false,
        priceInfo: null,
        gasUsage: {},
    };

    try {
        // Test 1: Create NFT batch
        console.log("Test 1: Creating NFT batch...");
        const producers = [deployer.address, deployer.address, deployer.address];
        const cids = ["QmTest1", "QmTest2", "QmTest3"];

        const createTx = await astaVerde.mintBatch(producers, cids);
        const createReceipt = await createTx.wait();
        results.gasUsage.batchCreation = createReceipt.gasUsed;

        const batchId = await astaVerde.lastBatchID();
        console.log(`   ✅ Created batch #${batchId}, gas: ${createReceipt.gasUsed}`);
        results.batchCreation = true;

        // Test 2: Get price info
        const currentPrice = await astaVerde.getCurrentBatchPrice(batchId);
        const batchInfo = await astaVerde.getBatchInfo(batchId);
        results.priceInfo = {
            currentPrice: ethers.formatUnits(currentPrice, 6),
            basePrice: ethers.formatUnits(batchInfo[2], 6), // startingPrice from batch
            remainingAmount: batchInfo[4].toString(), // remainingTokens
        };
        console.log(
            `   📊 Price: ${results.priceInfo.currentPrice} USDC, Remaining: ${results.priceInfo.remainingAmount}`,
        );

        // Test 3: User buys NFT
        console.log("Test 2: User purchasing NFT...");
        const price = currentPrice;

        await usdc.connect(user1).approve(await astaVerde.getAddress(), price);
        const buyTx = await astaVerde.connect(user1).buyBatch(batchId, price, 1);
        const buyReceipt = await buyTx.wait();
        results.gasUsage.nftPurchase = buyReceipt.gasUsed;

        // Get the first token ID from batch info
        const phase1BatchInfo = await astaVerde.getBatchInfo(batchId);
        const phase1TokenId = phase1BatchInfo[1][0]; // First token in the batch
        const nftBalance = await astaVerde.balanceOf(user1.address, phase1TokenId);
        console.log(`   ✅ User owns ${nftBalance} NFT #${phase1TokenId}, gas: ${buyReceipt.gasUsed}`);
        results.nftPurchase = nftBalance > 0n;

        // Test 4: User redeems NFT
        console.log("Test 3: User redeeming NFT...");
        const redeemTx = await astaVerde.connect(user1).redeemToken(phase1TokenId);
        const redeemReceipt = await redeemTx.wait();
        results.gasUsage.nftRedemption = redeemReceipt.gasUsed;

        const tokenInfo = await astaVerde.tokens(phase1TokenId);
        const isRedeemed = tokenInfo[4];
        console.log(`   ✅ NFT redeemed: ${isRedeemed}, gas: ${redeemReceipt.gasUsed}`);
        results.nftRedemption = isRedeemed;
    } catch (error) {
        console.log(`   ❌ Phase 1 test failed: ${error.message}`);
        results.error = error.message;
    }

    return results;
}

async function runPhase2Tests(contracts, users) {
    const { usdc, astaVerde, scc, vault } = contracts;
    const { deployer, user1, user2 } = users;

    console.log("\n🎯 PHASE 2 TESTING - Vault System");
    console.log("━".repeat(50));

    const results = {
        nftDeposit: false,
        sccMinting: false,
        nftWithdraw: false,
        sccBurning: false,
        redeemedRejection: false,
        gasUsage: {},
        balances: {},
    };

    try {
        // Setup: Create new NFTs for vault testing
        console.log("Setup: Creating fresh NFTs for vault testing...");
        const producers = [deployer.address, deployer.address];
        const cids = ["QmVault1", "QmVault2"];
        await astaVerde.mintBatch(producers, cids);

        const batchId = await astaVerde.lastBatchID();
        const currentPrice = await astaVerde.getCurrentBatchPrice(batchId);
        const price = currentPrice;

        // User1 buys NFT for vault testing
        await usdc.connect(user1).approve(await astaVerde.getAddress(), price);
        await astaVerde.connect(user1).buyBatch(batchId, price, 1);

        // Get the token IDs from the batch info
        const batchInfo = await astaVerde.getBatchInfo(batchId);
        const tokenIds = batchInfo[1]; // tokenIds array from batch
        const vaultTokenId = tokenIds[0]; // First token for User1
        console.log(`   ✅ User1 owns NFT #${vaultTokenId} for vault testing`);

        // User2 buys NFT and redeems it for rejection testing
        await usdc.connect(user2).approve(await astaVerde.getAddress(), price);
        await astaVerde.connect(user2).buyBatch(batchId, price, 1);
        const redeemedTokenId = tokenIds[1]; // Second token for User2
        await astaVerde.connect(user2).redeemToken(redeemedTokenId);
        console.log(`   ✅ User2 owns redeemed NFT #${redeemedTokenId} for rejection testing`);

        // Test 1: Deposit NFT to vault
        console.log("Test 1: Depositing NFT to vault...");
        const initialSCC = await scc.balanceOf(user1.address);
        console.log(`   📊 Initial SCC balance: ${ethers.formatEther(initialSCC)}`);

        await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);
        const depositTx = await vault.connect(user1).deposit(vaultTokenId);
        const depositReceipt = await depositTx.wait();
        results.gasUsage.deposit = depositReceipt.gasUsed;

        const finalSCC = await scc.balanceOf(user1.address);
        const sccMinted = finalSCC - initialSCC;
        const expectedSCC = ethers.parseEther("20");

        console.log(`   ✅ Deposit successful, gas: ${depositReceipt.gasUsed}`);
        console.log(`   💰 SCC minted: ${ethers.formatEther(sccMinted)}`);

        results.nftDeposit = true;
        results.sccMinting = sccMinted === expectedSCC;
        results.balances.sccAfterDeposit = ethers.formatEther(finalSCC);

        // Verify NFT is in vault
        const userNftBalance = await astaVerde.balanceOf(user1.address, vaultTokenId);
        const vaultNftBalance = await astaVerde.balanceOf(await vault.getAddress(), vaultTokenId);
        console.log(`   📦 NFT in vault: ${vaultNftBalance}, user has: ${userNftBalance}`);

        // Test 2: Withdraw NFT from vault
        console.log("Test 2: Withdrawing NFT from vault...");
        await scc.connect(user1).approve(await vault.getAddress(), expectedSCC);

        const withdrawTx = await vault.connect(user1).withdraw(vaultTokenId);
        const withdrawReceipt = await withdrawTx.wait();
        results.gasUsage.withdraw = withdrawReceipt.gasUsed;

        const finalUserSCC = await scc.balanceOf(user1.address);
        const sccBurned = finalSCC - finalUserSCC;
        const finalUserNft = await astaVerde.balanceOf(user1.address, vaultTokenId);

        console.log(`   ✅ Withdraw successful, gas: ${withdrawReceipt.gasUsed}`);
        console.log(`   🔥 SCC burned: ${ethers.formatEther(sccBurned)}`);
        console.log(`   🎁 NFT returned: ${finalUserNft}`);

        results.nftWithdraw = finalUserNft === 1n;
        results.sccBurning = sccBurned === expectedSCC;
        results.balances.sccAfterWithdraw = ethers.formatEther(finalUserSCC);

        // Test 3: Try to deposit redeemed NFT (should fail)
        console.log("Test 3: Testing redeemed NFT rejection...");
        await astaVerde.connect(user2).setApprovalForAll(await vault.getAddress(), true);

        try {
            await vault.connect(user2).deposit(redeemedTokenId);
            console.log(`   ❌ UNEXPECTED: Redeemed NFT deposit succeeded!`);
            results.redeemedRejection = false;
        } catch (error) {
            if (error.message.includes("redeemed asset")) {
                console.log(`   ✅ Correctly rejected redeemed NFT: ${error.message}`);
                results.redeemedRejection = true;
            } else {
                console.log(`   ❓ Unexpected error: ${error.message}`);
                results.redeemedRejection = false;
            }
        }
    } catch (error) {
        console.log(`   ❌ Phase 2 test failed: ${error.message}`);
        results.error = error.message;
    }

    return results;
}

async function runIntegrationTests(contracts, users) {
    const { scc, vault } = contracts;
    const { user1, user2, user3 } = users;

    console.log("\n🎯 INTEGRATION TESTING - Multi-user scenarios");
    console.log("━".repeat(50));

    const results = {
        multiUser: false,
        sccTransfers: false,
        vaultStats: null,
    };

    try {
        // Get current vault state
        const totalActiveLoans = await vault.getTotalActiveLoans();
        const totalSCCSupply = await scc.totalSupply();

        console.log(`📊 Current vault state:`);
        console.log(`   Active loans: ${totalActiveLoans}`);
        console.log(`   Total SCC supply: ${ethers.formatEther(totalSCCSupply)}`);

        results.vaultStats = {
            activeLoans: totalActiveLoans.toString(),
            totalSupply: ethers.formatEther(totalSCCSupply),
        };

        // Test SCC transfers between users
        const user1Balance = await scc.balanceOf(user1.address);
        if (user1Balance > 0n) {
            console.log("Test: SCC transfer between users...");
            const transferAmount = ethers.parseEther("5");

            const initialUser2Balance = await scc.balanceOf(user2.address);
            await scc.connect(user1).transfer(user2.address, transferAmount);
            const finalUser2Balance = await scc.balanceOf(user2.address);

            const received = finalUser2Balance - initialUser2Balance;
            console.log(`   ✅ Transferred ${ethers.formatEther(received)} SCC`);
            results.sccTransfers = received === transferAmount;
        }

        results.multiUser = true;
    } catch (error) {
        console.log(`   ❌ Integration test failed: ${error.message}`);
        results.error = error.message;
    }

    return results;
}

async function generateTestReport(phase1Results, phase2Results, integrationResults) {
    console.log("\n" + "=".repeat(60));
    console.log("📊 COMPREHENSIVE QA TEST REPORT");
    console.log("=".repeat(60));

    const allResults = {
        phase1: phase1Results,
        phase2: phase2Results,
        integration: integrationResults,
        summary: {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            criticalIssues: [],
        },
    };

    // Phase 1 Summary
    console.log("\n🎮 Phase 1 Results (NFT Marketplace):");
    const phase1Tests = [
        ["Batch Creation", phase1Results.batchCreation],
        ["NFT Purchase", phase1Results.nftPurchase],
        ["NFT Redemption", phase1Results.nftRedemption],
    ];

    phase1Tests.forEach(([test, passed]) => {
        const status = passed ? "✅" : "❌";
        console.log(`   ${status} ${test}`);
        allResults.summary.totalTests++;
        if (passed) allResults.summary.passedTests++;
        else allResults.summary.failedTests++;
    });

    if (phase1Results.priceInfo) {
        console.log(`   💰 Current Price: ${phase1Results.priceInfo.currentPrice} USDC`);
    }

    // Phase 2 Summary
    console.log("\n🏦 Phase 2 Results (Vault System):");
    const phase2Tests = [
        ["NFT Deposit", phase2Results.nftDeposit],
        ["SCC Minting (20 per NFT)", phase2Results.sccMinting],
        ["NFT Withdrawal", phase2Results.nftWithdraw],
        ["SCC Burning", phase2Results.sccBurning],
        ["Redeemed NFT Rejection", phase2Results.redeemedRejection],
    ];

    phase2Tests.forEach(([test, passed]) => {
        const status = passed ? "✅" : "❌";
        console.log(`   ${status} ${test}`);
        allResults.summary.totalTests++;
        if (passed) allResults.summary.passedTests++;
        else {
            allResults.summary.failedTests++;
            if (test.includes("Rejection")) {
                allResults.summary.criticalIssues.push(`Security: ${test} failed`);
            }
        }
    });

    // Gas Usage Analysis
    if (phase2Results.gasUsage.deposit || phase2Results.gasUsage.withdraw) {
        console.log("\n⛽ Gas Usage Analysis:");
        if (phase2Results.gasUsage.deposit) {
            const depositGas = Number(phase2Results.gasUsage.deposit);
            const depositStatus = depositGas < 150000 ? "✅" : "⚠️";
            console.log(`   ${depositStatus} Deposit: ${depositGas.toLocaleString()} gas (target: <150,000)`);

            if (depositGas >= 150000) {
                allResults.summary.criticalIssues.push(`Gas: Deposit exceeds target (${depositGas})`);
            }
        }

        if (phase2Results.gasUsage.withdraw) {
            const withdrawGas = Number(phase2Results.gasUsage.withdraw);
            const withdrawStatus = withdrawGas < 120000 ? "✅" : "⚠️";
            console.log(`   ${withdrawStatus} Withdraw: ${withdrawGas.toLocaleString()} gas (target: <120,000)`);

            if (withdrawGas >= 120000) {
                allResults.summary.criticalIssues.push(`Gas: Withdraw exceeds target (${withdrawGas})`);
            }
        }
    }

    // Integration Summary
    console.log("\n🔄 Integration Results:");
    const integrationTests = [
        ["Multi-user Operations", integrationResults.multiUser],
        ["SCC Transfers", integrationResults.sccTransfers],
    ];

    integrationTests.forEach(([test, passed]) => {
        const status = passed ? "✅" : "❌";
        console.log(`   ${status} ${test}`);
        allResults.summary.totalTests++;
        if (passed) allResults.summary.passedTests++;
        else allResults.summary.failedTests++;
    });

    if (integrationResults.vaultStats) {
        console.log(`   📊 Active Loans: ${integrationResults.vaultStats.activeLoans}`);
        console.log(`   💰 Total SCC Supply: ${integrationResults.vaultStats.totalSupply}`);
    }

    // Overall Summary
    const passRate = ((allResults.summary.passedTests / allResults.summary.totalTests) * 100).toFixed(1);
    console.log("\n📋 Overall Summary:");
    console.log(`   Tests: ${allResults.summary.passedTests}/${allResults.summary.totalTests} passed (${passRate}%)`);

    if (allResults.summary.criticalIssues.length > 0) {
        console.log("\n⚠️  Critical Issues Found:");
        allResults.summary.criticalIssues.forEach((issue) => {
            console.log(`   🔴 ${issue}`);
        });
    }

    // Production Readiness Assessment
    const isProductionReady = allResults.summary.failedTests === 0 && allResults.summary.criticalIssues.length === 0;

    console.log(`\n🚀 Production Readiness: ${isProductionReady ? "✅ READY" : "❌ NOT READY"}`);

    if (isProductionReady) {
        console.log("   All tests passed. System ready for deployment.");
    } else {
        console.log("   Issues found. Review and fix before deployment.");
    }

    return allResults;
}

async function main() {
    console.log("🤖 Claude Code Friendly QA Test Suite");
    console.log("=====================================");
    console.log("Running comprehensive Phase 1 + Phase 2 testing...\n");

    try {
        // Setup
        const { contracts, users } = await setupTestEnvironment();

        // Run all test phases
        const phase1Results = await runPhase1Tests(contracts, users);
        const phase2Results = await runPhase2Tests(contracts, users);
        const integrationResults = await runIntegrationTests(contracts, users);

        // Generate comprehensive report
        const fullReport = await generateTestReport(phase1Results, phase2Results, integrationResults);

        // Return success/failure for process exit code
        const success = fullReport.summary.failedTests === 0;
        return { success, report: fullReport };
    } catch (error) {
        console.error("\n❌ QA Test Suite Failed:");
        console.error(error.message);
        console.error(error.stack);
        return { success: false, error: error.message };
    }
}

if (require.main === module) {
    main()
        .then(({ success, report, error }) => {
            if (success) {
                console.log("\n🎉 All tests completed successfully!");
                process.exit(0);
            } else {
                console.log("\n💥 Tests completed with issues.");
                if (error) console.error(error);
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error("❌ Fatal error:", error);
            process.exit(1);
        });
}

module.exports = main;
