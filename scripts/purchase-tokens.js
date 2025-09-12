const { ethers } = require("hardhat");

async function main() {
  const [owner, alice, bob] = await ethers.getSigners();
  
  const astaverdeAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const usdcAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  
  const astaverde = await ethers.getContractAt("AstaVerde", astaverdeAddress);
  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
  
  // Alice buys batch 1
  console.log("Alice approving USDC...");
  await (await usdc.connect(alice).approve(astaverdeAddress, ethers.parseUnits("690", 6))).wait();
  
  console.log("Alice buying batch 1...");
  await (await astaverde.connect(alice).buyBatch(1)).wait();
  console.log("✅ Alice bought batch 1 (tokens 1-3)");
  
  // Bob buys batch 2
  console.log("Bob approving USDC...");
  await (await usdc.connect(bob).approve(astaverdeAddress, ethers.parseUnits("690", 6))).wait();
  
  console.log("Bob buying batch 2...");
  await (await astaverde.connect(bob).buyBatch(2)).wait();
  console.log("✅ Bob bought batch 2 (tokens 4-6)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });