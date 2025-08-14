const { ethers } = require("hardhat");

async function main() {
    const [deployer, alice] = await ethers.getSigners();

    const usdcAddress = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";
    const astaVerdeAddress = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";

    console.log("Alice address:", alice.address);

    // Get contract with minimal ABI
    const abi = [
        "function approve(address spender, uint256 value) returns (bool)",
        "function balanceOf(address) view returns (uint256)",
        "function allowance(address owner, address spender) view returns (uint256)",
    ];

    const usdc = new ethers.Contract(usdcAddress, abi, alice);

    // Check balance
    const balance = await usdc.balanceOf(alice.address);
    console.log("Alice balance:", ethers.formatUnits(balance, 6), "USDC");

    // Try different amounts
    const amounts = ["1", "100", "1000", "2300"];

    for (const amount of amounts) {
        try {
            const amountWei = ethers.parseUnits(amount, 6);
            console.log(`\nTrying approve ${amount} USDC (${amountWei} wei)...`);

            // Static call first to check if it would revert
            const wouldSucceed = await usdc.approve.staticCall(astaVerdeAddress, amountWei);
            console.log("Static call result:", wouldSucceed);

            if (wouldSucceed) {
                const tx = await usdc.approve(astaVerdeAddress, amountWei);
                await tx.wait();
                console.log("✅ Approve successful!");

                const allowance = await usdc.allowance(alice.address, astaVerdeAddress);
                console.log("New allowance:", ethers.formatUnits(allowance, 6), "USDC");
                break;
            }
        } catch (error) {
            console.error("❌ Failed:", error.message);
            if (error.data) {
                console.log("Error data:", error.data);
            }
        }
    }
}

main().catch(console.error);
