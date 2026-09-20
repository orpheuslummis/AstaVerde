const { ethers, deployments } = require("hardhat");

async function main() {
    const astaVerde = await ethers.getContractAt("AstaVerde", (await deployments.get("AstaVerde")).address);

    // Get batch info like the frontend does
    const batchInfo = await astaVerde.getBatchInfo(1);
    console.log("\nBatch 1 Info from getBatchInfo:");
    console.log("Price field (index 3):", batchInfo[3].toString(), "wei");
    console.log("In USDC:", ethers.formatUnits(batchInfo[3], 6));

    // Also check getCurrentBatchPrice
    const currentPrice = await astaVerde.getCurrentBatchPrice(1);
    console.log("\nBatch 1 from getCurrentBatchPrice:");
    console.log("Price:", currentPrice.toString(), "wei");
    console.log("In USDC:", ethers.formatUnits(currentPrice, 6));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
