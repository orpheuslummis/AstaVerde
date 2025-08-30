#!/usr/bin/env node

/**
 * Sepolia Development Environment
 * Connects webapp to Base Sepolia testnet contracts
 * Runs on port 3002 to avoid conflicts with local development (port 3001)
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
        console.log("\n🌐 Starting Base Sepolia Development Environment");
        console.log("=".repeat(60));

        try {
            // Load root env files so we can map RPC_API_KEY → NEXT_PUBLIC_ALCHEMY_API_KEY
            dotenv.config({ path: path.resolve(process.cwd(), ".env") });
            dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
            dotenv.config({ path: path.resolve(process.cwd(), ".env.sepolia") });

            // Check if .env.sepolia exists
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
        const envPath = path.join(__dirname, "../webapp/.env.sepolia");

        if (!fs.existsSync(envPath)) {
            throw new Error(".env.sepolia not found. Please create it from .env.sepolia.example");
        }

        // Load the config
        const envContent = fs.readFileSync(envPath, "utf8");
        const lines = envContent.split("\n");

        const config = {};
        lines.forEach((line) => {
            if (line && !line.startsWith("#")) {
                const [key, value] = line.split("=");
                if (key && value) {
                    config[key.trim()] = value.trim();
                }
            }
        });

        // Check for placeholder addresses
        const requiredAddresses = [
            "NEXT_PUBLIC_ASTAVERDE_ADDRESS",
            "NEXT_PUBLIC_ECOSTABILIZER_ADDRESS",
            "NEXT_PUBLIC_SCC_ADDRESS",
            "NEXT_PUBLIC_USDC_ADDRESS",
        ];

        const missingAddresses = requiredAddresses.filter(
            (key) => !config[key] || config[key] === "0x0000000000000000000000000000000000000000",
        );

        if (missingAddresses.length > 0) {
            console.log("\n⚠️  Warning: The following addresses are not configured:");
            missingAddresses.forEach((addr) => {
                console.log(`   - ${addr}`);
            });
            console.log("\n   Run 'npm run deploy:testnet' to deploy contracts to Base Sepolia");
            console.log("   Then update .env.sepolia with the deployed addresses\n");
        }

        this.config = config;
    }

    async displayContractInfo() {
        console.log("\n📋 Base Sepolia Contract Configuration:");
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

        console.log("\n📡 Network: Base Sepolia (Chain ID: 84532)");
        console.log("🔗 Explorer: https://sepolia.basescan.org");
    }

    async startWebapp() {
        console.log(`\n🚀 Starting webapp on port ${this.webappPort}...`);

        const envSepoliaPath = path.join(__dirname, "../webapp/.env.sepolia");

        // Load Sepolia env vars directly without modifying files
        const envContent = fs.readFileSync(envSepoliaPath, "utf8");
        const envVars = {};

        envContent.split("\n").forEach((line) => {
            if (line && !line.startsWith("#")) {
                const [key, value] = line.split("=");
                if (key && value) {
                    envVars[key.trim()] = value.trim();
                }
            }
        });

        // Ensure correct chain + RPC for Sepolia regardless of .env.local overrides
        const forcedEnv = {
            NEXT_PUBLIC_CHAIN_SELECTION: "base_sepolia",
        };

        // Resolve public Alchemy key in priority order
        // 1) webapp/.env.sepolia NEXT_PUBLIC_ALCHEMY_API_KEY
        // 2) root .env.sepolia RPC_API_KEY
        // 3) existing process env NEXT_PUBLIC_ALCHEMY_API_KEY
        const resolvedAlchemyKey =
            envVars.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.RPC_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
        if (resolvedAlchemyKey) {
            forcedEnv.NEXT_PUBLIC_ALCHEMY_API_KEY = resolvedAlchemyKey;
        }
        // WalletConnect is optional for dev; only set if provided
        if (!envVars.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID && process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID) {
            forcedEnv.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;
        }

        // Start Next.js on specified port with Sepolia environment and forced overrides
        this.webappProcess = spawn("npm", ["run", "dev", "--", "-p", this.webappPort.toString()], {
            cwd: path.join(__dirname, "../webapp"),
            stdio: "inherit",
            env: {
                ...process.env,
                ...envVars, // Inject Sepolia env vars directly
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
        console.log("🧪 BASE SEPOLIA TEST ENVIRONMENT READY");
        console.log("=".repeat(60));
        console.log(`🌐 Webapp: http://localhost:${this.webappPort}`);
        console.log("⛓️  Network: Base Sepolia Testnet");
        console.log("\n📝 Setup Instructions:");
        console.log("   1. Add Base Sepolia to MetaMask:");
        console.log("      - Network: Base Sepolia");
        console.log("      - RPC URL: https://sepolia.base.org");
        console.log("      - Chain ID: 84532");
        console.log("      - Symbol: ETH");
        console.log("\n   2. Get test ETH from faucet:");
        console.log("      https://www.alchemy.com/faucets/base-sepolia");
        console.log("\n   3. Connect wallet to webapp");
        console.log("\n⚡ Quick Commands:");
        console.log("   npm run deploy:testnet    # Deploy contracts to Sepolia");
        console.log("   npm run dev:local         # Run local development (port 3001)");
        console.log("   npm run dev:both          # Run both environments");
        console.log("\n🛑 To stop: Press Ctrl+C");
        console.log("=".repeat(60));
    }
}

// Run the environment
const env = new SepoliaDevEnvironment();
env.run().catch(console.error);
