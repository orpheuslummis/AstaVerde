#!/usr/bin/env node

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

async function fetchFromIPFS(cidOrUri, gateway = "https://ipfs.io/ipfs/") {
    const cid = cidOrUri.replace("ipfs://", "");
    const url = `${gateway}${cid}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch from ${url}:`, error.message);
        return null;
    }
}

async function main() {
    const network = process.argv[2] || "sepolia";
    const tokenId = process.argv[3] ? BigInt(process.argv[3]) : null;
    
    console.log(`Checking NFT metadata on network: ${network}`);
    if (tokenId) {
        console.log(`Checking specific token ID: ${tokenId}`);
    }
    
    let provider, contractAddress;
    
    if (network === "localhost") {
        provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        
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
    console.log("=" .repeat(60));
    
    // Load ABI
    const abiPath = path.join(__dirname, "..", "webapp", "src", "config", "AstaVerde.json");
    const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
    
    // Create contract instance
    const astaVerde = new ethers.Contract(contractAddress, abi, provider);
    
    // Get contract info
    const lastTokenID = await astaVerde.lastTokenID();
    console.log(`Total tokens minted: ${lastTokenID}`);
    
    if (lastTokenID === 0n) {
        console.log("No tokens have been minted yet.");
        process.exit(0);
    }
    
    // Check base URI
    try {
        const baseUri = await astaVerde.uri(1);
        console.log(`Base URI template: ${baseUri}`);
    } catch (error) {
        console.log("Unable to get base URI");
    }
    
    console.log("=" .repeat(60));
    
    // Determine which tokens to check
    const tokensToCheck = [];
    if (tokenId !== null) {
        if (tokenId > lastTokenID || tokenId <= 0n) {
            console.error(`Token ID ${tokenId} is out of range (1-${lastTokenID})`);
            process.exit(1);
        }
        tokensToCheck.push(tokenId);
    } else {
        // Check up to 5 tokens as samples
        const sampleSize = lastTokenID < 5n ? Number(lastTokenID) : 5;
        for (let i = 1; i <= sampleSize; i++) {
            tokensToCheck.push(BigInt(i));
        }
    }
    
    // Check each token
    for (const tid of tokensToCheck) {
        console.log(`\n📋 Token #${tid}`);
        console.log("-" .repeat(40));
        
        try {
            // Get token data
            const [producer, cid, isRedeemed] = await Promise.all([
                astaVerde.getTokenProducer(tid),
                astaVerde.getTokenCid(tid),
                astaVerde.isRedeemed(tid)
            ]);
            
            console.log(`Producer: ${producer}`);
            console.log(`CID: ${cid}`);
            console.log(`Redeemed: ${isRedeemed}`);
            
            // Get the full URI
            const fullUri = await astaVerde.uri(tid);
            console.log(`Full URI: ${fullUri}`);
            
            // Check who owns the token
            const balance = await astaVerde.balanceOf(contractAddress, tid);
            console.log(`Contract balance: ${balance}`);
            
            // Try to fetch metadata from IPFS
            if (cid && cid !== "") {
                console.log("\n🔍 Fetching metadata from IPFS...");
                const ipfsUri = `ipfs://${cid}`;
                
                // Try multiple gateways
                const gateways = [
                    process.env.IPFS_GATEWAY_URL || "https://w3s.link/ipfs/",
                    "https://cloudflare-ipfs.com/ipfs/",
                    "https://gateway.pinata.cloud/ipfs/",
                    "https://ipfs.io/ipfs/",
                    "https://dweb.link/ipfs/"
                ];
                
                let metadata = null;
                let successGateway = null;
                
                for (const gateway of gateways) {
                    console.log(`Trying gateway: ${gateway}`);
                    metadata = await fetchFromIPFS(ipfsUri, gateway);
                    if (metadata) {
                        successGateway = gateway;
                        break;
                    }
                }
                
                if (metadata) {
                    console.log(`✅ Metadata fetched successfully from: ${successGateway}`);
                    console.log("Metadata content:");
                    console.log(JSON.stringify(metadata, null, 2));
                    
                    // Validate metadata structure
                    console.log("\n📐 Metadata validation:");
                    const hasName = !!metadata.name;
                    const hasDescription = !!metadata.description;
                    const hasImage = !!metadata.image;
                    
                    console.log(`- Has name: ${hasName ? "✅" : "❌"} ${hasName ? metadata.name : ""}`);
                    console.log(`- Has description: ${hasDescription ? "✅" : "❌"}`);
                    console.log(`- Has image: ${hasImage ? "✅" : "❌"} ${hasImage ? metadata.image : ""}`);
                    
                    if (metadata.attributes && Array.isArray(metadata.attributes)) {
                        console.log(`- Has attributes: ✅ (${metadata.attributes.length} attributes)`);
                    } else {
                        console.log(`- Has attributes: ❌`);
                    }
                    
                    // Check if image is accessible
                    if (hasImage && metadata.image.startsWith("ipfs://")) {
                        const imageCid = metadata.image.replace("ipfs://", "");
                        const imageUrl = `${successGateway}${imageCid}`;
                        console.log(`\n🖼️ Image URL: ${imageUrl}`);
                        
                        try {
                            const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
                            if (imageResponse.ok) {
                                console.log(`✅ Image is accessible`);
                            } else {
                                console.log(`❌ Image returned status: ${imageResponse.status}`);
                            }
                        } catch (error) {
                            console.log(`❌ Failed to check image: ${error.message}`);
                        }
                    }
                } else {
                    console.log("❌ Failed to fetch metadata from any gateway");
                    console.log("This means the CID might be:");
                    console.log("  1. Not pinned to IPFS");
                    console.log("  2. Invalid or malformed");
                    console.log("  3. Gateway issues (try again later)");
                }
            } else {
                console.log("⚠️ No CID set for this token");
            }
            
        } catch (error) {
            console.error(`Error checking token ${tid}:`, error.message);
        }
    }
    
    console.log("\n" + "=" .repeat(60));
    console.log("🔧 Troubleshooting NFT Visibility Issues:");
    console.log("=" .repeat(60));
    console.log("\n1. Base URI Configuration:");
    console.log("   - The contract's base URI should be 'ipfs://'");
    console.log("   - Run: node scripts/set-metadata-uri.js [network]");
    
    console.log("\n2. Metadata Requirements:");
    console.log("   - Each token needs a valid CID pointing to JSON metadata");
    console.log("   - Metadata must include: name, description, and image");
    console.log("   - Image should be an IPFS URI: 'ipfs://[IMAGE_CID]'");
    
    console.log("\n3. IPFS Pinning:");
    console.log("   - Ensure metadata and images are pinned to IPFS");
    console.log("   - Use services like Pinata, Web3.Storage, or Infura");
    
    console.log("\n4. Wallet Support:");
    console.log("   - Not all wallets support testnets equally");
    console.log("   - MetaMask: May need manual import with contract address");
    console.log("   - Rainbow: Good testnet support");
    console.log("   - Coinbase Wallet: Limited testnet NFT display");
    
    console.log("\n5. OpenSea Testnet:");
    console.log("   - Check visibility at: https://testnets.opensea.io/");
    console.log(`   - Your collection: https://testnets.opensea.io/assets/base-sepolia/${contractAddress}`);
    
    console.log("\n6. Contract Standards:");
    console.log("   - Contract must implement ERC-1155 metadata extension");
    console.log("   - uri() function should return proper IPFS URIs");
    
    console.log("\n7. Time & Indexing:");
    console.log("   - Wallets may take 5-30 minutes to index new metadata");
    console.log("   - Force refresh in wallet settings if available");
}

main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
});
