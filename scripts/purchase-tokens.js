const { ethers, deployments } = require("hardhat");

async function main() {
    const [owner, alice, bob] = await ethers.getSigners();

    const astaverdeAddress = (await deployments.get("AstaVerde")).address;
    const usdcAddress = (await deployments.get("MockUSDC")).address;

    const astaverde = await ethers.getContractAt("AstaVerde", astaverdeAddress);
    const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);

    // Alice buys batch 1
    console.log("Alice approving USDC...");
    await (await usdc.connect(alice).approve(astaverdeAddress, ethers.parseUnits("690", 6))).wait();

    console.log("Alice buying batch 1...");
    await (await astaverde.connect(alice).buyBatch(1)).wait();
    console.log("✅ Alice bought batch 1 (tokens 1-3)");

    // Bob buys batch 2
    console.log("Bob approving USDC...");
    await (await usdc.connect(bob).approve(astaverdeAddress, ethers.parseUnits("690", 6))).wait();

    console.log("Bob buying batch 2...");
    await (await astaverde.connect(bob).buyBatch(2)).wait();
    console.log("✅ Bob bought batch 2 (tokens 4-6)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
