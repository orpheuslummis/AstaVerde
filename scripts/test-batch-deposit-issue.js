const { ethers } = require("hardhat");

async function main() {
  const [owner, alice, bob] = await ethers.getSigners();
  
  const astaverdeAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const usdcAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  
  const astaverde = await ethers.getContractAt("AstaVerde", astaverdeAddress);
  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
  
  console.log("=== Setting up test scenario ===\n");
  
  // 1. Mint 3 batches with 3 tokens each
  console.log("📦 Minting Batch 1 (tokens 1-3)...");
  await (await astaverde.mintBatch(
    ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"],
    ["QmBatch1Token1", "QmBatch1Token2", "QmBatch1Token3"]
  )).wait();
  console.log("✅ Batch 1 minted\n");
  
  console.log("📦 Minting Batch 2 (tokens 4-6)...");
  await (await astaverde.mintBatch(
    ["0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"],
    ["QmBatch2Token4", "QmBatch2Token5", "QmBatch2Token6"]
  )).wait();
  console.log("✅ Batch 2 minted\n");
  
  console.log("📦 Minting Batch 3 (tokens 7-9)...");
  await (await astaverde.mintBatch(
    ["0x90F79bf6EB2c4f870365E785982E1f101E93b906", "0x90F79bf6EB2c4f870365E785982E1f101E93b906", "0x90F79bf6EB2c4f870365E785982E1f101E93b906"],
    ["QmBatch3Token7", "QmBatch3Token8", "QmBatch3Token9"]
  )).wait();
  console.log("✅ Batch 3 minted\n");
  
  // 2. Mint USDC to Alice
  console.log("💰 Minting USDC to Alice...");
  await (await usdc.mint(alice.address, ethers.parseUnits("10000", 6))).wait();
  console.log("✅ Alice has 10,000 USDC\n");
  
  // 3. Alice buys Batch 1 and Batch 2
  console.log("🛒 Alice buying Batch 1...");
  const price = ethers.parseUnits("690", 6); // 230 USDC per token * 3 tokens
  await (await usdc.connect(alice).approve(astaverdeAddress, price)).wait();
  await (await astaverde.connect(alice).buyBatch(1, price, 3)).wait();
  console.log("✅ Alice owns tokens 1-3\n");
  
  console.log("🛒 Alice buying Batch 2...");
  await (await usdc.connect(alice).approve(astaverdeAddress, price)).wait();
  await (await astaverde.connect(alice).buyBatch(2, price, 3)).wait();
  console.log("✅ Alice owns tokens 4-6\n");
  
  // Verify ownership
  console.log("=== Verifying Alice's ownership ===");
  for (let i = 1; i <= 6; i++) {
    const balance = await astaverde.balanceOf(alice.address, i);
    console.log(`Token ${i}: Balance = ${balance}`);
  }
  
  console.log("\n=== Test Scenario Ready ===");
  console.log("Alice owns:");
  console.log("- Batch 1: tokens 1, 2, 3");
  console.log("- Batch 2: tokens 4, 5, 6");
  console.log("\n✨ Now test depositing from Batch 1 and see if it affects Batch 2");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });