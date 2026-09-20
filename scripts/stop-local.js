#!/usr/bin/env node

/**
 * Stop local development environment
 * Kills any processes using ports 8545 (Hardhat) and 3000 (Next.js)
 */

const { execSync } = require("child_process");
const path = require("path");

// Scope process cleanup to this checkout, so a bare "hardhat node" or "next dev"
// belonging to another repo on this machine is never killed.
const repoRoot = path.resolve(__dirname, "..");

console.log("🛑 Stopping AstaVerde Local Development\n");

// Kill processes on port 8545 (Hardhat)
console.log("Stopping Hardhat node (port 8545)...");
try {
    execSync("lsof -i :8545 -t | xargs -r kill -9 2>/dev/null", { stdio: "ignore" });
    console.log("✅ Hardhat node stopped");
} catch (e) {
    console.log("ℹ️  No Hardhat node running");
}

// Kill processes on port 3000 (Next.js)
console.log("Stopping webapp (port 3000)...");
try {
    execSync("lsof -i :3000 -t | xargs -r kill -9 2>/dev/null", { stdio: "ignore" });
    console.log("✅ Webapp stopped");
} catch (e) {
    console.log("ℹ️  No webapp running");
}

// Also try to clean up any node processes related to our project
console.log("Cleaning up any orphaned processes...");
try {
    // Kill any hardhat node started from this checkout
    execSync(`pkill -f "${repoRoot}.*hardhat node" 2>/dev/null`, { stdio: "ignore" });
    // Kill any Next.js dev server started from this checkout
    execSync(`pkill -f "${repoRoot}.*next dev" 2>/dev/null`, { stdio: "ignore" });
} catch (e) {
    // Ignore - these might not exist
}

console.log("\n✨ All local development processes stopped");
