import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log("Starting deployment...");
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("Network name: ", hre.network.name);

  let usdcTokenAddress = process.env.USDC_ADDRESS;
  if (!usdcTokenAddress) {
    throw new Error("USDC_ADDRESS is not set in the environment");
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