#!/usr/bin/env node

/**
 * Unified development environment orchestrator
 * Manages different scenarios: complete, minimal, testing
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Import the all-in-one-dev functionality
const { AllInOneDev } = require("./all-in-one-dev.js");

async function main() {
    const scenario = process.env.SCENARIO || "complete";

    console.log(`🚀 Starting AstaVerde Development Environment (${scenario} mode)\n`);

    switch (scenario) {
        case "complete":
            // Use the all-in-one-dev setup with improvements
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
            break;

        case "minimal":
            console.log("Running minimal setup (node + contracts only)...");
            // Just start node and deploy contracts
            const minDev = new AllInOneDev();
            await minDev.startHardhatNode();
            await minDev.deployContracts();
            console.log("✅ Minimal setup complete - node running with contracts deployed");
            return new Promise(() => {});

        case "testing":
            console.log("Running testing setup (for automated tests)...");
            // Start node, deploy, and exit
            const testDev = new AllInOneDev();
            await testDev.startHardhatNode();
            await testDev.deployContracts();
            await testDev.seedMarketplaceData();
            console.log("✅ Testing setup complete");
            process.exit(0);
            break;

        default:
            console.error(`Unknown scenario: ${scenario}`);
            console.log("Available scenarios: complete, minimal, testing");
            process.exit(1);
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}

module.exports = { main };
