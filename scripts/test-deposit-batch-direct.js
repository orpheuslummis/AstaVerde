const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Testing Deposit Batch Directly ===\n");

    const [signer] = await ethers.getSigners();
    console.log("User:", signer.address);

    const VAULT_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
    const ASSET_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

    const vaultAbi = require("../artifacts/contracts/EcoStabilizer.sol/EcoStabilizer.json").abi;
    const assetAbi = require("../artifacts/contracts/AstaVerde.sol/AstaVerde.json").abi;

    const vault = new ethers.Contract(VAULT_ADDRESS, vaultAbi, signer);
    const asset = new ethers.Contract(ASSET_ADDRESS, assetAbi, signer);

    // Check tokens 2, 3, 4, 5
    const tokenIds = [2n, 3n, 4n, 5n];

    console.log("Checking token ownership...");
    for (const tokenId of tokenIds) {
        const balance = await asset.balanceOf(signer.address, tokenId);
        const isRedeemed = await asset.isRedeemed(tokenId);
        console.log(`Token ${tokenId}: balance=${balance}, redeemed=${isRedeemed}`);
    }

    // Check NFT approval
    const isApproved = await asset.isApprovedForAll(signer.address, VAULT_ADDRESS);
    console.log("\nNFT approval status:", isApproved);

    if (!isApproved) {
        console.log("Setting NFT approval...");
        const tx = await asset.setApprovalForAll(VAULT_ADDRESS, true);
        await tx.wait();
        console.log("Approval set!");
    }

    // Try depositBatch with different array creation methods
    console.log("\n--- Testing depositBatch ---");

    // Method 1: Direct array
    try {
        console.log("\nMethod 1: Direct bigint array");
        const tx = await vault.depositBatch([2n, 3n, 4n, 5n]);
        const receipt = await tx.wait();
        console.log("✅ Success! Gas used:", receipt.gasUsed.toString());
        return;
    } catch (error) {
        console.log("❌ Failed:", error.reason || error.message);
    }

    // Method 2: Map to ensure BigInt
    try {
        console.log("\nMethod 2: Mapped array");
        const mappedIds = tokenIds.map((id) => BigInt(id));
        const tx = await vault.depositBatch(mappedIds);
        const receipt = await tx.wait();
        console.log("✅ Success! Gas used:", receipt.gasUsed.toString());
        return;
    } catch (error) {
        console.log("❌ Failed:", error.reason || error.message);
    }

    // Method 3: New Array with manual population
    try {
        console.log("\nMethod 3: Manual array creation");
        const manualArray = new Array(tokenIds.length);
        for (let i = 0; i < tokenIds.length; i++) {
            manualArray[i] = tokenIds[i];
        }
        const tx = await vault.depositBatch(manualArray);
        const receipt = await tx.wait();
        console.log("✅ Success! Gas used:", receipt.gasUsed.toString());
        return;
    } catch (error) {
        console.log("❌ Failed:", error.reason || error.message);
    }

    // Check if maybe one token is the problem
    console.log("\n--- Testing individual deposits ---");
    for (const tokenId of tokenIds) {
        try {
            console.log(`\nDepositing token ${tokenId}...`);
            const tx = await vault.deposit(tokenId);
            const receipt = await tx.wait();
            console.log(`✅ Token ${tokenId} deposited! Gas:`, receipt.gasUsed.toString());
        } catch (error) {
            console.log(`❌ Token ${tokenId} failed:`, error.reason || error.message);

            // Check why it failed
            const balance = await asset.balanceOf(signer.address, tokenId);
            const isRedeemed = await asset.isRedeemed(tokenId);
            const loan = await vault.loans(tokenId);
            console.log(`  Balance: ${balance}, Redeemed: ${isRedeemed}, Loan active: ${loan.active}`);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
