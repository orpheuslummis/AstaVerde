const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔍 VERIFYING PRODUCER DOS FIX\n");
  console.log("=" .repeat(50));
  
  // Deploy contracts
  const [owner, buyer, producer1, producer2] = await ethers.getSigners();
  
  // Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy(0);
  await mockUSDC.waitForDeployment();
  
  // Deploy AstaVerde
  const AstaVerde = await ethers.getContractFactory("AstaVerde");
  const astaVerde = await AstaVerde.deploy(
    await owner.getAddress(),
    await mockUSDC.getAddress()
  );
  await astaVerde.waitForDeployment();
  
  // Deploy malicious producer that would cause DoS in old version
  const MaliciousProducer = await ethers.getContractFactory("MaliciousProducer");
  const malicious = await MaliciousProducer.deploy();
  await malicious.waitForDeployment();
  
  console.log("✅ Contracts deployed");
  
  // Fund buyer
  await mockUSDC.mint(await buyer.getAddress(), ethers.parseUnits("1000", 6));
  await mockUSDC.connect(buyer).approve(await astaVerde.getAddress(), ethers.MaxUint256);
  console.log("✅ Buyer funded with USDC");
  
  // Mint batch with malicious producer
  const producers = [
    await malicious.getAddress(), // Would block sales in old version!
    await producer1.getAddress(),
    await producer2.getAddress()
  ];
  const cids = ["QmTest1", "QmTest2", "QmTest3"];
  
  await astaVerde.connect(owner).mintBatch(producers, cids);
  console.log("✅ Batch minted with malicious producer");
  
  // Try to buy - this would FAIL in old version due to DoS
  const batchPrice = await astaVerde.getCurrentBatchPrice(1);
  const totalCost = batchPrice * 3n;
  
  try {
    const tx = await astaVerde.connect(buyer).buyBatch(1, totalCost, 3);
    await tx.wait();
    console.log("✅ Purchase SUCCEEDED despite malicious producer!");
  } catch (error) {
    console.log("❌ Purchase FAILED - DoS vulnerability still present!");
    process.exit(1);
  }
  
  // Verify funds are accrued, not transferred
  const maliciousBalance = await astaVerde.producerBalances(await malicious.getAddress());
  const producer1Balance = await astaVerde.producerBalances(await producer1.getAddress());
  const totalProducerBalances = await astaVerde.totalProducerBalances();
  
  console.log("\n📊 ACCOUNTING VERIFICATION:");
  console.log(`  Malicious producer balance: ${ethers.formatUnits(maliciousBalance, 6)} USDC`);
  console.log(`  Producer 1 balance: ${ethers.formatUnits(producer1Balance, 6)} USDC`);
  console.log(`  Total producer balances: ${ethers.formatUnits(totalProducerBalances, 6)} USDC`);
  
  // Verify accounting invariant
  const contractBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());
  const platformShare = await astaVerde.platformShareAccumulated();
  const expectedBalance = platformShare + totalProducerBalances;
  
  if (contractBalance === expectedBalance) {
    console.log("✅ Accounting invariant holds: contract balance = platform + producers");
  } else {
    console.log("❌ Accounting invariant violated!");
    process.exit(1);
  }
  
  // Verify normal producer can claim
  const initialBalance = await mockUSDC.balanceOf(await producer1.getAddress());
  await astaVerde.connect(producer1).claimProducerFunds();
  const finalBalance = await mockUSDC.balanceOf(await producer1.getAddress());
  
  if (finalBalance > initialBalance) {
    console.log("✅ Producer successfully claimed funds");
  } else {
    console.log("❌ Producer claim failed!");
    process.exit(1);
  }
  
  // Verify malicious producer's balance is still accrued (they can't claim due to revert)
  const maliciousStillAccrued = await astaVerde.producerBalances(await malicious.getAddress());
  if (maliciousStillAccrued > 0n) {
    console.log("✅ Malicious producer's funds remain accrued (unclaimed)");
  }
  
  console.log("\n" + "=" .repeat(50));
  console.log("🎉 DOS VULNERABILITY SUCCESSFULLY FIXED!");
  console.log("=" .repeat(50));
  console.log("\nKey improvements:");
  console.log("  • Sales never blocked by producer addresses");
  console.log("  • Pull payment pattern prevents DoS");
  console.log("  • Accounting invariants maintained");
  console.log("  • Producers can claim at their convenience");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });