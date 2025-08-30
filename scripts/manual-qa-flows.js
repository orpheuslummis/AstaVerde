const { ethers } = require("hardhat");
const readline = require("readline");

// Interactive CLI for manual QA testing
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

function formatBalance(balance, decimals = 18) {
    return ethers.formatUnits(balance, decimals);
}

function formatUsdc(balance) {
    return ethers.formatUnits(balance, 6);
}

async function waitForKeyPress(message = "\nPress Enter to continue...") {
    await prompt(message);
}

async function displayAccountInfo(signer, contracts) {
    const { usdc, astaVerde, scc } = contracts;

    console.log(`\n📋 Account: ${signer.address}`);
    console.log(`ETH Balance: ${formatBalance(await signer.provider.getBalance(signer.address))} ETH`);
    console.log(`USDC Balance: ${formatUsdc(await usdc.balanceOf(signer.address))} USDC`);
    console.log(`SCC Balance: ${formatBalance(await scc.balanceOf(signer.address))} SCC`);

    // Show owned NFTs (check first 10 tokens)
    console.log("\nOwned NFTs:");
    for (let i = 1; i <= 10; i++) {
        try {
            const balance = await astaVerde.balanceOf(signer.address, i);
            if (balance > 0n) {
                const redeemed = await astaVerde.isRedeemed(i);
                const status = redeemed ? "REDEEMED" : "ACTIVE";
                console.log(`  Token #${i}: ${balance.toString()} (${status})`);
            }
        } catch (e) {
            // Token doesn't exist yet
        }
    }
}

async function main() {
    console.log("🎮 AstaVerde Phase 1 + Phase 2 Manual QA Testing\n");

    // Setup contracts
    const [deployer, user1, user2, user3] = await ethers.getSigners();

    // Load deployed contracts (assuming they're deployed)
    console.log("📡 Loading deployed contracts...");

    let contracts;
    try {
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const AstaVerde = await ethers.getContractFactory("AstaVerde");
        const SCC = await ethers.getContractFactory("StabilizedCarbonCoin");
        const EcoStabilizer = await ethers.getContractFactory("EcoStabilizer");

        // You'll need to update these addresses based on your deployment
        // For now, we'll deploy fresh ones
        console.log("⚠️  No deployed addresses found, deploying fresh contracts...");

        const usdc = await MockUSDC.deploy(ethers.parseUnits("10000000", 6));
        await usdc.waitForDeployment();

        const astaVerde = await AstaVerde.deploy(deployer.address, await usdc.getAddress());
        await astaVerde.waitForDeployment();

        const scc = await SCC.deploy(ethers.ZeroAddress); // Deploy without vault initially
        await scc.waitForDeployment();

        const vault = await EcoStabilizer.deploy(await astaVerde.getAddress(), await scc.getAddress());
        await vault.waitForDeployment();

        // Setup roles
        const MINTER_ROLE = await scc.MINTER_ROLE();
        await scc.grantRole(MINTER_ROLE, await vault.getAddress());

        // Mint USDC to all users
        for (const user of [deployer, user1, user2, user3]) {
            await usdc.mint(user.address, ethers.parseUnits("50000", 6));
        }

        contracts = {
            usdc,
            astaVerde,
            scc,
            vault,
            addresses: {
                usdc: await usdc.getAddress(),
                astaVerde: await astaVerde.getAddress(),
                scc: await scc.getAddress(),
                vault: await vault.getAddress(),
            },
        };

        console.log("✅ Contracts deployed and setup complete");
        console.log(`MockUSDC: ${contracts.addresses.usdc}`);
        console.log(`AstaVerde: ${contracts.addresses.astaVerde}`);
        console.log(`SCC: ${contracts.addresses.scc}`);
        console.log(`Vault: ${contracts.addresses.vault}`);
    } catch (error) {
        console.error("❌ Failed to load contracts:", error.message);
        process.exit(1);
    }

    // QA Test Menu
    while (true) {
        console.log("\n" + "=".repeat(60));
        console.log("🎮 MANUAL QA TEST MENU");
        console.log("=".repeat(60));
        console.log("1. Phase 1: Create NFT Batch (Admin)");
        console.log("2. Phase 1: Buy NFTs (User)");
        console.log("3. Phase 1: Redeem NFT (Owner)");
        console.log("4. Phase 2: Deposit NFT to Vault (Get 20 SCC)");
        console.log("5. Phase 2: Withdraw NFT from Vault (Burn 20 SCC)");
        console.log("6. Phase 2: Try deposit REDEEMED NFT (Should fail)");
        console.log("7. View Account Balances & NFTs");
        console.log("8. Switch Active User");
        console.log("9. Exit");

        const choice = await prompt("\nSelect option (1-9): ");

        let currentUser = user1; // Default user

        switch (choice) {
            case "1":
                await testCreateNFTBatch(deployer, contracts);
                break;
            case "2":
                console.log(`\nCurrent user: ${currentUser.address}`);
                await testBuyNFTs(currentUser, contracts);
                break;
            case "3":
                console.log(`\nCurrent user: ${currentUser.address}`);
                await testRedeemNFT(currentUser, contracts);
                break;
            case "4":
                console.log(`\nCurrent user: ${currentUser.address}`);
                await testDepositNFT(currentUser, contracts);
                break;
            case "5":
                console.log(`\nCurrent user: ${currentUser.address}`);
                await testWithdrawNFT(currentUser, contracts);
                break;
            case "6":
                console.log(`\nCurrent user: ${currentUser.address}`);
                await testDepositRedeemedNFT(currentUser, contracts);
                break;
            case "7":
                await displayAccountInfo(currentUser, contracts);
                await waitForKeyPress();
                break;
            case "8":
                const userOptions = { 1: user1, 2: user2, 3: user3 };
                const userChoice = await prompt("Select user (1=user1, 2=user2, 3=user3): ");
                if (userOptions[userChoice]) {
                    currentUser = userOptions[userChoice];
                    console.log(`✅ Switched to ${currentUser.address}`);
                }
                break;
            case "9":
                console.log("👋 Goodbye!");
                rl.close();
                process.exit(0);
            default:
                console.log("❌ Invalid option");
        }
    }
}

async function testCreateNFTBatch(admin, contracts) {
    const { astaVerde } = contracts;

    console.log("\n🎯 TEST: Creating NFT Batch (Phase 1)");
    console.log("━".repeat(50));

    const batchSize = parseInt(await prompt("How many NFTs to create? (1-5): ")) || 3;

    const producers = [];
    const cids = [];

    for (let i = 0; i < batchSize; i++) {
        producers.push(admin.address);
        cids.push(`QmTest${i + 1}${"a".repeat(39)}`);
    }

    console.log(`Creating batch of ${batchSize} NFTs...`);

    try {
        const tx = await astaVerde.mintBatch(producers, cids);
        await tx.wait();

        console.log(`✅ Created ${batchSize} NFTs successfully`);
        console.log(`Gas used: ${(await tx.wait()).gasUsed}`);

        // Show current batch info
        const currentBatchId = await astaVerde.currentBatchId();
        console.log(`Current batch ID: ${currentBatchId}`);
    } catch (error) {
        console.log(`❌ Failed to create NFTs: ${error.message}`);
    }

    await waitForKeyPress();
}

async function testBuyNFTs(user, contracts) {
    const { astaVerde, usdc } = contracts;

    console.log("\n🎯 TEST: Buying NFTs (Phase 1)");
    console.log("━".repeat(50));

    try {
        const currentBatchId = await astaVerde.currentBatchId();
        if (currentBatchId === 0n) {
            console.log("❌ No NFT batches available. Create a batch first!");
            await waitForKeyPress();
            return;
        }

        console.log(`Available batch: ${currentBatchId}`);

        const batchId = BigInt((await prompt(`Which batch to buy from? (1-${currentBatchId}): `)) || "1");
        const quantity = parseInt(await prompt("How many NFTs to buy? (1-5): ")) || 1;

        // Get current price
        const priceInfo = await astaVerde.getBatchPriceInfo(batchId);
        const currentPrice = priceInfo[0]; // currentPrice
        const totalCost = currentPrice * BigInt(quantity);

        console.log(`Current price per NFT: ${formatUsdc(currentPrice)} USDC`);
        console.log(`Total cost: ${formatUsdc(totalCost)} USDC`);

        const userBalance = await usdc.balanceOf(user.address);
        if (userBalance < totalCost) {
            console.log(`❌ Insufficient USDC balance. Need ${formatUsdc(totalCost)}, have ${formatUsdc(userBalance)}`);
            await waitForKeyPress();
            return;
        }

        // Approve and buy
        console.log("Approving USDC...");
        let tx = await usdc.connect(user).approve(await astaVerde.getAddress(), totalCost);
        await tx.wait();

        console.log("Buying NFTs...");
        tx = await astaVerde.connect(user).buyBatch(batchId, currentPrice, quantity);
        const receipt = await tx.wait();

        console.log(`✅ Successfully bought ${quantity} NFTs`);
        console.log(`Gas used: ${receipt.gasUsed}`);
    } catch (error) {
        console.log(`❌ Failed to buy NFTs: ${error.message}`);
    }

    await waitForKeyPress();
}

async function testRedeemNFT(user, contracts) {
    const { astaVerde } = contracts;

    console.log("\n🎯 TEST: Redeeming NFT (Phase 1)");
    console.log("━".repeat(50));

    // Show user's NFTs
    console.log("Your NFTs:");
    let ownedTokens = [];
    for (let i = 1; i <= 20; i++) {
        try {
            const balance = await astaVerde.balanceOf(user.address, i);
            if (balance > 0n) {
                const redeemed = await astaVerde.isRedeemed(i);
                const status = redeemed ? "REDEEMED" : "ACTIVE";
                console.log(`  Token #${i}: ${status}`);
                if (!tokenInfo[4]) ownedTokens.push(i);
            }
        } catch (e) {}
    }

    if (ownedTokens.length === 0) {
        console.log("❌ No active NFTs to redeem. Buy some first!");
        await waitForKeyPress();
        return;
    }

    const tokenId = parseInt(await prompt(`Which token to redeem? (${ownedTokens.join(", ")}): `));
    if (!ownedTokens.includes(tokenId)) {
        console.log("❌ Invalid token selection");
        await waitForKeyPress();
        return;
    }

    try {
        console.log(`Redeeming token #${tokenId}...`);
        const tx = await astaVerde.connect(user).redeemToken(tokenId);
        const receipt = await tx.wait();

        console.log(`✅ Token #${tokenId} redeemed successfully`);
        console.log(`Gas used: ${receipt.gasUsed}`);
        console.log("⚠️  This NFT can no longer be deposited to the vault!");
    } catch (error) {
        console.log(`❌ Failed to redeem NFT: ${error.message}`);
    }

    await waitForKeyPress();
}

async function testDepositNFT(user, contracts) {
    const { astaVerde, vault, scc } = contracts;

    console.log("\n🎯 TEST: Deposit NFT to Vault (Phase 2)");
    console.log("━".repeat(50));

    // Show user's active (non-redeemed, non-vaulted) NFTs
    console.log("Your available NFTs:");
    let availableTokens = [];
    for (let i = 1; i <= 20; i++) {
        try {
            const balance = await astaVerde.balanceOf(user.address, i);
            if (balance > 0n) {
                const redeemed = await astaVerde.isRedeemed(i);
                const loanInfo = await vault.loans(i);

                if (!tokenInfo[4] && !loanInfo[1]) {
                    // Not redeemed and not in vault
                    console.log(`  Token #${i}: AVAILABLE`);
                    availableTokens.push(i);
                } else if (tokenInfo[4]) {
                    console.log(`  Token #${i}: REDEEMED (unavailable)`);
                } else if (loanInfo[1]) {
                    console.log(`  Token #${i}: IN VAULT (unavailable)`);
                }
            }
        } catch (e) {}
    }

    if (availableTokens.length === 0) {
        console.log("❌ No available NFTs to deposit. Buy active NFTs first!");
        await waitForKeyPress();
        return;
    }

    const tokenId = parseInt(await prompt(`Which token to deposit? (${availableTokens.join(", ")}): `));
    if (!availableTokens.includes(tokenId)) {
        console.log("❌ Invalid token selection");
        await waitForKeyPress();
        return;
    }

    try {
        // Check initial SCC balance
        const initialSCC = await scc.balanceOf(user.address);
        console.log(`Initial SCC balance: ${formatBalance(initialSCC)} SCC`);

        // Approve NFT transfer
        console.log("Approving NFT for vault...");
        let tx = await astaVerde.connect(user).setApprovalForAll(await vault.getAddress(), true);
        await tx.wait();

        // Deposit NFT
        console.log(`Depositing token #${tokenId} to vault...`);
        tx = await vault.connect(user).deposit(tokenId);
        const receipt = await tx.wait();

        // Check results
        const finalSCC = await scc.balanceOf(user.address);
        const nftBalance = await astaVerde.balanceOf(user.address, tokenId);
        const vaultNftBalance = await astaVerde.balanceOf(await vault.getAddress(), tokenId);

        console.log("✅ Deposit successful!");
        console.log(`Gas used: ${receipt.gasUsed}`);
        console.log(`SCC minted: ${formatBalance(finalSCC - initialSCC)} SCC`);
        console.log(`Your NFT balance: ${nftBalance} (should be 0)`);
        console.log(`Vault NFT balance: ${vaultNftBalance} (should be 1)`);

        if (finalSCC - initialSCC === ethers.parseEther("20")) {
            console.log("✅ Correct amount minted (20 SCC)");
        } else {
            console.log("❌ Incorrect amount minted");
        }
    } catch (error) {
        console.log(`❌ Failed to deposit NFT: ${error.message}`);
    }

    await waitForKeyPress();
}

async function testWithdrawNFT(user, contracts) {
    const { astaVerde, vault, scc } = contracts;

    console.log("\n🎯 TEST: Withdraw NFT from Vault (Phase 2)");
    console.log("━".repeat(50));

    // Show user's vaulted NFTs
    console.log("Your vaulted NFTs:");
    let vaultedTokens = [];
    for (let i = 1; i <= 20; i++) {
        try {
            const loanInfo = await vault.loans(i);
            if (loanInfo[1] && loanInfo[0].toLowerCase() === user.address.toLowerCase()) {
                console.log(`  Token #${i}: IN VAULT`);
                vaultedTokens.push(i);
            }
        } catch (e) {}
    }

    if (vaultedTokens.length === 0) {
        console.log("❌ No NFTs in vault. Deposit some first!");
        await waitForKeyPress();
        return;
    }

    const tokenId = parseInt(await prompt(`Which token to withdraw? (${vaultedTokens.join(", ")}): `));
    if (!vaultedTokens.includes(tokenId)) {
        console.log("❌ Invalid token selection");
        await waitForKeyPress();
        return;
    }

    try {
        // Check SCC balance
        const userSCCBalance = await scc.balanceOf(user.address);
        const requiredSCC = ethers.parseEther("20");

        console.log(`Your SCC balance: ${formatBalance(userSCCBalance)} SCC`);
        console.log(`Required SCC: ${formatBalance(requiredSCC)} SCC`);

        if (userSCCBalance < requiredSCC) {
            console.log("❌ Insufficient SCC balance for withdrawal!");
            await waitForKeyPress();
            return;
        }

        // Approve SCC spending
        console.log("Approving SCC for burning...");
        let tx = await scc.connect(user).approve(await vault.getAddress(), requiredSCC);
        await tx.wait();

        // Withdraw NFT
        console.log(`Withdrawing token #${tokenId} from vault...`);
        tx = await vault.connect(user).withdraw(tokenId);
        const receipt = await tx.wait();

        // Check results
        const finalSCCBalance = await scc.balanceOf(user.address);
        const nftBalance = await astaVerde.balanceOf(user.address, tokenId);
        const loanInfo = await vault.loans(tokenId);

        console.log("✅ Withdrawal successful!");
        console.log(`Gas used: ${receipt.gasUsed}`);
        console.log(`SCC burned: ${formatBalance(userSCCBalance - finalSCCBalance)} SCC`);
        console.log(`Your NFT balance: ${nftBalance} (should be 1)`);
        console.log(`Loan active: ${loanInfo[1]} (should be false)`);
    } catch (error) {
        console.log(`❌ Failed to withdraw NFT: ${error.message}`);
    }

    await waitForKeyPress();
}

async function testDepositRedeemedNFT(user, contracts) {
    const { astaVerde, vault } = contracts;

    console.log("\n🎯 TEST: Try Depositing REDEEMED NFT (Should Fail)");
    console.log("━".repeat(50));

    // Show user's redeemed NFTs
    console.log("Your redeemed NFTs:");
    let redeemedTokens = [];
    for (let i = 1; i <= 20; i++) {
        try {
            const balance = await astaVerde.balanceOf(user.address, i);
            if (balance > 0n) {
                const redeemed = await astaVerde.isRedeemed(i);
                if (redeemed) {
                    // redeemed
                    console.log(`  Token #${i}: REDEEMED`);
                    redeemedTokens.push(i);
                }
            }
        } catch (e) {}
    }

    if (redeemedTokens.length === 0) {
        console.log("❌ No redeemed NFTs available. Redeem an NFT first to test this!");
        await waitForKeyPress();
        return;
    }

    const tokenId = parseInt(await prompt(`Which redeemed token to try depositing? (${redeemedTokens.join(", ")}): `));
    if (!redeemedTokens.includes(tokenId)) {
        console.log("❌ Invalid token selection");
        await waitForKeyPress();
        return;
    }

    try {
        // This should fail
        console.log(`Attempting to deposit redeemed token #${tokenId}...`);
        console.log('⚠️  This should fail with "redeemed asset" error');

        // Approve first (this should succeed)
        await astaVerde.connect(user).setApprovalForAll(await vault.getAddress(), true);

        // Try to deposit (this should fail)
        const tx = await vault.connect(user).deposit(tokenId);
        await tx.wait();

        console.log("❌ UNEXPECTED: Deposit succeeded! This is a bug!");
    } catch (error) {
        if (error.message.includes("redeemed asset")) {
            console.log('✅ EXPECTED: Deposit correctly failed with "redeemed asset" error');
            console.log(`Error: ${error.message}`);
        } else {
            console.log(`❌ UNEXPECTED ERROR: ${error.message}`);
        }
    }

    await waitForKeyPress();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ QA script failed:", error);
            process.exit(1);
        });
}

module.exports = main;
