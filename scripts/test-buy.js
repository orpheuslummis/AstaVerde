const { ethers } = require("hardhat");

async function main() {
    const [deployer, alice] = await ethers.getSigners();

    const usdcAddress = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";
    const astaVerdeAddress = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";

    const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
    const astaVerde = await ethers.getContractAt("AstaVerde", astaVerdeAddress);

    console.log("Testing with Alice:", alice.address);

    // Check Alice's balance
    const balance = await usdc.balanceOf(alice.address);
    console.log("Alice USDC balance:", ethers.formatUnits(balance, 6));

    // Check batch info
    const batchInfo = await astaVerde.getBatchInfo(1);
    console.log("Batch 1 available NFTs:", batchInfo[3].toString());
    console.log("Batch 1 price:", ethers.formatUnits(await astaVerde.getCurrentBatchPrice(1), 6), "USDC");

    // Approve USDC
    try {
        const approveAmount = ethers.parseUnits("250", 6);
        console.log("Approving", ethers.formatUnits(approveAmount, 6), "USDC...");
        const approveTx = await usdc.connect(alice).approve(astaVerdeAddress, approveAmount);
        await approveTx.wait();
        console.log("✅ Approve successful!");
    } catch (error) {
        console.error("❌ Approve failed:", error.message);
        return;
    }

    // Try to buy
    try {
        const price = await astaVerde.getCurrentBatchPrice(1);
        console.log("Buying 1 NFT for", ethers.formatUnits(price, 6), "USDC...");
        const buyTx = await astaVerde.connect(alice).buyBatch(1, price, 1);
        await buyTx.wait();
        console.log("✅ Buy successful!");

        // Check NFT balance
        const nftBalance = await astaVerde.balanceOf(alice.address, 1);
        console.log("Alice now owns", nftBalance.toString(), "NFT(s) from batch 1");
    } catch (error) {
        console.error("❌ Buy failed:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
    }
}

main().catch(console.error);
