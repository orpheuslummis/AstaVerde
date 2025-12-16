const { ethers } = require("hardhat");

async function main() {
    const [owner, alice] = await ethers.getSigners();

    const astaverdeAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const vaultAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

    const astaverde = await ethers.getContractAt("AstaVerde", astaverdeAddress);
    const vault = await ethers.getContractAt("EcoStabilizer", vaultAddress);

    console.log("\n=== Testing Deposit Issue ===\n");

    // Check Alice's current balances
    console.log("📊 Alice's token balances before deposit:");
    for (let i = 1; i <= 6; i++) {
        const balance = await astaverde.balanceOf(alice.address, i);
        console.log(`  Token ${i}: ${balance}`);
    }

    // Approve vault to transfer NFTs
    console.log("\n🔓 Approving vault for NFT transfers...");
    await (await astaverde.connect(alice).setApprovalForAll(vaultAddress, true)).wait();
    console.log("✅ Vault approved\n");

    // Deposit token 1 from Batch 1
    console.log("💼 Depositing token 1 (from Batch 1) to vault...");
    try {
        await (await vault.connect(alice).deposit(1)).wait();
        console.log("✅ Token 1 deposited successfully\n");
    } catch (error) {
        console.log("❌ Error depositing token 1:", error.message, "\n");
    }

    // Check balances after first deposit
    console.log("📊 Alice's token balances after depositing token 1:");
    for (let i = 1; i <= 6; i++) {
        const balance = await astaverde.balanceOf(alice.address, i);
        console.log(`  Token ${i}: ${balance}`);
    }

    // Now try to deposit remaining tokens from Batch 1 (tokens 2 and 3)
    console.log("\n💼 Depositing remaining tokens from Batch 1 (tokens 2 and 3)...");
    try {
        await (await vault.connect(alice).depositBatch([2, 3])).wait();
        console.log("✅ Tokens 2 and 3 deposited successfully\n");
    } catch (error) {
        console.log("❌ Error depositing tokens 2 and 3:", error.message, "\n");
    }

    // Final balance check
    console.log("📊 Final token balances:");
    for (let i = 1; i <= 6; i++) {
        const balance = await astaverde.balanceOf(alice.address, i);
        console.log(`  Token ${i}: ${balance}`);
    }

    // Check vault status
    console.log("\n🔍 Checking vault status:");
    const aliceLoans = await vault.getUserLoans(alice.address);
    console.log(`  Alice's loans in vault: [${aliceLoans.join(", ")}]`);

    // Verify Batch 2 tokens are unaffected
    console.log("\n✅ Verification:");
    const batch2Affected =
        (await astaverde.balanceOf(alice.address, 4)) === 0n ||
        (await astaverde.balanceOf(alice.address, 5)) === 0n ||
        (await astaverde.balanceOf(alice.address, 6)) === 0n;

    if (batch2Affected) {
        console.log("❌ ISSUE DETECTED: Batch 2 tokens were affected!");
    } else {
        console.log("✅ Batch 2 tokens (4, 5, 6) remain unaffected - Issue appears to be fixed!");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
