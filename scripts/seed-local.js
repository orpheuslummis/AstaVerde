#!/usr/bin/env node

/**
 * Seeds the local development environment with test data
 * Run this AFTER starting the local dev stack with `npm run dev:local`
 * Safe to run multiple times - checks existing state first
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🌱 Seeding local development environment with test data...\n");

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

    // Connect to deployed contracts using hardhat's provider
    const [deployer, alice, bob, charlie, dave, producer] = await ethers.getSigners();

    const usdc = await ethers.getContractAt("MockUSDC", usdcDeployment.address, deployer);
    const astaVerde = await ethers.getContractAt("AstaVerde", astaVerdeDeployment.address, deployer);

    // Fund test users with USDC
    const users = [
        { signer: deployer, name: "Deployer" },
        { signer: alice, name: "Alice" },
        { signer: bob, name: "Bob" },
        { signer: charlie, name: "Charlie" },
        { signer: dave, name: "Dave" },
        { signer: producer, name: "Producer" }
    ];

    console.log("\n💰 Checking and funding accounts with USDC:");
    for (const { signer, name } of users) {
        try {
            const currentBalance = await usdc.balanceOf(signer.address);
            const targetAmount = ethers.parseUnits("50000", 6); // 50k USDC
            
            if (currentBalance < targetAmount) {
                const mintAmount = targetAmount - currentBalance;
                const tx = await usdc.mint(signer.address, mintAmount);
                await tx.wait();
                console.log(`   ✓ ${name}: Added ${ethers.formatUnits(mintAmount, 6)} USDC (total: 50000.0)`);
            } else {
                console.log(`   ℹ️ ${name}: Already has ${ethers.formatUnits(currentBalance, 6)} USDC`);
            }
        } catch (error) {
            console.log(`   ⚠ ${name}: Error checking/minting - ${error.message}`);
        }
    }

    // Create NFT batches if they don't exist
    console.log("\n📦 Checking and creating NFT batches:");
    
    try {
        const lastBatchId = await astaVerde.lastBatchID();
        console.log(`   Current number of batches: ${lastBatchId}`);
        
        if (lastBatchId >= 3) {
            console.log("   ℹ️ All 3 batches already exist");
        } else {
            // Create missing batches
            const batchesToCreate = [
                {
                    id: 1,
                    producers: [producer.address, producer.address, producer.address, producer.address, producer.address],
                    ipfsHashes: ["QmTest1", "QmTest2", "QmTest3", "QmTest4", "QmTest5"],
                    description: "5 NFTs for marketplace testing"
                },
                {
                    id: 2,
                    producers: [producer.address, producer.address, producer.address],
                    ipfsHashes: ["QmVault1", "QmVault2", "QmVault3"],
                    description: "3 NFTs for vault testing"
                },
                {
                    id: 3,
                    producers: [producer.address, producer.address],
                    ipfsHashes: ["QmExtra1", "QmExtra2"],
                    description: "2 NFTs for additional testing"
                }
            ];
            
            for (const batch of batchesToCreate) {
                if (lastBatchId < batch.id) {
                    console.log(`   Creating Batch ${batch.id}: ${batch.description}`);
                    const tx = await astaVerde.mintBatch(batch.producers, batch.ipfsHashes);
                    await tx.wait();
                    console.log(`   ✓ Batch ${batch.id} created`);
                }
            }
        }
    } catch (error) {
        console.log(`   ⚠ Error with batches: ${error.message}`);
    }

    // Simulate some purchases (only if not already done)
    console.log("\n💸 Checking and simulating NFT purchases:");

    try {
        const lastBatchId = await astaVerde.lastBatchID();
        
        if (lastBatchId < 2) {
            console.log("   ⚠ Not enough batches available for purchases");
        } else {
            // Check Alice's NFT balance
            const aliceBalance = await astaVerde.balanceOf(alice.address, 1);
            if (aliceBalance === 0n) {
                const batch1Price = await astaVerde.getCurrentBatchPrice(1);
                const batch1Info = await astaVerde.getBatchInfo(1);
                const batch1Available = batch1Info[1].filter(id => id > 0n).length;
                
                if (batch1Available > 0) {
                    console.log(`   Alice buying 1 NFT from Batch 1 at ${ethers.formatUnits(batch1Price, 6)} USDC`);
                    const approveTx = await usdc.connect(alice).approve(await astaVerde.getAddress(), batch1Price);
                    await approveTx.wait();
                    const buyTx = await astaVerde.connect(alice).buyBatch(1, batch1Price, 1);
                    await buyTx.wait();
                    console.log(`   ✓ Alice purchased 1 NFT`);
                } else {
                    console.log("   ℹ️ Batch 1 sold out");
                }
            } else {
                console.log(`   ℹ️ Alice already owns ${aliceBalance} NFT(s) from Batch 1`);
            }

            // Check Bob's NFT status
            const bobBalance = await astaVerde.balanceOf(bob.address, 2);
            if (bobBalance === 0n) {
                const batch2Price = await astaVerde.getCurrentBatchPrice(2);
                const batch2Info = await astaVerde.getBatchInfo(2);
                const batch2Available = batch2Info[1].filter(id => id > 0n).length;
                
                if (batch2Available > 0) {
                    console.log(`   Bob buying 1 NFT from Batch 2 at ${ethers.formatUnits(batch2Price, 6)} USDC`);
                    const approveTx = await usdc.connect(bob).approve(await astaVerde.getAddress(), batch2Price);
                    await approveTx.wait();
                    const buyTx = await astaVerde.connect(bob).buyBatch(2, batch2Price, 1);
                    await buyTx.wait();
                    
                    // Find Bob's token and redeem it
                    const balance = await astaVerde.balanceOf(bob.address, 2);
                    if (balance > 0n) {
                        // Get the first unredeemed token from batch 2 that Bob owns
                        for (let i = 6; i <= 8; i++) { // Batch 2 tokens are 6-8
                            const owner = await astaVerde.ownerOf(i);
                            const isRedeemed = await astaVerde.isRedeemed(i);
                            if (owner.toLowerCase() === bob.address.toLowerCase() && !isRedeemed) {
                                console.log(`   Bob redeeming token #${i}`);
                                const redeemTx = await astaVerde.connect(bob).redeemToken(i);
                                await redeemTx.wait();
                                console.log(`   ✓ Bob purchased and redeemed 1 NFT`);
                                break;
                            }
                        }
                    }
                } else {
                    console.log("   ℹ️ Batch 2 sold out");
                }
            } else {
                console.log(`   ℹ️ Bob already owns NFT(s) from Batch 2`);
            }

            // Check Charlie's NFT balance
            const charlieBalance = await astaVerde.balanceOf(charlie.address, 1);
            if (charlieBalance < 2n) {
                const batch1Info = await astaVerde.getBatchInfo(1);
                const batch1Available = batch1Info[1].filter(id => id > 0n).length;
                const batch1Price = await astaVerde.getCurrentBatchPrice(1);
                
                const needed = 2n - charlieBalance;
                if (batch1Available >= Number(needed)) {
                    const charlieTotal = batch1Price * needed;
                    console.log(`   Charlie buying ${needed} NFTs from Batch 1 at ${ethers.formatUnits(charlieTotal, 6)} USDC total`);
                    const approveTx = await usdc.connect(charlie).approve(await astaVerde.getAddress(), charlieTotal);
                    await approveTx.wait();
                    const buyTx = await astaVerde.connect(charlie).buyBatch(1, batch1Price, needed);
                    await buyTx.wait();
                    console.log(`   ✓ Charlie purchased ${needed} NFTs`);
                } else {
                    console.log(`   ℹ️ Not enough NFTs available in Batch 1 for Charlie`);
                }
            } else {
                console.log(`   ℹ️ Charlie already owns ${charlieBalance} NFTs from Batch 1`);
            }
        }
    } catch (error) {
        console.log(`   ⚠ Error with purchases: ${error.message}`);
    }

    // Display final state
    console.log("\n📊 Final State Summary:");
    
    try {
        const producerBalance = await astaVerde.producerBalances(producer.address);
        const platformBalance = await astaVerde.platformShareAccumulated();
        const lastBatchId = await astaVerde.lastBatchID();
        
        console.log(`   Total batches created: ${lastBatchId}`);
        console.log(`   Producer claimable balance: ${ethers.formatUnits(producerBalance, 6)} USDC`);
        console.log(`   Platform accumulated fees: ${ethers.formatUnits(platformBalance, 6)} USDC`);
        
        // Count NFTs sold and available
        let totalSold = 0;
        let totalAvailable = 0;
        for (let i = 1; i <= lastBatchId; i++) {
            const batchInfo = await astaVerde.getBatchInfo(i);
            const available = batchInfo[1].filter(id => id > 0n).length;
            const sold = batchInfo[1].length - available;
            totalSold += sold;
            totalAvailable += available;
        }
        
        console.log(`   NFTs sold: ${totalSold}`);
        console.log(`   NFTs available: ${totalAvailable}`);
        
    } catch (error) {
        console.log(`   ⚠ Error getting summary: ${error.message}`);
    }
    
    console.log("\n✅ Seeding complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error seeding data:", error);
        process.exit(1);
    });