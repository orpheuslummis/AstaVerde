const hre = require("hardhat");

async function main() {
    console.log("💰 Funding accounts with USDC...\n");

    // Get signers
    const [deployer, alice, bob, charlie, dave] = await hre.ethers.getSigners();

    // Get USDC contract
    const usdcAddress = (await hre.deployments.get("MockUSDC")).address;
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const usdc = MockUSDC.attach(usdcAddress);

    // Amount to fund each account (10,000 USDC)
    const amount = hre.ethers.parseUnits("10000", 6);

    // Fund accounts
    const accounts = [
        { name: "Alice", signer: alice },
        { name: "Bob", signer: bob },
        { name: "Charlie", signer: charlie },
        { name: "Dave", signer: dave },
    ];

    for (const account of accounts) {
        try {
            // Mint USDC directly to the account
            const tx = await usdc.connect(deployer).mint(account.signer.address, amount);
            await tx.wait();

            const balance = await usdc.balanceOf(account.signer.address);
            console.log(`✅ ${account.name} (${account.signer.address}): ${hre.ethers.formatUnits(balance, 6)} USDC`);
        } catch (error) {
            console.error(`❌ Failed to fund ${account.name}: ${error.message}`);
        }
    }

    console.log("\n✨ USDC funding complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
