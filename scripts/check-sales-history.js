const hre = require("hardhat");

async function main() {
  const producerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  
  // Get deployed contract
  const deployment = await hre.deployments.get("AstaVerde");
  const astaVerde = await hre.ethers.getContractAt("AstaVerde", deployment.address);
  
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
    
    // Calculate splits (70% producer, 30% platform)
    const producerAmount = priceInUSDC * 0.7;
    const platformAmount = priceInUSDC * 0.3;
    
    totalSales += priceInUSDC;
    producerRevenue += producerAmount;
    platformRevenue += platformAmount;
    
    console.log(`\nPurchase Event:`);
    console.log(`  Buyer: ${buyer}`);
    console.log(`  Token ID: ${tokenId}`);
    console.log(`  Total Price: ${priceInUSDC} USDC`);
    console.log(`  Producer gets: ${producerAmount.toFixed(2)} USDC (70%)`);
    console.log(`  Platform gets: ${platformAmount.toFixed(2)} USDC (30%)`);
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total Sales: ${totalSales.toFixed(2)} USDC`);
  console.log(`Producer Revenue (70%): ${producerRevenue.toFixed(2)} USDC`);
  console.log(`Platform Revenue (30%): ${platformRevenue.toFixed(2)} USDC`);
  
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