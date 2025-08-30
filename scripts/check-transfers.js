const hre = require("hardhat");

async function main() {
    const producerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    // Get deployed contract
    const deployment = await hre.deployments.get("AstaVerde");
    const astaVerde = await hre.ethers.getContractAt("AstaVerde", deployment.address);

    // Get TransferBatch events (ERC1155 standard)
    const filter = astaVerde.filters.TransferBatch();
    const events = await astaVerde.queryFilter(filter, 0, "latest");

    console.log(`\nTotal TransferBatch events found: ${events.length}`);

    // Also check TransferSingle events
    const singleFilter = astaVerde.filters.TransferSingle();
    const singleEvents = await astaVerde.queryFilter(singleFilter, 0, "latest");

    console.log(`Total TransferSingle events found: ${singleEvents.length}`);

    // Check batch info to understand pricing
    const batchCount = await astaVerde.batchCount();
    console.log(`\nTotal batches created: ${batchCount}`);

    // Check details of batches
    for (let i = 1; i <= batchCount; i++) {
        try {
            const batch = await astaVerde.batches(i);
            console.log(`\nBatch ${i}:`);
            console.log(`  Base Price: ${hre.ethers.formatUnits(batch.basePrice, 6)} USDC`);
            console.log(`  Total Tokens: ${batch.totalTokens}`);
            console.log(`  Sold Tokens: ${batch.soldTokens}`);
            console.log(`  Launch Time: ${new Date(Number(batch.launchTime) * 1000).toISOString()}`);

            // Calculate price based on Dutch auction
            const currentTime = Math.floor(Date.now() / 1000);
            const daysSinceLaunch = Math.floor((currentTime - Number(batch.launchTime)) / 86400);
            const currentPrice = Math.max(
                Number(batch.basePrice) - daysSinceLaunch * 1000000, // Decrease 1 USDC per day
                40000000, // Floor at 40 USDC
            );
            console.log(`  Current Price: ${currentPrice / 1000000} USDC (after ${daysSinceLaunch} days)`);

            // Check if this batch contributed to producer balance
            if (batch.soldTokens > 0) {
                const revenue = Number(batch.soldTokens) * currentPrice;
                const producerShare = (revenue * 0.7) / 1000000;
                console.log(`  Estimated Producer Revenue: ${producerShare.toFixed(2)} USDC`);
            }
        } catch (e) {
            // Batch doesn't exist yet
        }
    }

    // Check producer balance
    const balance = await astaVerde.producerBalances(producerAddress);
    console.log("\n=== PRODUCER BALANCE ===");
    console.log(`Address: ${producerAddress}`);
    console.log(`Balance: ${hre.ethers.formatUnits(balance, 6)} USDC`);

    // Check total producer balances
    const totalProducerBalances = await astaVerde.totalProducerBalances();
    console.log(`\nTotal Producer Balances: ${hre.ethers.formatUnits(totalProducerBalances, 6)} USDC`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
