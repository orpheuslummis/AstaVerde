#!/usr/bin/env node

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

// Configuration
const IPFS_GATEWAY = process.env.IPFS_GATEWAY_URL || "https://ipfs.io/ipfs/";
const BASE_URI = "ipfs://"; // Base URI that will be combined with CID

async function main() {
    const network = process.argv[2] || "sepolia";
    
    console.log(`Setting metadata URI for network: ${network}`);
    
    let provider, wallet, contractAddress;
    
    if (network === "localhost") {
        provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        // Use account 0 from Hardhat
        wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
        
        // Read contract address from deployments
        const deploymentPath = path.join(__dirname, "..", "deployments", "localhost", "AstaVerde.json");
        if (!fs.existsSync(deploymentPath)) {
            console.error("No local deployment found. Run 'npm run dev:local' first.");
            process.exit(1);
        }
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        contractAddress = deployment.address;
    } else if (network === "sepolia") {
        const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 
                      `https://base-sepolia.g.alchemy.com/v2/${process.env.RPC_API_KEY || "demo"}`;
        provider = new ethers.JsonRpcProvider(rpcUrl);
        
        const privateKey = process.env.PRIVATE_KEY_SEPOLIA;
        if (!privateKey) {
            console.error("PRIVATE_KEY_SEPOLIA not found in environment variables");
            process.exit(1);
        }
        wallet = new ethers.Wallet(privateKey, provider);
        
        // Read contract address from webapp env
        const envPath = path.join(__dirname, "..", "webapp", ".env.sepolia");
        if (!fs.existsSync(envPath)) {
            console.error("No Sepolia deployment configuration found.");
            process.exit(1);
        }
        dotenv.config({ path: envPath });
        contractAddress = process.env.NEXT_PUBLIC_ASTAVERDE_ADDRESS;
    } else {
        console.error("Unsupported network. Use 'localhost' or 'sepolia'");
        process.exit(1);
    }
    
    if (!contractAddress) {
        console.error("Contract address not found");
        process.exit(1);
    }
    
    console.log("Contract address:", contractAddress);
    console.log("Wallet address:", wallet.address);
    
    // Load ABI
    const abiPath = path.join(__dirname, "..", "webapp", "src", "config", "AstaVerde.json");
    const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
    
    // Create contract instance
    const astaVerde = new ethers.Contract(contractAddress, abi, wallet);
    
    // Check current owner
    try {
        const owner = await astaVerde.owner();
        console.log("Contract owner:", owner);
        
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error(`Error: Wallet ${wallet.address} is not the owner of the contract`);
            console.error(`Contract owner is: ${owner}`);
            process.exit(1);
        }
    } catch (error) {
        console.error("Error checking contract owner:", error.message);
        process.exit(1);
    }
    
    // Get current URI to check what's set
    try {
        const currentUri = await astaVerde.uri(1);
        console.log("Current URI template:", currentUri);
    } catch (error) {
        console.log("No tokens minted yet or unable to get URI");
    }
    
    // Set the new URI
    // For ERC-1155, the URI should be a template that can work with token IDs
    // The contract's uri() function already appends the CID, so we just need the base
    const newUri = BASE_URI;
    
    console.log(`Setting new base URI to: ${newUri}`);
    console.log("This will allow wallets to properly resolve metadata via IPFS gateways");
    
    try {
        const tx = await astaVerde.setURI(newUri);
        console.log("Transaction sent:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("Transaction confirmed in block:", receipt.blockNumber);
        console.log("✅ Base URI successfully set!");
        
        // Verify the change
        try {
            const updatedUri = await astaVerde.uri(1);
            console.log("Updated URI template:", updatedUri);
        } catch (error) {
            console.log("Unable to verify URI (may need tokens minted first)");
        }
        
        console.log("\n📝 Important Notes for NFT Visibility:");
        console.log("1. Each token's metadata CID must point to valid JSON on IPFS");
        console.log("2. The JSON should follow ERC-1155 metadata standard:");
        console.log("   {");
        console.log('     "name": "Token Name",');
        console.log('     "description": "Token Description",');
        console.log('     "image": "ipfs://[IMAGE_CID]",');
        console.log('     "attributes": [...]');
        console.log("   }");
        console.log("3. Some wallets may take time to index new metadata");
        console.log("4. On testnets, not all wallets support NFT display");
        console.log("5. Consider using OpenSea testnet to verify: https://testnets.opensea.io/");
        
    } catch (error) {
        console.error("Error setting URI:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
});