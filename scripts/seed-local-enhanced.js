#!/usr/bin/env node

/**
 * Enhanced local seeding with production-like metadata
 * Creates realistic carbon offset NFTs with proper metadata structure
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Load mock metadata template
const metadataTemplate = JSON.parse(
    fs.readFileSync(path.join(__dirname, "mock-metadata/metadata-template.json"))
);

async function main() {
    console.log("🌱 Enhanced seeding with production-like data...\n");

    // Get deployed contract addresses
    const usdcDeployment = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../deployments/localhost/MockUSDC.json"))
    );
    const astaVerdeDeployment = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../deployments/localhost/AstaVerde.json"))
    );

    console.log("📦 Using deployed contracts:");
    console.log(`   MockUSDC: ${usdcDeployment.address}`);
    console.log(`   AstaVerde: ${astaVerdeDeployment.address}`);

    // Connect to deployed contracts
    const [deployer, alice, bob, charlie, dave, producer1, producer2, producer3] = await ethers.getSigners();

    const usdc = await ethers.getContractAt("MockUSDC", usdcDeployment.address, deployer);
    const astaVerde = await ethers.getContractAt("AstaVerde", astaVerdeDeployment.address, deployer);

    // Fund test users with USDC
    const users = [
        { signer: deployer, name: "Deployer" },
        { signer: alice, name: "Alice" },
        { signer: bob, name: "Bob" },
        { signer: charlie, name: "Charlie" },
        { signer: dave, name: "Dave" },
        { signer: producer1, name: "Solar Farm Producer" },
        { signer: producer2, name: "Wind Farm Producer" },
        { signer: producer3, name: "Reforestation Producer" }
    ];

    console.log("\n💰 Funding accounts with USDC:");
    for (const { signer, name } of users) {
        try {
            const currentBalance = await usdc.balanceOf(signer.address);
            const targetAmount = ethers.parseUnits("50000", 6); // 50k USDC
            
            if (currentBalance < targetAmount) {
                const mintAmount = targetAmount - currentBalance;
                const tx = await usdc.mint(signer.address, mintAmount);
                await tx.wait();
                console.log(`   ✓ ${name}: ${ethers.formatUnits(mintAmount, 6)} USDC added`);
            } else {
                console.log(`   ℹ️ ${name}: Already funded`);
            }
        } catch (error) {
            console.log(`   ⚠ ${name}: Error - ${error.message}`);
        }
    }

    // Create NFT batches with realistic metadata
    console.log("\n🎨 Creating NFT batches with production-like metadata:");
    
    const lastBatchId = await astaVerde.lastBatchID();
    console.log(`   Current batches: ${lastBatchId}`);

    // Define batches to create
    const batches = [
        {
            name: "Renewable Energy Bundle",
            description: "Solar and wind projects from multiple continents",
            projects: ["solar-farm-kenya", "wind-farm-texas", "geothermal-iceland"],
            producers: [producer1.address, producer1.address, producer1.address]
        },
        {
            name: "Nature-Based Solutions",
            description: "Forest and ocean conservation projects",
            projects: ["reforestation-brazil", "ocean-cleanup"],
            producers: [producer3.address, producer3.address]
        },
        {
            name: "Community Impact Projects",
            description: "Projects directly benefiting local communities",
            projects: ["biogas-india", "cookstoves-uganda", "transport-colombia"],
            producers: [producer2.address, producer2.address, producer2.address]
        },
        {
            name: "Industrial Efficiency",
            description: "Energy efficiency and clean technology",
            projects: ["efficiency-germany", "hydro-norway"],
            producers: [producer1.address, producer2.address]
        }
    ];

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchNum = Number(lastBatchId) + i + 1;
        
        if (batchNum > Number(lastBatchId)) {
            console.log(`\n   📦 Batch ${batchNum}: ${batch.name}`);
            console.log(`      ${batch.description}`);
            
            // Generate IPFS hashes based on project IDs
            const ipfsHashes = batch.projects.map(projectId => {
                // Create a deterministic but realistic-looking IPFS hash
                const project = metadataTemplate.projects.find(p => p.id === projectId);
                return `Qm${projectId.substring(0, 8).padEnd(44, projectId.charAt(0))}`;
            });
            
            console.log(`      Projects: ${batch.projects.join(", ")}`);
            console.log(`      Minting ${batch.projects.length} NFTs...`);
            
            try {
                const tx = await astaVerde.mintBatch(batch.producers, ipfsHashes);
                await tx.wait();
                console.log(`      ✓ Batch ${batchNum} created successfully`);
            } catch (error) {
                console.log(`      ⚠ Failed to create batch: ${error.message}`);
            }
        }
    }

    // Simulate some initial purchases
    console.log("\n💸 Simulating initial NFT purchases:");
    
    try {
        // Alice buys from batch 1
        const price = await astaVerde.getCurrentPrice(1);
        await usdc.connect(alice).approve(astaVerde.target, price);
        const tx1 = await astaVerde.connect(alice).buyFromBatch(1, 1);
        await tx1.wait();
        console.log(`   ✓ Alice purchased 1 NFT from Batch 1`);

        // Bob buys from batch 2
        await usdc.connect(bob).approve(astaVerde.target, price);
        const tx2 = await astaVerde.connect(bob).buyFromBatch(2, 1);
        await tx2.wait();
        console.log(`   ✓ Bob purchased 1 NFT from Batch 2`);

        // Charlie buys from batch 3
        await usdc.connect(charlie).approve(astaVerde.target, price * 2n);
        const tx3 = await astaVerde.connect(charlie).buyFromBatch(3, 2);
        await tx3.wait();
        console.log(`   ✓ Charlie purchased 2 NFTs from Batch 3`);
    } catch (error) {
        console.log(`   ⚠ Purchase error: ${error.message}`);
    }

    // Display final statistics
    console.log("\n📊 Final Statistics:");
    const finalBatchCount = await astaVerde.lastBatchID();
    const finalTokenCount = await astaVerde.lastTokenID();
    
    console.log(`   Total batches: ${finalBatchCount}`);
    console.log(`   Total tokens minted: ${finalTokenCount}`);
    
    // Check producer balances
    for (const producer of [producer1, producer2, producer3]) {
        const balance = await astaVerde.producerBalances(producer.address);
        if (balance > 0) {
            console.log(`   ${producer.address.slice(0, 8)}... has ${ethers.formatUnits(balance, 6)} USDC claimable`);
        }
    }

    console.log("\n✅ Enhanced seeding complete!");
    console.log("   View the NFTs at http://localhost:3000");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    });