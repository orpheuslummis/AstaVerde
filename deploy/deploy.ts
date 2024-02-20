import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log("Starting deployment...");
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("Network name: ", hre.network.name);

  let usdcTokenAddress = process.env.USDC_ADDRESS;
  if (hre.network.name === "mainnet" && !usdcTokenAddress) {
    throw new Error("USDC_ADDRESS missing. USDC token address is required for Mainnet deployment.");
  }
  if (!usdcTokenAddress) {
    console.log("USDC token address not found.");
    // For local test deployment, we deploy a mock USDC token
    const usdcToken = await deploy("MockUSDC", {
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
deployFunc.id = "deploy_astaverde"; // id required to prevent reexecution
deployFunc.tags = ["AstaVerde"];
export default deployFunc;