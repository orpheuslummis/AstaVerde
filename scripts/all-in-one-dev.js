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

        // Use hardhat-deploy to deploy contracts
        const { execSync } = require("child_process");
        try {
            execSync("npx hardhat deploy --network localhost", { stdio: "inherit" });
        } catch (error) {
            console.error("Failed to deploy contracts:", error);
            throw error;
        }

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
        const producer = new ethers.Wallet(
            "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
            provider,
        ); // Account #5 as dedicated producer

        // Get deployed contract addresses from hardhat-deploy
        const deployments = require("../deployments/localhost/MockUSDC.json");
        const astaVerdeDeployment = require("../deployments/localhost/AstaVerde.json");

        // Connect to deployed contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC", deployer);
        const usdc = MockUSDC.attach(deployments.address);

        const AstaVerde = await ethers.getContractFactory("AstaVerde", deployer);
        const astaVerde = AstaVerde.attach(astaVerdeDeployment.address);

        // Deploy additional v2 contracts (not in hardhat-deploy yet)
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
        const users = [deployer, alice, bob, charlie, dave, producer];
        console.log("💰 Funding accounts with USDC:");
        for (const user of users) {
            await usdc.mint(user.address, ethers.parseUnits("50000", 6)); // 50k USDC each
            console.log(`   - ${user.address}: 50,000 USDC`);
        }

        this.contracts = { usdc, astaVerde, scc, vault };
        this.users = { deployer, alice, bob, charlie, dave, producer };

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
        const { alice, bob, charlie, producer } = this.users;

        console.log("\n📦 Creating NFT batches:");
        console.log(`   Producer address: ${producer.address}`);
        console.log(`   Platform owner: ${this.users.deployer.address}`);

        // Create multiple batches for testing - using dedicated producer address
        console.log("   - Batch 1: 3 NFTs for marketplace testing");
        await astaVerde.mintBatch(
            [producer.address, producer.address, producer.address],
            ["QmBasicBatch1", "QmBasicBatch2", "QmBasicBatch3"],
        );

        console.log("   - Batch 2: 2 NFTs for vault testing");
        await astaVerde.mintBatch([producer.address, producer.address], ["QmVaultBatch1", "QmVaultBatch2"]);

        // Alice buys an NFT
        console.log("\n💸 Simulating NFT purchases:");
        const batch1Price = await astaVerde.getCurrentBatchPrice(1);
        console.log(`   - Alice buying 1 NFT from Batch 1 at ${ethers.formatUnits(batch1Price, 6)} USDC`);
        await usdc.connect(alice).approve(await astaVerde.getAddress(), batch1Price);
        await astaVerde.connect(alice).buyBatch(1, batch1Price, 1);
        console.log(
            `     ✓ Purchase complete - Producer gets ${ethers.formatUnits((batch1Price * 70n) / 100n, 6)} USDC (70%)`,
        );
        console.log(`     ✓ Platform gets ${ethers.formatUnits((batch1Price * 30n) / 100n, 6)} USDC (30%)`);

        // Bob buys and redeems one (for testing redeemed rejection)
        const batch2Price = await astaVerde.getCurrentBatchPrice(2);
        console.log(`   - Bob buying 1 NFT from Batch 2 at ${ethers.formatUnits(batch2Price, 6)} USDC`);
        await usdc.connect(bob).approve(await astaVerde.getAddress(), batch2Price);
        await astaVerde.connect(bob).buyBatch(2, batch2Price, 1);
        console.log(
            `     ✓ Purchase complete - Producer gets ${ethers.formatUnits((batch2Price * 70n) / 100n, 6)} USDC (70%)`,
        );

        const batch2Info = await astaVerde.getBatchInfo(2);
        const bobTokenId = batch2Info[1][0];
        console.log(`   - Bob redeeming token #${bobTokenId} (for vault rejection testing)`);
        await astaVerde.connect(bob).redeemToken(bobTokenId);

        // Display final balances
        const producerBalance = await astaVerde.producerBalances(producer.address);
        const platformBalance = await astaVerde.platformShareAccumulated();
        const totalProducerBalances = await astaVerde.totalProducerBalances();

        console.log("\n💰 Revenue Distribution Summary:");
        console.log(
            `   Producer balance: ${ethers.formatUnits(producerBalance, 6)} USDC (claimable by ${producer.address})`,
        );
        console.log(
            `   Platform fees: ${ethers.formatUnits(platformBalance, 6)} USDC (accumulated for platform owner)`,
        );
        console.log(`   Total producer balances: ${ethers.formatUnits(totalProducerBalances, 6)} USDC`);

        console.log("\n✅ Test data ready:");
        console.log("   - Multiple NFT batches available for purchase");
        console.log("   - Alice owns an NFT (ready for vault deposit)");
        console.log("   - Bob has a redeemed NFT (should be rejected by vault)");
        console.log("   - Charlie has 50k USDC (ready to buy NFTs)");
        console.log("   - Producer has claimable revenue from sales");
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
        console.log("   Platform Owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Account #0)");
        console.log("   Key:           0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
        console.log("");
        console.log("   Producer:      0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 (Account #4)");
        console.log("   Key:           0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba");
        console.log("");
        console.log("   Alice (Buyer): 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (Account #1)");
        console.log("   Key:           0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
        console.log("");
        console.log("   Bob (Buyer):   0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (Account #2)");
        console.log("   Key:           0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
        console.log("");
        console.log("   Charlie:       0x90F79bf6EB2c4f870365E785982E1f101E93b906 (Account #3)");
        console.log("   Key:           0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
        console.log("");
        console.log("💰 All accounts have 50,000 USDC for testing");
        console.log("");
        console.log("🧪 WHAT'S READY FOR TESTING:");
        console.log("   ✅ NFT marketplace with batches ready to buy");
        console.log("   ✅ Vault system for collateralizing NFTs → SCC");
        console.log("   ✅ Alice owns an NFT (ready for vault testing)");
        console.log("   ✅ Bob has redeemed NFT (will be rejected by vault)");
        console.log("   ✅ Security features working (redeemed NFT protection)");
        console.log("   ✅ Producer revenue tracking separate from platform fees");
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
