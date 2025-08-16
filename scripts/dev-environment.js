// NOTE: Do NOT import hardhat here. We set the network first and require it later
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

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
        this.nodeProcess = null;
        this.startedNode = false;
    }

    async ensureHardhatNodeRunning({
        rpcUrl = "http://127.0.0.1:8545",
        hostname = "127.0.0.1",
        port = 8545,
    } = {}) {
        const isUp = async () => {
            try {
                const result = await this.#jsonRpcRequest(rpcUrl, {
                    jsonrpc: "2.0",
                    method: "web3_clientVersion",
                    params: [],
                    id: 1,
                });
                return typeof result === "object" && !!result.result;
            } catch (_) {
                return false;
            }
        };

        if (await isUp()) {
            // Ensure subsequent hardhat usage targets the external JSON-RPC node
            process.env.HARDHAT_NETWORK = "localhost";
            return;
        }

        console.log("⛓️  Starting local Hardhat node...");
        this.nodeProcess = spawn(
            "npx",
            [
                "hardhat",
                "node",
                "--hostname",
                String(hostname),
                "--port",
                String(port),
                "--network",
                "hardhat",
                // Let hardhat-deploy run to deploy contracts
            ],
            {
                stdio: "inherit",
                env: { ...process.env, HARDHAT_NETWORK: "hardhat" },
                // Make the process detached so we can kill the entire process group
                detached: process.platform !== "win32",
            },
        );
        this.startedNode = true;

        // Wait for RPC to become ready
        const startTime = Date.now();
        const timeoutMs = 20000;
        const intervalMs = 400;
        while (Date.now() - startTime < timeoutMs) {
            if (await isUp()) {
                console.log("   ✅ Hardhat node is ready at http://127.0.0.1:8545");
                // Ensure subsequent hardhat usage targets the external JSON-RPC node
                process.env.HARDHAT_NETWORK = "localhost";
                return;
            }
            await new Promise((r) => setTimeout(r, intervalMs));
        }
        throw new Error("Timed out waiting for Hardhat node to start");
    }

    async #jsonRpcRequest(url, payload) {
        const isHttps = url.startsWith("https:");
        const lib = isHttps ? https : http;
        const { hostname, port, pathname } = new URL(url);
        const pathWithDefault = pathname && pathname.length > 0 ? pathname : "/";
        return new Promise((resolve, reject) => {
            const req = lib.request({
                hostname,
                port,
                path: pathWithDefault,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            }, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (err) {
                        reject(err);
                    }
                });
            });
            req.on("error", reject);
            req.write(JSON.stringify(payload));
            req.end();
        });
    }

    async setupContracts() {
        console.log("🚀 Setting up contracts...");

        // Use localhost network (external node) for deployments and interactions
        process.env.HARDHAT_NETWORK = process.env.HARDHAT_NETWORK || "localhost";

        // Load hardhat only after HARDHAT_NETWORK is set
        const hre = require("hardhat");
        const { ethers } = hre;

        const [deployer, alice, bob, charlie, dave] = await ethers.getSigners();

        // Run the deployment scripts (deploy.ts)
        await hre.run("deploy", { tags: "AstaVerde,MockUSDC" });

        // Get deployed contract addresses from deployments
        const deployments = hre.deployments;
        
        // Get deployed contract addresses
        const MockUSDCDeployment = await deployments.get("MockUSDC");
        const AstaVerdeDeployment = await deployments.get("AstaVerde");
        
        // Check if Phase 2 contracts are already deployed
        let scc, vault;
        try {
            const SCCDeployment = await deployments.get("StabilizedCarbonCoin");
            const VaultDeployment = await deployments.get("EcoStabilizer");
            scc = await ethers.getContractAt("StabilizedCarbonCoin", SCCDeployment.address);
            vault = await ethers.getContractAt("EcoStabilizer", VaultDeployment.address);
            console.log("📋 Using existing Phase 2 contracts:");
            console.log(`   SCC: ${SCCDeployment.address}`);
            console.log(`   Vault: ${VaultDeployment.address}`);
        } catch (e) {
            // Phase 2 contracts not deployed, deploy them now
            console.log("📋 Deploying Phase 2 contracts...");
            const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
            scc = await SCC.deploy(ethers.ZeroAddress);
            await scc.waitForDeployment();

            const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
            vault = await EcoStabilizer.deploy(AstaVerdeDeployment.address, await scc.getAddress());
            await vault.waitForDeployment();

            // Setup roles
            await scc.grantRole(await scc.MINTER_ROLE(), await vault.getAddress());
        }

        console.log("📋 Using deployed contracts:");
        console.log(`   MockUSDC: ${MockUSDCDeployment.address}`);
        console.log(`   AstaVerde: ${AstaVerdeDeployment.address}`);

        // Get contract instances
        const usdc = await ethers.getContractAt("MockUSDC", MockUSDCDeployment.address);
        const astaVerde = await ethers.getContractAt("AstaVerde", AstaVerdeDeployment.address);

        // Fund test users with USDC (realistic amounts)
        const users = [alice, bob, charlie, dave];
        for (const user of users) {
            await usdc.mint(user.address, ethers.parseUnits("50000", 6)); // 50k USDC each
            const balance = await usdc.balanceOf(user.address);
            console.log(`   Funded ${user.address} with ${ethers.formatUnits(balance, 6)} USDC`);
        }

        this.contracts = { usdc, astaVerde, scc, vault };
        this.users = { deployer, alice, bob, charlie, dave };

        console.log("✅ Contracts ready:");
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
        const tx = await astaVerde.mintBatch(
            [this.users.deployer.address, this.users.deployer.address, this.users.deployer.address],
            ["QmBasic1", "QmBasic2", "QmBasic3"],
        );
        const receipt = await tx.wait();
        console.log(`   Batch created in tx ${receipt.hash}`);

        const lastBatchID = await astaVerde.lastBatchID();
        console.log(`   ✅ Created batch #${lastBatchID} with 3 NFTs ready for purchase`);
    }

    async seedMarketplaceScenario() {
        console.log("🌱 Seeding active marketplace scenario...");
        const { usdc, astaVerde } = this.contracts;
        const { alice, bob } = this.users;

        // Create multiple batches at different stages
        console.log("   Creating first batch...");
        const tx1 = await astaVerde.mintBatch(
            [this.users.deployer.address, this.users.deployer.address],
            ["QmMarket1", "QmMarket2"],
        );
        const receipt1 = await tx1.wait();
        const firstBatchId = await astaVerde.lastBatchID();
        console.log(`   Batch ${firstBatchId} created in tx ${receipt1.hash}`);

        console.log("   Creating second batch...");
        const tx2 = await astaVerde.mintBatch(
            [this.users.deployer.address, this.users.deployer.address, this.users.deployer.address],
            ["QmMarket3", "QmMarket4", "QmMarket5"],
        );
        const receipt2 = await tx2.wait();
        const secondBatchId = await astaVerde.lastBatchID();
        console.log(`   Batch ${secondBatchId} created in tx ${receipt2.hash}`);

        // Alice buys some NFTs
        const batch1Price = await astaVerde.getCurrentBatchPrice(firstBatchId);
        // Approve slightly more than needed to avoid rounding issues
        const aliceApproval = batch1Price + (batch1Price / 100n);
        await usdc.connect(alice).approve(await astaVerde.getAddress(), aliceApproval);
        await astaVerde.connect(alice).buyBatch(firstBatchId, batch1Price, 1);

        // Bob buys and redeems one
        const batch2Price = await astaVerde.getCurrentBatchPrice(secondBatchId);
        const bobApproval = batch2Price + (batch2Price / 100n);
        await usdc.connect(bob).approve(await astaVerde.getAddress(), bobApproval);
        await astaVerde.connect(bob).buyBatch(secondBatchId, batch2Price, 1);

        const batch2Info = await astaVerde.getBatchInfo(secondBatchId);
        const tokenId = batch2Info[1][0]; // First token from batch 2
        await astaVerde.connect(bob).redeemToken(tokenId);

        const finalBatchId = await astaVerde.lastBatchID();
        console.log(`   Current lastBatchID: ${finalBatchId}`);
        console.log("   ✅ Created active marketplace:");
        console.log(`      - Batch #${firstBatchId}: 1 NFT sold (Alice owns), 1 available`);
        console.log(`      - Batch #${secondBatchId}: 1 NFT sold & redeemed (Bob), 2 available`);
        console.log("      - Users have USDC and some own NFTs");
    }

    async seedVaultScenario() {
        console.log("🌱 Seeding vault testing scenario...");
        const { usdc, astaVerde, vault } = this.contracts;
        const { alice, bob, charlie } = this.users;

        // Create NFTs for vault testing
        const tx = await astaVerde.mintBatch(
            [
                this.users.deployer.address,
                this.users.deployer.address,
                this.users.deployer.address,
                this.users.deployer.address,
            ],
            ["QmVault1", "QmVault2", "QmVault3", "QmVault4"],
        );
        const receipt = await tx.wait();
        console.log(`   Vault batch created in tx ${receipt.hash}`);
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
        // Re-read to ensure we pick the correct index regardless of prior buys
        const batchInfoAfterPurchases = await astaVerde.getBatchInfo(newBatchId);
        const charlieTokenId = batchInfoAfterPurchases[1][2];
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
        const tx = await this.contracts.astaVerde.mintBatch([this.users.deployer.address], ["QmAged1"]);
        await tx.wait();

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

    async startWebappDev(webappPath, resolve, reject) {
        // Default to 0.0.0.0 for better SSH/remote compatibility
        const host = process.env.WEBAPP_HOST || "0.0.0.0";
        // Default to 3001 to avoid common port 3000 conflicts (especially with SSH forwarding)
        let port = process.env.WEBAPP_PORT || "3001";
        
        // Check if port is available, try alternatives if not
        const isPortAvailable = async (port) => {
            return new Promise((resolve) => {
                const net = require("net");
                const server = net.createServer();
                server.once("error", () => resolve(false));
                server.once("listening", () => {
                    server.close();
                    resolve(true);
                });
                server.listen(port, "127.0.0.1");
            });
        };
        
        // Try ports 3000, 3001, 3002, etc. until we find an available one
        const originalPort = port;
        let attempts = 0;
        while (!(await isPortAvailable(port)) && attempts < 10) {
            console.log(`   ⚠️  Port ${port} is in use, trying ${parseInt(port) + 1}...`);
            port = String(parseInt(port) + 1);
            attempts++;
        }
        
        if (attempts >= 10) {
            reject(new Error(`Could not find an available port after trying ${originalPort}-${port}`));
            return;
        }

        // Remove --turbo flag to reduce memory usage, add memory limit
        const nextArgs = ["next", "dev", "-H", host, "-p", String(port)];
        console.log(`   ▶ Launching Next.js: npx ${nextArgs.join(" ")}`);
        this.webappProcess = spawn("npx", nextArgs, {
            cwd: webappPath,
            stdio: "inherit",
            env: { 
                ...process.env, 
                NODE_ENV: "development",
                NODE_OPTIONS: "--max-old-space-size=2048" // Limit Node.js memory to 2GB
            },
            // Make the process detached so we can kill the entire process group
            detached: process.platform !== "win32",
        });

        // Restart Next.js automatically if it crashes unexpectedly
        this.webappProcess.on("exit", (code, signal) => {
            console.error(`\n⚠️  Webapp process exited (code=${code}, signal=${signal}).`);
            if (this._restartingWebapp || process.env.NO_WEBAPP_AUTORESTART) {
                return;
            }
            this._restartingWebapp = true;
            // Attempt restart after a short delay
            setTimeout(async () => {
                try {
                    console.log("🔁 Restarting webapp dev server...");
                    await this.startWebappDev(webappPath, () => {}, (err) => console.error("Webapp restart error:", err));
                    console.log("   ✅ Webapp restarted");
                } catch (err) {
                    console.error("   ❌ Failed to restart webapp:", err);
                } finally {
                    this._restartingWebapp = false;
                }
            }, 1000);
        });
        this.webappProcess.on("error", (err) => {
            console.error("⚠️  Webapp process error:", err);
        });

        // Wait for webapp to actually accept connections before resolving
        (async () => {
            const displayHost = (host === "0.0.0.0" || host === "::") ? "localhost" : host;
            const candidates = [
                `http://127.0.0.1:${port}/`,
                `http://[::1]:${port}/`,
                `http://${displayHost}:${port}/`,
            ];
            const start = Date.now();
            const timeout = 20000;
            while (Date.now() - start < timeout) {
                for (const url of candidates) {
                    try {
                        await this.#httpGet(url);
                        console.log(`   ✅ Webapp starting at http://${displayHost}:${port}`);
                        if (host === "0.0.0.0") {
                            console.log(`   📡 Accessible from: http://localhost:${port}, http://127.0.0.1:${port}, or via SSH forwarding`);
                        }
                        console.log("   🔗 Use MetaMask with network: http://localhost:8545");
                        // Store the actual port for later reference
                        this.webappPort = port;
                        resolve();
                        return;
                    } catch (_) {
                        // try next candidate
                    }
                }
                await new Promise((r) => setTimeout(r, 300));
            }
            // If not ready in time, resolve anyway; subsequent warm-up will continue polling
            console.log("   ⚠ Timed out waiting for webapp readiness; continuing...");
            resolve();
        })().catch(reject);

        this.webappProcess.on("error", reject);
    }

    async warmWebappRoutes() {
        if (process.env.NO_WARM_ROUTES) {
            return;
        }
        const port = this.webappPort || "3000";
        const baseUrl = `http://localhost:${port}`;
        const altBaseUrl = `http://[::1]:${port}`;
        // Poll until server is responsive
        const waitForWeb = async () => {
            const start = Date.now();
            const timeout = 20000;
            while (Date.now() - start < timeout) {
                try {
                    await this.#httpGet(`${baseUrl}/`);
                    return;
                } catch (_) {
                    // try IPv6 loopback explicitly as a fallback
                    try {
                        await this.#httpGet(`${altBaseUrl}/`);
                        return;
                    } catch (_) {
                        // keep waiting
                    }
                    await new Promise((r) => setTimeout(r, 300));
                }
            }
        };
        await waitForWeb();

        const appDir = path.join(__dirname, "..", "webapp", "src", "app");
        const routes = this.#discoverRoutes(appDir);
        console.log(`⚡ Warming ${routes.length} routes to precompile dev pages...`);
        // Limit concurrency to avoid overwhelming dev server
        const concurrency = 4;
        let index = 0;
        const worker = async () => {
            while (index < routes.length) {
                const i = index++;
                const route = routes[i];
                try {
                    await this.#httpGet(`${baseUrl}${route}`);
                    // console.log(`   warmed ${route}`);
                } catch (_) {
                    // ignore
                }
            }
        };
        await Promise.all(Array.from({ length: concurrency }, () => worker()));
        console.log("   ✅ Route warming complete");
    }

    #discoverRoutes(appDir) {
        const routes = new Set();
        const walk = (dir, prefix) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            const hasPage = entries.some((e) => e.isFile() && e.name === "page.tsx");
            if (hasPage) {
                routes.add(prefix || "/");
            }
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    if (["styles"].includes(entry.name)) continue;
                    const seg = entry.name
                        .replace(/^\[(.+)\]$/, "1")
                        .replace(/^\[\.\.\.\w+\]$/, "1");
                    const childPrefix = prefix === "/" ? `/${seg}` : `${prefix}/${seg}`;
                    walk(path.join(dir, entry.name), prefix ? childPrefix : `/${seg}`);
                }
            }
        };
        walk(appDir, "/");
        // Ensure some critical dynamic routes are warmed with sample ids
        routes.add("/batch/1");
        routes.add("/token/1");
        return Array.from(routes);
    }

    async #httpGet(url) {
        const isHttps = url.startsWith("https:");
        const lib = isHttps ? https : http;
        return new Promise((resolve, reject) => {
            const req = lib.get(url, (res) => {
                // drain
                res.resume();
                res.on("end", resolve);
            });
            req.on("error", reject);
        });
    }

    async displayTestingInstructions(scenario) {
        const port = this.webappPort || "3000";
        console.log("\n" + "=".repeat(60));
        console.log("🧪 MANUAL QA TESTING ENVIRONMENT READY");
        console.log("=".repeat(60));
        console.log(`📊 Scenario: ${scenario}`);
        console.log(`🌐 Webapp: http://localhost:${port}`);
        console.log(`⛓️  Local blockchain: http://127.0.0.1:8545`);

        console.log("\n🔑 Test Accounts (all have 50k USDC):");
        Object.entries(this.users).forEach(([name, user], index) => {
            if (name !== "deployer") {
                console.log(`   ${name}: ${user.address}`);
            }
        });

        console.log("\n📝 MetaMask Setup:");
        console.log("   1. Add network: http://127.0.0.1:8545, Chain ID: 31337");
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
        console.log("   npx hardhat node --hostname 127.0.0.1 --port 8545   # Start local blockchain (required)");
        console.log("   npm run qa:fast                                     # Quick system validation");
        console.log("   npm run qa:status                                   # Health check");

        console.log("\n🛑 To stop: Press Ctrl+C (processes will be automatically cleaned up)");
    }

    cleanup() {
        this._shuttingDown = true;
        
        // Kill webapp process group
        if (this.webappProcess) {
            console.log("\n🧹 Shutting down webapp...");
            try {
                // On Unix, kill the entire process group
                if (process.platform !== "win32") {
                    process.kill(-this.webappProcess.pid, 'SIGTERM');
                } else {
                    this.webappProcess.kill('SIGTERM');
                }
            } catch (e) {
                // Fallback to regular kill
                try {
                    this.webappProcess.kill('SIGKILL');
                } catch (e2) {
                    console.log("   ⚠️  Could not kill webapp process");
                }
            }
        }
        
        // Kill hardhat node process group
        if (this.nodeProcess && this.startedNode) {
            console.log("🧹 Shutting down local Hardhat node...");
            try {
                // On Unix, kill the entire process group
                if (process.platform !== "win32") {
                    process.kill(-this.nodeProcess.pid, 'SIGTERM');
                } else {
                    this.nodeProcess.kill('SIGTERM');
                }
            } catch (e) {
                // Fallback to regular kill
                try {
                    this.nodeProcess.kill('SIGKILL');
                } catch (e2) {
                    console.log("   ⚠️  Could not kill hardhat node process");
                }
            }
        }
        
        // Give processes a moment to clean up, then force exit
        setTimeout(() => {
            process.exit(0);
        }, 500);
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

    // Handle cleanup on multiple signals
    const handleExit = () => {
        if (!env._exitHandled) {
            env._exitHandled = true;
            env.cleanup();
        }
    };
    
    // Register multiple signal handlers for robust cleanup
    process.on("SIGINT", handleExit);  // Ctrl+C
    process.on("SIGTERM", handleExit); // Termination signal
    process.on("SIGHUP", handleExit);  // Terminal closed
    process.on("SIGQUIT", handleExit); // Quit signal
    
    // Handle uncaught exceptions
    process.on("uncaughtException", (err) => {
        console.error("\n❌ Uncaught exception:", err);
        handleExit();
    });
    
    process.on("unhandledRejection", (err) => {
        console.error("\n❌ Unhandled rejection:", err);
        handleExit();
    });

    try {
        // Ensure a local JSON-RPC is available
        await env.ensureHardhatNodeRunning();

        await env.setupContracts();

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
        // Warm routes in background to precompile pages
        env.warmWebappRoutes().catch(() => {});
        await env.displayTestingInstructions(scenario);

        // Keep the process running indefinitely using an active timer to keep the event loop alive
        setInterval(() => {}, 1 << 30);
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
