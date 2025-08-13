const { ethers } = require("hardhat");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Complete Development Environment Setup
 * Spins up contracts + webapp with realistic test data for manual QA testing
 *
 * Usage: node scripts/dev-environment.js [scenario]
 * Scenarios: basic, marketplace, vault, complete
 */

class DevEnvironment {
    constructor() {
        this.contracts = {};
        this.users = {};
        this.webappProcess = null;
    }

    async deployContracts() {
        console.log("🚀 Deploying contracts...");

        const [deployer, alice, bob, charlie, dave] = await ethers.getSigners();

        // Deploy contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const usdc = await MockUSDC.deploy(ethers.parseUnits("10000000", 6));
        await usdc.waitForDeployment();

        const AstaVerde = await ethers.getContractFactory("AstaVerde");
        const astaVerde = await AstaVerde.deploy(deployer.address, await usdc.getAddress());
        await astaVerde.waitForDeployment();

        const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
        const scc = await SCC.deploy(ethers.ZeroAddress);
        await scc.waitForDeployment();

        const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
        const vault = await EcoStabilizer.deploy(await astaVerde.getAddress(), await scc.getAddress());
        await vault.waitForDeployment();

        // Setup roles
        await scc.grantRole(await scc.MINTER_ROLE(), await vault.getAddress());

        // Fund test users with USDC (realistic amounts)
        const users = [alice, bob, charlie, dave];
        for (const user of users) {
            await usdc.mint(user.address, ethers.parseUnits("50000", 6)); // 50k USDC each
        }

        this.contracts = { usdc, astaVerde, scc, vault };
        this.users = { deployer, alice, bob, charlie, dave };

        console.log("✅ Contracts deployed:");
        console.log(`   USDC: ${await usdc.getAddress()}`);
        console.log(`   AstaVerde: ${await astaVerde.getAddress()}`);
        console.log(`   SCC: ${await scc.getAddress()}`);
        console.log(`   Vault: ${await vault.getAddress()}`);

        return { contracts: this.contracts, users: this.users };
    }

    async seedBasicScenario() {
        console.log("🌱 Seeding basic marketplace scenario...");
        const { astaVerde } = this.contracts;

        // Create a single batch with 3 NFTs for basic testing
        await astaVerde.mintBatch(
            [this.users.deployer.address, this.users.deployer.address, this.users.deployer.address],
            ["QmBasic1", "QmBasic2", "QmBasic3"],
        );

        console.log("   ✅ Created batch #1 with 3 NFTs ready for purchase");
    }

    async seedMarketplaceScenario() {
        console.log("🌱 Seeding active marketplace scenario...");
        const { usdc, astaVerde } = this.contracts;
        const { alice, bob } = this.users;

        // Create multiple batches at different stages
        await astaVerde.mintBatch(
            [this.users.deployer.address, this.users.deployer.address],
            ["QmMarket1", "QmMarket2"],
        );

        await astaVerde.mintBatch(
            [this.users.deployer.address, this.users.deployer.address, this.users.deployer.address],
            ["QmMarket3", "QmMarket4", "QmMarket5"],
        );

        // Alice buys some NFTs
        const batch1Price = await astaVerde.getCurrentBatchPrice(1);
        await usdc.connect(alice).approve(await astaVerde.getAddress(), batch1Price);
        await astaVerde.connect(alice).buyBatch(1, batch1Price, 1);

        // Bob buys and redeems one
        const batch2Price = await astaVerde.getCurrentBatchPrice(2);
        await usdc.connect(bob).approve(await astaVerde.getAddress(), batch2Price);
        await astaVerde.connect(bob).buyBatch(2, batch2Price, 1);

        const batch2Info = await astaVerde.getBatchInfo(2);
        const tokenId = batch2Info[1][0]; // First token from batch 2
        await astaVerde.connect(bob).redeemToken(tokenId);

        console.log("   ✅ Created active marketplace:");
        console.log("      - Batch #1: 1 NFT sold (Alice owns), 1 available");
        console.log("      - Batch #2: 1 NFT sold & redeemed (Bob), 2 available");
        console.log("      - Users have USDC and some own NFTs");
    }

    async seedVaultScenario() {
        console.log("🌱 Seeding vault testing scenario...");
        const { usdc, astaVerde, vault } = this.contracts;
        const { alice, bob, charlie } = this.users;

        // Create NFTs for vault testing
        await astaVerde.mintBatch(
            [
                this.users.deployer.address,
                this.users.deployer.address,
                this.users.deployer.address,
                this.users.deployer.address,
            ],
            ["QmVault1", "QmVault2", "QmVault3", "QmVault4"],
        );
        // Use the newly created batch for all subsequent operations
        const newBatchId = await astaVerde.lastBatchID();
        const batchPrice = await astaVerde.getCurrentBatchPrice(newBatchId);

        // Alice: Buys NFT and deposits to vault (has SCC)
        await usdc.connect(alice).approve(await astaVerde.getAddress(), batchPrice);
        await astaVerde.connect(alice).buyBatch(newBatchId, batchPrice, 1);
        const batchInfo = await astaVerde.getBatchInfo(newBatchId);
        const aliceTokenId = batchInfo[1][0];

        await astaVerde.connect(alice).setApprovalForAll(await vault.getAddress(), true);
        await vault.connect(alice).deposit(aliceTokenId);

        // Bob: Buys NFT but keeps it (ready to test vault deposit)
        await usdc.connect(bob).approve(await astaVerde.getAddress(), batchPrice);
        await astaVerde.connect(bob).buyBatch(newBatchId, batchPrice, 1);

        // Charlie: Buys NFT, redeems it (to test redeemed rejection)
        await usdc.connect(charlie).approve(await astaVerde.getAddress(), batchPrice);
        await astaVerde.connect(charlie).buyBatch(newBatchId, batchPrice, 1);
        const charlieTokenId = batchInfo[1][2];
        await astaVerde.connect(charlie).redeemToken(charlieTokenId);

        console.log("   ✅ Created vault testing scenario:");
        console.log("      - Alice: Has 20 SCC from vault deposit");
        console.log("      - Bob: Owns NFT ready for vault deposit");
        console.log("      - Charlie: Owns redeemed NFT (should be rejected by vault)");
        console.log("      - 1 NFT still available for purchase");
    }

    async seedCompleteScenario() {
        console.log("🌱 Seeding complete testing scenario...");

        // Run all scenarios for comprehensive testing
        await this.seedMarketplaceScenario();
        await this.seedVaultScenario(); // This will create additional batches

        // Add some aged batches (simulate time passing for price decay testing)
        await this.contracts.astaVerde.mintBatch([this.users.deployer.address], ["QmAged1"]);

        console.log("   ✅ Complete scenario ready:");
        console.log("      - Multiple batches in different states");
        console.log("      - Users with various NFT/SCC holdings");
        console.log("      - Active vault positions");
        console.log("      - Redeemed NFTs for rejection testing");
    }

    async generateWebappConfig() {
        console.log("📝 Generating webapp configuration...");

        // Create .env.local for webapp with local contract addresses
        const envContent = `# Generated by dev-environment.js - Local Development
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

        // Also create a JSON config for reference
        const config = {
            network: "localhost",
            chainId: 31337,
            contracts: {
                MockUSDC: await this.contracts.usdc.getAddress(),
                AstaVerde: await this.contracts.astaVerde.getAddress(),
                StabilizedCarbonCoin: await this.contracts.scc.getAddress(),
                EcoStabilizer: await this.contracts.vault.getAddress(),
            },
            testAccounts: {
                deployer: this.users.deployer.address,
                alice: this.users.alice.address,
                bob: this.users.bob.address,
                charlie: this.users.charlie.address,
                dave: this.users.dave.address,
            },
        };

        const configDir = path.join(__dirname, "..", "webapp", "src", "config");
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        const configPath = path.join(configDir, "local-dev.json");
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        console.log("   ✅ Webapp config generated:");
        console.log("      - .env.local created");
        console.log("      - local-dev.json reference file created");
    }

    async startWebapp() {
        console.log("🌐 Starting webapp...");

        return new Promise((resolve, reject) => {
            const webappPath = path.join(__dirname, "..", "webapp");

            // Check if webapp dependencies are installed
            if (!fs.existsSync(path.join(webappPath, "node_modules"))) {
                console.log("   📦 Installing webapp dependencies...");
                const installProcess = spawn("npm", ["install"], {
                    cwd: webappPath,
                    stdio: "inherit",
                });

                installProcess.on("close", (code) => {
                    if (code === 0) {
                        this.startWebappDev(webappPath, resolve, reject);
                    } else {
                        reject(new Error("Failed to install webapp dependencies"));
                    }
                });
            } else {
                this.startWebappDev(webappPath, resolve, reject);
            }
        });
    }

    startWebappDev(webappPath, resolve, reject) {
        this.webappProcess = spawn("npm", ["run", "dev"], {
            cwd: webappPath,
            stdio: "inherit",
            env: { ...process.env, NODE_ENV: "development" },
        });

        // Wait a bit for webapp to start
        setTimeout(() => {
            console.log("   ✅ Webapp starting at http://localhost:3000");
            console.log("   🔗 Use MetaMask with network: http://localhost:8545");
            resolve();
        }, 3000);

        this.webappProcess.on("error", reject);
    }

    async displayTestingInstructions(scenario) {
        console.log("\n" + "=".repeat(60));
        console.log("🧪 MANUAL QA TESTING ENVIRONMENT READY");
        console.log("=".repeat(60));
        console.log(`📊 Scenario: ${scenario}`);
        console.log(`🌐 Webapp: http://localhost:3000`);
        console.log(`⛓️  Local blockchain: http://localhost:8545`);

        console.log("\n🔑 Test Accounts (all have 50k USDC):");
        Object.entries(this.users).forEach(([name, user], index) => {
            if (name !== "deployer") {
                console.log(`   ${name}: ${user.address}`);
            }
        });

        console.log("\n📝 MetaMask Setup:");
        console.log("   1. Add network: http://localhost:8545, Chain ID: 31337");
        console.log("   2. Import test account private keys:");
        console.log("      Alice: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
        console.log("      Bob: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
        console.log("      Charlie: 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");

        console.log(`\n🎯 Test Scenarios Available:`);
        console.log("   • Basic: Simple marketplace testing");
        console.log("   • Marketplace: Active marketplace with various states");
        console.log("   • Vault: Vault functionality testing");
        console.log("   • Complete: All scenarios combined");

        console.log("\n⚡ Quick Commands:");
        console.log("   npm run qa:fast     - Quick system validation");
        console.log("   npm run qa:status   - Health check");

        console.log("\n🛑 To stop: Ctrl+C");
    }

    cleanup() {
        if (this.webappProcess) {
            console.log("\n🧹 Shutting down webapp...");
            this.webappProcess.kill();
        }
    }
}

async function main() {
    const scenario = process.env.SCENARIO || process.argv[2] || "basic";
    const validScenarios = ["basic", "marketplace", "vault", "complete"];

    if (!validScenarios.includes(scenario)) {
        console.error(`❌ Invalid scenario: ${scenario}`);
        console.error(`   Valid options: ${validScenarios.join(", ")}`);
        process.exit(1);
    }

    const env = new DevEnvironment();

    // Handle cleanup on exit
    process.on("SIGINT", () => {
        env.cleanup();
        process.exit(0);
    });

    try {
        await env.deployContracts();

        // Seed based on scenario
        switch (scenario) {
            case "basic":
                await env.seedBasicScenario();
                break;
            case "marketplace":
                await env.seedMarketplaceScenario();
                break;
            case "vault":
                await env.seedVaultScenario();
                break;
            case "complete":
                await env.seedCompleteScenario();
                break;
        }

        await env.generateWebappConfig();

        if (process.env.NO_WEBAPP) {
            console.log("🌐 NO_WEBAPP set: skipping webapp start. Local config generated.");
            await env.displayTestingInstructions(scenario);
            return; // exit normally
        }

        await env.startWebapp();
        await env.displayTestingInstructions(scenario);

        // Keep running when webapp is started
        return new Promise(() => {});
    } catch (error) {
        console.error("❌ Failed to setup dev environment:", error);
        env.cleanup();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { DevEnvironment };
