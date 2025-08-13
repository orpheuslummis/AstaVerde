const hre = require("hardhat");

async function main() {
  console.log("💰 Simple USDC funding...\n");

  const [deployer, alice, bob, charlie] = await hre.ethers.getSigners();
  
  // Deploy a new MockUSDC just for funding (workaround)
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = MockUSDC.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3");
  
  // Since mint has no access control in MockUSDC, this should work
  const amount = hre.ethers.parseUnits("50000", 6); // 50k USDC each
  
  const accounts = [
    { name: "Alice", address: alice.address },
    { name: "Bob", address: bob.address },
    { name: "Charlie", address: charlie.address }
  ];

  for (const account of accounts) {
    try {
      // Try direct transfer from deployer (if deployer has USDC)
      const deployerBalance = await usdc.balanceOf(deployer.address);
      if (deployerBalance >= amount) {
        const tx = await usdc.connect(deployer).transfer(account.address, amount);
        await tx.wait();
        console.log(`✅ ${account.name}: Funded via transfer`);
      } else {
        // Use hardhat to impersonate the USDC contract itself
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [usdc.target],
        });
        
        // Fund the USDC contract with ETH for gas
        await deployer.sendTransaction({
          to: usdc.target,
          value: hre.ethers.parseEther("1.0")
        });
        
        // Now mint as the USDC contract (bypass any access control)
        const usdcSigner = await hre.ethers.getSigner(usdc.target);
        const tx = await usdc.connect(usdcSigner).mint(account.address, amount);
        await tx.wait();
        
        console.log(`✅ ${account.name}: Funded via impersonation`);
        
        await hre.network.provider.request({
          method: "hardhat_stopImpersonatingAccount",
          params: [usdc.target],
        });
      }
      
      const balance = await usdc.balanceOf(account.address);
      console.log(`   Balance: ${hre.ethers.formatUnits(balance, 6)} USDC`);
      
    } catch (error) {
      // Last resort: use hardhat_setStorageAt to directly set balance
      console.log(`⚠️  ${account.name}: Using storage manipulation...`);
      
      // USDC uses storage slot mapping(address => uint256) at slot 0
      // Calculate storage slot for balance
      const slot = hre.ethers.solidityPackedKeccak256(
        ["address", "uint256"],
        [account.address, 0]
      );
      
      // Set balance to 50000 USDC (50000 * 10^6)
      const value = hre.ethers.toBeHex(amount, 32);
      
      await hre.network.provider.send("hardhat_setStorageAt", [
        usdc.target,
        slot,
        value
      ]);
      
      const balance = await usdc.balanceOf(account.address);
      console.log(`✅ ${account.name}: ${hre.ethers.formatUnits(balance, 6)} USDC (via storage)`);
    }
  }

  console.log("\n✨ Funding complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });