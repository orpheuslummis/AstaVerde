const hre = require("hardhat");

async function main() {
    console.log("🔍 COMPREHENSIVE DEV STACK VERIFICATION\n");
    console.log("=".repeat(80));

    let errors = [];
    let warnings = [];

    // Contract addresses from hardhat-deploy's records (throws if deployments/localhost is missing)
    const contracts = {
        MockUSDC: (await hre.deployments.get("MockUSDC")).address,
        AstaVerde: (await hre.deployments.get("AstaVerde")).address,
        SCC: (await hre.deployments.get("StabilizedCarbonCoin")).address,
        EcoStabilizer: (await hre.deployments.get("EcoStabilizer")).address,
    };

    console.log("1️⃣  CONTRACT DEPLOYMENT STATUS");
    console.log("-".repeat(40));

    for (const [name, address] of Object.entries(contracts)) {
        const code = await hre.ethers.provider.getCode(address);
        if (code === "0x") {
            console.log(`❌ ${name}: NOT DEPLOYED at ${address}`);
            errors.push(`${name} not deployed`);
        } else {
            console.log(`✅ ${name}: Deployed (${code.length} bytes)`);
        }
    }

    console.log("\n2️⃣  CONTRACT FUNCTIONALITY");
    console.log("-".repeat(40));

    try {
        // Test AstaVerde
        const astaVerde = await hre.ethers.getContractAt("AstaVerde", contracts.AstaVerde);
        const lastBatchID = await astaVerde.lastBatchID();
        const lastTokenID = await astaVerde.lastTokenID();
        console.log("✅ AstaVerde responding:");
        console.log(`   Last Batch ID: ${lastBatchID}`);
        console.log(`   Last Token ID: ${lastTokenID}`);

        if (lastBatchID == 0) {
            warnings.push("No batches minted yet");
        }
    } catch (e) {
        console.log(`❌ AstaVerde not responding: ${e.message}`);
        errors.push("AstaVerde not functional");
    }

    try {
        // Test USDC
        const usdc = await hre.ethers.getContractAt("MockUSDC", contracts.MockUSDC);
        const decimals = await usdc.decimals();
        const totalSupply = await usdc.totalSupply();
        console.log("✅ MockUSDC responding:");
        console.log(`   Decimals: ${decimals}`);
        console.log(`   Total Supply: ${hre.ethers.formatUnits(totalSupply, decimals)} USDC`);
    } catch (e) {
        console.log(`❌ MockUSDC not responding: ${e.message}`);
        errors.push("MockUSDC not functional");
    }

    try {
        // Test EcoStabilizer
        const vault = await hre.ethers.getContractAt("EcoStabilizer", contracts.EcoStabilizer);
        const sccPerAsset = await vault.SCC_PER_ASSET();
        console.log("✅ EcoStabilizer responding:");
        console.log(`   SCC per Asset: ${hre.ethers.formatEther(sccPerAsset)}`);
    } catch (e) {
        console.log(`❌ EcoStabilizer not responding: ${e.message}`);
        errors.push("EcoStabilizer not functional");
    }

    console.log("\n3️⃣  ACCOUNT BALANCES");
    console.log("-".repeat(40));

    const [deployer, alice, bob, charlie] = await hre.ethers.getSigners();
    const testAccounts = [
        { name: "Deployer", signer: deployer },
        { name: "Alice", signer: alice },
        { name: "Bob", signer: bob },
        { name: "Charlie", signer: charlie },
    ];

    const usdc = await hre.ethers.getContractAt("MockUSDC", contracts.MockUSDC);

    for (const account of testAccounts) {
        const ethBalance = await hre.ethers.provider.getBalance(account.signer.address);
        const usdcBalance = await usdc.balanceOf(account.signer.address);

        console.log(`${account.name} (${account.signer.address.slice(0, 6)}...${account.signer.address.slice(-4)}):`);
        console.log(`   ETH: ${hre.ethers.formatEther(ethBalance)}`);
        console.log(`   USDC: ${hre.ethers.formatUnits(usdcBalance, 6)}`);

        if (account.name !== "Deployer" && usdcBalance == 0) {
            warnings.push(`${account.name} has no USDC`);
        }
    }

    console.log("\n4️⃣  WEBAPP CONFIGURATION");
    console.log("-".repeat(40));

    const fs = require("fs");
    const envPath = "./webapp/.env.local";

    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf8");
        const envVars = envContent.split("\n").filter((line) => line.includes("ADDRESS"));

        console.log("✅ Webapp .env.local exists with addresses:");
        envVars.forEach((line) => {
            if (line.trim()) console.log(`   ${line.trim()}`);
        });

        // Verify addresses match
        if (!envContent.includes(contracts.AstaVerde)) {
            errors.push("Webapp has wrong AstaVerde address");
        }
        if (!envContent.includes(contracts.MockUSDC)) {
            errors.push("Webapp has wrong USDC address");
        }
    } else {
        console.log("❌ Webapp .env.local not found");
        errors.push("Webapp configuration missing");
    }

    console.log("\n5️⃣  NETWORK STATUS");
    console.log("-".repeat(40));

    const network = await hre.ethers.provider.getNetwork();
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    console.log(`✅ Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`✅ Current Block: ${blockNumber}`);

    if (network.chainId !== 31337n) {
        errors.push("Not connected to local hardhat network");
    }

    console.log("\n6️⃣  SERVICE STATUS");
    console.log("-".repeat(40));

    // Check if services are accessible
    try {
        const rpcTest = await hre.ethers.provider.getBlockNumber();
        console.log(`✅ Hardhat RPC: Responding (Block ${rpcTest})`);
    } catch (e) {
        console.log("❌ Hardhat RPC: Not responding");
        errors.push("Hardhat RPC not accessible");
    }

    console.log("✅ Webapp: Should be at http://localhost:3000");

    // Final summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 VERIFICATION SUMMARY");
    console.log("=".repeat(80));

    if (errors.length === 0 && warnings.length === 0) {
        console.log("\n✅ ALL SYSTEMS OPERATIONAL - Dev stack is fully functional!");
    } else {
        if (errors.length > 0) {
            console.log("\n❌ CRITICAL ERRORS:");
            errors.forEach((e) => console.log(`   - ${e}`));
        }

        if (warnings.length > 0) {
            console.log("\n⚠️  WARNINGS:");
            warnings.forEach((w) => console.log(`   - ${w}`));
        }

        console.log("\n🔧 RECOMMENDED ACTIONS:");
        if (errors.includes("AstaVerde not deployed")) {
            console.log("   1. Run: npx hardhat deploy --network localhost");
        }
        if (warnings.includes("No batches minted yet")) {
            console.log("   2. Run: npx hardhat run scripts/mint-local-batch.js --network localhost");
        }
        if (warnings.some((w) => w.includes("has no USDC"))) {
            console.log("   3. Fund accounts with USDC manually or fix MockUSDC permissions");
        }
    }

    console.log("\n" + "=".repeat(80));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
