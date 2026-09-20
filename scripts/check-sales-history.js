const hre = require("hardhat");

async function main() {
    const producerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    // Get deployed contract
    const deployment = await hre.deployments.get("AstaVerde");
    const astaVerde = await hre.ethers.getContractAt("AstaVerde", deployment.address);

    // Revenue split comes from the contract, not a hardcoded 70/30
    const platformPct = Number(await astaVerde.platformSharePercentage());
    const producerPct = 100 - platformPct;

    // Get recent Purchase events
    const filter = astaVerde.filters.Purchase();
    const events = await astaVerde.queryFilter(filter, 0, "latest");

    console.log(`\nTotal purchases found: ${events.length}`);

    let totalSales = 0;
    let producerRevenue = 0;
    let platformRevenue = 0;

    for (const event of events) {
        const buyer = event.args.buyer;
        const tokenId = event.args.tokenId;
        const price = event.args.price;
        const priceInUSDC = Number(hre.ethers.formatUnits(price, 6));

        // Calculate splits using the contract's configured platform share
        const producerAmount = (priceInUSDC * producerPct) / 100;
        const platformAmount = (priceInUSDC * platformPct) / 100;

        totalSales += priceInUSDC;
        producerRevenue += producerAmount;
        platformRevenue += platformAmount;

        console.log("\nPurchase Event:");
        console.log(`  Buyer: ${buyer}`);
        console.log(`  Token ID: ${tokenId}`);
        console.log(`  Total Price: ${priceInUSDC} USDC`);
        console.log(`  Producer gets: ${producerAmount.toFixed(2)} USDC (${producerPct}%)`);
        console.log(`  Platform gets: ${platformAmount.toFixed(2)} USDC (${platformPct}%)`);
    }

    console.log("\n=== SUMMARY ===");
    console.log(`Total Sales: ${totalSales.toFixed(2)} USDC`);
    console.log(`Producer Revenue (${producerPct}%): ${producerRevenue.toFixed(2)} USDC`);
    console.log(`Platform Revenue (${platformPct}%): ${platformRevenue.toFixed(2)} USDC`);

    // Verify against contract state
    const balance = await astaVerde.producerBalances(producerAddress);
    console.log(`\nContract Producer Balance: ${hre.ethers.formatUnits(balance, 6)} USDC`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
