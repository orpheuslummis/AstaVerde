const { ethers } = require("hardhat");

async function main() {
    const [deployer, alice] = await ethers.getSigners();
    const usdc = await ethers.getContractAt("MockUSDC", "0x5FbDB2315678afecb367f032d93F642f64180aa3");

    console.log("\n=== Alice USDC Status ===");
    console.log("Alice address:", alice.address);

    const balance = await usdc.balanceOf(alice.address);
    console.log("USDC Balance:", ethers.formatUnits(balance, 6), "USDC");
    console.log("Raw balance:", balance.toString(), "wei");

    // Check current allowance
    const astaverdeAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const allowance = await usdc.allowance(alice.address, astaverdeAddress);
    console.log("\nCurrent allowance to AstaVerde:", ethers.formatUnits(allowance, 6), "USDC");
    console.log("Raw allowance:", allowance.toString(), "wei");

    // Try to approve manually
    console.log("\nTrying to approve 230 USDC...");
    try {
        const tx = await usdc.connect(alice).approve(astaverdeAddress, ethers.parseUnits("230", 6));
        await tx.wait();
        console.log("✅ Approval successful!");

        const newAllowance = await usdc.allowance(alice.address, astaverdeAddress);
        console.log("New allowance:", ethers.formatUnits(newAllowance, 6), "USDC");
    } catch (error) {
        console.error("❌ Approval failed:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
