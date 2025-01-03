/**
 * Deployment Script: AstaVerde Smart Contracts
 * ==========================================
 *
 * PURPOSE:
 * Automated deployment script that handles the deployment of all AstaVerde smart contracts
 * using the hardhat-deploy plugin.
 *
 * CONTRACTS DEPLOYED:
 * 1. MockUSDC Contract
 *    - Only deployed on test networks (hardhat, localhost, sepolia)
 *    - Initial supply: 1,000,000 USDC (6 decimals)
 *
 * 2. AstaVerde Main Contract
 *    - Deployed on all networks
 *    - Requires USDC contract address
 *    - Requires owner address
 *
 * NETWORK HANDLING:
 * - Test Networks (hardhat, localhost, sepolia):
 *   → Deploys MockUSDC automatically
 *   → Uses deployed MockUSDC address for AstaVerde contract
 *
 * - Production Networks (mainnet, etc.):
 *   → Requires USDC_ADDRESS environment variable
 *   → Uses existing USDC contract address
 *
 * GAS OPTIMIZATION:
 * - Automatically sets gas prices to 120% of current network prices
 * - Fallback values if network data unavailable:
 *   → maxFeePerGas: 30 gwei
 *   → maxPriorityFeePerGas: 2 gwei
 *
 * CONTRACT VERIFICATION:
 * - Automatically verifies contracts on block explorers
 * - Skips verification on local networks (hardhat, localhost)
 * - Handles "already verified" cases
 *
 * REQUIRED ENVIRONMENT VARIABLES:
 * USDC_ADDRESS=0x...  # Required for production networks only
 *
 * CONFIGURATION:
 * Owner Address Selection:
 * 1. First checks deploymentConfig.ownerAddress in hardhat.config
 *    Example in hardhat.config.ts:
 *    ```
 *    deploymentConfig: {
 *      ownerAddress: "0x123..." // The desired owner address
 *    }
 *    ```
 * 2. If deploymentConfig.ownerAddress is undefined or empty, uses the deployer address
 *    The deployer address comes from the named accounts in hardhat.config.ts:
 *    ```
 *    namedAccounts: {
 *      deployer: {
 *        default: 0, // First account in the wallet
 *        // Or specific addresses per network:
 *        mainnet: "0x456..."
 *      }
 *    }
 *    ```
 *
 * USAGE:
 * # Local deployment
 * npx hardhat deploy
 *
 * # Network-specific deployment
 * npx hardhat deploy --network sepolia
 * npx hardhat deploy --network mainnet
 *
 * ERROR HANDLING:
 * - Provides detailed error logs including:
 *   → Current nonce state
 *   → Gas price data
 *   → Full error stack traces
 */

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
    const pendingNonce = await provider.getTransactionCount(
        deployer,
        "pending",
    );

    console.log(`Current nonce: ${nonce}, Pending nonce: ${pendingNonce}`);

    const feeData = await provider.getFeeData();

    console.log("Current fee data:", {
        gasPrice: feeData.gasPrice
            ? `${ethers.formatUnits(feeData.gasPrice, "gwei")} gwei`
            : "N/A",
        maxFeePerGas: feeData.maxFeePerGas
            ? `${ethers.formatUnits(feeData.maxFeePerGas, "gwei")} gwei`
            : "N/A",
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            ? `${ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei")} gwei`
            : "N/A",
    });

    const deployContract = async (contractName: string, args: unknown[]) => {
        console.log(`Deploying ${contractName}...`);
        console.log("Constructor arguments:", args);

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
                maxFeePerGas: `${
                    ethers.formatUnits(maxFeePerGas, "gwei")
                } gwei`,
                maxPriorityFeePerGas: `${
                    ethers.formatUnits(maxPriorityFeePerGas, "gwei")
                } gwei`,
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

            if (contractName === "AstaVerde") {
                const contract = await hre.ethers.getContractAt(
                    contractName,
                    result.address,
                );
                console.log("\nVerifying AstaVerde contract state:");

                // Convert BigInt values to strings or numbers for logging
                const owner = await contract.owner();
                const usdcToken = await contract.usdcToken();
                const basePrice = await contract.basePrice();
                const platformShare = await contract.platformSharePercentage();
                const maxBatchSize = await contract.maxBatchSize();

                console.log(`- Owner: ${owner}`);
                console.log(`- USDC Token: ${usdcToken}`);
                console.log(`- Base Price: ${basePrice.toString()}`);
                console.log(`- Platform Share: ${platformShare.toString()}%`);
                console.log(`- Max Batch Size: ${maxBatchSize.toString()}`);

                // Add additional verification for batch functionality
                try {
                    // Test batch retrieval for batch ID 1 (if it exists)
                    const batchInfo = await contract.getBatchInfo(1);
                    console.log("\nTest Batch Info (ID 1):");
                    console.log(`- Batch ID: ${batchInfo[0].toString()}`);
                    console.log(
                        `- Token IDs: ${
                            batchInfo[1].map((id) => id.toString())
                        }`,
                    );
                    console.log(`- Creation Time: ${batchInfo[2].toString()}`);
                    console.log(`- Current Price: ${batchInfo[3].toString()}`);
                    console.log(
                        `- Remaining Tokens: ${batchInfo[4].toString()}`,
                    );
                } catch (error) {
                    // If batch 1 doesn't exist, this is expected for a fresh deployment
                    console.log(
                        "No existing batches (this is normal for fresh deployments)",
                    );
                }
            }

            if (contractName === "MockUSDC") {
                const contract = await hre.ethers.getContractAt(
                    contractName,
                    result.address,
                );
                console.log("\nVerifying MockUSDC contract state:");
                console.log(`- Total Supply: ${await contract.totalSupply()}`);
                console.log(`- Decimals: ${await contract.decimals()}`);
            }

            if (network.name !== "hardhat" && network.name !== "localhost") {
                console.log("Verifying contract...");
                try {
                    await hre.run("verify:verify", {
                        address: result.address,
                        constructorArguments: args,
                        contract:
                            `contracts/${contractName}.sol:${contractName}`,
                    });
                    console.log("Contract verified successfully");
                } catch (error: unknown) {
                    if (
                        error instanceof Error &&
                        error.message.toLowerCase().includes("already verified")
                    ) {
                        console.log("Contract is already verified");
                    } else {
                        console.error("Error verifying contract:", error);
                        console.error(
                            "Error details:",
                            JSON.stringify(error, null, 2),
                        );
                    }
                }
            }

            return result;
        } catch (error) {
            console.error(`\nDetailed error deploying ${contractName}:`);
            if (error instanceof Error) {
                console.error(`- Message: ${error.message}`);
                console.error(`- Stack: ${error.stack}`);
            }

            if (contractName === "AstaVerde") {
                console.error("\nPossible issues:");
                console.error("- Check if USDC address is valid");
                console.error("- Check if owner address is valid");
                console.error(
                    "- Check if deployer has enough funds for deployment",
                );
            }

            // Log the current nonce and fee data again
            const currentNonce = await provider.getTransactionCount(deployer);
            const currentPendingNonce = await provider.getTransactionCount(
                deployer,
                "pending",
            );
            console.log(
                `Nonce after error: ${currentNonce}, Pending nonce after error: ${currentPendingNonce}`,
            );

            const currentFeeData = await provider.getFeeData();
            console.log("Fee data after error:", {
                gasPrice: currentFeeData.gasPrice
                    ? `${
                        ethers.formatUnits(currentFeeData.gasPrice, "gwei")
                    } gwei`
                    : "N/A",
                maxFeePerGas: currentFeeData.maxFeePerGas
                    ? `${
                        ethers.formatUnits(currentFeeData.maxFeePerGas, "gwei")
                    } gwei`
                    : "N/A",
                maxPriorityFeePerGas: currentFeeData.maxPriorityFeePerGas
                    ? `${
                        ethers.formatUnits(
                            currentFeeData.maxPriorityFeePerGas,
                            "gwei",
                        )
                    } gwei`
                    : "N/A",
            });
            throw error;
        }
    };

    let usdcTokenAddress: string;

    if (
        network.name === "hardhat" || network.name === "localhost" ||
        network.name.includes("sepolia")
    ) {
        console.log("\nDeploying MockUSDC for test network...");
        const initialSupply = ethers.parseUnits("1000000", 6);
        console.log(
            `Initial supply: ${initialSupply} (${
                ethers.formatUnits(initialSupply, 6)
            } USDC)`,
        );

        const mockUSDC = await deployContract("MockUSDC", [initialSupply]);
        usdcTokenAddress = mockUSDC.address;
    } else {
        const envUsdcAddress = process.env.USDC_ADDRESS;
        if (!envUsdcAddress || !ethers.isAddress(envUsdcAddress)) {
            throw new Error(
                "Invalid USDC_ADDRESS in the environment for this network",
            );
        }
        usdcTokenAddress = envUsdcAddress;
        console.log("Using existing USDC at address:", usdcTokenAddress);
    }

    console.log("\nDeploying AstaVerde main contract...");
    console.log(`- Owner Address: ${ownerAddress}`);
    console.log(`- USDC Address: ${usdcTokenAddress}`);

    await deployContract("AstaVerde", [ownerAddress, usdcTokenAddress]);

    console.log("AstaVerde deployed with owner:", ownerAddress);
    console.log("Deployment completed successfully");
};

deployFunc.tags = ["AstaVerde", "MockUSDC"];
export default deployFunc;
