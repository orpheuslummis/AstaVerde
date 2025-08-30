#!/usr/bin/env node

/**
 * Deploy Script with ABI Validation
 * ==================================
 *
 * Ensures contracts are properly compiled and ABIs are generated before deployment
 * Works for all networks: localhost, sepolia, mainnet
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Parse command line arguments
const args = process.argv.slice(2);
const networkIndex = args.findIndex((arg) => arg === "--network");
const network = networkIndex !== -1 && args[networkIndex + 1] ? args[networkIndex + 1] : "localhost";

console.log(`🚀 Starting deployment process for network: ${network}`);
console.log("═".repeat(60));

// Step 1: Clean and compile contracts
console.log("\n📦 Step 1: Cleaning and compiling contracts...");
try {
    execSync("npm run clean", { stdio: "inherit" });
    console.log("   ✅ Cleaned artifacts");

    execSync("npm run compile", { stdio: "inherit" });
    console.log("   ✅ Contracts compiled successfully");
} catch (error) {
    console.error("❌ Compilation failed:", error.message);
    process.exit(1);
}

// Step 2: Validate ABI files exist
console.log("\n🔍 Step 2: Validating ABI files...");
const requiredABIs = [
    "artifacts/contracts/AstaVerde.sol/AstaVerde.json",
    "artifacts/contracts/EcoStabilizer.sol/EcoStabilizer.json",
    "artifacts/contracts/StabilizedCarbonCoin.sol/StabilizedCarbonCoin.json",
];

let allABIsValid = true;
for (const abiPath of requiredABIs) {
    const fullPath = path.join(__dirname, "..", abiPath);
    if (fs.existsSync(fullPath)) {
        try {
            const artifact = JSON.parse(fs.readFileSync(fullPath, "utf8"));
            if (artifact.abi && Array.isArray(artifact.abi)) {
                // Check for critical functions
                const contractName = path.basename(abiPath, ".json");
                if (contractName === "EcoStabilizer") {
                    const hasGetUserLoansIndexed = artifact.abi.some(
                        (item) => item.type === "function" && item.name === "getUserLoansIndexed",
                    );
                    if (!hasGetUserLoansIndexed) {
                        console.error(`   ❌ ${contractName}: Missing getUserLoansIndexed function in ABI`);
                        allABIsValid = false;
                    } else {
                        console.log(`   ✅ ${contractName}: ABI valid with getUserLoansIndexed`);
                    }
                } else {
                    console.log(`   ✅ ${contractName}: ABI valid`);
                }
            } else {
                console.error(`   ❌ ${path.basename(abiPath)}: Invalid ABI structure`);
                allABIsValid = false;
            }
        } catch (error) {
            console.error(`   ❌ ${path.basename(abiPath)}: Failed to parse - ${error.message}`);
            allABIsValid = false;
        }
    } else {
        console.warn(`   ⚠️  ${path.basename(abiPath)}: File not found (may be optional)`);
    }
}

if (!allABIsValid) {
    console.error("\n❌ ABI validation failed. Please check your contracts and try again.");
    process.exit(1);
}

// Step 3: Deploy contracts
console.log(`\n🚀 Step 3: Deploying contracts to ${network}...`);
try {
    const deployCommand =
        network === "localhost" ? "npx hardhat deploy --network localhost" : `npx hardhat deploy --network ${network}`;

    execSync(deployCommand, { stdio: "inherit" });
    console.log("   ✅ Contracts deployed successfully");
} catch (error) {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
}

// Step 4: Copy ABIs to webapp (for local development)
if (network === "localhost") {
    console.log("\n📋 Step 4: Copying ABIs to webapp...");
    try {
        // Copy AstaVerde ABI
        const astaVerdeABI = JSON.parse(
            fs.readFileSync(path.join(__dirname, "../artifacts/contracts/AstaVerde.sol/AstaVerde.json"), "utf8"),
        );
        fs.writeFileSync(
            path.join(__dirname, "../webapp/src/config/AstaVerde.json"),
            JSON.stringify({ abi: astaVerdeABI.abi }, null, 2),
        );
        console.log("   ✅ AstaVerde ABI copied to webapp");

        // Copy deployment info to webapp config
        const deploymentInfo = {
            astaverde: JSON.parse(fs.readFileSync("deployments/localhost/AstaVerde.json")).address,
            usdc: JSON.parse(fs.readFileSync("deployments/localhost/MockUSDC.json")).address,
        };

        // Try to add vault contracts if they exist
        try {
            deploymentInfo.scc = JSON.parse(fs.readFileSync("deployments/localhost/StabilizedCarbonCoin.json")).address;
            deploymentInfo.ecostabilizer = JSON.parse(
                fs.readFileSync("deployments/localhost/EcoStabilizer.json"),
            ).address;
            console.log("   ✅ Vault contracts included");
        } catch {
            console.log("   ℹ️  Vault contracts not deployed");
        }

        // Update local-dev.json with addresses and ABIs
        const localDevConfig = {
            AstaVerde: {
                address: deploymentInfo.astaverde,
                abi: astaVerdeABI.abi,
            },
            MockUSDC: {
                address: deploymentInfo.usdc,
                abi: JSON.parse(
                    fs.readFileSync(
                        path.join(__dirname, "../artifacts/contracts/test/MockUSDC.sol/MockUSDC.json"),
                        "utf8",
                    ),
                ).abi,
            },
        };

        // Add vault contracts if available
        if (deploymentInfo.scc && deploymentInfo.ecostabilizer) {
            localDevConfig.StabilizedCarbonCoin = {
                address: deploymentInfo.scc,
                abi: JSON.parse(
                    fs.readFileSync(
                        path.join(
                            __dirname,
                            "../artifacts/contracts/StabilizedCarbonCoin.sol/StabilizedCarbonCoin.json",
                        ),
                        "utf8",
                    ),
                ).abi,
            };
            localDevConfig.EcoStabilizer = {
                address: deploymentInfo.ecostabilizer,
                abi: JSON.parse(
                    fs.readFileSync(
                        path.join(__dirname, "../artifacts/contracts/EcoStabilizer.sol/EcoStabilizer.json"),
                        "utf8",
                    ),
                ).abi,
            };
        }

        fs.writeFileSync(
            path.join(__dirname, "../webapp/src/config/local-dev.json"),
            JSON.stringify(localDevConfig, null, 2),
        );
        console.log("   ✅ Webapp configuration updated");
    } catch (error) {
        console.error("   ⚠️  Failed to copy some ABIs:", error.message);
    }
}

// Step 5: Post-deployment verification for testnet/mainnet
if (network !== "localhost" && network !== "hardhat") {
    console.log("\n✅ Step 5: Post-deployment tasks...");
    console.log("\n📝 Next steps:");
    console.log("1. Update webapp/.env.sepolia or webapp/.env with deployed addresses");
    console.log("2. Run contract verification if needed: npm run verify:contracts");
    console.log("3. Test the deployment: npm run qa:status");

    // Try to read and display deployed addresses
    try {
        const networkDir = `deployments/${network}`;
        if (fs.existsSync(networkDir)) {
            console.log("\n📍 Deployed addresses:");
            const files = fs.readdirSync(networkDir);
            for (const file of files) {
                if (file.endsWith(".json")) {
                    const deployment = JSON.parse(fs.readFileSync(path.join(networkDir, file), "utf8"));
                    console.log(`   ${file.replace(".json", "")}: ${deployment.address}`);
                }
            }
        }
    } catch (error) {
        console.log("   Could not read deployment addresses");
    }
}

console.log("\n" + "═".repeat(60));
console.log("✅ Deployment process completed successfully!");
console.log("═".repeat(60));
