const hre = require("hardhat");

async function main() {
  const [deployer, alice] = await hre.ethers.getSigners();
  const usdcAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const usdc = await hre.ethers.getContractAt("MockUSDC", usdcAddress);
  
  const balance = await usdc.balanceOf(alice.address);
  console.log(`Alice (${alice.address}):`);
  console.log(`USDC balance: ${hre.ethers.formatUnits(balance, 6)} USDC`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });