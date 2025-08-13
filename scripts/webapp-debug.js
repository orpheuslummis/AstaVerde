const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Webapp debugging script that captures and logs webapp errors
 * for Claude Code visibility
 */

async function runWebappWithLogging() {
    console.log("🌐 Starting webapp with error logging...");

    // Ensure webapp directory exists
    const webappDir = path.join(process.cwd(), "webapp");
    if (!fs.existsSync(webappDir)) {
        console.error("❌ Webapp directory not found. Run from project root.");
        process.exit(1);
    }

    // Log file for capturing all output
    const logFile = path.join(process.cwd(), "webapp-debug.log");
    const logStream = fs.createWriteStream(logFile, { flags: "w" });

    console.log(`📝 Logging all webapp output to: ${logFile}`);
    console.log("📊 Real-time monitoring enabled - errors will be visible to Claude Code\n");

    // Start Next.js dev server
    const webappProcess = spawn("npm", ["run", "dev"], {
        cwd: webappDir,
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0" }, // Disable colors for cleaner logs
    });

    // Log both stdout and stderr with timestamps
    const logWithTimestamp = (data, type = "INFO") => {
        const timestamp = new Date().toISOString();
        const message = `[${timestamp}] [${type}] ${data.toString()}`;

        // Write to log file
        logStream.write(message);

        // Also output to console with color coding
        if (type === "ERROR") {
            console.error(`🔴 ${message.trim()}`);
        } else if (message.includes("error") || message.includes("Error")) {
            console.error(`🟡 ${message.trim()}`);
        } else if (message.includes("ready") || message.includes("compiled")) {
            console.log(`🟢 ${message.trim()}`);
        } else {
            console.log(`⚪ ${message.trim()}`);
        }
    };

    webappProcess.stdout.on("data", (data) => {
        logWithTimestamp(data, "STDOUT");
    });

    webappProcess.stderr.on("data", (data) => {
        logWithTimestamp(data, "STDERR");
    });

    webappProcess.on("error", (error) => {
        const errorMsg = `Failed to start webapp process: ${error.message}\n`;
        logWithTimestamp(errorMsg, "PROCESS_ERROR");
    });

    webappProcess.on("exit", (code, signal) => {
        const exitMsg = `Webapp process exited with code ${code} and signal ${signal}\n`;
        logWithTimestamp(exitMsg, "EXIT");
        logStream.end();

        if (code !== 0) {
            console.log("\n❌ Webapp exited with errors. Check the log above for details.");
            console.log(`📝 Full log available at: ${logFile}`);
        }

        process.exit(code);
    });

    // Handle graceful shutdown
    process.on("SIGINT", () => {
        console.log("\n🛑 Shutting down webapp...");
        webappProcess.kill("SIGTERM");

        setTimeout(() => {
            webappProcess.kill("SIGKILL");
        }, 5000);
    });

    process.on("SIGTERM", () => {
        webappProcess.kill("SIGTERM");
    });

    // Monitor for specific error patterns and provide helpful suggestions
    let errorPatterns = [
        {
            pattern: /Module not found/i,
            suggestion: "📦 Missing dependency. Run 'npm install' in webapp directory.",
        },
        {
            pattern: /EADDRINUSE.*3000/i,
            suggestion: "🔌 Port 3000 already in use. Kill existing process or use different port.",
        },
        {
            pattern: /Contract.*not found/i,
            suggestion: "📋 Contract not deployed. Run 'node scripts/deploy-local-qa.js' first.",
        },
        {
            pattern: /Failed to compile/i,
            suggestion: "🔨 Compilation error. Check TypeScript types and imports.",
        },
        {
            pattern: /RPC.*connection/i,
            suggestion: "🌐 RPC connection issue. Ensure local node is running or check network config.",
        },
        {
            pattern: /Wallet.*not connected/i,
            suggestion: "👛 Wallet connection issue. Check wallet setup and network configuration.",
        },
    ];

    // Set up pattern monitoring
    const checkForPatterns = (data) => {
        const text = data.toString();
        for (const { pattern, suggestion } of errorPatterns) {
            if (pattern.test(text)) {
                console.log(`\n💡 SUGGESTION: ${suggestion}\n`);
                logWithTimestamp(`SUGGESTION: ${suggestion}\n`, "HELP");
            }
        }
    };

    webappProcess.stdout.on("data", checkForPatterns);
    webappProcess.stderr.on("data", checkForPatterns);

    // Keep the process alive
    console.log("🎯 Webapp monitoring started. Press Ctrl+C to stop.");
    console.log("🔍 Watching for errors, compilation issues, and connection problems...\n");
}

// Function to check webapp logs
function checkWebappLogs() {
    const logFile = path.join(process.cwd(), "webapp-debug.log");

    if (!fs.existsSync(logFile)) {
        console.log("📄 No webapp debug log found. Start webapp with logging first:");
        console.log("   node scripts/webapp-debug.js");
        return;
    }

    console.log("📋 Recent webapp log entries:\n");

    const logContent = fs.readFileSync(logFile, "utf8");
    const lines = logContent.split("\n").filter((line) => line.trim());

    // Show last 50 lines with error highlighting
    const recentLines = lines.slice(-50);

    recentLines.forEach((line) => {
        if (line.includes("[ERROR]") || line.includes("error") || line.includes("Error")) {
            console.error(`🔴 ${line}`);
        } else if (line.includes("warning") || line.includes("Warning")) {
            console.warn(`🟡 ${line}`);
        } else if (line.includes("ready") || line.includes("compiled") || line.includes("success")) {
            console.log(`🟢 ${line}`);
        } else {
            console.log(`⚪ ${line}`);
        }
    });

    console.log(`\n📊 Total log lines: ${lines.length}`);
    console.log(`📝 Full log: ${logFile}`);
}

// Command line interface
if (require.main === module) {
    const command = process.argv[2];

    if (command === "logs") {
        checkWebappLogs();
    } else if (command === "help") {
        console.log("🌐 Webapp Debug Script");
        console.log("\nCommands:");
        console.log("  node scripts/webapp-debug.js        - Start webapp with error logging");
        console.log("  node scripts/webapp-debug.js logs   - View recent webapp logs");
        console.log("  node scripts/webapp-debug.js help   - Show this help");
    } else {
        runWebappWithLogging();
    }
}

module.exports = { runWebappWithLogging, checkWebappLogs };
