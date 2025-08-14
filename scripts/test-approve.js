const { ethers } = require("hardhat");

async function main() {
    const [deployer, alice] = await ethers.getSigners();

    const usdcAddress = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";
    const astaVerdeAddress = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";

    const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);

    // Check Alice's balance
    const balance = await usdc.balanceOf(alice.address);
    console.log("Alice USDC balance:", ethers.formatUnits(balance, 6));

    // Try approve
    try {
        const tx = await usdc.connect(alice).approve(astaVerdeAddress, ethers.parseUnits("1000", 6));
        await tx.wait();
        console.log("✅ Approve successful!");

        const allowance = await usdc.allowance(alice.address, astaVerdeAddress);
        console.log("Allowance:", ethers.formatUnits(allowance, 6));
    } catch (error) {
        console.error("❌ Approve failed:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
    }
}

main().catch(console.error);
