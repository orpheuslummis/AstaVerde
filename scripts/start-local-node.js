const { spawn } = require("child_process");
const { ethers } = require("hardhat");

async function deployContracts() {
    console.log("🚀 Deploying contracts to local node...");

    const [deployer, user1, user2] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy(ethers.parseUnits("1000000", 6));
    await usdc.waitForDeployment();

    // Deploy AstaVerde
    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    const astaVerde = await AstaVerde.deploy(deployer.address, await usdc.getAddress());
    await astaVerde.waitForDeployment();

    // Deploy StabilizedCarbonCoin
    const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
    const scc = await SCC.deploy(ethers.ZeroAddress);
    await scc.waitForDeployment();

    // Deploy EcoStabilizer
    const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
    const ecoStabilizer = await EcoStabilizer.deploy(await astaVerde.getAddress(), await scc.getAddress());
    await ecoStabilizer.waitForDeployment();

    // Setup roles
    const MINTER_ROLE = await scc.MINTER_ROLE();
    const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();
    await scc.grantRole(MINTER_ROLE, await ecoStabilizer.getAddress());
    await scc.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);

    // Mint USDC to users
    await usdc.mint(deployer.address, ethers.parseUnits("100000", 6));
    await usdc.mint(user1.address, ethers.parseUnits("50000", 6));
    await usdc.mint(user2.address, ethers.parseUnits("50000", 6));

    // Create test batch
    const producers = [deployer.address, user1.address, user2.address];
    const cids = [
        "QmTest1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "QmTest2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "QmTest3cccccccccccccccccccccccccccccccccccccccc",
    ];
    await astaVerde.mintBatch(producers, cids);

    // Buy NFTs
    const price = ethers.parseUnits("230", 6);
    await usdc.connect(user1).approve(await astaVerde.getAddress(), price);
    await astaVerde.connect(user1).buyBatch(1n, price, 1);

    await usdc.connect(user2).approve(await astaVerde.getAddress(), price);
    await astaVerde.connect(user2).buyBatch(1n, price, 1);

    console.log("✅ Contracts deployed and setup complete");
    console.log("MockUSDC:", await usdc.getAddress());
    console.log("AstaVerde:", await astaVerde.getAddress());
    console.log("SCC:", await scc.getAddress());
    console.log("EcoStabilizer:", await ecoStabilizer.getAddress());
    console.log("\n🎉 Ready for QA testing!");
}

async function main() {
    console.log("Starting hardhat node for QA testing...");

    // Start the node
    const nodeProcess = spawn("npx", ["hardhat", "node", "--port", "8545", "--hostname", "0.0.0.0"], {
        stdio: "inherit",
        cwd: process.cwd(),
    });

    // Wait a bit for node to start
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Deploy contracts
    await deployContracts();

    console.log("\n🌟 Local QA environment is ready!");
    console.log("- Hardhat node running on http://localhost:8545");
    console.log("- All contracts deployed with test data");
    console.log("- Ready to start webapp!");

    // Keep the process alive
    nodeProcess.on("exit", (code) => {
        console.log(`Node process exited with code ${code}`);
        process.exit(code);
    });

    process.on("SIGINT", () => {
        console.log("\nShutting down...");
        nodeProcess.kill();
        process.exit();
    });
}

if (require.main === module) {
    main().catch(console.error);
}
