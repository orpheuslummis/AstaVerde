#!/usr/bin/env node

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

async function main() {
    const network = (process.argv[2] || "sepolia").toLowerCase();
    const userAddress = process.argv[3];

    console.log(`Checking vault tokens on network: ${network}`);

    let provider, astaVerdeAddress, vaultAddress;

    if (network === "localhost") {
        provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

        // Read contract addresses from deployments
        const astaDeploymentPath = path.join(__dirname, "..", "deployments", "localhost", "AstaVerde.json");
        const vaultDeploymentPath = path.join(__dirname, "..", "deployments", "localhost", "EcoStabilizer.json");

        if (!fs.existsSync(astaDeploymentPath)) {
            console.error("No local deployment found. Run 'npm run dev:local' first.");
            process.exit(1);
        }

        const astaDeployment = JSON.parse(fs.readFileSync(astaDeploymentPath, "utf8"));
        const vaultDeployment = fs.existsSync(vaultDeploymentPath)
            ? JSON.parse(fs.readFileSync(vaultDeploymentPath, "utf8"))
            : null;

        astaVerdeAddress = astaDeployment.address;
        vaultAddress = vaultDeployment?.address;
    } else if (network === "arbitrum-sepolia" || network === "sepolia") {
        const rpcUrl =
            process.env.ARBITRUM_SEPOLIA_RPC_URL ||
            (process.env.RPC_API_KEY ? `https://arb-sepolia.g.alchemy.com/v2/${process.env.RPC_API_KEY}` : "");
        if (!rpcUrl) {
            console.error("Missing RPC URL. Set ARBITRUM_SEPOLIA_RPC_URL (preferred) or RPC_API_KEY.");
            process.exit(1);
        }
        provider = new ethers.JsonRpcProvider(rpcUrl);

        // Read contract addresses from webapp env
        const envPath = path.join(__dirname, "..", "webapp", ".env.local");
        if (!fs.existsSync(envPath)) {
            console.error("No webapp env found. Create webapp/.env.local from webapp/.env.local.example.");
            process.exit(1);
        }
        dotenv.config({ path: envPath, override: true });
        astaVerdeAddress = process.env.NEXT_PUBLIC_ASTAVERDE_ADDRESS;
        vaultAddress = process.env.NEXT_PUBLIC_ECOSTABILIZER_ADDRESS;
    } else {
        console.error("Unsupported network. Use 'localhost' or 'sepolia'");
        process.exit(1);
    }

    if (!astaVerdeAddress) {
        console.error("AstaVerde contract address not found");
        process.exit(1);
    }

    console.log("AstaVerde address:", astaVerdeAddress);
    console.log("Vault address:", vaultAddress || "Not deployed");
    console.log("=".repeat(60));

    // Load ABIs
    const astaAbiPath = path.join(__dirname, "..", "webapp", "src", "config", "AstaVerde.json");
    const vaultAbiPath = path.join(__dirname, "..", "webapp", "src", "config", "EcoStabilizer.json");

    const astaAbi = JSON.parse(fs.readFileSync(astaAbiPath, "utf8"));
    const vaultAbi = fs.existsSync(vaultAbiPath) ? JSON.parse(fs.readFileSync(vaultAbiPath, "utf8")) : null;

    // Create contract instances
    const astaVerde = new ethers.Contract(astaVerdeAddress, astaAbi, provider);

    // Check AstaVerde contract status
    console.log("📋 AstaVerde Contract Status:");
    console.log("-".repeat(40));

    try {
        const lastTokenID = await astaVerde.lastTokenID();
        const lastBatchID = await astaVerde.lastBatchID();

        console.log(`Last Token ID: ${lastTokenID}`);
        console.log(`Last Batch ID: ${lastBatchID}`);

        // If user address provided, check their tokens
        if (userAddress) {
            console.log(`\nChecking tokens for user: ${userAddress}`);

            const userTokens = [];
            for (let i = 1n; i <= lastTokenID; i++) {
                const balance = await astaVerde.balanceOf(userAddress, i);
                if (balance > 0n) {
                    userTokens.push({ tokenId: i, balance });
                }
            }

            if (userTokens.length > 0) {
                console.log("User's AstaVerde tokens:");
                userTokens.forEach(({ tokenId, balance }) => {
                    console.log(`  - Token #${tokenId}: ${balance} units`);
                });
            } else {
                console.log("User has no AstaVerde tokens");
            }
        }
    } catch (error) {
        console.error("Error reading AstaVerde contract:", error.message);
    }

    // Check Vault if deployed
    if (vaultAddress && vaultAbi) {
        console.log("\n📦 Vault (EcoStabilizer) Status:");
        console.log("-".repeat(40));

        const vault = new ethers.Contract(vaultAddress, vaultAbi, provider);

        try {
            // Check if user has loans in vault
            if (userAddress) {
                const userLoans = await vault.getUserLoans(userAddress);
                console.log(`\nUser's vaulted tokens: ${userLoans.length} tokens`);

                if (userLoans.length > 0) {
                    console.log("Vaulted token IDs:", userLoans.map((id) => id.toString()).join(", "));

                    // Check each vaulted token's validity
                    console.log("\n🔍 Validating vaulted tokens:");
                    for (const tokenId of userLoans) {
                        console.log(`\nToken #${tokenId}:`);

                        // Check if token exists in AstaVerde
                        const lastTokenID = await astaVerde.lastTokenID();
                        if (tokenId > lastTokenID || tokenId <= 0n) {
                            console.log(
                                `  ❌ INVALID: Token ID ${tokenId} does not exist in AstaVerde (max: ${lastTokenID})`,
                            );
                            console.log("     This is causing the error!");
                            continue;
                        }

                        // Check token details
                        try {
                            const producer = await astaVerde.getTokenProducer(tokenId);
                            const cid = await astaVerde.getTokenCid(tokenId);
                            const isRedeemed = await astaVerde.isRedeemed(tokenId);

                            console.log("  ✅ Valid token");
                            console.log(`     Producer: ${producer}`);
                            console.log(`     CID: ${cid || "Not set"}`);
                            console.log(`     Redeemed: ${isRedeemed}`);

                            // Check vault ownership
                            const vaultBalance = await astaVerde.balanceOf(vaultAddress, tokenId);
                            console.log(`     Vault holds: ${vaultBalance} units`);

                            if (vaultBalance === 0n) {
                                console.log("     ⚠️ WARNING: Vault claims to have this token but balance is 0");
                            }
                        } catch (error) {
                            console.log(`  ❌ Error reading token data: ${error.message}`);
                        }
                    }
                }
            }

            // Check total vault stats
            const totalLoans = await vault.getTotalActiveLoans();
            console.log(`\nTotal active loans in vault: ${totalLoans}`);
        } catch (error) {
            console.error("Error reading vault contract:", error.message);
        }
    } else {
        console.log("\n⚠️ Vault not deployed or ABI not found");
    }

    console.log("\n" + "=".repeat(60));
    console.log("🔧 Troubleshooting Invalid Vault Tokens:");
    console.log("=".repeat(60));
    console.log("\nIf you see invalid token IDs in the vault:");
    console.log("1. This happens when vault has tokens that don't exist in AstaVerde");
    console.log("2. Possible causes:");
    console.log("   - Contract mismatch (different deployments)");
    console.log("   - Testing artifacts from previous deployments");
    console.log("   - Manual contract manipulation");
    console.log("\n3. Solutions:");
    console.log("   - Redeploy both contracts fresh");
    console.log("   - Or manually withdraw invalid tokens from vault");
    console.log("   - Ensure contracts are deployed together");
}

main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
});
