const { ethers } = require("ethers");

async function checkVaultState() {
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");

    const aliceAddr = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const vaultAddr = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

    const vaultAbi = [
        "function getUserLoans(address user) view returns (uint256[])",
        "function getUserLoansIndexed(address user, uint256 offset, uint256 limit) view returns (uint256[] memory tokenIds, uint256 nextOffset)",
        "function loans(uint256) view returns (address user, uint256 tokenId, uint256 amount, uint256 timestamp)",
        "function getTotalActiveLoans() view returns (uint256)",
    ];

    const vaultContract = new ethers.Contract(vaultAddr, vaultAbi, provider);

    console.log("\n=== Vault State Check ===");
    console.log("Vault Address:", vaultAddr);
    console.log("User Address:", aliceAddr);

    try {
        // Check total active loans
        const totalLoans = await vaultContract.getTotalActiveLoans();
        console.log("\nTotal Active Loans in Vault:", totalLoans.toString());

        // Check getUserLoans
        console.log("\n1. Using getUserLoans():");
        try {
            const loans = await vaultContract.getUserLoans(aliceAddr);
            console.log(
                "   Loans:",
                loans.map((l) => l.toString()),
            );
        } catch (err) {
            console.log("   Error:", err.message);
        }

        // Check getUserLoansIndexed
        console.log("\n2. Using getUserLoansIndexed():");
        try {
            const result = await vaultContract.getUserLoansIndexed(aliceAddr, 1n, 2000n);
            console.log(
                "   Token IDs:",
                result.tokenIds.map((id) => id.toString()),
            );
            console.log("   Next Offset:", result.nextOffset.toString());
        } catch (err) {
            console.log("   Error:", err.message);
        }

        // Check specific loan details for tokenId 1-20
        console.log("\n3. Checking loan details for each token:");
        for (let i = 1n; i <= 20n; i++) {
            try {
                const loan = await vaultContract.loans(i);
                if (loan.user !== "0x0000000000000000000000000000000000000000") {
                    console.log(`   Token #${i}:`);
                    console.log(`     User: ${loan.user}`);
                    console.log(`     Amount: ${ethers.formatEther(loan.amount)} SCC`);
                    console.log(`     Is Alice's: ${loan.user.toLowerCase() === aliceAddr.toLowerCase()}`);
                }
            } catch (err) {
                // Token doesn't have a loan
            }
        }
    } catch (err) {
        console.log("Error checking vault:", err.message);
    }
}

checkVaultState().catch(console.error);
