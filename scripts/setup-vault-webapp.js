const { ethers } = require("hardhat");

async function main() {
    console.log("=== Setting up Vault for Webapp ===\n");

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

    console.log("1. Setting up NFT approval for vault:");
    try {
        const isApproved = await astaVerde.isApprovedForAll(alice.address, addresses.EcoStabilizer);
        if (!isApproved) {
            console.log("   Setting approval...");
            const tx = await astaVerde.connect(alice).setApprovalForAll(addresses.EcoStabilizer, true);
            await tx.wait();
            console.log("   ✅ NFT approval set!");
        } else {
            console.log("   ✅ Already approved");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message);
    }

    console.log("\n2. Checking Alice's current holdings:");
    try {
        const nftBalance1 = await astaVerde.balanceOf(alice.address, 1);
        const nftBalance2 = await astaVerde.balanceOf(alice.address, 2);
        const sccBalance = await scc.balanceOf(alice.address);

        console.log(`   NFT Token #1: ${nftBalance1}`);
        console.log(`   NFT Token #2: ${nftBalance2}`);
        console.log(`   SCC Balance: ${ethers.formatEther(sccBalance)} SCC`);

        // If Alice has SCC but no NFTs, she must have deposited them
        if (sccBalance > 0n && nftBalance1 === 0n && nftBalance2 === 0n) {
            console.log("\n   🔧 Alice has SCC but no NFTs - withdrawing to reset state...");

            // Check which NFTs are in vault
            const deposits = await vault.deposits(alice.address);
            console.log(`   NFTs in vault: ${deposits.length}`);

            for (const tokenId of deposits) {
                console.log(`   Withdrawing token #${tokenId}...`);

                // First approve SCC for burning
                const sccNeeded = ethers.parseEther("20");
                const allowance = await scc.allowance(alice.address, addresses.EcoStabilizer);
                if (allowance < sccNeeded) {
                    const approveTx = await scc.connect(alice).approve(addresses.EcoStabilizer, sccNeeded);
                    await approveTx.wait();
                    console.log(`   ✅ SCC approval set`);
                }

                const withdrawTx = await vault.connect(alice).withdraw(tokenId);
                await withdrawTx.wait();
                console.log(`   ✅ Token #${tokenId} withdrawn`);
            }
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message);
    }

    console.log("\n3. Final state check:");
    try {
        const nftBalance1 = await astaVerde.balanceOf(alice.address, 1);
        const nftBalance2 = await astaVerde.balanceOf(alice.address, 2);
        const sccBalance = await scc.balanceOf(alice.address);
        const isApproved = await astaVerde.isApprovedForAll(alice.address, addresses.EcoStabilizer);

        console.log(`   NFT Token #1: ${nftBalance1}`);
        console.log(`   NFT Token #2: ${nftBalance2}`);
        console.log(`   SCC Balance: ${ethers.formatEther(sccBalance)} SCC`);
        console.log(`   Vault approved for NFTs: ${isApproved ? "✅" : "❌"}`);

        if (nftBalance1 > 0 || nftBalance2 > 0) {
            console.log("\n   ✅ Alice has NFTs available to deposit via webapp!");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message);
    }

    console.log("\n=== Setup Complete ===");
    console.log("You can now use the webapp to deposit NFTs into the vault!");
}

main().catch(console.error);
