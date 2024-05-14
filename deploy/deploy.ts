import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log("Starting deployment...");
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("Network name: ", hre.network.name);

  let usdcTokenAddress = process.env.USDC_ADDRESS;
  if (hre.network.name === "hardhat") {
    console.log("Deploying Mock USDC for local testing...");
    const usdcToken = await deploy("MockUSDC", {
      from: deployer,
      log: true,
      args: [1000000000], // Set an initial supply for the mock token
    });
    usdcTokenAddress = usdcToken.address;
    console.log("Mock USDC token deployed at: ", usdcTokenAddress);
  } else if (!usdcTokenAddress) {
    throw new Error(
      "USDC_ADDRESS missing. USDC token address is required for deployment on " +
        hre.network.name,
    );
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
