const { ethers } = require("hardhat");

async function main() {
    const usdcAddress = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";

    // Get the MockUSDC contract
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = MockUSDC.attach(usdcAddress);

    // Get all signers
    const signers = await ethers.getSigners();
    const deployer = signers[0];

    console.log("Funding all Hardhat accounts with USDC...\n");

    // Fund all 20 accounts
    for (let i = 0; i < 20; i++) {
        const address = signers[i].address;
        const balance = await usdc.balanceOf(address);

        if (balance < ethers.parseUnits("1000", 6)) {
            console.log(`Account #${i}: ${address}`);
            console.log(`  Current balance: ${ethers.formatUnits(balance, 6)} USDC`);

            const mintAmount = ethers.parseUnits("5000", 6);
            const tx = await usdc.connect(deployer).mint(address, mintAmount);
            await tx.wait();

            const newBalance = await usdc.balanceOf(address);
            console.log(`  New balance: ${ethers.formatUnits(newBalance, 6)} USDC ✓\n`);
        } else {
            console.log(`Account #${i}: ${address} - Already has ${ethers.formatUnits(balance, 6)} USDC\n`);
        }
    }

    console.log("All accounts funded!");
}

main().catch(console.error);
