const hre = require("hardhat");

async function main() {
  console.log("Testing USDC approve function...\n");

  // Get signers
  const [deployer, alice] = await hre.ethers.getSigners();
  console.log("Alice address:", alice.address);
  
  // Contract addresses
  const usdcAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const astaVerdeAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  
  // Get USDC contract
  const usdc = await hre.ethers.getContractAt("MockUSDC", usdcAddress);
  
  // Check Alice's balance
  const balance = await usdc.balanceOf(alice.address);
  console.log("Alice USDC balance:", hre.ethers.formatUnits(balance, 6), "USDC");
  
  // Check decimals
  const decimals = await usdc.decimals();
  console.log("USDC decimals:", decimals);
  
  // Amount to approve (230 USDC for batch purchase)
  const approveAmount = hre.ethers.parseUnits("230", 6);
  console.log("\nApproving amount:", approveAmount.toString(), "(raw)");
  console.log("Approving amount:", hre.ethers.formatUnits(approveAmount, 6), "USDC");
  
  try {
    // Try to approve
    console.log("\nSending approve transaction...");
    const tx = await usdc.connect(alice).approve(astaVerdeAddress, approveAmount);
    console.log("Transaction hash:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Approve successful! Block:", receipt.blockNumber);
    
    // Check allowance
    const allowance = await usdc.allowance(alice.address, astaVerdeAddress);
    console.log("New allowance:", hre.ethers.formatUnits(allowance, 6), "USDC");
    
  } catch (error) {
    console.error("❌ Approve failed!");
    console.error("Error:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });