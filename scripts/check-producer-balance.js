const hre = require("hardhat");

async function main() {
    const producerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    // Get deployed contract
    const deployment = await hre.deployments.get("AstaVerde");
    const astaVerde = await hre.ethers.getContractAt("AstaVerde", deployment.address);

    // Check producer balance
    const balance = await astaVerde.producerBalances(producerAddress);
    console.log(`Producer balance for ${producerAddress}: ${hre.ethers.formatUnits(balance, 6)} USDC`);

    // Check total producer balances
    const totalProducerBalances = await astaVerde.totalProducerBalances();
    console.log(`Total producer balances: ${hre.ethers.formatUnits(totalProducerBalances, 6)} USDC`);

    // Check platform fees
    const platformFees = await astaVerde.platformFeesAccumulated();
    console.log(`Platform fees accumulated: ${hre.ethers.formatUnits(platformFees, 6)} USDC`);

    // Check if this address is a producer
    const isProducer = await astaVerde.producerInfo(producerAddress);
    console.log(`\nProducer info for ${producerAddress}:`);
    console.log(`  Name: ${isProducer.name}`);
    console.log(`  Location: ${isProducer.location}`);
    console.log(`  Is Active: ${isProducer.isActive}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
