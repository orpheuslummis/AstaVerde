const { ethers } = require("hardhat");

/**
 * Predefined QA scenarios for testing complete Phase 1 + Phase 2 workflows
 * These are automated test scenarios that can be run to verify end-to-end functionality
 */

async function runScenario(scenarioName, scenarioFunc, contracts) {
    console.log(`\n🎯 SCENARIO: ${scenarioName}`);
    console.log("━".repeat(60));

    try {
        await scenarioFunc(contracts);
        console.log(`✅ SCENARIO PASSED: ${scenarioName}`);
    } catch (error) {
        console.log(`❌ SCENARIO FAILED: ${scenarioName}`);
        console.log(`Error: ${error.message}`);
        throw error;
    }
}

// Scenario 1: Complete happy path workflow
async function scenarioHappyPath(contracts) {
    const { usdc, astaVerde, scc, vault } = contracts;
    const [deployer, user1] = await ethers.getSigners();

    console.log("Step 1: Admin creates NFT batch");
    const producers = [deployer.address, deployer.address, deployer.address];
    const cids = ["QmTest1", "QmTest2", "QmTest3"];
    await astaVerde.mintBatch(producers, cids);

    console.log("Step 2: User buys NFT from batch");
    const batchId = 1n;
    const priceInfo = await astaVerde.getBatchPriceInfo(batchId);
    const price = priceInfo[0];

    await usdc.connect(user1).approve(await astaVerde.getAddress(), price);
    await astaVerde.connect(user1).buyBatch(batchId, price, 1);

    const nftBalance = await astaVerde.balanceOf(user1.address, 1);
    console.log(`  ✓ User owns NFT #1: ${nftBalance.toString()}`);

    console.log("Step 3: User deposits NFT to vault");
    await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);

    const initialSCC = await scc.balanceOf(user1.address);
    await vault.connect(user1).deposit(1);

    const finalSCC = await scc.balanceOf(user1.address);
    const sccMinted = finalSCC - initialSCC;
    console.log(`  ✓ SCC minted: ${ethers.formatEther(sccMinted)}`);

    if (sccMinted !== ethers.parseEther("20")) {
        throw new Error(`Expected 20 SCC, got ${ethers.formatEther(sccMinted)}`);
    }

    console.log("Step 4: User withdraws NFT from vault");
    await scc.connect(user1).approve(await vault.getAddress(), ethers.parseEther("20"));
    await vault.connect(user1).withdraw(1);

    const finalNftBalance = await astaVerde.balanceOf(user1.address, 1);
    const finalUserSCC = await scc.balanceOf(user1.address);

    console.log(`  ✓ NFT returned: ${finalNftBalance.toString()}`);
    console.log(`  ✓ SCC balance: ${ethers.formatEther(finalUserSCC)}`);

    if (finalNftBalance !== 1n) {
        throw new Error("NFT not returned to user");
    }

    console.log("Step 5: User redeems NFT");
    await astaVerde.connect(user1).redeemToken(1);

    const isRedeemed = await astaVerde.isRedeemed(1);
    if (!isRedeemed) {
        throw new Error("NFT not marked as redeemed");
    }
    console.log("  ✓ NFT #1 redeemed successfully");
}

// Scenario 2: Redeemed NFT rejection
async function scenarioRedeemedRejection(contracts) {
    const { usdc, astaVerde, vault } = contracts;
    const [deployer, user1] = await ethers.getSigners();

    console.log("Step 1: Create and buy NFT");
    const producers = [deployer.address];
    const cids = ["QmTestRedeemed"];
    await astaVerde.mintBatch(producers, cids);

    const currentBatch = await astaVerde.currentBatchId();
    const tokenId = currentBatch; // Latest token

    const priceInfo = await astaVerde.getBatchPriceInfo(currentBatch);
    const price = priceInfo[0];

    await usdc.connect(user1).approve(await astaVerde.getAddress(), price);
    await astaVerde.connect(user1).buyBatch(currentBatch, price, 1);

    console.log("Step 2: Redeem NFT first");
    await astaVerde.connect(user1).redeemToken(tokenId);

    const isRedeemed = await astaVerde.isRedeemed(tokenId);
    if (!isRedeemed) {
        throw new Error("NFT should be redeemed");
    }
    console.log(`  ✓ NFT #${tokenId} redeemed`);

    console.log("Step 3: Try to deposit redeemed NFT (should fail)");
    await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);

    let failed = false;
    try {
        await vault.connect(user1).deposit(tokenId);
    } catch (error) {
        if (error.message.includes("redeemed asset")) {
            failed = true;
            console.log(`  ✓ Correctly rejected redeemed asset: ${error.message}`);
        } else {
            throw new Error(`Unexpected error: ${error.message}`);
        }
    }

    if (!failed) {
        throw new Error("Deposit should have failed for redeemed asset");
    }
}

// Scenario 3: Insufficient SCC balance for withdrawal
async function scenarioInsufficientSCC(contracts) {
    const { usdc, astaVerde, scc, vault } = contracts;
    const [deployer, user1, user2] = await ethers.getSigners();

    console.log("Step 1: Create and buy NFT");
    const producers = [deployer.address];
    const cids = ["QmTestInsufficient"];
    await astaVerde.mintBatch(producers, cids);

    const currentBatch = await astaVerde.currentBatchId();
    const tokenId = currentBatch;

    const priceInfo = await astaVerde.getBatchPriceInfo(currentBatch);
    const price = priceInfo[0];

    await usdc.connect(user1).approve(await astaVerde.getAddress(), price);
    await astaVerde.connect(user1).buyBatch(currentBatch, price, 1);

    console.log("Step 2: Deposit NFT to vault");
    await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);
    await vault.connect(user1).deposit(tokenId);

    const sccBalance = await scc.balanceOf(user1.address);
    console.log(`  ✓ User has ${ethers.formatEther(sccBalance)} SCC`);

    console.log("Step 3: Transfer away most SCC");
    const transferAmount = ethers.parseEther("15"); // Leave only 5 SCC
    await scc.connect(user1).transfer(user2.address, transferAmount);

    const remainingSCC = await scc.balanceOf(user1.address);
    console.log(`  ✓ User now has ${ethers.formatEther(remainingSCC)} SCC`);

    console.log("Step 4: Try to withdraw NFT (should fail)");
    await scc.connect(user1).approve(await vault.getAddress(), ethers.parseEther("20"));

    let failed = false;
    try {
        await vault.connect(user1).withdraw(tokenId);
    } catch (error) {
        if (
            error.message.includes("insufficient allowance") ||
            error.message.includes("transfer amount exceeds balance") ||
            error.message.includes("ERC20InsufficientBalance")
        ) {
            failed = true;
            console.log(`  ✓ Correctly failed due to insufficient SCC: ${error.message}`);
        } else {
            throw new Error(`Unexpected error: ${error.message}`);
        }
    }

    if (!failed) {
        throw new Error("Withdrawal should have failed due to insufficient SCC");
    }

    console.log("Step 5: Get more SCC and complete withdrawal");
    await scc.connect(user2).transfer(user1.address, transferAmount);

    await vault.connect(user1).withdraw(tokenId);
    console.log("  ✓ Withdrawal succeeded after getting sufficient SCC");
}

// Scenario 4: Multiple users, multiple NFTs workflow
async function scenarioMultiUser(contracts) {
    const { usdc, astaVerde, scc, vault } = contracts;
    const [deployer, user1, user2, user3] = await ethers.getSigners();

    console.log("Step 1: Create large NFT batch");
    const batchSize = 5;
    const producers = Array(batchSize).fill(deployer.address);
    const cids = Array.from({ length: batchSize }, (_, i) => `QmMulti${i + 1}`);
    await astaVerde.mintBatch(producers, cids);

    const currentBatch = await astaVerde.currentBatchId();
    const priceInfo = await astaVerde.getBatchPriceInfo(currentBatch);
    const price = priceInfo[0];

    console.log("Step 2: Multiple users buy NFTs");
    const users = [user1, user2, user3];
    const userTokens = [];

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        await usdc.connect(user).approve(await astaVerde.getAddress(), price);
        await astaVerde.connect(user).buyBatch(currentBatch, price, 1);

        const tokenId = currentBatch - BigInt(batchSize - 1) + BigInt(i);
        userTokens.push({ user, tokenId });
        console.log(`  ✓ User ${i + 1} bought NFT #${tokenId}`);
    }

    console.log("Step 3: All users deposit to vault");
    for (const { user, tokenId } of userTokens) {
        await astaVerde.connect(user).setApprovalForAll(await vault.getAddress(), true);
        await vault.connect(user).deposit(tokenId);

        const sccBalance = await scc.balanceOf(user.address);
        console.log(`  ✓ User deposited NFT #${tokenId}, has ${ethers.formatEther(sccBalance)} SCC`);
    }

    console.log("Step 4: Check vault state");
    const totalActiveLoans = await vault.getTotalActiveLoans();
    console.log(`  ✓ Total active loans: ${totalActiveLoans}`);

    if (totalActiveLoans < BigInt(users.length)) {
        throw new Error(`Expected at least ${users.length} active loans`);
    }

    console.log("Step 5: Users trade SCC among themselves");
    const tradAmount = ethers.parseEther("5");
    await scc.connect(user1).transfer(user2.address, tradAmount);
    console.log("  ✓ User1 sent 5 SCC to User2");

    const user2Balance = await scc.balanceOf(user2.address);
    console.log(`  ✓ User2 now has ${ethers.formatEther(user2Balance)} SCC`);

    console.log("Step 6: Some users withdraw, others keep positions");
    // User1 withdraws (has 15 SCC, needs to get 5 more back from User2)
    await scc.connect(user2).transfer(user1.address, tradAmount);
    await scc.connect(user1).approve(await vault.getAddress(), ethers.parseEther("20"));
    await vault.connect(user1).withdraw(userTokens[0].tokenId);
    console.log(`  ✓ User1 withdrew NFT #${userTokens[0].tokenId}`);

    // User3 withdraws
    await scc.connect(user3).approve(await vault.getAddress(), ethers.parseEther("20"));
    await vault.connect(user3).withdraw(userTokens[2].tokenId);
    console.log(`  ✓ User3 withdrew NFT #${userTokens[2].tokenId}`);

    // User2 keeps position
    const finalActiveLoans = await vault.getTotalActiveLoans();
    console.log(`  ✓ Final active loans: ${finalActiveLoans}`);

    if (finalActiveLoans !== 1n) {
        throw new Error(`Expected 1 active loan, got ${finalActiveLoans}`);
    }
}

// Scenario 5: Gas usage validation
async function scenarioGasUsage(contracts) {
    const { usdc, astaVerde, vault } = contracts;
    const [deployer, user1] = await ethers.getSigners();

    console.log("Step 1: Setup NFT");
    const producers = [deployer.address];
    const cids = ["QmGasTest"];
    await astaVerde.mintBatch(producers, cids);

    const currentBatch = await astaVerde.currentBatchId();
    const tokenId = currentBatch;

    const priceInfo = await astaVerde.getBatchPriceInfo(currentBatch);
    const price = priceInfo[0];

    await usdc.connect(user1).approve(await astaVerde.getAddress(), price);
    await astaVerde.connect(user1).buyBatch(currentBatch, price, 1);

    console.log("Step 2: Test deposit gas usage");
    await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);

    const depositTx = await vault.connect(user1).deposit(tokenId);
    const depositReceipt = await depositTx.wait();
    const depositGas = depositReceipt.gasUsed;

    console.log(`  ✓ Deposit gas usage: ${depositGas}`);

    const maxDepositGas = 150000n;
    if (depositGas > maxDepositGas) {
        console.log(`  ⚠️  Deposit gas (${depositGas}) exceeds target (${maxDepositGas})`);
    } else {
        console.log("  ✓ Deposit gas within target");
    }

    console.log("Step 3: Test withdraw gas usage");
    const sccAddr = await vault.scc();
    const sccContract = await ethers.getContractAt("StabilizedCarbonCoin", sccAddr);
    await sccContract.connect(user1).approve(await vault.getAddress(), ethers.parseEther("20"));

    const withdrawTx = await vault.connect(user1).withdraw(tokenId);
    const withdrawReceipt = await withdrawTx.wait();
    const withdrawGas = withdrawReceipt.gasUsed;

    console.log(`  ✓ Withdraw gas usage: ${withdrawGas}`);

    const maxWithdrawGas = 120000n;
    if (withdrawGas > maxWithdrawGas) {
        console.log(`  ⚠️  Withdraw gas (${withdrawGas}) exceeds target (${maxWithdrawGas})`);
    } else {
        console.log("  ✓ Withdraw gas within target");
    }

    return { depositGas, withdrawGas };
}

async function main() {
    console.log("🎮 Running Automated QA Scenarios\n");

    // Setup contracts (assumes they're deployed or deploys fresh ones)
    const [deployer] = await ethers.getSigners();

    console.log("📡 Setting up contracts...");

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy(ethers.parseUnits("10000000", 6));
    await usdc.waitForDeployment();

    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    const astaVerde = await AstaVerde.deploy(deployer.address, await usdc.getAddress());
    await astaVerde.waitForDeployment();

    const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
    const scc = await SCC.deploy();
    await scc.waitForDeployment();

    const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
    const vault = await EcoStabilizer.deploy(await astaVerde.getAddress(), await scc.getAddress());
    await vault.waitForDeployment();

    // Setup roles and USDC
    const MINTER_ROLE = await scc.MINTER_ROLE();
    await scc.grantRole(MINTER_ROLE, await vault.getAddress());

    const [, user1, user2, user3] = await ethers.getSigners();
    for (const user of [deployer, user1, user2, user3]) {
        await usdc.mint(user.address, ethers.parseUnits("100000", 6));
    }

    const contracts = { usdc, astaVerde, scc, vault };

    console.log("✅ Contracts setup complete\n");

    const scenarios = [
        ["Complete Happy Path Workflow", scenarioHappyPath],
        ["Redeemed NFT Rejection", scenarioRedeemedRejection],
        ["Insufficient SCC Balance", scenarioInsufficientSCC],
        ["Multi-User Workflow", scenarioMultiUser],
        ["Gas Usage Validation", scenarioGasUsage],
    ];

    const results = {};
    let passCount = 0;

    for (const [name, scenarioFunc] of scenarios) {
        try {
            await runScenario(name, scenarioFunc, contracts);
            results[name] = "PASS";
            passCount++;
        } catch (error) {
            results[name] = `FAIL: ${error.message}`;
            console.log("\n❌ Continuing with remaining scenarios...\n");
        }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 QA SCENARIOS SUMMARY");
    console.log("=".repeat(60));

    for (const [name, result] of Object.entries(results)) {
        const status = result === "PASS" ? "✅" : "❌";
        console.log(`${status} ${name}: ${result}`);
    }

    console.log(`\n📈 Results: ${passCount}/${scenarios.length} scenarios passed`);

    if (passCount === scenarios.length) {
        console.log("🎉 All QA scenarios passed! System is ready for production.");
        return true;
    } else {
        console.log("⚠️  Some scenarios failed. Review and fix before production.");
        return false;
    }
}

if (require.main === module) {
    main()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error("❌ QA scenarios failed:", error);
            process.exit(1);
        });
}

module.exports = {
    scenarioHappyPath,
    scenarioRedeemedRejection,
    scenarioInsufficientSCC,
    scenarioMultiUser,
    scenarioGasUsage,
    main,
};
