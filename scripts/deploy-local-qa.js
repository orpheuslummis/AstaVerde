const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Setting up complete local QA environment...");

    const [deployer, user1, user2] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("User1:", user1.address);
    console.log("User2:", user2.address);
    console.log("Deployer balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    // Deploy MockUSDC
    console.log("\n1. Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy(ethers.parseUnits("1000000", 6)); // 1M USDC
    await usdc.waitForDeployment();
    console.log("MockUSDC deployed to:", await usdc.getAddress());

    // Deploy AstaVerde
    console.log("\n2. Deploying AstaVerde...");
    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    const astaVerde = await AstaVerde.deploy(deployer.address, await usdc.getAddress());
    await astaVerde.waitForDeployment();
    console.log("AstaVerde deployed to:", await astaVerde.getAddress());

    // Deploy StabilizedCarbonCoin
    console.log("\n3. Deploying StabilizedCarbonCoin...");
    const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
    const scc = await SCC.deploy(ethers.ZeroAddress); // Deploy without vault first
    await scc.waitForDeployment();
    console.log("StabilizedCarbonCoin deployed to:", await scc.getAddress());

    // Deploy EcoStabilizer
    console.log("\n4. Deploying EcoStabilizer...");
    const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
    const ecoStabilizer = await EcoStabilizer.deploy(await astaVerde.getAddress(), await scc.getAddress());
    await ecoStabilizer.waitForDeployment();
    console.log("EcoStabilizer deployed to:", await ecoStabilizer.getAddress());

    // Setup roles
    console.log("\n5. Setting up roles...");
    const MINTER_ROLE = await scc.MINTER_ROLE();
    const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();

    await scc.grantRole(MINTER_ROLE, await ecoStabilizer.getAddress());
    console.log("✅ Granted MINTER_ROLE to vault");

    await scc.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    console.log("✅ Renounced admin role");

    // Mint USDC to users for testing
    console.log("\n6. Minting USDC to users...");
    await usdc.mint(deployer.address, ethers.parseUnits("100000", 6)); // 100k USDC
    await usdc.mint(user1.address, ethers.parseUnits("50000", 6)); // 50k USDC
    await usdc.mint(user2.address, ethers.parseUnits("50000", 6)); // 50k USDC
    console.log("✅ Minted USDC to deployer, user1, and user2");

    // Create a test batch of NFTs
    console.log("\n7. Creating test batch of NFTs...");
    const producers = [deployer.address, user1.address, user2.address];
    const cids = [
        "QmTest1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "QmTest2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "QmTest3cccccccccccccccccccccccccccccccccccccccc",
    ];

    await astaVerde.mintBatch(producers, cids);
    console.log("✅ Minted test batch with 3 NFTs");

    // Buy some NFTs with different users
    console.log("\n8. Setting up NFT purchases for testing...");

    // User1 buys 1 NFT
    const price = ethers.parseUnits("230", 6); // Current base price
    await usdc.connect(user1).approve(await astaVerde.getAddress(), price);
    await astaVerde.connect(user1).buyBatch(1n, price, 1);
    console.log("✅ User1 bought 1 NFT");

    // User2 buys 1 NFT
    await usdc.connect(user2).approve(await astaVerde.getAddress(), price);
    await astaVerde.connect(user2).buyBatch(1n, price, 1);
    console.log("✅ User2 bought 1 NFT");

    console.log("\n🎉 Local QA environment setup complete!");
    console.log("\n📋 Contract Addresses:");
    console.log("MockUSDC:", await usdc.getAddress());
    console.log("AstaVerde:", await astaVerde.getAddress());
    console.log("StabilizedCarbonCoin:", await scc.getAddress());
    console.log("EcoStabilizer:", await ecoStabilizer.getAddress());

    console.log("\n👥 Test Accounts:");
    console.log("Deployer:", deployer.address);
    console.log("User1:", user1.address, "(has NFT #1)");
    console.log("User2:", user2.address, "(has NFT #2)");

    console.log("\n📝 Ready for QA Testing:");
    console.log("- Users have USDC balances");
    console.log("- Users own NFTs to test vault with");
    console.log("- Vault contracts are deployed and secured");
    console.log("- All contracts ready for webapp integration");

    return {
        usdc: await usdc.getAddress(),
        astaVerde: await astaVerde.getAddress(),
        scc: await scc.getAddress(),
        ecoStabilizer: await ecoStabilizer.getAddress(),
        deployer: deployer.address,
        user1: user1.address,
        user2: user2.address,
    };
}

if (require.main === module) {
    main()
        .then((addresses) => {
            console.log("\n✅ Setup completed successfully!");
            console.log("Contract addresses:", addresses);
            process.exit(0);
        })
        .catch((error) => {
            console.error("❌ Setup failed:", error);
            process.exit(1);
        });
}

module.exports = main;
