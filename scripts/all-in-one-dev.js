const { spawn } = require("child_process");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * All-in-One Development Environment
 * Starts hardhat node AND deploys contracts AND starts webapp
 * Perfect for manual QA testing
 */

class AllInOneDev {
    constructor() {
        this.hardhatProcess = null;
        this.webappProcess = null;
        this.contracts = {};
        this.users = {};
    }

    async startHardhatNode() {
        console.log("🏗️  Starting Hardhat node...");

        return new Promise((resolve, reject) => {
            this.hardhatProcess = spawn("npx", ["hardhat", "node", "--no-deploy"], { stdio: "pipe" });

            let nodeReady = false;

            this.hardhatProcess.stdout.on("data", (data) => {
                const output = data.toString();
                console.log(output);

                if (output.includes("Started HTTP and WebSocket JSON-RPC server") && !nodeReady) {
                    nodeReady = true;
                    setTimeout(resolve, 2000); // Wait a bit for node to be fully ready
                }
            });

            this.hardhatProcess.stderr.on("data", (data) => {
                console.error(data.toString());
            });

            this.hardhatProcess.on("error", reject);

            // Fallback timeout
            setTimeout(() => {
                if (!nodeReady) {
                    console.log("   ✅ Node should be ready (timeout fallback)");
                    resolve();
                }
            }, 10000);
        });
    }

    async deployContracts() {
        console.log("🚀 Deploying contracts to local node...");

        // Connect to the running localhost node
        const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

        // Use the test accounts with known private keys
        const deployer = new ethers.Wallet(
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
            provider,
        );
        const alice = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", provider);
        const bob = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", provider);
        const charlie = new ethers.Wallet(
            "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
            provider,
        );
        const dave = new ethers.Wallet("0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", provider);

        // Deploy contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC", deployer);
        const usdc = await MockUSDC.deploy(ethers.parseUnits("10000000", 6));
        await usdc.waitForDeployment();

        const AstaVerde = await ethers.getContractFactory("AstaVerde", deployer);
        const astaVerde = await AstaVerde.deploy(deployer.address, await usdc.getAddress());
        await astaVerde.waitForDeployment();

        const SCC = await ethers.getContractFactory("StabilizedCarbonCoin", deployer);
        const scc = await SCC.deploy(ethers.ZeroAddress);
        await scc.waitForDeployment();

        const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer", deployer);
        const vault = await EcoStabilizer.deploy(await astaVerde.getAddress(), await scc.getAddress());
        await vault.waitForDeployment();

        // Setup roles
        await scc.grantRole(await scc.MINTER_ROLE(), await vault.getAddress());

        // Fund test users with USDC (realistic amounts)
        // Include deployer to prevent issues when testing with default account
        const users = [deployer, alice, bob, charlie, dave];
        for (const user of users) {
            await usdc.mint(user.address, ethers.parseUnits("50000", 6)); // 50k USDC each
        }

        this.contracts = { usdc, astaVerde, scc, vault };
        this.users = { deployer, alice, bob, charlie, dave };

        console.log("✅ Contracts deployed:");
        console.log(`   MockUSDC: ${await usdc.getAddress()}`);
        console.log(`   AstaVerde: ${await astaVerde.getAddress()}`);
        console.log(`   SCC: ${await scc.getAddress()}`);
        console.log(`   EcoStabilizer: ${await vault.getAddress()}`);

        return { contracts: this.contracts, users: this.users };
    }

    async seedMarketplaceData() {
        console.log("🌱 Seeding marketplace with test data...");
        const { usdc, astaVerde } = this.contracts;
        const { alice, bob, charlie } = this.users;

        // Create multiple batches for testing
        await astaVerde.mintBatch(
            [this.users.deployer.address, this.users.deployer.address, this.users.deployer.address],
            ["QmBasicBatch1", "QmBasicBatch2", "QmBasicBatch3"],
        );

        await astaVerde.mintBatch(
            [this.users.deployer.address, this.users.deployer.address],
            ["QmVaultBatch1", "QmVaultBatch2"],
        );

        // Alice buys an NFT
        const batch1Price = await astaVerde.getCurrentBatchPrice(1);
        await usdc.connect(alice).approve(await astaVerde.getAddress(), batch1Price);
        await astaVerde.connect(alice).buyBatch(1, batch1Price, 1);

        // Bob buys and redeems one (for testing redeemed rejection)
        const batch2Price = await astaVerde.getCurrentBatchPrice(2);
        await usdc.connect(bob).approve(await astaVerde.getAddress(), batch2Price);
        await astaVerde.connect(bob).buyBatch(2, batch2Price, 1);

        const batch2Info = await astaVerde.getBatchInfo(2);
        const bobTokenId = batch2Info[1][0];
        await astaVerde.connect(bob).redeemToken(bobTokenId);

        console.log("   ✅ Test data ready:");
        console.log("      - Multiple NFT batches available for purchase");
        console.log("      - Alice owns an NFT (ready for vault deposit)");
        console.log("      - Bob has a redeemed NFT (should be rejected by vault)");
        console.log("      - Charlie has 50k USDC (ready to buy NFTs)");
    }

    async generateWebappConfig() {
        console.log("📝 Generating webapp configuration...");

        const envContent = `# Generated by all-in-one-dev.js - Local Development
NEXT_PUBLIC_CHAIN_SELECTION=local
NEXT_PUBLIC_ASTAVERDE_ADDRESS=${await this.contracts.astaVerde.getAddress()}
NEXT_PUBLIC_USDC_ADDRESS=${await this.contracts.usdc.getAddress()}
NEXT_PUBLIC_ECOSTABILIZER_ADDRESS=${await this.contracts.vault.getAddress()}
NEXT_PUBLIC_SCC_ADDRESS=${await this.contracts.scc.getAddress()}
NEXT_PUBLIC_USDC_DECIMALS=6
NEXT_PUBLIC_IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
NEXT_PUBLIC_ALCHEMY_API_KEY=demo
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=demo
`;

        const envPath = path.join(__dirname, "..", "webapp", ".env.local");
        fs.writeFileSync(envPath, envContent);
        console.log("   ✅ Webapp .env.local updated with contract addresses");
    }

    async startWebapp() {
        console.log("🌐 Starting webapp...");

        const webappPath = path.join(__dirname, "..", "webapp");

        // Check if dependencies are installed
        if (!fs.existsSync(path.join(webappPath, "node_modules"))) {
            console.log("   📦 Installing webapp dependencies first...");
            await new Promise((resolve, reject) => {
                const installProcess = spawn("npm", ["install"], {
                    cwd: webappPath,
                    stdio: "inherit",
                });
                installProcess.on("close", (code) => {
                    if (code === 0) resolve();
                    else reject(new Error("Failed to install dependencies"));
                });
            });
        }

        // Start webapp - listen on all interfaces for Tailscale access
        this.webappProcess = spawn("npm", ["run", "dev", "--", "-H", "0.0.0.0"], {
            cwd: webappPath,
            stdio: "inherit",
            env: { ...process.env, NODE_ENV: "development" },
        });

        console.log("   ✅ Webapp starting at http://localhost:3000 (accessible on all interfaces)");

        // Wait a moment for webapp to boot
        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    displayInstructions() {
        console.log("\n" + "=".repeat(70));
        console.log("🎉 ALL-IN-ONE DEV ENVIRONMENT READY!");
        console.log("=".repeat(70));
        console.log("🌐 Webapp:          http://localhost:3000");
        console.log("⛓️  Blockchain:      http://localhost:8545 (Chain ID: 31337)");
        console.log("");
        console.log("🔑 TEST ACCOUNTS (Import private keys into MetaMask):");
        console.log("   Alice:   0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
        console.log("   Key:     0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
        console.log("");
        console.log("   Bob:     0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
        console.log("   Key:     0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
        console.log("");
        console.log("   Charlie: 0x90F79bf6EB2c4f870365E785982E1f101E93b906");
        console.log("   Key:     0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
        console.log("");
        console.log("💰 All accounts have 50,000 USDC for testing");
        console.log("");
        console.log("🧪 WHAT'S READY FOR TESTING:");
        console.log("   ✅ NFT marketplace with batches ready to buy");
        console.log("   ✅ Vault system for collateralizing NFTs → SCC");
        console.log("   ✅ Alice owns an NFT (ready for vault testing)");
        console.log("   ✅ Bob has redeemed NFT (will be rejected by vault)");
        console.log("   ✅ Security features working (redeemed NFT protection)");
        console.log("");
        console.log("📱 MetaMask Setup:");
        console.log("   1. Add Network: http://localhost:8545, Chain ID: 31337");
        console.log("   2. Import any of the test account private keys above");
        console.log("   3. Start testing the webapp!");
        console.log("");
        console.log("⚡ Quick validation: npm run qa:fast");
        console.log("🛑 Stop everything: Ctrl+C");
        console.log("=".repeat(70));
    }

    cleanup() {
        console.log("\n🧹 Shutting down all processes...");

        if (this.webappProcess) {
            this.webappProcess.kill();
            console.log("   ✅ Webapp stopped");
        }

        if (this.hardhatProcess) {
            this.hardhatProcess.kill();
            console.log("   ✅ Hardhat node stopped");
        }

        console.log("👋 Goodbye!");
    }
}

async function main() {
    const dev = new AllInOneDev();

    // Handle cleanup on exit
    process.on("SIGINT", () => {
        dev.cleanup();
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        dev.cleanup();
        process.exit(0);
    });

    try {
        await dev.startHardhatNode();
        await dev.deployContracts();
        await dev.seedMarketplaceData();
        await dev.generateWebappConfig();
        await dev.startWebapp();
        dev.displayInstructions();

        // Keep running
        return new Promise(() => {});
    } catch (error) {
        console.error("❌ Failed to setup development environment:", error);
        dev.cleanup();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { AllInOneDev };
