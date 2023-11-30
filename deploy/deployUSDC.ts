/**
 * This script deploys the MockUSDC contract.
 *
 * Usage:
 * 1. Make sure the network configuration in hardhat.config.ts is correct.
 * 2. Run the script using the command: npx hardhat run --network <network_name> deploy/deployUSDC.ts
 *
 * The script will output the address of the deployed MockUSDC contract.
 */
// import { DeployFunction } from "hardhat-deploy/types";
// import { HardhatRuntimeEnvironment } from "hardhat/types";

// const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//   const { deployer } = await hre.getNamedAccounts();
//   const { deploy } = hre.deployments;

//   let usdcToken;
//   if (hre.network.name === "sepolia") {
//     usdcToken = await deploy("MockUSDC", {
//       from: deployer,
//       log: true,
//       args: [1000000000],
//     });
//   }

//   console.log(`MockUSDC contract: `, usdcToken.address);
// };
// export default func;
// func.id = "deploy_mockusdc"; // id required to prevent reexecution
// func.tags = ["MockUSDC"];
