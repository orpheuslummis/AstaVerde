import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// This is for local test deployment.

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // First, we deploy an ERC20 representing our "USDC" token
  const usdcToken = await deploy("MockUSDC", {
    from: deployer,
    log: true,
    args: [1000000000],
  });

  const astaVerde = await deploy("AstaVerde", {
    from: deployer,
    log: true,
    args: [deployer, usdcToken.address],
  });

  console.log(`AstaVerde contract: `, astaVerde.address);
};
export default func;
func.id = "deploy_astaverde"; // id required to prevent reexecution
func.tags = ["AstaVerde"];
