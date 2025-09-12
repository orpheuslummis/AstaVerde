#!/usr/bin/env node

const { ethers } = require("ethers");
const fs = require("fs");

// Configuration for local development
const LOCAL_RPC_URL = "http://localhost:8545";
const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // AstaVerde contract address
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Default Hardhat account #0

// Load ABI
const contractJson = JSON.parse(fs.readFileSync("./artifacts/contracts/AstaVerde.sol/AstaVerde.json", "utf8"));
const ABI = contractJson.abi;

async function mintBatch(tokenCount = 3) {
    try {
        console.log(`🚀 Starting local batch minting of ${tokenCount} tokens...`);

        // Setup provider and wallet
        const provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

        // Check connection
        const network = await provider.getNetwork();
        console.log(`✅ Connected to network: ${network.name} (chainId: ${network.chainId})`);

        // Get current state
        const lastBatchId = await contract.lastBatchID();
        const lastTokenId = await contract.lastTokenID();
        console.log(`📊 Current state: Last Batch ID: ${lastBatchId}, Last Token ID: ${lastTokenId}`);

        // Generate producer addresses and mock CIDs
        const producers = [];
        const cids = [];

        for (let i = 0; i < tokenCount; i++) {
            // Use different test addresses as producers
            const testAddresses = [
                "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // alice
                "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // bob
                "0x90F79bf6EB2c4f870365E785982E1f101E93b906", // charlie
            ];
            producers.push(testAddresses[i % testAddresses.length]);

            // Generate mock CID for local development
            const mockCid = `QmLocal${Number(lastTokenId) + i + 1}`;
            cids.push(mockCid);
        }

        console.log(`🎨 Minting batch with ${tokenCount} tokens...`);
        console.log(`   Producers: ${producers.join(", ")}`);
        console.log(`   CIDs: ${cids.join(", ")}`);

        // Mint the batch
        const tx = await contract.mintBatch(producers, cids);
        console.log(`📝 Transaction sent: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

        // Get the new batch info
        const newBatchId = await contract.lastBatchID();
        const batchInfo = await contract.getBatchInfo(newBatchId);

        console.log(`\n🎉 Successfully minted Batch #${newBatchId}`);
        console.log(`   Token IDs: ${batchInfo[1].map((id) => id.toString()).join(", ")}`);
        console.log(`   Price: ${ethers.formatUnits(batchInfo[3], 6)} USDC`);
        console.log(`   Remaining tokens: ${batchInfo[4]}`);

        console.log("\n✨ Batch minting complete! View the new tokens in the webapp.");
    } catch (error) {
        console.error("❌ Error minting batch:", error.message);
        if (error.reason) {
            console.error("   Reason:", error.reason);
        }
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const tokenCount = args[0] ? parseInt(args[0]) : 3;

if (isNaN(tokenCount) || tokenCount < 1 || tokenCount > 20) {
    console.log("Usage: node mint-local-batch.js [tokenCount]");
    console.log("  tokenCount: Number of tokens to mint (1-20, default: 3)");
    process.exit(1);
}

// Run the minting
mintBatch(tokenCount);
