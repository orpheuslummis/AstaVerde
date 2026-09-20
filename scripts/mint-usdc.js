const { deployments, ethers } = require("hardhat");

async function main() {
    const [deployer, alice, bob, charlie] = await ethers.getSigners();

    // Get USDC contract
    const usdcAddress = (await deployments.get("MockUSDC")).address;
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = MockUSDC.attach(usdcAddress);

    // Mint USDC to test accounts
    console.log("Minting USDC to test accounts...");

    const amount = ethers.parseUnits("50000", 6); // 50k USDC

    await usdc.connect(deployer).mint(alice.address, amount);
    console.log(`✅ Minted 50,000 USDC to Alice: ${alice.address}`);

    await usdc.connect(deployer).mint(bob.address, amount);
    console.log(`✅ Minted 50,000 USDC to Bob: ${bob.address}`);

    await usdc.connect(deployer).mint(charlie.address, amount);
    console.log(`✅ Minted 50,000 USDC to Charlie: ${charlie.address}`);

    // Check balances
    const aliceBalance = await usdc.balanceOf(alice.address);
    console.log(`Alice balance: ${ethers.formatUnits(aliceBalance, 6)} USDC`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
