import { ethers } from "ethers";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { deploymentConfig } from "../hardhat.config";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    console.log("Deploying contracts with account:", deployer);
    console.log("Network:", network.name);
    console.log("Owner address:", deploymentConfig.ownerAddress);

    const provider = hre.ethers.provider;
    const nonce = await provider.getTransactionCount(deployer);
    const pendingNonce = await provider.getTransactionCount(deployer, "pending");
    console.log(`Current nonce: ${nonce}, Pending nonce: ${pendingNonce}`);

    const feeData = await provider.getFeeData();
    console.log("Current fee data:", {
        gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") + " gwei" : "N/A",
        maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") + " gwei" : "N/A",
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") + " gwei"
            : "N/A",
    });

    const deployContract = async (contractName: string, args: any[]) => {
        console.log(`Deploying ${contractName}...`);

        try {
            const result = await deploy(contractName, {
                from: deployer,
                args: args,
                log: true,
                waitConfirmations: 1,
                maxFeePerGas: ethers.parseUnits("10", "gwei").toString(),
                maxPriorityFeePerGas: ethers.parseUnits("2", "gwei").toString(),
            });

            console.log(`${contractName} deployed at:`, result.address);

            if (network.name !== "hardhat" && network.name !== "localhost") {
                console.log("Verifying contract...");
                try {
                    await hre.run("verify:verify", {
                        address: result.address,
                        constructorArguments: args,
                        contract: `contracts/${contractName}.sol:${contractName}`,
                    });
                    console.log("Contract verified successfully");
                } catch (error: any) {
                    if (error.message.toLowerCase().includes("already verified")) {
                        console.log("Contract is already verified");
                    } else {
                        console.error("Error verifying contract:", error);
                        console.error("Error details:", JSON.stringify(error, null, 2));
                    }
                }
            }

            return result;
        } catch (error) {
            console.error(`Error deploying ${contractName}:`, error);
            // Log the current nonce and fee data again
            const currentNonce = await provider.getTransactionCount(deployer);
            const currentPendingNonce = await provider.getTransactionCount(deployer, "pending");
            console.log(`Nonce after error: ${currentNonce}, Pending nonce after error: ${currentPendingNonce}`);

            const currentFeeData = await provider.getFeeData();
            console.log("Fee data after error:", {
                gasPrice: currentFeeData.gasPrice
                    ? ethers.formatUnits(currentFeeData.gasPrice, "gwei") + " gwei"
                    : "N/A",
                maxFeePerGas: currentFeeData.maxFeePerGas
                    ? ethers.formatUnits(currentFeeData.maxFeePerGas, "gwei") + " gwei"
                    : "N/A",
                maxPriorityFeePerGas: currentFeeData.maxPriorityFeePerGas
                    ? ethers.formatUnits(currentFeeData.maxPriorityFeePerGas, "gwei") + " gwei"
                    : "N/A",
            });
            throw error;
        }
    };

    let usdcTokenAddress: string;

    if (network.name === "hardhat" || network.name === "localhost" || network.name.includes("sepolia")) {
        const mockUSDC = await deployContract("MockUSDC", [ethers.parseUnits("1000000", 6)]);
        usdcTokenAddress = mockUSDC.address;
    } else {
        usdcTokenAddress = process.env.USDC_ADDRESS!;
        if (!ethers.isAddress(usdcTokenAddress)) {
            throw new Error("Invalid USDC_ADDRESS in the environment for this network");
        }
        console.log("Using existing USDC at address:", usdcTokenAddress);
    }

    // Use the owner address from the deployment config
    await deployContract("AstaVerde", [deploymentConfig.ownerAddress, usdcTokenAddress]);

    console.log("AstaVerde deployed with owner:", deploymentConfig.ownerAddress);
    console.log("Deployment completed successfully");
};

deployFunc.tags = ["AstaVerde", "MockUSDC"];
export default deployFunc;
