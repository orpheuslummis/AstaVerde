const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("📊 ASTAVERDE MARKETPLACE - CURRENT STATE ANALYSIS");
    console.log("=".repeat(70));
    
    // Get all signers
    const signers = await hre.ethers.getSigners();
    
    // Get deployed contract
    const deployment = await hre.deployments.get("AstaVerde");
    const astaVerde = await hre.ethers.getContractAt("AstaVerde", deployment.address);
    
    console.log(`\n📍 Contract Address: ${deployment.address}`);
    console.log(`⛓️  Network: localhost:8545`);
    
    // Get contract owner
    const owner = await astaVerde.owner();
    console.log(`\n👑 Platform Owner: ${owner}`);
    
    // Check platform settings
    const platformShare = await astaVerde.platformSharePercentage();
    const platformFees = await astaVerde.platformShareAccumulated();
    const totalProducerBalances = await astaVerde.totalProducerBalances();
    
    console.log(`\n💰 REVENUE DISTRIBUTION:`);
    console.log(`   Platform Share: ${platformShare}%`);
    console.log(`   Platform Fees Accumulated: ${ethers.formatUnits(platformFees, 6)} USDC`);
    console.log(`   Total Producer Balances: ${ethers.formatUnits(totalProducerBalances, 6)} USDC`);
    
    // Check producer balances for all test accounts
    console.log(`\n👥 ACCOUNT BALANCES:`);
    const accountNames = [
        "Platform Owner (Account #0)",
        "Alice (Account #1)",
        "Bob (Account #2)", 
        "Charlie (Account #3)",
        "Producer (Account #4)",
        "Account #5",
        "Account #6",
        "Account #7"
    ];
    
    for (let i = 0; i < 8; i++) {
        const address = signers[i].address;
        const producerBalance = await astaVerde.producerBalances(address);
        if (producerBalance > 0n) {
            console.log(`   ${accountNames[i]} (${address}):`);
            console.log(`     Producer Balance: ${ethers.formatUnits(producerBalance, 6)} USDC`);
        }
    }
    
    // Check batch information
    const lastBatchId = await astaVerde.lastBatchID();
    console.log(`\n📦 BATCH INFORMATION:`);
    console.log(`   Total Batches Created: ${lastBatchId}`);
    
    // Get USDC token for checking buyer balances
    const usdcAddress = await astaVerde.usdcToken();
    const usdc = await hre.ethers.getContractAt("IERC20", usdcAddress);
    
    for (let i = 1; i <= Math.min(5, Number(lastBatchId)); i++) {
        try {
            const batchInfo = await astaVerde.getBatchInfo(i);
            const [id, tokenIds, creationTime, currentPrice, remainingTokens] = batchInfo;
            
            console.log(`\n   Batch #${id}:`);
            console.log(`     Token IDs: [${tokenIds.map(t => t.toString()).join(", ")}]`);
            console.log(`     Current Price: ${ethers.formatUnits(currentPrice, 6)} USDC`);
            console.log(`     Remaining/Total: ${remainingTokens}/${tokenIds.length}`);
            console.log(`     Sold: ${tokenIds.length - Number(remainingTokens)}`);
            
            // Check who produced these tokens
            if (tokenIds.length > 0) {
                const firstTokenId = tokenIds[0];
                const tokenInfo = await astaVerde.tokens(firstTokenId);
                console.log(`     Producer: ${tokenInfo.producer}`);
                
                // Match producer to account name
                for (let j = 0; j < signers.length; j++) {
                    if (signers[j].address.toLowerCase() === tokenInfo.producer.toLowerCase()) {
                        console.log(`     Producer Name: ${accountNames[j] || `Account #${j}`}`);
                        break;
                    }
                }
            }
            
            // Calculate revenue if sold
            const soldCount = tokenIds.length - Number(remainingTokens);
            if (soldCount > 0) {
                const revenue = Number(currentPrice) * soldCount / 1000000;
                const producerRevenue = revenue * 0.7;
                const platformRevenue = revenue * 0.3;
                console.log(`     Revenue from sales: ${revenue.toFixed(2)} USDC`);
                console.log(`       → Producer (70%): ${producerRevenue.toFixed(2)} USDC`);
                console.log(`       → Platform (30%): ${platformRevenue.toFixed(2)} USDC`);
            }
        } catch (e) {
            // Batch doesn't exist
            break;
        }
    }
    
    // Check NFT ownership
    console.log(`\n🎨 NFT OWNERSHIP:`);
    const lastTokenId = await astaVerde.lastTokenID();
    
    for (let i = 0; i < Math.min(8, signers.length); i++) {
        const ownedTokens = [];
        for (let tokenId = 1; tokenId <= Math.min(10, Number(lastTokenId)); tokenId++) {
            const balance = await astaVerde.balanceOf(signers[i].address, tokenId);
            if (balance > 0n) {
                const isRedeemed = await astaVerde.isRedeemed(tokenId);
                ownedTokens.push(`#${tokenId}${isRedeemed ? " (REDEEMED)" : ""}`);
            }
        }
        
        if (ownedTokens.length > 0) {
            console.log(`   ${accountNames[i] || `Account #${i}`}: ${ownedTokens.join(", ")}`);
        }
    }
    
    // Check USDC balances
    console.log(`\n💵 USDC BALANCES:`);
    for (let i = 0; i < Math.min(8, signers.length); i++) {
        const balance = await usdc.balanceOf(signers[i].address);
        const formattedBalance = ethers.formatUnits(balance, 6);
        if (formattedBalance !== "0.0") {
            console.log(`   ${accountNames[i] || `Account #${i}`}: ${formattedBalance} USDC`);
        }
    }
    
    // Summary
    const totalRevenue = Number(platformFees) + Number(totalProducerBalances);
    if (totalRevenue > 0) {
        console.log(`\n📈 REVENUE SUMMARY:`);
        console.log(`   Total Sales Revenue: ${ethers.formatUnits(totalRevenue, 6)} USDC`);
        console.log(`   Platform Share (30%): ${ethers.formatUnits(platformFees, 6)} USDC`);
        console.log(`   Producer Share (70%): ${ethers.formatUnits(totalProducerBalances, 6)} USDC`);
        
        // Verify the 70/30 split
        const expectedPlatform = totalRevenue * 30 / 100;
        const expectedProducer = totalRevenue * 70 / 100;
        const platformDiff = Math.abs(Number(platformFees) - expectedPlatform);
        const producerDiff = Math.abs(Number(totalProducerBalances) - expectedProducer);
        
        if (platformDiff < 1000000 && producerDiff < 1000000) { // Within 1 USDC tolerance
            console.log(`   ✅ Revenue split correctly maintained at 70/30`);
        } else {
            console.log(`   ⚠️  Revenue split variance detected`);
        }
    }
    
    console.log("\n" + "=".repeat(70));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });