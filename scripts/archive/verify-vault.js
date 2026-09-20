const { ethers } = require("hardhat");

async function main() {
    console.log("=== Verifying Vault Setup ===\n");

    const addresses = {
        AstaVerde: "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
        EcoStabilizer: "0x9A676e781A523b5d0C0e43731313A708CB607508",
        SCC: "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82",
    };

    const [deployer, alice] = await ethers.getSigners();

    // Get contract instances
    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    const astaVerde = AstaVerde.attach(addresses.AstaVerde);

    const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
    const vault = EcoStabilizer.attach(addresses.EcoStabilizer);

    const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
    const scc = SCC.attach(addresses.SCC);

    console.log("1. Checking contract deployments:");
    for (const [name, addr] of Object.entries(addresses)) {
        const code = await ethers.provider.getCode(addr);
        console.log(`   ${name}: ${code.length > 2 ? "✅ Deployed" : "❌ Not deployed"}`);
    }

    console.log("\n2. Checking vault configuration:");
    try {
        const astaVerdeInVault = await vault.astaVerde();
        console.log(`   AstaVerde address in vault: ${astaVerdeInVault}`);
        console.log(
            `   Matches expected: ${astaVerdeInVault.toLowerCase() === addresses.AstaVerde.toLowerCase() ? "✅" : "❌"}`,
        );

        const sccInVault = await vault.scc();
        console.log(`   SCC address in vault: ${sccInVault}`);
        console.log(`   Matches expected: ${sccInVault.toLowerCase() === addresses.SCC.toLowerCase() ? "✅" : "❌"}`);
    } catch (error) {
        console.log("   ❌ Error reading vault config:", error.message);
    }

    console.log("\n3. Checking SCC minter role:");
    try {
        const MINTER_ROLE = await scc.MINTER_ROLE();
        const vaultHasMinterRole = await scc.hasRole(MINTER_ROLE, addresses.EcoStabilizer);
        console.log(`   Vault has MINTER_ROLE: ${vaultHasMinterRole ? "✅" : "❌"}`);

        if (!vaultHasMinterRole) {
            console.log("   🔧 Granting MINTER_ROLE to vault...");
            const tx = await scc.connect(deployer).grantRole(MINTER_ROLE, addresses.EcoStabilizer);
            await tx.wait();
            console.log("   ✅ MINTER_ROLE granted!");
        }
    } catch (error) {
        console.log("   ❌ Error checking minter role:", error.message);
    }

    console.log("\n4. Checking Alice's NFT ownership:");
    try {
        const balance1 = await astaVerde.balanceOf(alice.address, 1);
        const balance2 = await astaVerde.balanceOf(alice.address, 2);
        console.log(`   Token #1 balance: ${balance1}`);
        console.log(`   Token #2 balance: ${balance2}`);

        if (balance1 === 0n && balance2 === 0n) {
            console.log("   ❌ Alice has no NFTs!");
        }
    } catch (error) {
        console.log("   ❌ Error checking NFT balance:", error.message);
    }

    console.log("\n5. Checking vault approval:");
    try {
        const isApproved = await astaVerde.isApprovedForAll(alice.address, addresses.EcoStabilizer);
        console.log(`   Alice approved vault for NFTs: ${isApproved ? "✅" : "❌"}`);

        if (!isApproved) {
            console.log("   🔧 Setting approval for vault...");
            const tx = await astaVerde.connect(alice).setApprovalForAll(addresses.EcoStabilizer, true);
            await tx.wait();
            console.log("   ✅ Approval set!");
        }
    } catch (error) {
        console.log("   ❌ Error checking approval:", error.message);
    }

    console.log("\n6. Testing deposit functionality:");
    try {
        // Check if Alice has token #1
        const balance = await astaVerde.balanceOf(alice.address, 1);
        if (balance > 0) {
            console.log("   🔧 Attempting to deposit token #1...");
            const tx = await vault.connect(alice).deposit(1);
            await tx.wait();
            console.log("   ✅ Deposit successful!");

            // Check SCC balance
            const sccBalance = await scc.balanceOf(alice.address);
            console.log(`   Alice's SCC balance: ${ethers.formatEther(sccBalance)} SCC`);

            // Withdraw it back
            console.log("   🔧 Withdrawing token #1...");
            const withdrawTx = await vault.connect(alice).withdraw(1);
            await withdrawTx.wait();
            console.log("   ✅ Withdrawal successful!");
        } else {
            console.log("   ⚠️ Alice doesn't have token #1 to test with");
        }
    } catch (error) {
        console.log("   ❌ Error testing deposit:", error.message);
        if (error.data) {
            console.log("   Error data:", error.data);
        }
    }

    console.log("\n=== Vault Verification Complete ===");
}

main().catch(console.error);
