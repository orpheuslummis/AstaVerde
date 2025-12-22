#!/usr/bin/env node

/**
 * Arbitrum Sepolia Development Environment
 * Connects webapp to Arbitrum Sepolia testnet contracts.
 * Runs on port 3002.
 *
 * Config:
 * - webapp/.env.local (untracked) (copy from webapp/.env.local.example)
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

class SepoliaDevEnvironment {
    constructor() {
        this.webappProcess = null;
        this.webappPort = process.env.WEBAPP_PORT || 3002;
    }

    async run() {
        console.log("\n🌐 Starting Arbitrum Sepolia Development Environment");
        console.log("=".repeat(60));

        try {
            // Read and validate webapp/.env.local for display/validation.
            await this.checkSepoliaConfig();

            // Load and display contract addresses
            await this.displayContractInfo();

            // Start webapp
            await this.startWebapp();

            // Display access information
            this.displayAccessInfo();
        } catch (error) {
            console.error("\n❌ Error:", error.message);
            process.exit(1);
        }
    }

    async checkSepoliaConfig() {
        const envPath = path.join(__dirname, "../webapp/.env.local");

        if (!fs.existsSync(envPath)) {
            throw new Error(
                "webapp/.env.local not found.\n" +
                    "Create it from webapp/.env.local.example (Arbitrum Sepolia config) and fill addresses + RPC.",
            );
        }

        const envContent = fs.readFileSync(envPath, "utf8");
        const config = dotenv.parse(envContent);

        const chainSelection = (config.NEXT_PUBLIC_CHAIN_SELECTION || "").trim();
        if (chainSelection && chainSelection !== "arbitrum_sepolia") {
            throw new Error(
                `webapp/.env.local has NEXT_PUBLIC_CHAIN_SELECTION=${chainSelection}, but dev:sepolia expects arbitrum_sepolia.\n` +
                    "Update webapp/.env.local (copy from webapp/.env.local.example) and re-run.",
            );
        }

        // Check for placeholder addresses
        const requiredAddresses = ["NEXT_PUBLIC_ASTAVERDE_ADDRESS", "NEXT_PUBLIC_USDC_ADDRESS"];
        const optionalAddresses = ["NEXT_PUBLIC_ECOSTABILIZER_ADDRESS", "NEXT_PUBLIC_SCC_ADDRESS"];

        const missingAddresses = requiredAddresses.filter(
            (key) => !config[key] || config[key] === "0x0000000000000000000000000000000000000000",
        );

        if (missingAddresses.length > 0) {
            console.log("\n⚠️  Warning: The following addresses are not configured:");
            missingAddresses.forEach((addr) => {
                console.log(`   - ${addr}`);
            });
            console.log(
                "\n   Deploy contracts to Arbitrum Sepolia, then update webapp/.env.local with the deployed addresses.\n",
            );
        }

        const rpcOverride = (config.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL || "").trim();
        if (rpcOverride.toLowerCase().includes("infura.io")) {
            console.log("\n⚠️  Warning: RPC override points at Infura:");
            console.log(`   NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL=${rpcOverride}`);
            console.log("   Remove it or replace with your Alchemy RPC URL to avoid rate limits.\n");
        }
        const alchemyKey = (config.NEXT_PUBLIC_ALCHEMY_API_KEY || "").trim();
        if (!rpcOverride && !alchemyKey) {
            console.log("\n⚠️  Warning: No Arbitrum Sepolia RPC configured.");
            console.log(
                "   Set NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL (recommended) or NEXT_PUBLIC_ALCHEMY_API_KEY in webapp/.env.local.\n",
            );
        }

        const missingOptional = optionalAddresses.filter(
            (key) => !config[key] || config[key] === "0x0000000000000000000000000000000000000000",
        );
        if (missingOptional.length > 0) {
            console.log("\nℹ️  Optional contracts not configured (vault UI may be disabled):");
            missingOptional.forEach((addr) => {
                console.log(`   - ${addr}`);
            });
            console.log("");
        }

        this.config = config;
    }

    async displayContractInfo() {
        console.log("\n📋 Arbitrum Sepolia Contract Configuration:");
        console.log("-".repeat(40));

        const contracts = [
            ["AstaVerde", this.config.NEXT_PUBLIC_ASTAVERDE_ADDRESS],
            ["EcoStabilizer", this.config.NEXT_PUBLIC_ECOSTABILIZER_ADDRESS],
            ["SCC Token", this.config.NEXT_PUBLIC_SCC_ADDRESS],
            ["USDC", this.config.NEXT_PUBLIC_USDC_ADDRESS],
        ];

        contracts.forEach(([name, address]) => {
            if (address && address !== "0x0000000000000000000000000000000000000000") {
                console.log(`   ${name}: ${address}`);
            } else {
                console.log(`   ${name}: ❌ Not deployed`);
            }
        });

        console.log("\n📡 Network: Arbitrum Sepolia (Chain ID: 421614)");
        console.log("🔗 Explorer: https://sepolia.arbiscan.io");
    }

    async startWebapp() {
        console.log(`\n🚀 Starting webapp on port ${this.webappPort}...`);

        // Force chain selection to prevent accidental mainnet connections.
        const forcedEnv = { NEXT_PUBLIC_CHAIN_SELECTION: "arbitrum_sepolia" };

        // Pass through only explicit webapp config keys to avoid surprises from shell env.
        const allowlisted = {};
        Object.entries(this.config || {}).forEach(([key, value]) => {
            if (key.startsWith("NEXT_PUBLIC_")) {
                allowlisted[key] = value;
            }
        });

        // Prevent leaking `NEXT_PUBLIC_*` vars from the shell into Next.js (common source of wrong RPC URLs).
        const baseEnv = { ...process.env };
        for (const key of Object.keys(baseEnv)) {
            if (key.startsWith("NEXT_PUBLIC_")) delete baseEnv[key];
        }

        // WalletConnect is optional for dev. Explicitly set it so shell env doesn't leak in.
        if (allowlisted.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID) {
            forcedEnv.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID = allowlisted.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;
        } else if (process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID) {
            forcedEnv.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;
        } else {
            forcedEnv.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID = "";
        }

        // Start Next.js on specified port with Arbitrum Sepolia environment and forced overrides
        this.webappProcess = spawn("npm", ["run", "dev", "--", "-p", this.webappPort.toString()], {
            cwd: path.join(__dirname, "../webapp"),
            stdio: "inherit",
            env: {
                ...baseEnv,
                ...allowlisted,
                ...forcedEnv, // Force chain selection and optional keys
                PORT: this.webappPort.toString(),
            },
        });

        // Handle cleanup
        const cleanup = () => {
            console.log("\n🧹 Cleaning up...");
            if (this.webappProcess) {
                this.webappProcess.kill();
            }
            process.exit(0);
        };

        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
        process.on("exit", cleanup);
    }

    displayAccessInfo() {
        console.log("\n" + "=".repeat(60));
        console.log("🧪 ARBITRUM SEPOLIA TEST ENVIRONMENT READY");
        console.log("=".repeat(60));
        console.log(`🌐 Webapp: http://localhost:${this.webappPort}`);
        console.log("⛓️  Network: Arbitrum Sepolia Testnet");
        console.log("\n📝 Setup:");
        console.log("   1. Create webapp/.env.local from webapp/.env.local.example");
        console.log("   2. Add Arbitrum Sepolia to MetaMask and get faucet ETH:");
        console.log("      https://www.alchemy.com/faucets/arbitrum-sepolia");
        console.log("   3. Connect wallet to the webapp");
        console.log("\n⚡ Commands:");
        console.log("   npm run deploy:testnet    # Deploy contracts to Arbitrum Sepolia");
        console.log("\n🛑 To stop: Press Ctrl+C");
        console.log("=".repeat(60));
    }
}

// Run the environment
const env = new SepoliaDevEnvironment();
env.run().catch(console.error);
