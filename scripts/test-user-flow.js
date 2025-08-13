#!/usr/bin/env node

const { ethers } = require("ethers");
const fs = require("fs");
const chalk = require("chalk");

// Configuration
const RPC_URL = "http://localhost:8545";
const CONTRACTS = {
    USDC: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    ASTAVERDE: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    ECOSTABILIZER: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    SCC: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
};

// Test account (Alice)
const TEST_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

// Load ABIs
const loadABI = (contractName) => {
    const contractJson = JSON.parse(
        fs.readFileSync(`./artifacts/contracts/${contractName}.sol/${contractName}.json`, "utf8"),
    );
    return contractJson.abi;
};

// Helper to wait
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to log step
const logStep = (step, description) => {
    console.log(chalk.bold.cyan(`\n📍 Step ${step}: ${description}`));
    console.log(chalk.gray("-".repeat(60)));
};

// Helper to log success
const logSuccess = (message) => {
    console.log(chalk.green(`✅ ${message}`));
};

// Helper to log info
const logInfo = (label, value) => {
    console.log(chalk.yellow(`   ${label}:`), value);
};

async function runUserFlow() {
    console.log(chalk.bold.magenta("\n🚀 Starting Automated User Flow Test\n"));
    console.log(chalk.gray("=".repeat(80)));

    try {
        // Setup
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(TEST_PRIVATE_KEY, provider);

        // Get fresh nonce to avoid conflicts
        const currentNonce = await provider.getTransactionCount(wallet.address, "latest");
        let nonce = currentNonce;

        // Load contracts
        const usdc = new ethers.Contract(CONTRACTS.USDC, loadABI("MockUSDC"), wallet);
        const astaverde = new ethers.Contract(CONTRACTS.ASTAVERDE, loadABI("AstaVerde"), wallet);
        const ecoStabilizer = new ethers.Contract(CONTRACTS.ECOSTABILIZER, loadABI("EcoStabilizer"), wallet);
        const scc = new ethers.Contract(CONTRACTS.SCC, loadABI("StabilizedCarbonCoin"), wallet);

        console.log(chalk.bold("Test Account:"), wallet.address);

        // Step 1: Check initial balances
        logStep(1, "Check Initial Balances");
        const initialUSDC = await usdc.balanceOf(wallet.address);
        const initialSCC = await scc.balanceOf(wallet.address);
        logInfo("USDC Balance", ethers.formatUnits(initialUSDC, 6));
        logInfo("SCC Balance", ethers.formatUnits(initialSCC, 18));
        logSuccess("Initial balances checked");

        // Step 2: Get batch info
        logStep(2, "Get Available Batches");
        const lastBatchId = await astaverde.lastBatchID();
        logInfo("Last Batch ID", lastBatchId.toString());

        let availableBatch = null;
        for (let i = lastBatchId; i >= 1; i--) {
            const batchInfo = await astaverde.getBatchInfo(i);
            const remaining = batchInfo[4];
            if (remaining > 0) {
                availableBatch = { id: i, info: batchInfo };
                break;
            }
        }

        if (!availableBatch) {
            console.log(chalk.yellow("⚠️  No batches with available tokens. Minting new batch..."));
            // Mint a new batch
            const tx = await astaverde.mintBatch([wallet.address, wallet.address], ["QmTest1", "QmTest2"], {
                nonce: nonce++,
            });
            await tx.wait();
            const newBatchId = await astaverde.lastBatchID();
            availableBatch = {
                id: newBatchId,
                info: await astaverde.getBatchInfo(newBatchId),
            };
            logSuccess("New batch minted");
        }

        logInfo("Selected Batch", availableBatch.id);
        logInfo("Available Tokens", availableBatch.info[4].toString());
        logInfo("Price per Token", ethers.formatUnits(availableBatch.info[3], 6) + " USDC");

        // Step 3: Buy NFT from batch
        logStep(3, "Purchase NFT from Batch");
        const tokensToBuy = 1n;
        const price = await astaverde.getCurrentBatchPrice(availableBatch.id);
        const totalCost = price * tokensToBuy;

        logInfo("Tokens to buy", tokensToBuy.toString());
        logInfo("Total cost", ethers.formatUnits(totalCost, 6) + " USDC");

        // Approve USDC
        const approveTx = await usdc.approve(CONTRACTS.ASTAVERDE, totalCost, { nonce: nonce++ });
        await approveTx.wait();
        logSuccess("USDC approved");

        // Buy batch
        const buyTx = await astaverde.buyBatch(availableBatch.id, totalCost, tokensToBuy, { nonce: nonce++ });
        const buyReceipt = await buyTx.wait();
        logSuccess("NFT purchased");

        // Get the token ID from events
        let tokenId = null;
        try {
            const boughtEvent = buyReceipt.logs
                .map((log) => {
                    try {
                        return astaverde.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event) => event && event.name === "BatchBought");

            if (boughtEvent && boughtEvent.args) {
                tokenId = boughtEvent.args[2]; // firstTokenId is the third argument
            }
        } catch (e) {
            // If we can't get from events, calculate it
            const lastTokenId = await astaverde.lastTokenID();
            tokenId = lastTokenId; // The last minted token
        }
        logInfo("Token ID acquired", tokenId ? tokenId.toString() : "Unknown");

        // Step 4: Deposit NFT to Vault
        logStep(4, "Deposit NFT to Vault");

        if (tokenId) {
            // Approve vault to transfer NFT
            const approveVaultTx = await astaverde.setApprovalForAll(CONTRACTS.ECOSTABILIZER, true, { nonce: nonce++ });
            await approveVaultTx.wait();
            logSuccess("Vault approved for NFT transfer");

            // Deposit to vault
            const depositTx = await ecoStabilizer.deposit(tokenId, { nonce: nonce++ });
            await depositTx.wait();
            logSuccess("NFT deposited to vault");

            // Check SCC balance
            const sccBalance = await scc.balanceOf(wallet.address);
            logInfo("SCC received", ethers.formatUnits(sccBalance, 18));
        }

        // Step 5: Check vault position
        logStep(5, "Check Vault Position");
        // Get deposited tokens (EcoStabilizer doesn't have getUserTokenIds, we'll track manually)
        const vaultTokens = tokenId ? [tokenId] : [];
        logInfo("Tokens in vault", vaultTokens.length);
        if (vaultTokens.length > 0) {
            logInfo("Token IDs in vault", vaultTokens.map((t) => t.toString()).join(", "));
        }

        // Step 6: Withdraw from Vault (if we have tokens)
        if (vaultTokens.length > 0 && tokenId) {
            logStep(6, "Withdraw NFT from Vault");

            // Approve SCC for vault
            const sccAmount = ethers.parseUnits("20", 18); // 20 SCC per NFT
            const approveSccTx = await scc.approve(CONTRACTS.ECOSTABILIZER, sccAmount, { nonce: nonce++ });
            await approveSccTx.wait();
            logSuccess("SCC approved for repayment");

            // Withdraw
            const withdrawTx = await ecoStabilizer.withdraw(tokenId, { nonce: nonce++ });
            await withdrawTx.wait();
            logSuccess("NFT withdrawn from vault");

            // Verify NFT ownership
            const nftBalance = await astaverde.balanceOf(wallet.address, tokenId);
            logInfo("NFT balance after withdrawal", nftBalance.toString());
        }

        // Step 7: Redeem token
        if (tokenId) {
            logStep(7, "Redeem Token");
            const redeemTx = await astaverde.redeemToken(tokenId, { nonce: nonce++ });
            await redeemTx.wait();
            logSuccess("Token redeemed");

            // Check if token is redeemed
            const tokenInfo = await astaverde.tokens(tokenId);
            logInfo("Token redeemed status", tokenInfo.redeemed ? "Yes" : "No");
        }

        // Final Summary
        console.log(chalk.bold.green("\n" + "=".repeat(80)));
        console.log(chalk.bold.green("✅ User Flow Test Complete!"));
        console.log(chalk.gray("=".repeat(80)));

        // Final balances
        const finalUSDC = await usdc.balanceOf(wallet.address);
        const finalSCC = await scc.balanceOf(wallet.address);

        console.log(chalk.bold.cyan("\n📊 Final Balances:"));
        logInfo("USDC", ethers.formatUnits(finalUSDC, 6));
        logInfo("SCC", ethers.formatUnits(finalSCC, 18));
        logInfo("USDC spent", ethers.formatUnits(initialUSDC - finalUSDC, 6));
    } catch (error) {
        console.error(chalk.red("\n❌ Error in user flow:"), error.message);
        if (error.data) {
            console.error(chalk.red("Error data:"), error.data);
        }
        process.exit(1);
    }
}

// Run the flow
console.log(chalk.gray("\n💡 Make sure 'npm run dev' is running before executing this test\n"));
runUserFlow();
