#!/usr/bin/env node

/**
 * ABI Validation Script
 * =====================
 *
 * Validates that all contract ABIs are properly generated and contain expected functions
 * Can be run standalone or as part of CI/CD pipeline
 */

const fs = require("fs");
const path = require("path");

// Define expected functions for each contract
const EXPECTED_FUNCTIONS = {
    AstaVerde: [
        "mintBatch",
        "buyBatch",
        "redeemToken",
        "getBatchInfo",
        "getCurrentBatchPrice",
        "producerBalances",
        "claimProducerFunds",
    ],
    EcoStabilizer: [
        "deposit",
        "withdraw",
        "depositBatch",
        "withdrawBatch",
        "getUserLoans",
        "getUserLoansIndexed", // Critical function that was missing
        "getUserLoanCount",
        "getTotalActiveLoans",
    ],
    StabilizedCarbonCoin: ["mint", "burn", "totalSupply", "balanceOf", "transfer", "approve", "allowance"],
    MockUSDC: ["mint", "balanceOf", "transfer", "approve", "allowance"],
};

// Color codes for terminal output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[36m",
};

function validateABI(contractName, abiPath) {
    console.log(`\n${colors.blue}Validating ${contractName}...${colors.reset}`);

    const fullPath = path.join(__dirname, "..", abiPath);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
        console.log(`${colors.yellow}  ⚠️  ABI file not found: ${abiPath}${colors.reset}`);
        return false;
    }

    try {
        // Parse the artifact
        const artifact = JSON.parse(fs.readFileSync(fullPath, "utf8"));

        // Check ABI structure
        if (!artifact.abi || !Array.isArray(artifact.abi)) {
            console.log(`${colors.red}  ❌ Invalid ABI structure${colors.reset}`);
            return false;
        }

        console.log(`  ✓ ABI structure valid (${artifact.abi.length} items)`);

        // Get all function names from ABI
        const abiFunctions = artifact.abi.filter((item) => item.type === "function").map((item) => item.name);

        // Check for expected functions
        const expectedFunctions = EXPECTED_FUNCTIONS[contractName] || [];
        const missingFunctions = [];

        for (const funcName of expectedFunctions) {
            if (!abiFunctions.includes(funcName)) {
                missingFunctions.push(funcName);
            }
        }

        if (missingFunctions.length > 0) {
            console.log(`${colors.red}  ❌ Missing functions: ${missingFunctions.join(", ")}${colors.reset}`);
            return false;
        }

        console.log(`${colors.green}  ✓ All expected functions present${colors.reset}`);

        // Special checks for critical functions
        if (contractName === "EcoStabilizer") {
            const getUserLoansIndexed = artifact.abi.find(
                (item) => item.type === "function" && item.name === "getUserLoansIndexed",
            );

            if (getUserLoansIndexed) {
                const params = getUserLoansIndexed.inputs || [];
                const outputs = getUserLoansIndexed.outputs || [];

                console.log("  ✓ getUserLoansIndexed signature:");
                console.log(`    - Inputs: ${params.map((p) => `${p.name}:${p.type}`).join(", ")}`);
                console.log(`    - Outputs: ${outputs.map((o) => `${o.name || "unnamed"}:${o.type}`).join(", ")}`);
            }
        }

        return true;
    } catch (error) {
        console.log(`${colors.red}  ❌ Error parsing ABI: ${error.message}${colors.reset}`);
        return false;
    }
}

function validateWebappConfig() {
    console.log(`\n${colors.blue}Validating webapp configuration...${colors.reset}`);

    const configPath = path.join(__dirname, "../webapp/src/config/local-dev.json");

    if (!fs.existsSync(configPath)) {
        console.log(`${colors.yellow}  ⚠️  Webapp config not found (OK if not using local dev)${colors.reset}`);
        return true;
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

        // Check each contract in config
        const contracts = ["AstaVerde", "MockUSDC", "StabilizedCarbonCoin", "EcoStabilizer"];
        let allValid = true;

        for (const contractName of contracts) {
            if (config[contractName]) {
                console.log(`  Checking ${contractName}...`);

                if (!config[contractName].address) {
                    console.log(`${colors.red}    ❌ Missing address${colors.reset}`);
                    allValid = false;
                }

                if (!config[contractName].abi || !Array.isArray(config[contractName].abi)) {
                    console.log(`${colors.red}    ❌ Missing or invalid ABI${colors.reset}`);
                    allValid = false;
                } else {
                    // Check for critical functions in webapp config
                    const abiFunctions = config[contractName].abi
                        .filter((item) => item.type === "function")
                        .map((item) => item.name);

                    if (contractName === "EcoStabilizer" && !abiFunctions.includes("getUserLoansIndexed")) {
                        console.log(`${colors.red}    ❌ Missing getUserLoansIndexed in webapp config${colors.reset}`);
                        allValid = false;
                    } else {
                        console.log(`${colors.green}    ✓ Valid${colors.reset}`);
                    }
                }
            }
        }

        return allValid;
    } catch (error) {
        console.log(`${colors.red}  ❌ Error parsing config: ${error.message}${colors.reset}`);
        return false;
    }
}

// Main validation
console.log("═".repeat(60));
console.log(`${colors.blue}ABI Validation Tool${colors.reset}`);
console.log("═".repeat(60));

let allValid = true;

// Validate main contracts
allValid = validateABI("AstaVerde", "artifacts/contracts/AstaVerde.sol/AstaVerde.json") && allValid;
allValid = validateABI("EcoStabilizer", "artifacts/contracts/EcoStabilizer.sol/EcoStabilizer.json") && allValid;
allValid =
    validateABI("StabilizedCarbonCoin", "artifacts/contracts/StabilizedCarbonCoin.sol/StabilizedCarbonCoin.json") &&
    allValid;
allValid = validateABI("MockUSDC", "artifacts/contracts/MockUSDC.sol/MockUSDC.json") && allValid;

// Validate webapp config
allValid = validateWebappConfig() && allValid;

// Summary
console.log("\n" + "═".repeat(60));
if (allValid) {
    console.log(`${colors.green}✅ All validations passed!${colors.reset}`);
    console.log("═".repeat(60));
    process.exit(0);
} else {
    console.log(`${colors.red}❌ Validation failed!${colors.reset}`);
    console.log(`\n${colors.yellow}To fix:${colors.reset}`);
    console.log("1. Run: npm run clean");
    console.log("2. Run: npm run compile");
    console.log("3. Run this script again");
    console.log("═".repeat(60));
    process.exit(1);
}
