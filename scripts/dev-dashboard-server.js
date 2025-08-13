#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { exec } = require("child_process");

const PORT = 8080;

// Contract addresses and ABIs
const CONTRACTS = {
    astaverde: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    usdc: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    ecoStabilizer: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    scc: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
};

// Simple ABIs
const ABI = {
    astaverde: [
        "function lastBatchID() view returns (uint256)",
        "function lastTokenID() view returns (uint256)",
        "function getCurrentBatchPrice(uint256) view returns (uint256)",
        "function getBatchInfo(uint256) view returns (tuple(uint256, uint256[], uint256, uint256, uint256))",
    ],
    usdc: ["function balanceOf(address) view returns (uint256)"],
    scc: ["function balanceOf(address) view returns (uint256)"],
};

// Setup provider
const provider = new ethers.JsonRpcProvider("http://localhost:8545");

// API endpoints
async function handleAPI(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        switch (url.pathname) {
            case "/api/status":
                const network = await provider.getNetwork();
                const blockNumber = await provider.getBlockNumber();
                let gasPrice = "0";
                try {
                    const feeData = await provider.getFeeData();
                    if (feeData.gasPrice) {
                        gasPrice = ethers.formatUnits(feeData.gasPrice, "gwei");
                    }
                } catch (e) {
                    // Default gas price for local network
                    gasPrice = "0";
                }
                res.writeHead(200);
                res.end(
                    JSON.stringify({
                        connected: true,
                        chainId: Number(network.chainId),
                        blockNumber,
                        gasPrice: gasPrice,
                    }),
                );
                break;

            case "/api/batch-info":
                const astaverde = new ethers.Contract(CONTRACTS.astaverde, ABI.astaverde, provider);
                const lastBatchId = await astaverde.lastBatchID();
                const lastTokenId = await astaverde.lastTokenID();
                let currentPrice = "0";
                let basePrice = "250"; // Default base price

                if (lastBatchId > 0) {
                    const price = await astaverde.getCurrentBatchPrice(lastBatchId);
                    currentPrice = ethers.formatUnits(price, 6);
                    // Could calculate days since launch here if needed
                }

                res.writeHead(200);
                res.end(
                    JSON.stringify({
                        lastBatchId: lastBatchId.toString(),
                        lastTokenId: lastTokenId.toString(),
                        currentPrice: currentPrice + " USDC",
                        basePrice: basePrice + " USDC",
                        daysSince: "0",
                    }),
                );
                break;

            case "/api/balances":
                const deployer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
                const ethBalance = await provider.getBalance(deployer);

                const usdcContract = new ethers.Contract(CONTRACTS.usdc, ABI.usdc, provider);
                const usdcBalance = await usdcContract.balanceOf(deployer);

                const sccContract = new ethers.Contract(CONTRACTS.scc, ABI.scc, provider);
                const sccBalance = await sccContract.balanceOf(deployer);

                res.writeHead(200);
                res.end(
                    JSON.stringify({
                        eth: ethers.formatEther(ethBalance),
                        usdc: ethers.formatUnits(usdcBalance, 6),
                        scc: ethers.formatUnits(sccBalance, 18),
                    }),
                );
                break;

            case "/api/mint":
                // Handle POST request with custom mint count
                if (req.method === "POST") {
                    let body = "";
                    req.on("data", (chunk) => (body += chunk));
                    req.on("end", () => {
                        try {
                            const data = JSON.parse(body);
                            const count = data.count || 3;
                            exec(`node scripts/mint-local-batch.js ${count}`, (error, stdout, stderr) => {
                                if (error) {
                                    res.writeHead(500);
                                    res.end(JSON.stringify({ error: error.message }));
                                } else {
                                    res.writeHead(200);
                                    res.end(JSON.stringify({ success: true, output: stdout }));
                                }
                            });
                        } catch (error) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ error: "Invalid request body" }));
                        }
                    });
                } else {
                    // Default GET request
                    exec("node scripts/mint-local-batch.js 3", (error, stdout, stderr) => {
                        if (error) {
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: error.message }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true, output: stdout }));
                        }
                    });
                }
                break;

            case "/api/check-balances":
                exec("node scripts/check-balances.js", (error, stdout, stderr) => {
                    if (error) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: error.message }));
                    } else {
                        res.writeHead(200);
                        res.end(JSON.stringify({ success: true, output: stdout }));
                    }
                });
                break;

            case "/api/test-flow":
                // Handle POST request with custom account
                if (req.method === "POST") {
                    let body = "";
                    req.on("data", (chunk) => (body += chunk));
                    req.on("end", () => {
                        // For now, just run the standard test flow
                        exec("node scripts/test-user-flow.js", (error, stdout, stderr) => {
                            if (error) {
                                res.writeHead(500);
                                res.end(JSON.stringify({ error: error.message }));
                            } else {
                                res.writeHead(200);
                                res.end(JSON.stringify({ success: true, output: stdout }));
                            }
                        });
                    });
                } else {
                    exec("node scripts/test-user-flow.js", (error, stdout, stderr) => {
                        if (error) {
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: error.message }));
                        } else {
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true, output: stdout }));
                        }
                    });
                }
                break;

            case "/api/vault-stats":
                try {
                    const sccContract = new ethers.Contract(CONTRACTS.scc, 
                        ["function totalSupply() view returns (uint256)"], provider);

                    const totalSCC = await sccContract.totalSupply();
                    const totalDeposits = Number(ethers.formatUnits(totalSCC, 18)) / 20; // 20 SCC per NFT

                    res.writeHead(200);
                    res.end(
                        JSON.stringify({
                            totalDeposits: Math.floor(totalDeposits),
                            totalSCC: ethers.formatUnits(totalSCC, 18),
                            activePositions: Math.floor(totalDeposits),
                        }),
                    );
                } catch (error) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ totalDeposits: 0, totalSCC: "0", activePositions: 0 }));
                }
                break;

            default:
                // Check if it's a balance request for a specific address
                if (url.pathname.startsWith("/api/balance/")) {
                    const address = url.pathname.replace("/api/balance/", "");

                    const ethBalance = await provider.getBalance(address);
                    const usdcContract = new ethers.Contract(CONTRACTS.usdc, ABI.usdc, provider);
                    const usdcBalance = await usdcContract.balanceOf(address);
                    const sccContract = new ethers.Contract(CONTRACTS.scc, ABI.scc, provider);
                    const sccBalance = await sccContract.balanceOf(address);

                    res.writeHead(200);
                    res.end(
                        JSON.stringify({
                            eth: ethers.formatEther(ethBalance),
                            usdc: ethers.formatUnits(usdcBalance, 6),
                            scc: ethers.formatUnits(sccBalance, 18),
                        }),
                    );
                } else {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: "Not found" }));
                }
        }
    } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
    }
}

// HTML content
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AstaVerde Dev Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
        }
        
        .card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.15);
        }
        
        .card h2 {
            color: #333;
            margin-bottom: 15px;
            font-size: 1.3rem;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        
        .info-row:last-child {
            border-bottom: none;
        }
        
        .label {
            color: #666;
            font-weight: 500;
        }
        
        .value {
            color: #333;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
        }
        
        .address {
            font-size: 0.75rem;
            word-break: break-all;
        }
        
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s;
            margin: 5px;
            font-weight: 600;
        }
        
        button:hover {
            transform: scale(1.05);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        button:active {
            transform: scale(0.98);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .button-group {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }
        
        .status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        
        .status.connected {
            background: #10b981;
            color: white;
        }
        
        .status.disconnected {
            background: #ef4444;
            color: white;
        }
        
        .balance-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        
        .balance-item {
            background: #f7f7f7;
            padding: 10px;
            border-radius: 6px;
            text-align: center;
        }
        
        .balance-value {
            font-size: 1.1rem;
            font-weight: bold;
            color: #333;
        }
        
        .balance-label {
            font-size: 0.85rem;
            color: #666;
            margin-top: 4px;
        }
        
        #console {
            background: #1a1a1a;
            color: #0f0;
            font-family: 'Courier New', monospace;
            padding: 15px;
            border-radius: 8px;
            max-height: 200px;
            overflow-y: auto;
            font-size: 0.85rem;
            margin-top: 10px;
            white-space: pre-wrap;
        }
        
        .loader {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-left: 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 AstaVerde Dev Dashboard</h1>
        
        <div class="grid">
            <!-- Network Status -->
            <div class="card">
                <h2>⛓️ Network Status</h2>
                <div class="info-row">
                    <span class="label">Status:</span>
                    <span class="value">
                        <span id="network-status" class="status disconnected">Connecting...</span>
                    </span>
                </div>
                <div class="info-row">
                    <span class="label">Chain ID:</span>
                    <span class="value" id="chain-id">-</span>
                </div>
                <div class="info-row">
                    <span class="label">RPC URL:</span>
                    <span class="value">http://localhost:8545</span>
                </div>
                <div class="info-row">
                    <span class="label">Block Number:</span>
                    <span class="value" id="block-number">-</span>
                </div>
            </div>
            
            <!-- Contract Addresses -->
            <div class="card">
                <h2>📝 Contract Addresses</h2>
                <div class="info-row">
                    <span class="label">AstaVerde:</span>
                    <span class="value address">0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512</span>
                </div>
                <div class="info-row">
                    <span class="label">USDC:</span>
                    <span class="value address">0x5FbDB2315678afecb367f032d93F642f64180aa3</span>
                </div>
                <div class="info-row">
                    <span class="label">EcoStabilizer:</span>
                    <span class="value address">0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9</span>
                </div>
                <div class="info-row">
                    <span class="label">SCC:</span>
                    <span class="value address">0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0</span>
                </div>
            </div>
            
            <!-- Test Accounts -->
            <div class="card">
                <h2>👥 Deployer Account</h2>
                <div class="info-row">
                    <span class="label">Address:</span>
                    <span class="value address">0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</span>
                </div>
                <div class="balance-grid">
                    <div class="balance-item">
                        <div class="balance-value" id="deployer-eth">-</div>
                        <div class="balance-label">ETH</div>
                    </div>
                    <div class="balance-item">
                        <div class="balance-value" id="deployer-usdc">-</div>
                        <div class="balance-label">USDC</div>
                    </div>
                    <div class="balance-item">
                        <div class="balance-value" id="deployer-scc">-</div>
                        <div class="balance-label">SCC</div>
                    </div>
                </div>
                <button onclick="copyAddress('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')">
                    📋 Copy Private Key
                </button>
            </div>
            
            <!-- Quick Actions -->
            <div class="card">
                <h2>⚡ Quick Actions</h2>
                <div class="button-group">
                    <button onclick="mintBatch()" id="mint-btn">🎨 Mint Batch (3 NFTs)</button>
                    <button onclick="checkBalances()" id="balances-btn">💰 Check All Balances</button>
                    <button onclick="runTestFlow()" id="test-btn">🔄 Run Test Flow</button>
                    <button onclick="openWebapp()">🌐 Open Webapp</button>
                </div>
            </div>
            
            <!-- Batch Info -->
            <div class="card">
                <h2>📦 Batch Info</h2>
                <div class="info-row">
                    <span class="label">Last Batch ID:</span>
                    <span class="value" id="last-batch-id">-</span>
                </div>
                <div class="info-row">
                    <span class="label">Last Token ID:</span>
                    <span class="value" id="last-token-id">-</span>
                </div>
                <div class="info-row">
                    <span class="label">Current Price:</span>
                    <span class="value" id="current-price">-</span>
                </div>
                <button onclick="updateBatchInfo()">🔄 Refresh</button>
            </div>
            
            <!-- Console Output -->
            <div class="card" style="grid-column: 1 / -1;">
                <h2>📟 Console</h2>
                <div id="console">Ready for commands...</div>
            </div>
        </div>
    </div>
    
    <script>
        let connected = false;
        
        // Console logging
        function log(message, type = 'info') {
            const console = document.getElementById('console');
            const time = new Date().toLocaleTimeString();
            const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '💬';
            console.textContent += '\\n[' + time + '] ' + prefix + ' ' + message;
            console.scrollTop = console.scrollHeight;
        }
        
        // API calls
        async function callAPI(endpoint) {
            try {
                const response = await fetch('http://localhost:8080' + endpoint);
                return await response.json();
            } catch (error) {
                throw error;
            }
        }
        
        // Update status
        async function updateStatus() {
            try {
                const status = await callAPI('/api/status');
                connected = true;
                document.getElementById('network-status').className = 'status connected';
                document.getElementById('network-status').textContent = 'Connected';
                document.getElementById('chain-id').textContent = status.chainId;
                document.getElementById('block-number').textContent = status.blockNumber;
            } catch (error) {
                connected = false;
                document.getElementById('network-status').className = 'status disconnected';
                document.getElementById('network-status').textContent = 'Disconnected';
            }
        }
        
        // Update batch info
        async function updateBatchInfo() {
            if (!connected) return;
            try {
                const info = await callAPI('/api/batch-info');
                document.getElementById('last-batch-id').textContent = info.lastBatchId;
                document.getElementById('last-token-id').textContent = info.lastTokenId;
                document.getElementById('current-price').textContent = info.currentPrice;
                log('Batch info updated');
            } catch (error) {
                log('Failed to update batch info: ' + error.message, 'error');
            }
        }
        
        // Update balances
        async function updateBalances() {
            if (!connected) return;
            try {
                const balances = await callAPI('/api/balances');
                document.getElementById('deployer-eth').textContent = 
                    parseFloat(balances.eth).toFixed(2);
                document.getElementById('deployer-usdc').textContent = 
                    parseFloat(balances.usdc).toFixed(0);
                document.getElementById('deployer-scc').textContent = 
                    parseFloat(balances.scc).toFixed(2);
            } catch (error) {
                log('Failed to update balances: ' + error.message, 'error');
            }
        }
        
        // Quick Actions
        async function mintBatch() {
            const btn = document.getElementById('mint-btn');
            btn.disabled = true;
            log('Minting new batch...');
            try {
                const result = await callAPI('/api/mint');
                if (result.success) {
                    log('Batch minted successfully!', 'success');
                    setTimeout(() => {
                        updateBatchInfo();
                        updateBalances();
                    }, 2000);
                } else {
                    log('Mint failed: ' + result.error, 'error');
                }
            } catch (error) {
                log('Mint failed: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
            }
        }
        
        async function checkBalances() {
            const btn = document.getElementById('balances-btn');
            btn.disabled = true;
            log('Checking all balances...');
            try {
                const result = await callAPI('/api/check-balances');
                if (result.success) {
                    log('Balance check complete (see terminal for details)', 'success');
                } else {
                    log('Check failed: ' + result.error, 'error');
                }
            } catch (error) {
                log('Check failed: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
            }
        }
        
        async function runTestFlow() {
            const btn = document.getElementById('test-btn');
            btn.disabled = true;
            log('Running automated test flow...');
            try {
                const result = await callAPI('/api/test-flow');
                if (result.success) {
                    log('Test flow complete (see terminal for details)', 'success');
                    setTimeout(() => {
                        updateBatchInfo();
                        updateBalances();
                    }, 3000);
                } else {
                    log('Test failed: ' + result.error, 'error');
                }
            } catch (error) {
                log('Test failed: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
            }
        }
        
        function openWebapp() {
            window.open('http://localhost:3000', '_blank');
            log('Opening webapp in new window');
        }
        
        function copyAddress(text) {
            navigator.clipboard.writeText(text);
            log('Copied to clipboard');
        }
        
        // Initialize
        async function init() {
            log('Initializing dashboard...');
            await updateStatus();
            if (connected) {
                log('Connected to local node', 'success');
                await updateBatchInfo();
                await updateBalances();
                
                // Start monitoring
                setInterval(updateStatus, 2000);
                setInterval(updateBalances, 5000);
            } else {
                log('Failed to connect to local node - ensure npm run dev is running', 'error');
            }
        }
        
        // Start on load
        window.addEventListener('load', init);
    </script>
</body>
</html>`;

// Create server
const server = http.createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
        handleAPI(req, res);
    } else {
        // Try to serve v2 dashboard first
        const v2HtmlPath = path.join(__dirname, "dev-dashboard-v2.html");

        fs.readFile(v2HtmlPath, "utf8", (err, data) => {
            if (err) {
                // Fallback to embedded HTML if file not found
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(HTML_CONTENT);
            } else {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(data);
            }
        });
    }
});

// Start server
server.listen(PORT, () => {
    console.log(`\n🚀 AstaVerde Dev Dashboard Server`);
    console.log(`\n📊 Dashboard: http://localhost:${PORT}`);
    console.log(`\n💡 Make sure 'npm run dev' is running in another terminal\n`);
});
