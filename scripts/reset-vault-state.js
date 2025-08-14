const { ethers } = require("hardhat");

async function main() {
    console.log("=== Resetting Vault State for Testing ===\n");

    const addresses = {
        AstaVerde: "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
        EcoStabilizer: "0x9A676e781A523b5d0C0e43731313A708CB607508",
        SCC: "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82",
    };

    const [deployer, alice] = await ethers.getSigners();
    console.log("Alice address:", alice.address);

    // Get contract instances
    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    const astaVerde = AstaVerde.attach(addresses.AstaVerde);

    const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");
    const vault = EcoStabilizer.attach(addresses.EcoStabilizer);

    const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
    const scc = SCC.attach(addresses.SCC);

    console.log("1. Checking current state:");
    const nft1Balance = await astaVerde.balanceOf(alice.address, 1);
    const nft2Balance = await astaVerde.balanceOf(alice.address, 2);
    const sccBalance = await scc.balanceOf(alice.address);

    console.log(`   NFT Token #1: ${nft1Balance}`);
    console.log(`   NFT Token #2: ${nft2Balance}`);
    console.log(`   SCC Balance: ${ethers.formatEther(sccBalance)} SCC`);

    // If tokens are in vault, withdraw them
    if (sccBalance > 0n && (nft1Balance === 0n || nft2Balance === 0n)) {
        console.log("\n2. Withdrawing tokens from vault...");

        // First approve SCC for burning (need to approve for each withdrawal)
        const sccPerToken = ethers.parseEther("20");
        const totalSccNeeded = sccPerToken * 2n; // For both tokens

        console.log("   Approving SCC for vault...");
        const approveTx = await scc.connect(alice).approve(addresses.EcoStabilizer, totalSccNeeded);
        await approveTx.wait();
        console.log("   ✅ SCC approved");

        // Withdraw token #1 if it's in vault
        if (nft1Balance === 0n) {
            try {
                console.log("   Withdrawing token #1...");
                const withdraw1Tx = await vault.connect(alice).withdraw(1);
                await withdraw1Tx.wait();
                console.log("   ✅ Token #1 withdrawn");
            } catch (e) {
                console.log("   ⚠️ Token #1 not in vault or error:", e.message);
            }
        }

        // Withdraw token #2 if it's in vault
        if (nft2Balance === 0n) {
            try {
                console.log("   Withdrawing token #2...");
                const withdraw2Tx = await vault.connect(alice).withdraw(2);
                await withdraw2Tx.wait();
                console.log("   ✅ Token #2 withdrawn");
            } catch (e) {
                console.log("   ⚠️ Token #2 not in vault or error:", e.message);
            }
        }
    }

    console.log("\n3. Final state:");
    const finalNft1 = await astaVerde.balanceOf(alice.address, 1);
    const finalNft2 = await astaVerde.balanceOf(alice.address, 2);
    const finalScc = await scc.balanceOf(alice.address);
    const isApproved = await astaVerde.isApprovedForAll(alice.address, addresses.EcoStabilizer);

    console.log(`   NFT Token #1: ${finalNft1}`);
    console.log(`   NFT Token #2: ${finalNft2}`);
    console.log(`   SCC Balance: ${ethers.formatEther(finalScc)} SCC`);
    console.log(`   Vault approved: ${isApproved ? "✅" : "❌"}`);

    if (!isApproved) {
        console.log("\n4. Setting vault approval...");
        const approvalTx = await astaVerde.connect(alice).setApprovalForAll(addresses.EcoStabilizer, true);
        await approvalTx.wait();
        console.log("   ✅ Vault approved for NFTs");
    }

    console.log("\n=== Ready for Testing ===");
    console.log("Alice now has both tokens available to test 'Deposit All' functionality!");
}

main().catch(console.error);
