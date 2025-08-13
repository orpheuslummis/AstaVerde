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

// Simple ABIs
const ABIs = {
    usdc: ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
    astaverde: [
        "function buyBatch(uint256,uint256,uint256) returns (uint256[])",
        "function lastBatchID() view returns (uint256)",
        "function getBatchInfo(uint256) view returns (uint256,uint256[],uint256,uint256,uint256)",
        "function balanceOf(address,uint256) view returns (uint256)",
        "function getCurrentBatchPrice(uint256) view returns (uint256)",
    ],
    ecoStabilizer: ["function deposit(uint256)", "function setApprovalForAll(address,bool)"],
    scc: ["function balanceOf(address) view returns (uint256)"],
};

async function simpleTest() {
    console.log(chalk.bold.cyan("\n🧪 Simple Test Flow\n"));

    try {
        // Setup
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(TEST_PRIVATE_KEY, provider);

        console.log("Test Account:", wallet.address);

        // Contracts
        const usdc = new ethers.Contract(CONTRACTS.USDC, ABIs.usdc, wallet);
        const astaverde = new ethers.Contract(CONTRACTS.ASTAVERDE, ABIs.astaverde, wallet);
        const scc = new ethers.Contract(CONTRACTS.SCC, ABIs.scc, wallet);

        // 1. Check initial balances
        const usdcBalance = await usdc.balanceOf(wallet.address);
        console.log("USDC Balance:", ethers.formatUnits(usdcBalance, 6));

        // 2. Find available batch
        const lastBatchId = await astaverde.lastBatchID();
        const batchInfo = await astaverde.getBatchInfo(lastBatchId);
        const availableTokens = batchInfo[4];

        console.log(`\nBatch #${lastBatchId}: ${availableTokens} tokens available`);

        if (availableTokens === 0n) {
            console.log(chalk.yellow("No tokens available in batch"));
            return;
        }

        // 3. Buy 1 NFT
        console.log("\n" + chalk.green("Buying 1 NFT..."));
        const price = batchInfo[3];

        // Approve USDC
        const approveTx = await usdc.approve(CONTRACTS.ASTAVERDE, price);
        await approveTx.wait();
        console.log("✅ USDC approved");

        // Buy
        const buyTx = await astaverde.buyBatch(lastBatchId, price, 1n);
        const buyReceipt = await buyTx.wait();
        console.log("✅ NFT purchased");

        // Get token ID from batch info
        const tokenIds = batchInfo[1]; // Array of token IDs in batch
        const purchasedTokenId = tokenIds[tokenIds.length - Number(availableTokens)];
        console.log("Token ID:", purchasedTokenId.toString());

        // 4. Check ownership
        const balance = await astaverde.balanceOf(wallet.address, purchasedTokenId);
        console.log("NFT Balance:", balance.toString());

        // 5. Check SCC balance
        const sccBalance = await scc.balanceOf(wallet.address);
        console.log("SCC Balance:", ethers.formatUnits(sccBalance, 18));

        console.log(chalk.bold.green("\n✅ Test Complete!"));
    } catch (error) {
        console.error(chalk.red("Error:"), error.message);
    }
}

simpleTest();
