#!/usr/bin/env node

/**
 * Reliable local development starter
 * Handles port conflicts, orphaned processes, and ensures clean startup
 */

const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");

let hardhatProcess = null;
let webappProcess = null;
let isCleaningUp = false;

// Register cleanup handlers
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
process.on("uncaughtException", (err) => {
    console.error("\n❌ Uncaught exception:", err);
    cleanup();
});

function cleanup() {
    if (isCleaningUp) return;
    isCleaningUp = true;

    console.log("\n🧹 Shutting down...");

    // Kill webapp process and all its children
    if (webappProcess) {
        try {
            process.kill(-webappProcess.pid, "SIGTERM");
        } catch (e) {}
        webappProcess = null;
    }

    // Kill hardhat process and all its children
    if (hardhatProcess) {
        try {
            process.kill(-hardhatProcess.pid, "SIGTERM");
        } catch (e) {}
        hardhatProcess = null;
    }

    // Final cleanup of any remaining processes
    cleanupPorts();

    console.log("✅ Cleanup complete");
    process.exit(0);
}

function cleanupPorts() {
    // Kill anything on port 8545 (Hardhat)
    try {
        execSync("lsof -i :8545 -t | xargs -r kill -9 2>/dev/null", { stdio: "ignore" });
    } catch (e) {}

    // Kill anything on ports 3000-3002 (Next.js might use fallback ports)
    for (let port = 3000; port <= 3002; port++) {
        try {
            execSync(`lsof -i :${port} -t | xargs -r kill -9 2>/dev/null`, { stdio: "ignore" });
        } catch (e) {}
    }

    // Kill any Next.js dev processes
    try {
        execSync("pkill -f 'next dev' 2>/dev/null", { stdio: "ignore" });
    } catch (e) {}

    // Kill any Hardhat node processes
    try {
        execSync("pkill -f 'hardhat node' 2>/dev/null", { stdio: "ignore" });
    } catch (e) {}
}

async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => {
            server.close();
            resolve(true);
        });
        server.listen(port, "127.0.0.1");
    });
}

async function waitForPort(port, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        const server = net.createConnection({ port, host: "127.0.0.1" }, () => {
            server.end();
            return true;
        });

        await new Promise((resolve) => {
            server.on("connect", () => {
                server.end();
                resolve(true);
            });
            server.on("error", () => {
                resolve(false);
            });
        });

        const isConnected = await new Promise((resolve) => {
            const testServer = net.createConnection({ port, host: "127.0.0.1" });
            testServer.on("connect", () => {
                testServer.end();
                resolve(true);
            });
            testServer.on("error", () => {
                resolve(false);
            });
            setTimeout(() => {
                testServer.destroy();
                resolve(false);
            }, 500);
        });

        if (isConnected) return true;
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
}

async function main() {
    console.log("🚀 Starting AstaVerde Local Development\n");

    // 0. Aggressive cleanup of any existing processes
    console.log("0️⃣  Cleaning up any existing processes...");
    cleanupPorts();

    // Wait a bit for ports to be released
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify ports are actually free
    const hardhatPortFree = await isPortAvailable(8545);
    const webappPortFree = await isPortAvailable(3000);

    if (!hardhatPortFree) {
        console.log("⚠️  Port 8545 still in use, forcing cleanup...");
        execSync("lsof -i :8545 -t | xargs -r kill -9 2>/dev/null || true", { stdio: "ignore" });
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!webappPortFree) {
        console.log("⚠️  Port 3000 still in use, forcing cleanup...");
        execSync("lsof -i :3000 -t | xargs -r kill -9 2>/dev/null || true", { stdio: "ignore" });
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // 1. Compile contracts first to ensure ABIs are up to date
    console.log("\n1️⃣  Compiling contracts to ensure ABIs are up-to-date...");
    try {
        execSync("npm run compile", { stdio: "inherit" });
        console.log("   ✅ Contracts compiled successfully");
    } catch (error) {
        console.error("❌ Compilation failed:", error.message);
        cleanup();
        return;
    }

    // 2. Start Hardhat node
    console.log("\n2️⃣  Starting Hardhat node...");
    hardhatProcess = spawn("npx", ["hardhat", "node", "--no-deploy"], {
        stdio: "inherit",
        detached: process.platform !== "win32", // Only on Unix-like systems
    });

    // Wait for Hardhat to be ready by checking if port 8545 is open
    console.log("   Waiting for Hardhat node to be ready...");
    const hardhatReady = await waitForPort(8545);
    if (!hardhatReady) {
        console.error("❌ Hardhat node failed to start");
        cleanup();
        return;
    }
    console.log("   ✅ Hardhat node is ready");

    // 3. Deploy contracts
    console.log("\n3️⃣  Deploying contracts...");
    try {
        execSync("npx hardhat deploy --network localhost", { stdio: "inherit" });
    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        cleanup();
        return;
    }

    // 4. Update webapp env file
    console.log("\n4️⃣  Updating webapp configuration...");
    let deployments;
    try {
        deployments = {
            astaverde: JSON.parse(fs.readFileSync("deployments/localhost/AstaVerde.json")).address,
            usdc: JSON.parse(fs.readFileSync("deployments/localhost/MockUSDC.json")).address,
        };

        // Try to read vault contracts if they exist
        try {
            deployments.scc = JSON.parse(fs.readFileSync("deployments/localhost/StabilizedCarbonCoin.json")).address;
            deployments.ecostabilizer = JSON.parse(fs.readFileSync("deployments/localhost/EcoStabilizer.json")).address;
            console.log("   ✅ Found v2 vault contracts");
        } catch {
            console.log("   ℹ️  v2 vault contracts not deployed (optional)");
        }
    } catch (error) {
        console.error("❌ Failed to read deployment files:", error.message);
        cleanup();
        return;
    }

    let envContent = `# Local Development Configuration
NEXT_PUBLIC_CHAIN_SELECTION=local
NEXT_PUBLIC_ASTAVERDE_ADDRESS=${deployments.astaverde}
NEXT_PUBLIC_USDC_ADDRESS=${deployments.usdc}
NEXT_PUBLIC_USDC_DECIMALS=6
NEXT_PUBLIC_IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
NEXT_PUBLIC_ALCHEMY_API_KEY=demo
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=demo
`;

    // Add vault contracts if they exist
    if (deployments.scc && deployments.ecostabilizer) {
        envContent += `NEXT_PUBLIC_SCC_ADDRESS=${deployments.scc}
NEXT_PUBLIC_ECOSTABILIZER_ADDRESS=${deployments.ecostabilizer}
`;
    }

    fs.writeFileSync(path.join(__dirname, "../webapp/.env.local"), envContent);
    console.log("   ✅ Webapp configured");

    // 5. Start webapp with explicit port
    console.log("\n5️⃣  Starting webapp...");

    // Set PORT environment variable to force Next.js to use port 3000
    const webappEnv = { ...process.env, PORT: "3000" };

    webappProcess = spawn("npm", ["run", "dev"], {
        cwd: path.join(__dirname, "../webapp"),
        stdio: "inherit",
        env: webappEnv,
        detached: process.platform !== "win32", // Only on Unix-like systems
    });

    // Wait a bit for webapp to start
    console.log("   Waiting for webapp to be ready...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check if webapp started successfully
    const webappReady = await waitForPort(3000);
    if (!webappReady) {
        console.warn("⚠️  Webapp might be on a different port, checking 3001...");
        const webapp3001 = await waitForPort(3001);
        if (webapp3001) {
            console.log("   ℹ️  Webapp is running on port 3001");
        }
    } else {
        console.log("   ✅ Webapp is ready on port 3000");
    }

    // 5. Show instructions
    const finalPort = webappReady ? 3000 : 3001;
    console.log("\n" + "=".repeat(60));
    console.log("✅ LOCAL DEVELOPMENT ENVIRONMENT READY!");
    console.log("=".repeat(60));
    console.log("\n📍 Access Points:");
    console.log(`   Webapp:     http://localhost:${finalPort}`);
    console.log("   Blockchain: http://localhost:8545");
    console.log("\n🔑 Test Account (import to MetaMask):");
    console.log("   Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    console.log("   Key:     0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
    console.log("\n📦 Deployed Contracts:");
    console.log(`   AstaVerde: ${deployments.astaverde}`);
    console.log(`   MockUSDC:  ${deployments.usdc}`);
    if (deployments.scc && deployments.ecostabilizer) {
        console.log(`   SCC:       ${deployments.scc}`);
        console.log(`   Vault:     ${deployments.ecostabilizer}`);
    }
    console.log("\n🛑 Stop: Press Ctrl+C or run: npm run dev:local:stop");
    console.log("=".repeat(60));
}

main().catch((error) => {
    console.error("❌ Error:", error);
    cleanup();
});
