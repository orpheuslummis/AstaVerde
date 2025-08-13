#!/usr/bin/env node

const { ethers } = require("ethers");
const fs = require("fs");
const chalk = require("chalk");

// Contract addresses
const USDC_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ASTAVERDE_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const SCC_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

// Test accounts
const TEST_ACCOUNTS = {
    Deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    Alice: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    Bob: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    Charlie: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    Dave: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
};

// Load ABIs
const usdcAbi = ["function balanceOf(address) view returns (uint256)"];
const sccAbi = ["function balanceOf(address) view returns (uint256)"];
const astaverdeAbi = [
    "function balanceOf(address, uint256) view returns (uint256)",
    "function lastTokenID() view returns (uint256)",
];

async function checkBalances() {
    try {
        // Setup provider
        const provider = new ethers.JsonRpcProvider("http://localhost:8545");

        // Create contract instances
        const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, provider);
        const sccContract = new ethers.Contract(SCC_ADDRESS, sccAbi, provider);
        const astaverdeContract = new ethers.Contract(ASTAVERDE_ADDRESS, astaverdeAbi, provider);

        console.log(chalk.bold.cyan("\n🏦 AstaVerde Test Account Balances\n"));
        console.log(chalk.gray("=".repeat(80)));

        // Get last token ID for NFT checking
        const lastTokenId = await astaverdeContract.lastTokenID();

        for (const [name, address] of Object.entries(TEST_ACCOUNTS)) {
            console.log(chalk.bold.yellow(`\n${name}:`));
            console.log(chalk.gray(`Address: ${address}`));

            // Get ETH balance
            const ethBalance = await provider.getBalance(address);
            const ethFormatted = ethers.formatEther(ethBalance);
            console.log(`  ${chalk.green("ETH:")} ${ethFormatted}`);

            // Get USDC balance
            const usdcBalance = await usdcContract.balanceOf(address);
            const usdcFormatted = ethers.formatUnits(usdcBalance, 6);
            console.log(`  ${chalk.blue("USDC:")} ${usdcFormatted}`);

            // Get SCC balance
            const sccBalance = await sccContract.balanceOf(address);
            const sccFormatted = ethers.formatUnits(sccBalance, 18);
            console.log(`  ${chalk.magenta("SCC:")} ${sccFormatted}`);

            // Count NFTs owned
            let nftCount = 0;
            const ownedTokens = [];
            for (let tokenId = 1; tokenId <= lastTokenId; tokenId++) {
                const balance = await astaverdeContract.balanceOf(address, tokenId);
                if (balance > 0) {
                    nftCount++;
                    ownedTokens.push(tokenId);
                }
            }

            if (nftCount > 0) {
                console.log(`  ${chalk.cyan("NFTs:")} ${nftCount} tokens (IDs: ${ownedTokens.join(", ")})`);
            } else {
                console.log(`  ${chalk.cyan("NFTs:")} 0 tokens`);
            }
        }

        console.log(chalk.gray("\n" + "=".repeat(80)));
        console.log(chalk.bold.green("\n✅ Balance check complete!\n"));
    } catch (error) {
        console.error(chalk.red("\n❌ Error checking balances:"), error.message);
        console.log(chalk.yellow("\n💡 Make sure the local node is running: npm run dev"));
        process.exit(1);
    }
}

// Run the balance check
checkBalances();
