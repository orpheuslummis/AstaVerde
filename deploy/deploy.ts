import { ethers } from "ethers";
import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { deploymentConfig } from "../hardhat.config";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    console.log("Deploying contracts with account:", deployer);
    console.log("Network:", network.name);

    // Use the deployer address if ownerAddress is not set in the config
    const ownerAddress = deploymentConfig.ownerAddress || deployer;
    console.log("Owner address:", ownerAddress);

    const provider = hre.ethers.provider;
    const nonce = await provider.getTransactionCount(deployer);
    const pendingNonce = await provider.getTransactionCount(deployer, "pending");

    console.log(`Current nonce: ${nonce}, Pending nonce: ${pendingNonce}`);

    const feeData = await provider.getFeeData();

    console.log("Current fee data:", {
        gasPrice: feeData.gasPrice ? `${ethers.formatUnits(feeData.gasPrice, "gwei")} gwei` : "N/A",
        maxFeePerGas: feeData.maxFeePerGas ? `${ethers.formatUnits(feeData.maxFeePerGas, "gwei")} gwei` : "N/A",
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            ? `${ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei")} gwei`
            : "N/A",
    });

    const deployContract = async (contractName: string, args: unknown[]) => {
        console.log(`Deploying ${contractName}...`);

        try {
            // Get the latest fee data before each deployment
            const latestFeeData = await provider.getFeeData();
            
            // Calculate a slightly higher maxFeePerGas and maxPriorityFeePerGas
            const maxFeePerGas = latestFeeData.maxFeePerGas
                ? latestFeeData.maxFeePerGas * 120n / 100n // 120% of the current maxFeePerGas
                : ethers.parseUnits("30", "gwei"); // fallback to 30 gwei if maxFeePerGas is null
            
            const maxPriorityFeePerGas = latestFeeData.maxPriorityFeePerGas
                ? latestFeeData.maxPriorityFeePerGas * 120n / 100n // 120% of the current maxPriorityFeePerGas
                : ethers.parseUnits("2", "gwei"); // fallback to 2 gwei if maxPriorityFeePerGas is null

            console.log(`Deploying ${contractName} with gas settings:`, {
                maxFeePerGas: ethers.formatUnits(maxFeePerGas, "gwei") + " gwei",
                maxPriorityFeePerGas: ethers.formatUnits(maxPriorityFeePerGas, "gwei") + " gwei",
            });

            const result = await deploy(contractName, {
                from: deployer,
                args: args,
                log: true,
                waitConfirmations: 1,
                maxFeePerGas: maxFeePerGas.toString(),
                maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
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
                } catch (error: unknown) {
                    if (error instanceof Error && error.message.toLowerCase().includes("already verified")) {
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
                    ? `${ethers.formatUnits(currentFeeData.gasPrice, "gwei")} gwei`
                    : "N/A",
                maxFeePerGas: currentFeeData.maxFeePerGas
                    ? `${ethers.formatUnits(currentFeeData.maxFeePerGas, "gwei")} gwei`
                    : "N/A",
                maxPriorityFeePerGas: currentFeeData.maxPriorityFeePerGas
                    ? `${ethers.formatUnits(currentFeeData.maxPriorityFeePerGas, "gwei")} gwei`
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
        const envUsdcAddress = process.env.USDC_ADDRESS;
        if (!envUsdcAddress || !ethers.isAddress(envUsdcAddress)) {
            throw new Error("Invalid USDC_ADDRESS in the environment for this network");
        }
        usdcTokenAddress = envUsdcAddress;
        console.log("Using existing USDC at address:", usdcTokenAddress);
    }

    // Use the ownerAddress variable instead of deploymentConfig.ownerAddress
    await deployContract("AstaVerde", [ownerAddress, usdcTokenAddress]);

    console.log("AstaVerde deployed with owner:", ownerAddress);
    console.log("Deployment completed successfully");
};

deployFunc.tags = ["AstaVerde", "MockUSDC"];
export default deployFunc;
