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
 * 3. StabilizedCarbonCoin (SCC) Contract (v2)
 *    - ERC-20 debt token for vault system
 *    - Only deployed on test networks for now
 *
 * 4. EcoStabilizer Vault Contract (v2)
 *    - Vault for NFT collateralization
 *    - Requires AstaVerde and SCC addresses
 *    - Only deployed on test networks for now
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

    // Fail before anything is deployed: with the vault enabled on a fresh AstaVerde, the deployer
    // must own AstaVerde to call setTrustedVault, and it would otherwise only find out after the
    // irreversible SCC admin renounce. Deploy with OWNER_ADDRESS empty, then run npm run handoff.
    {
        const vaultWillDeploy =
            network.name === "hardhat" ||
            network.name === "localhost" ||
            network.name.includes("sepolia") ||
            process.env.DEPLOY_VAULT_V2 === "true";
        const freshAstaVerde = process.env.USE_EXISTING_ASTAVERDE !== "true";
        if (vaultWillDeploy && freshAstaVerde && ownerAddress.toLowerCase() !== deployer.toLowerCase()) {
            throw new Error(
                "OWNER_ADDRESS differs from the deployer. Deploy with OWNER_ADDRESS empty (the deployer sets " +
                    "trustedVault), then hand over with npm run handoff. Nothing was deployed.",
            );
        }
    }

    const provider = hre.ethers.provider;
    const nonce = await provider.getTransactionCount(deployer);
    const pendingNonce = await provider.getTransactionCount(deployer, "pending");

    console.log(`Current nonce: ${nonce}, Pending nonce: ${pendingNonce}`);

    // Number of confirmations to wait for after each transaction. Defaults to 1 (the previous
    // hard-coded value); raise it on L1 (e.g. DEPLOY_WAIT_CONFIRMATIONS=2) so dependent reads
    // such as the SCC MINTER_ROLE check below do not race a reorg-prone head block.
    const waitConfirmations = Math.max(1, Number(process.env.DEPLOY_WAIT_CONFIRMATIONS) || 1);

    const feeData = await provider.getFeeData();

    console.log("Current fee data:", {
        gasPrice: feeData.gasPrice ? `${ethers.formatUnits(feeData.gasPrice, "gwei")} gwei` : "N/A",
        maxFeePerGas: feeData.maxFeePerGas ? `${ethers.formatUnits(feeData.maxFeePerGas, "gwei")} gwei` : "N/A",
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            ? `${ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei")} gwei`
            : "N/A",
    });

    // EIP-1559 fees for every transaction this script sends: 120% of the RPC's suggestion. On Ethereum
    // mainnet the tip is clamped to [0.1, 1] gwei: RPCs there suggest anything from 0 to a few thousand
    // wei, which can leave a deploy pending (no timeouts here), and a suggestion of exactly 0 used to
    // hit the 2 gwei fallback (0n is falsy). The floor costs ~0.0007 ETH over 7M gas.
    const chainId = Number((await provider.getNetwork()).chainId);
    const gwei = (v: string) => ethers.parseUnits(v, "gwei");
    const minPriorityFee = chainId === 1 ? gwei(process.env.DEPLOY_MIN_PRIORITY_FEE_GWEI || "0.1") : 0n;
    const maxPriorityFee = chainId === 1 ? gwei(process.env.DEPLOY_MAX_PRIORITY_FEE_GWEI || "1") : null;
    const feeOverrides = async () => {
        const latestFeeData = await provider.getFeeData();
        let maxPriorityFeePerGas =
            latestFeeData.maxPriorityFeePerGas != null
                ? (latestFeeData.maxPriorityFeePerGas * 120n) / 100n // 120% of the current maxPriorityFeePerGas
                : chainId === 1
                  ? minPriorityFee
                  : gwei("2"); // fallback when the RPC gives no suggestion
        if (maxPriorityFeePerGas < minPriorityFee) maxPriorityFeePerGas = minPriorityFee;
        if (maxPriorityFee !== null && maxPriorityFeePerGas > maxPriorityFee) maxPriorityFeePerGas = maxPriorityFee;
        let maxFeePerGas =
            latestFeeData.maxFeePerGas != null
                ? (latestFeeData.maxFeePerGas * 120n) / 100n // 120% of the current maxFeePerGas
                : gwei("30"); // fallback when the RPC gives no suggestion
        const baseFee = (await provider.getBlock("latest"))?.baseFeePerGas ?? 0n;
        if (maxFeePerGas < baseFee * 2n + maxPriorityFeePerGas) maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
        return { maxFeePerGas, maxPriorityFeePerGas };
    };

    const waitForCode = async (address: string, label: string) => {
        const maxMs = 30000;
        const start = Date.now();
        let attempts = 0;
        while (Date.now() - start < maxMs) {
            const code = await provider.getCode(address);
            if (code && code !== "0x") return true;
            attempts += 1;
            await new Promise((r) => setTimeout(r, 1000));
        }
        console.warn(`Timed out waiting for code at ${label} ${address}`);
        return false;
    };

    const deployContract = async (contractName: string, args: unknown[]) => {
        console.log(`Deploying ${contractName}...`);
        console.log("Constructor arguments:", args);

        try {
            // Fresh fees before each deployment (see feeOverrides)
            const { maxFeePerGas, maxPriorityFeePerGas } = await feeOverrides();

            console.log(`Deploying ${contractName} with gas settings:`, {
                maxFeePerGas: `${ethers.formatUnits(maxFeePerGas, "gwei")} gwei`,
                maxPriorityFeePerGas: `${ethers.formatUnits(maxPriorityFeePerGas, "gwei")} gwei`,
            });

            const result = await deploy(contractName, {
                from: deployer,
                args: args,
                log: true,
                waitConfirmations,
                maxFeePerGas: maxFeePerGas.toString(),
                maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
            });

            console.log(`${contractName} deployed at:`, result.address);

            // Ensure the node exposes bytecode before making static calls (some RPCs lag)
            await waitForCode(result.address, contractName);

            if (contractName === "AstaVerde") {
                const contract = await hre.ethers.getContractAt(contractName, result.address);
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
                    console.log(`- Token IDs: ${batchInfo[1].map((id) => id.toString())}`);
                    console.log(`- Creation Time: ${batchInfo[2].toString()}`);
                    console.log(`- Current Price: ${batchInfo[3].toString()}`);
                    console.log(`- Remaining Tokens: ${batchInfo[4].toString()}`);
                } catch (error) {
                    // If batch 1 doesn't exist, this is expected for a fresh deployment
                    console.log("No existing batches (this is normal for fresh deployments)");
                }
            }

            if (contractName === "MockUSDC") {
                try {
                    const contract = await hre.ethers.getContractAt(contractName, result.address);
                    console.log("\nVerifying MockUSDC contract state:");
                    const ts = await contract.totalSupply();
                    console.log(`- Total Supply: ${ts.toString()}`);
                    console.log(`- Decimals: ${await contract.decimals()}`);
                } catch (e: any) {
                    console.warn("Verification note (MockUSDC): read failed; continuing. Details:");
                    console.warn(e?.message || e);
                }
            }

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
            console.error(`\nDetailed error deploying ${contractName}:`);
            if (error instanceof Error) {
                console.error(`- Message: ${error.message}`);
                console.error(`- Stack: ${error.stack}`);
            }

            if (contractName === "AstaVerde") {
                console.error("\nPossible issues:");
                console.error("- Check if USDC address is valid");
                console.error("- Check if owner address is valid");
                console.error("- Check if deployer has enough funds for deployment");
            }

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
    const mockSupportedChainIds = new Set([31337, 84532, 11155111, 421614]); // Hardhat, Base Sepolia, Ethereum Sepolia, Arbitrum Sepolia
    const currentChainId = Number(network.config?.chainId ?? 0);
    const canDeployMockUSDC = mockSupportedChainIds.has(currentChainId);

    if (canDeployMockUSDC) {
        console.log("\nDeploying MockUSDC for test network...");
        const initialSupply = ethers.parseUnits("1000000", 6);
        console.log(`Initial supply: ${initialSupply} (${ethers.formatUnits(initialSupply, 6)} USDC)`);

        const mockUSDC = await deployContract("MockUSDC", [initialSupply]);
        usdcTokenAddress = mockUSDC.address;
    } else {
        const nativeUsdcAddresses: Record<string, string> = {
            "arbitrum-one": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "arbitrum-sepolia": "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
            "ethereum-mainnet": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        };

        const resolvedUsdcAddress = process.env.USDC_ADDRESS || nativeUsdcAddresses[network.name];

        if (!resolvedUsdcAddress || !ethers.isAddress(resolvedUsdcAddress)) {
            throw new Error(
                `Invalid or missing USDC address for ${network.name}. ` +
                    "Set USDC_ADDRESS in your environment or update the native address mapping.",
            );
        }
        usdcTokenAddress = resolvedUsdcAddress;
        console.log("Using existing USDC at address:", usdcTokenAddress);

        // Verify USDC has 6 decimals
        // A wrong-decimals token must abort the deploy; only an unreadable decimals() is a warning.
        let usdcDecimals: bigint | undefined;
        try {
            const usdcContract = await hre.ethers.getContractAt("IERC20Metadata", usdcTokenAddress);
            usdcDecimals = await usdcContract.decimals();
        } catch (error) {
            console.warn("Warning: Could not verify USDC decimals (contract may not implement decimals())");
        }
        if (usdcDecimals !== undefined) {
            if (usdcDecimals !== 6n) {
                throw new Error(`USDC token must have 6 decimals, found ${usdcDecimals}`);
            }
            console.log("✓ USDC decimals verified: 6");
        }
    }

    // Optionally reuse an existing AstaVerde (e.g., live Phase 1 on Base mainnet)
    const useExistingAV = process.env.USE_EXISTING_ASTAVERDE === "true";
    const existingAV = process.env.AV_ADDR;

    let astaVerdeAddress: string | undefined;
    if (useExistingAV) {
        if (!existingAV || !ethers.isAddress(existingAV)) {
            throw new Error(
                "USE_EXISTING_ASTAVERDE=true set but AV_ADDR is missing or invalid. Provide AV_ADDR=0x... to continue.",
            );
        }
        // Basic sanity check: code must exist at AV_ADDR
        const code = await provider.getCode(existingAV);
        if (!code || code === "0x") {
            throw new Error(`AV_ADDR ${existingAV} has no contract code on ${network.name}`);
        }
        console.log("\nUsing existing AstaVerde contract:");
        console.log(`- Address: ${existingAV}`);
        astaVerdeAddress = existingAV;
    } else {
        console.log("\nDeploying AstaVerde main contract...");
        console.log(`- Owner Address: ${ownerAddress}`);
        console.log(`- USDC Address: ${usdcTokenAddress}`);

        const astaVerde = await deployContract("AstaVerde", [ownerAddress, usdcTokenAddress]);
        astaVerdeAddress = astaVerde.address;

        console.log("AstaVerde deployed with owner:", ownerAddress);
    }

    // Deploy v2 vault contracts
    // Testnets: always deploy. Mainnet: deploy when explicitly enabled via DEPLOY_VAULT_V2=true
    const enableV2OnProd = process.env.DEPLOY_VAULT_V2 === "true";
    const shouldDeployV2 =
        network.name === "hardhat" ||
        network.name === "localhost" ||
        network.name.includes("sepolia") ||
        enableV2OnProd;

    if (shouldDeployV2) {
        console.log("\n=== Deploying v2 Vault Contracts ===");

        // Deploy StabilizedCarbonCoin (SCC)
        // Pass address(0) as vault initially, will grant MINTER_ROLE after vault deployment
        console.log("\nDeploying StabilizedCarbonCoin (SCC)...");
        const scc = await deployContract("StabilizedCarbonCoin", [ethers.ZeroAddress]);

        // Deploy EcoStabilizer vault
        if (!astaVerdeAddress) {
            throw new Error("Internal error: AstaVerde address not resolved");
        }
        console.log("\nDeploying EcoStabilizer vault...");
        console.log(`- AstaVerde Address: ${astaVerdeAddress}`);
        console.log(`- SCC Address: ${scc.address}`);
        const vault = await deployContract("EcoStabilizer", [astaVerdeAddress, scc.address]);

        // Grant MINTER_ROLE to vault
        console.log("\nConfiguring SCC minter role...");
        const sccContract = await hre.ethers.getContractAt("StabilizedCarbonCoin", scc.address);
        const MINTER_ROLE = await sccContract.MINTER_ROLE();
        const grantTx = await sccContract.grantRole(MINTER_ROLE, vault.address, await feeOverrides());
        await grantTx.wait(waitConfirmations);
        console.log(`✓ Granted MINTER_ROLE to vault at ${vault.address}`);

        // Optional: Renounce SCC admin role on production after guards pass
        const wantRenounce = process.env.RENOUNCE_SCC_ADMIN === "true";
        if (
            wantRenounce &&
            !(network.name === "hardhat" || network.name === "localhost" || network.name.includes("sepolia"))
        ) {
            console.log("\nRenouncing SCC DEFAULT_ADMIN_ROLE (production hardening)...");
            const DEFAULT_ADMIN_ROLE = await sccContract.DEFAULT_ADMIN_ROLE();
            const hasMinter = await sccContract.hasRole(MINTER_ROLE, vault.address);
            if (!hasMinter) {
                throw new Error("Abort: Vault missing MINTER_ROLE — will not renounce admin");
            }
            const isAdmin = await sccContract.hasRole(DEFAULT_ADMIN_ROLE, deployer);
            if (isAdmin) {
                const tx = await sccContract.renounceRole(DEFAULT_ADMIN_ROLE, deployer, await feeOverrides());
                await tx.wait();
                console.log("✓ SCC admin role renounced by deployer");
            } else {
                console.log("✓ SCC admin already renounced");
            }
        }

        // Verify vault configuration
        const vaultContract = await hre.ethers.getContractAt("EcoStabilizer", vault.address);
        const vaultAstaVerde = await vaultContract.ecoAsset();
        const vaultSCC = await vaultContract.scc();
        console.log("\nVault configuration verified:");
        console.log(`- AstaVerde contract: ${vaultAstaVerde}`);
        console.log(`- SCC contract: ${vaultSCC}`);

        // Register the vault on AstaVerde so users can reclaim collateral even while the
        // marketplace is paused. Owner-only, so it must happen while the deployer is still owner.
        if (useExistingAV) {
            console.warn(
                "\n⚠️  USE_EXISTING_ASTAVERDE: call setTrustedVault(" + vault.address + ") from the AstaVerde owner.",
            );
        } else if (ownerAddress.toLowerCase() === deployer.toLowerCase()) {
            const avForVault = await hre.ethers.getContractAt("AstaVerde", astaVerdeAddress);
            const tvTx = await avForVault.setTrustedVault(vault.address, await feeOverrides());
            await tvTx.wait(waitConfirmations);
            const tv = await avForVault.trustedVault();
            if (tv.toLowerCase() !== vault.address.toLowerCase()) {
                throw new Error(`setTrustedVault failed: trustedVault() is ${tv}`);
            }
            console.log(`✓ AstaVerde.trustedVault = ${tv}`);
        } else {
            throw new Error(
                "OWNER_ADDRESS differs from the deployer, so the deployer cannot call setTrustedVault. " +
                    "Deploy with OWNER_ADDRESS empty, then hand over with npm run handoff.",
            );
        }

        // EcoStabilizer is Ownable(msg.sender): the deployer owns it. Hand it to the configured
        // owner when one is set, so AstaVerde and the vault end up under the same owner.
        if (ownerAddress.toLowerCase() !== deployer.toLowerCase()) {
            console.log(`\nTransferring EcoStabilizer ownership to ${ownerAddress}...`);
            const transferTx = await vaultContract.transferOwnership(ownerAddress, await feeOverrides());
            await transferTx.wait(waitConfirmations);
            const newVaultOwner = await vaultContract.owner();
            if (newVaultOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
                throw new Error(`Vault ownership transfer failed: owner() is ${newVaultOwner}`);
            }
            console.log(`✓ EcoStabilizer owner is now ${newVaultOwner}`);
        } else {
            console.log(
                "\nEcoStabilizer owner is the deployer (no OWNER_ADDRESS set); hand over later with npm run handoff",
            );
        }

        console.log("\n✅ v2 Vault contracts deployed successfully!");
        console.log(`- SCC: ${scc.address}`);
        console.log(`- EcoStabilizer: ${vault.address}`);
    }

    console.log("\nDeployment completed successfully");
};

deployFunc.tags = ["AstaVerde", "MockUSDC", "StabilizedCarbonCoin", "EcoStabilizer"];
export default deployFunc;
