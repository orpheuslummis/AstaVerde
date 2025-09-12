import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract ABIs (minimal for testing)
const SCC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
];

const VAULT_ABI = [
    "function deposit(uint256 tokenId)",
    "function withdraw(uint256 tokenId)",
    "function SCC_PER_ASSET() view returns (uint256)",
    "function loans(uint256) view returns (address borrower, bool active)",
    "function getUserLoans(address user) view returns (uint256[])",
    "function ecoAsset() view returns (address)",
    "function scc() view returns (address)",
];

const ASTAVER_ABI = [
    "function balanceOf(address account, uint256 id) view returns (uint256)",
    "function setApprovalForAll(address operator, bool approved)",
    "function isRedeemed(uint256 tokenId) view returns (bool)",
    "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
];

async function main() {
    console.log("🧪 Starting EcoStabilizer smoke test...\n");

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC || "http://localhost:8545");
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Using signer:", signer.address);
    console.log("Balance:", ethers.formatEther(await provider.getBalance(signer.address)), "ETH\n");

    // Load deployment info
    const networkInfo = await provider.getNetwork();
    const deploymentPath = path.join(__dirname, "..", "deployments", `ecostabilizer-${networkInfo.chainId}.json`);

    if (!fs.existsSync(deploymentPath)) {
        throw new Error(`Deployment file not found: ${deploymentPath}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    console.log("Loaded deployment:", deployment.contracts);

    // Initialize contracts
    const astaVerde = new ethers.Contract(deployment.contracts.AstaVerde, ASTAVER_ABI, signer);
    const scc = new ethers.Contract(deployment.contracts.StabilizedCarbonCoin, SCC_ABI, signer);
    const vault = new ethers.Contract(deployment.contracts.EcoStabilizer, VAULT_ABI, signer);

    // Test 1: Contract references
    console.log("📋 Test 1: Verifying contract references...");
    const vaultAstaVerde = await vault.ecoAsset();
    const vaultSCC = await vault.scc();

    console.log("Vault AstaVerde reference:", vaultAstaVerde);
    console.log("Expected:", deployment.contracts.AstaVerde);
    console.log("✅ AstaVerde reference correct:", vaultAstaVerde.toLowerCase() === deployment.contracts.AstaVerde.toLowerCase());

    console.log("Vault SCC reference:", vaultSCC);
    console.log("Expected:", deployment.contracts.StabilizedCarbonCoin);
    console.log("✅ SCC reference correct:", vaultSCC.toLowerCase() === deployment.contracts.StabilizedCarbonCoin.toLowerCase());

    // Test 2: SCC constants
    console.log("\n📋 Test 2: Verifying SCC constants...");
    const sccSymbol = await scc.symbol();
    const sccDecimals = await scc.decimals();
    const sccPerAsset = await vault.SCC_PER_ASSET();

    console.log("SCC symbol:", sccSymbol);
    console.log("SCC decimals:", sccDecimals);
    console.log("SCC per asset:", ethers.formatEther(sccPerAsset));

    console.log("✅ SCC symbol correct:", sccSymbol === "SCC");
    console.log("✅ SCC decimals correct:", sccDecimals === 18n);
    console.log("✅ SCC per asset correct:", sccPerAsset === ethers.parseEther("20"));

    // Test 3: Check if we have test NFTs available
    console.log("\n📋 Test 3: Checking available NFTs...");

    // Check tokenId 1 (common test token)
    let testTokenId = 1n;
    let nftBalance = 0n;
    let redeemed;

    try {
        nftBalance = await astaVerde.balanceOf(signer.address, testTokenId);
        redeemed = await astaVerde.isRedeemed(testTokenId);
        console.log(`NFT ${testTokenId} balance:`, nftBalance.toString());
        console.log(`NFT ${testTokenId} redeemed:`, redeemed);
    } catch (error) {
        console.log(`NFT ${testTokenId} not available:`, error.message);
    }

    if (nftBalance === 0n) {
        console.log("⚠️  No test NFTs available in wallet for functional testing");
        console.log("Smoke test completed with basic verification only");
        return;
    }

    // Test 4: Functional deposit test (if NFT available and not redeemed)
    if (nftBalance > 0n && !redeemed) {
        console.log("\n📋 Test 4: Testing deposit functionality...");

        // Check initial SCC balance
        const initialSCCBalance = await scc.balanceOf(signer.address);
        console.log("Initial SCC balance:", ethers.formatEther(initialSCCBalance));

        // Approve vault to transfer NFT
        console.log("Approving vault for NFT transfers...");
        const approveTx = await astaVerde.setApprovalForAll(vault.target, true);
        await approveTx.wait();
        console.log("✅ NFT approval set");

        // Deposit NFT
        console.log(`Depositing NFT ${testTokenId}...`);
        const depositTx = await vault.deposit(testTokenId);
        const receipt = await depositTx.wait();
        console.log(`✅ Deposit successful, gas used: ${receipt.gasUsed}`);

        // Check post-deposit state
        const finalSCCBalance = await scc.balanceOf(signer.address);
        const nftBalanceAfter = await astaVerde.balanceOf(signer.address, testTokenId);
        const vaultNFTBalance = await astaVerde.balanceOf(vault.target, testTokenId);
        const loanInfo = await vault.loans(testTokenId);

        console.log("Final SCC balance:", ethers.formatEther(finalSCCBalance));
        console.log("SCC minted:", ethers.formatEther(finalSCCBalance - initialSCCBalance));
        console.log("NFT balance after:", nftBalanceAfter.toString());
        console.log("Vault NFT balance:", vaultNFTBalance.toString());
        console.log("Loan info:", loanInfo);

        console.log("✅ SCC minted correctly:", (finalSCCBalance - initialSCCBalance) === ethers.parseEther("20"));
        console.log("✅ NFT transferred to vault:", vaultNFTBalance === 1n);
        console.log("✅ Loan created correctly:", loanInfo[0].toLowerCase() === signer.address.toLowerCase() && loanInfo[1]);

        // Test 5: Functional withdraw test
        console.log("\n📋 Test 5: Testing withdraw functionality...");

        // Approve SCC spending
        console.log("Approving SCC spending for withdraw...");
        const sccApproveTx = await scc.approve(vault.target, ethers.parseEther("20"));
        await sccApproveTx.wait();
        console.log("✅ SCC approval set");

        // Withdraw NFT
        console.log(`Withdrawing NFT ${testTokenId}...`);
        const withdrawTx = await vault.withdraw(testTokenId);
        const withdrawReceipt = await withdrawTx.wait();
        console.log(`✅ Withdraw successful, gas used: ${withdrawReceipt.gasUsed}`);

        // Check post-withdraw state
        const finalSCCBalanceAfterWithdraw = await scc.balanceOf(signer.address);
        const nftBalanceAfterWithdraw = await astaVerde.balanceOf(signer.address, testTokenId);
        const vaultNFTBalanceAfterWithdraw = await astaVerde.balanceOf(vault.target, testTokenId);
        const loanInfoAfterWithdraw = await vault.loans(testTokenId);

        console.log("SCC balance after withdraw:", ethers.formatEther(finalSCCBalanceAfterWithdraw));
        console.log("NFT balance after withdraw:", nftBalanceAfterWithdraw.toString());
        console.log("Vault NFT balance after withdraw:", vaultNFTBalanceAfterWithdraw.toString());
        console.log("Loan info after withdraw:", loanInfoAfterWithdraw);

        console.log("✅ SCC burned correctly:", finalSCCBalanceAfterWithdraw === initialSCCBalance);
        console.log("✅ NFT returned to user:", nftBalanceAfterWithdraw === 1n);
        console.log("✅ Loan deactivated correctly:", !loanInfoAfterWithdraw[1]);

        console.log("\n🎉 Full smoke test completed successfully!");

        // Gas consumption summary
        console.log("\n⛽ Gas Consumption Summary:");
        console.log(`Deposit gas: ${receipt.gasUsed} (target: <150,000)`);
        console.log(`Withdraw gas: ${withdrawReceipt.gasUsed} (target: <120,000)`);

        if (receipt.gasUsed < 150000n) {
            console.log("✅ Deposit gas within target");
        } else {
            console.log("❌ Deposit gas exceeds target");
        }

        if (withdrawReceipt.gasUsed < 120000n) {
            console.log("✅ Withdraw gas within target");
        } else {
            console.log("❌ Withdraw gas exceeds target");
        }

    } else if (tokenInfo[4]) {
        console.log("⚠️  Available NFT is redeemed, cannot test deposit functionality");
    }

    console.log("\n✅ Smoke test completed");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Smoke test failed:", error);
        process.exit(1);
    });
