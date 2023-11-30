import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// This is a script for local test deployment and Sepolia deployment.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log("Starting deployment...");
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  let usdcTokenAddress = process.env.USDC_ADDRESS;
  let usdcToken;

  if (!usdcTokenAddress) {
    console.log("USDC token address not found.");
    // For local test deployment, we deploy a mock USDC token
    usdcToken = await deploy("MockUSDC", {
      from: deployer,
      log: true,
      args: [1000000000],
    });
    usdcTokenAddress = usdcToken.address;
    console.log("Mock USDC token deployed at: ", usdcTokenAddress);
  }

  const astaVerde = await deploy("AstaVerde", {
    from: deployer,
    log: true,
    args: [deployer, usdcTokenAddress],
  });

  console.log(`AstaVerde contract deployed at: `, astaVerde.address);
};
export default func;
func.id = "deploy_astaverde"; // id required to prevent reexecution
func.tags = ["AstaVerde"];
