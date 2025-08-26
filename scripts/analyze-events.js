const hre = require("hardhat");

async function main() {
  const producerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  
  // Get deployed contract
  const deployment = await hre.deployments.get("AstaVerde");
  const astaVerde = await hre.ethers.getContractAt("AstaVerde", deployment.address);
  
  console.log("Contract deployed at:", deployment.address);
  
  // Get TransferSingle events where tokens were minted (from = 0x0)
  const singleFilter = astaVerde.filters.TransferSingle();
  const singleEvents = await astaVerde.queryFilter(singleFilter, 0, "latest");
  
  console.log(`\n=== TRANSFER SINGLE EVENTS (${singleEvents.length} total) ===`);
  for (const event of singleEvents) {
    const from = event.args.from;
    const to = event.args.to;
    const id = event.args.id;
    const value = event.args.value;
    
    if (from === "0x0000000000000000000000000000000000000000") {
      console.log(`\nMINT Event:`);
      console.log(`  To: ${to}`);
      console.log(`  Token ID: ${id}`);
      console.log(`  Amount: ${value}`);
    } else if (to !== deployment.address) {
      console.log(`\nTRANSFER Event:`);
      console.log(`  From: ${from}`);
      console.log(`  To: ${to}`);
      console.log(`  Token ID: ${id}`);
      console.log(`  Amount: ${value}`);
    }
  }
  
  // Get TransferBatch events
  const batchFilter = astaVerde.filters.TransferBatch();
  const batchEvents = await astaVerde.queryFilter(batchFilter, 0, "latest");
  
  console.log(`\n=== TRANSFER BATCH EVENTS (${batchEvents.length} total) ===`);
  for (const event of batchEvents) {
    const from = event.args.from;
    const to = event.args.to;
    const ids = event.args.ids;
    const values = event.args.values;
    
    if (from === "0x0000000000000000000000000000000000000000") {
      console.log(`\nBATCH MINT Event:`);
      console.log(`  To: ${to}`);
      console.log(`  Token IDs: ${ids.join(", ")}`);
      console.log(`  Amounts: ${values.join(", ")}`);
    }
  }
  
  // Check current balances
  console.log(`\n=== CONTRACT STATE ===`);
  const balance = await astaVerde.producerBalances(producerAddress);
  console.log(`Producer Balance: ${hre.ethers.formatUnits(balance, 6)} USDC`);
  
  const totalProducerBalances = await astaVerde.totalProducerBalances();
  console.log(`Total Producer Balances: ${hre.ethers.formatUnits(totalProducerBalances, 6)} USDC`);
  
  // Try to get some token metadata
  try {
    const uri = await astaVerde.uri(1);
    console.log(`\nToken 1 URI: ${uri}`);
  } catch (e) {
    console.log("\nCouldn't fetch token URI");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });