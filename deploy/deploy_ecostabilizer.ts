import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying EcoStabilizer system with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Get AstaVerde address from environment or config
  const astaVerdeAddress = process.env.AV_ADDR;
  if (!astaVerdeAddress) {
    throw new Error("AV_ADDR environment variable not set");
  }

  console.log("Using AstaVerde contract at:", astaVerdeAddress);

  // Step 1: Deploy StabilizedCarbonCoin
  console.log("\n1. Deploying StabilizedCarbonCoin...");
  const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
  const scc = await SCCFactory.deploy();
  await scc.waitForDeployment();

  console.log("StabilizedCarbonCoin deployed to:", await scc.getAddress());

  // Step 2: Deploy EcoStabilizer vault
  console.log("\n2. Deploying EcoStabilizer vault...");
  const EcoStabilizerFactory = await ethers.getContractFactory("EcoStabilizer");
  const ecoStabilizer = await EcoStabilizerFactory.deploy(
    astaVerdeAddress,
    await scc.getAddress()
  );
  await ecoStabilizer.waitForDeployment();

  console.log("EcoStabilizer deployed to:", await ecoStabilizer.getAddress());

  // Step 3: Grant MINTER_ROLE to vault
  console.log("\n3. Granting MINTER_ROLE to vault...");
  const MINTER_ROLE = await scc.MINTER_ROLE();
  const grantRoleTx = await scc.grantRole(MINTER_ROLE, await ecoStabilizer.getAddress());
  await grantRoleTx.wait();

  console.log("MINTER_ROLE granted to vault");

  // Step 4: Renounce roles from deployer (CRITICAL SECURITY STEP)
  console.log("\n4. Renouncing roles from deployer...");
  
  const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();
  
  // Renounce DEFAULT_ADMIN_ROLE 
  console.log("Renouncing DEFAULT_ADMIN_ROLE...");
  const renounceAdminTx = await scc.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  await renounceAdminTx.wait();

  console.log("All deployer roles renounced - contracts are now immutable");

  // Step 5: Verify deployment integrity
  console.log("\n5. Verifying deployment...");
  
  // Check vault references
  const vaultAstaVerde = await ecoStabilizer.ecoAsset();
  const vaultSCC = await ecoStabilizer.scc();
  
  console.log("Vault AstaVerde reference:", vaultAstaVerde);
  console.log("Vault SCC reference:", vaultSCC);
  
  // Check SCC constants
  const sccDecimals = await scc.decimals();
  const sccName = await scc.name();
  const sccSymbol = await scc.symbol();
  
  console.log("SCC decimals:", sccDecimals);
  console.log("SCC name:", sccName);
  console.log("SCC symbol:", sccSymbol);

  // Check vault constants
  const sccPerAsset = await ecoStabilizer.SCC_PER_ASSET();
  console.log("SCC per asset:", ethers.formatEther(sccPerAsset));

  // Check role assignments
  const vaultHasMinterRole = await scc.hasRole(MINTER_ROLE, await ecoStabilizer.getAddress());
  const deployerHasAdminRole = await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  const deployerHasMinterRole = await scc.hasRole(MINTER_ROLE, deployer.address);

  console.log("Vault has MINTER_ROLE:", vaultHasMinterRole);
  console.log("Deployer has DEFAULT_ADMIN_ROLE:", deployerHasAdminRole);
  console.log("Deployer has MINTER_ROLE:", deployerHasMinterRole);

  // Verify security state
  if (!vaultHasMinterRole) {
    throw new Error("CRITICAL: Vault does not have MINTER_ROLE");
  }
  if (deployerHasAdminRole) {
    throw new Error("CRITICAL: Deployer still has DEFAULT_ADMIN_ROLE");
  }
  if (deployerHasMinterRole) {
    throw new Error("CRITICAL: Deployer still has MINTER_ROLE");
  }

  console.log("✅ Deployment verification passed");

  // Step 6: Save deployment info
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      AstaVerde: astaVerdeAddress,
      StabilizedCarbonCoin: await scc.getAddress(),
      EcoStabilizer: await ecoStabilizer.getAddress()
    },
    constants: {
      SCC_PER_ASSET: ethers.formatEther(sccPerAsset),
      SCC_DECIMALS: sccDecimals.toString()
    },
    verification: {
      vaultHasMinterRole,
      securityState: "deployer roles renounced"
    }
  };

  const deploymentPath = path.join(__dirname, "..", "deployments", `ecostabilizer-${deploymentInfo.network.chainId}.json`);
  
  // Ensure deployments directory exists
  const deploymentsDir = path.dirname(deploymentPath);
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentPath}`);

  console.log("\n🎉 EcoStabilizer deployment completed successfully!");
  console.log("\nNext steps:");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Run smoke tests");
  console.log("3. Update frontend configuration");
  
  return {
    scc: await scc.getAddress(),
    ecoStabilizer: await ecoStabilizer.getAddress(),
    astaVerde: astaVerdeAddress
  };
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Deployment failed:", error);
      process.exit(1);
    });
}

export default main; 