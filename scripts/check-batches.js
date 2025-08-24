const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // Read the actual deployed address from webapp config
    const envPath = path.join(__dirname, "..", "webapp", ".env.local");
    const envContent = fs.readFileSync(envPath, "utf8");
    const astaVerdeMatch = envContent.match(/NEXT_PUBLIC_ASTAVERDE_ADDRESS=(0x[a-fA-F0-9]+)/);

    if (!astaVerdeMatch) {
        console.error("Could not find AstaVerde address in .env.local");
        return;
    }

    const astaVerdeAddress = astaVerdeMatch[1];
    console.log(`Using AstaVerde at: ${astaVerdeAddress}`);
    const astaVerde = await ethers.getContractAt("AstaVerde", astaVerdeAddress);

    const lastBatchID = await astaVerde.lastBatchID();
    console.log(`Last Batch ID: ${lastBatchID}`);

    for (let i = 1n; i <= lastBatchID; i++) {
        const batchInfo = await astaVerde.getBatchInfo(i);
        console.log(`\nBatch #${i}:`);
        console.log(`  Token IDs: ${batchInfo[1].map((id) => id.toString())}`);
        console.log(`  Remaining: ${batchInfo[4]}`);
        console.log(`  Price: ${ethers.formatUnits(batchInfo[3], 6)} USDC`);
    }
}

main().catch(console.error);
