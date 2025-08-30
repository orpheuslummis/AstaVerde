const hre = require("hardhat");

async function main() {
    const producerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    // Get all signers
    const signers = await hre.ethers.getSigners();
    console.log("Available signers:");
    signers.forEach((s, i) => console.log(`  [${i}] ${s.address}`));

    // Get deployed contract
    const deployment = await hre.deployments.get("AstaVerde");
    const astaVerde = await hre.ethers.getContractAt("AstaVerde", deployment.address);

    console.log(`\nContract deployed at: ${deployment.address}`);

    // Check producer info
    const producerInfo = await astaVerde.producerInfo(producerAddress);
    console.log(`\nProducer Info for ${producerAddress}:`);
    console.log(`  Name: ${producerInfo.name}`);
    console.log(`  Location: ${producerInfo.location}`);
    console.log(`  Is Active: ${producerInfo.isActive}`);

    // Check balance
    const balance = await astaVerde.producerBalances(producerAddress);
    console.log(`\nProducer Balance: ${hre.ethers.formatUnits(balance, 6)} USDC`);

    // Check total producer balances
    const totalProducerBalances = await astaVerde.totalProducerBalances();
    console.log(`Total Producer Balances: ${hre.ethers.formatUnits(totalProducerBalances, 6)} USDC`);

    // Check if this is the deployer/owner
    const owner = await astaVerde.owner();
    console.log(`\nContract Owner: ${owner}`);
    console.log(`Is producer the owner? ${producerAddress.toLowerCase() === owner.toLowerCase()}`);

    // Try to understand where the balance came from
    // Check past events
    console.log("\n=== Checking Events ===");

    // Get all BatchCreated events
    const batchFilter = astaVerde.filters.BatchCreated();
    const batchEvents = await astaVerde.queryFilter(batchFilter, 0, "latest");
    console.log(`\nFound ${batchEvents.length} BatchCreated events`);

    // Get all PartialBatchSold events
    const partialFilter = astaVerde.filters.PartialBatchSold();
    const partialEvents = await astaVerde.queryFilter(partialFilter, 0, "latest");
    console.log(`Found ${partialEvents.length} PartialBatchSold events`);

    // Check batch details
    console.log("\n=== Batch Details ===");
    for (let i = 1; i <= 10; i++) {
        try {
            const batch = await astaVerde.getBatchInfo(i);
            const [id, tokenIds, producer, basePrice, remainingTokens, launchTime, soldTokens] = batch;

            if (id > 0) {
                console.log(`\nBatch #${id}:`);
                console.log(`  Producer: ${producer}`);
                console.log(`  Base Price: ${hre.ethers.formatUnits(basePrice, 6)} USDC`);
                console.log(`  Total Tokens: ${tokenIds.length}`);
                console.log(`  Sold Tokens: ${soldTokens}`);
                console.log(`  Remaining: ${remainingTokens}`);

                if (soldTokens > 0) {
                    // Calculate revenue
                    const soldCount = Number(soldTokens);
                    const price = Number(basePrice);
                    const totalRevenue = (soldCount * price) / 1000000;
                    const producerShare = totalRevenue * 0.7;
                    console.log(`  Total Revenue: ${totalRevenue.toFixed(2)} USDC`);
                    console.log(`  Producer Share (70%): ${producerShare.toFixed(2)} USDC`);
                }
            }
        } catch (e) {
            // Batch doesn't exist
            break;
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
