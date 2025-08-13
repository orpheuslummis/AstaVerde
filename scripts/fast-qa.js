const { ethers } = require("hardhat");

/**
 * Ultra-Fast QA Script for Claude Code
 * Optimized for repeated execution with minimal overhead
 * - Uses hardhat's built-in test network (no external node needed)
 * - Skips unnecessary logging
 * - Fast pass/fail assessment
 * - Focuses on critical functionality only
 */

let contracts = null;
let users = null;

async function quickSetup() {
    if (contracts && users) return { contracts, users }; // Reuse if available

    const [deployer, user1, user2] = await ethers.getSigners();

    // Deploy minimal contracts
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy(ethers.parseUnits("1000000", 6));

    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    const astaVerde = await AstaVerde.deploy(deployer.address, await usdc.getAddress());

    const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
    const scc = await SCC.deploy(ethers.ZeroAddress);

    const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
    const vault = await EcoStabilizer.deploy(await astaVerde.getAddress(), await scc.getAddress());

    // Setup roles and funding in parallel
    await Promise.all([
        scc.grantRole(await scc.MINTER_ROLE(), await vault.getAddress()),
        usdc.mint(user1.address, ethers.parseUnits("50000", 6)),
        usdc.mint(user2.address, ethers.parseUnits("50000", 6)),
    ]);

    contracts = { usdc, astaVerde, scc, vault };
    users = { deployer, user1, user2 };

    return { contracts, users };
}

async function criticalPathTest() {
    const { contracts, users } = await quickSetup();
    const { usdc, astaVerde, scc, vault } = contracts;
    const { deployer, user1, user2 } = users;

    const results = {
        phase1: false,
        vaultDeposit: false,
        vaultWithdraw: false,
        securityCheck: false,
        gasIssues: [],
        criticalFailures: [],
    };

    try {
        // Phase 1: Quick marketplace test
        await astaVerde.mintBatch([deployer.address, deployer.address], ["QmTest1", "QmTest2"]);
        const batchId = await astaVerde.lastBatchID();
        const price = await astaVerde.getCurrentBatchPrice(batchId);

        await usdc.connect(user1).approve(await astaVerde.getAddress(), price);
        await astaVerde.connect(user1).buyBatch(batchId, price, 1);

        const batchInfo = await astaVerde.getBatchInfo(batchId);
        const tokenId = batchInfo[1][0];
        const balance = await astaVerde.balanceOf(user1.address, tokenId);
        results.phase1 = balance > 0n;

        // Phase 2: Vault critical path
        await astaVerde.connect(user1).setApprovalForAll(await vault.getAddress(), true);
        const depositTx = await vault.connect(user1).deposit(tokenId);
        const depositReceipt = await depositTx.wait();

        const sccBalance = await scc.balanceOf(user1.address);
        results.vaultDeposit = sccBalance === ethers.parseEther("20");

        // Check gas usage
        if (Number(depositReceipt.gasUsed) >= 150000) {
            results.gasIssues.push(`Deposit gas: ${depositReceipt.gasUsed} >= 150k`);
        }

        // Withdraw test
        await scc.connect(user1).approve(await vault.getAddress(), sccBalance);
        const withdrawTx = await vault.connect(user1).withdraw(tokenId);
        const withdrawReceipt = await withdrawTx.wait();

        const finalBalance = await astaVerde.balanceOf(user1.address, tokenId);
        results.vaultWithdraw = finalBalance === 1n;

        if (Number(withdrawReceipt.gasUsed) >= 120000) {
            results.gasIssues.push(`Withdraw gas: ${withdrawReceipt.gasUsed} >= 120k`);
        }

        // Security: Test redeemed NFT rejection
        await usdc.connect(user2).approve(await astaVerde.getAddress(), price);
        await astaVerde.connect(user2).buyBatch(batchId, price, 1);
        const redeemedTokenId = batchInfo[1][1];
        await astaVerde.connect(user2).redeemToken(redeemedTokenId);
        await astaVerde.connect(user2).setApprovalForAll(await vault.getAddress(), true);

        try {
            await vault.connect(user2).deposit(redeemedTokenId);
            results.criticalFailures.push("SECURITY: Redeemed NFT deposit allowed");
        } catch (error) {
            results.securityCheck = error.message.includes("redeemed asset");
        }
    } catch (error) {
        results.criticalFailures.push(`CRITICAL: ${error.message.substring(0, 100)}`);
    }

    return results;
}

function generateFastReport(results) {
    const passed = results.phase1 && results.vaultDeposit && results.vaultWithdraw && results.securityCheck;
    const critical = results.criticalFailures.length === 0;
    const production = passed && critical && results.gasIssues.length === 0;

    console.log("⚡ FAST QA RESULTS");
    console.log("================");
    console.log(`Phase 1 NFT:     ${results.phase1 ? "✅" : "❌"}`);
    console.log(`Vault Deposit:   ${results.vaultDeposit ? "✅" : "❌"}`);
    console.log(`Vault Withdraw:  ${results.vaultWithdraw ? "✅" : "❌"}`);
    console.log(`Security:        ${results.securityCheck ? "✅" : "❌"}`);

    if (results.gasIssues.length > 0) {
        console.log("\n⚠️  GAS ISSUES:");
        results.gasIssues.forEach((issue) => console.log(`   ${issue}`));
    }

    if (results.criticalFailures.length > 0) {
        console.log("\n🔴 CRITICAL FAILURES:");
        results.criticalFailures.forEach((failure) => console.log(`   ${failure}`));
    }

    console.log(`\n🚀 STATUS: ${production ? "READY" : critical ? "GAS OPTIMIZE" : "NEEDS FIX"}`);

    return { production, critical, passed };
}

async function main() {
    const start = Date.now();

    try {
        const results = await criticalPathTest();
        const status = generateFastReport(results);

        console.log(`\n⏱️  Completed in ${Date.now() - start}ms`);

        return status.production ? 0 : 1;
    } catch (error) {
        console.error("❌ FAST QA FAILED:", error.message);
        return 1;
    }
}

if (require.main === module) {
    main().then((exitCode) => process.exit(exitCode));
}

module.exports = main;
