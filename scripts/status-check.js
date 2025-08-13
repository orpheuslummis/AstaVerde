const { ethers } = require("hardhat");

/**
 * Ultra-Minimal Status Check
 * Just tells you if the system is working - under 200ms
 */

async function quickStatus() {
    const [deployer, user1] = await ethers.getSigners();

    try {
        // Deploy only what we need for basic validation
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const usdc = await MockUSDC.deploy(ethers.parseUnits("1000", 6));

        const AstaVerde = await ethers.getContractFactory("AstaVerde");
        const astaVerde = await AstaVerde.deploy(deployer.address, await usdc.getAddress());

        const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
        const scc = await SCC.deploy(ethers.ZeroAddress);

        const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
        const vault = await EcoStabilizer.deploy(await astaVerde.getAddress(), await scc.getAddress());

        // Quick smoke test
        await scc.grantRole(await scc.MINTER_ROLE(), await vault.getAddress());
        await astaVerde.mintBatch([deployer.address], ["QmTest"]);

        console.log("✅ ALL SYSTEMS OPERATIONAL");
        return true;
    } catch (error) {
        console.log(`❌ SYSTEM FAILURE: ${error.message.substring(0, 50)}...`);
        return false;
    }
}

async function main() {
    const start = Date.now();
    const result = await quickStatus();
    console.log(`⏱️  ${Date.now() - start}ms`);
    return result ? 0 : 1;
}

if (require.main === module) {
    main().then((exitCode) => process.exit(exitCode));
}

module.exports = main;
