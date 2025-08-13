const hre = require("hardhat");

async function main() {
  console.log("💰 Force funding USDC via storage manipulation...\n");

  const [deployer, alice, bob, charlie] = await hre.ethers.getSigners();
  const usdcAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const amount = "50000000000"; // 50000 USDC with 6 decimals
  
  const accounts = [
    { name: "Alice", address: alice.address },
    { name: "Bob", address: bob.address },
    { name: "Charlie", address: charlie.address }
  ];

  // ERC20 _balances mapping is at slot 0
  for (const account of accounts) {
    // Calculate storage slot for balance mapping
    // keccak256(abi.encode(address, uint256(0)))
    const slot = hre.ethers.keccak256(
      hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [account.address, 0]
      )
    );
    
    // Set balance to 50000 USDC
    const paddedAmount = hre.ethers.zeroPadValue(hre.ethers.toBeHex(amount), 32);
    
    await hre.network.provider.send("hardhat_setStorageAt", [
      usdcAddress,
      slot,
      paddedAmount
    ]);
    
    // Verify the balance
    const usdc = await hre.ethers.getContractAt("MockUSDC", usdcAddress);
    const balance = await usdc.balanceOf(account.address);
    console.log(`✅ ${account.name}: ${hre.ethers.formatUnits(balance, 6)} USDC`);
  }
  
  // Also update total supply (slot 2 in ERC20)
  const totalSupplySlot = "0x0000000000000000000000000000000000000000000000000000000000000002";
  const totalAmount = BigInt(amount) * 3n; // Total for 3 accounts
  const paddedTotal = hre.ethers.zeroPadValue(hre.ethers.toBeHex(totalAmount), 32);
  
  await hre.network.provider.send("hardhat_setStorageAt", [
    usdcAddress,
    totalSupplySlot,
    paddedTotal
  ]);
  
  const usdc = await hre.ethers.getContractAt("MockUSDC", usdcAddress);
  const totalSupply = await usdc.totalSupply();
  console.log(`\n📊 Total Supply: ${hre.ethers.formatUnits(totalSupply, 6)} USDC`);

  console.log("\n✨ Force funding complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });