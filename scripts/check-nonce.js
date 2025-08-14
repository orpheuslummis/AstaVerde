const hre = require("hardhat");

async function main() {
    const alice = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

    // Get current nonce
    const nonce = await hre.ethers.provider.getTransactionCount(alice);
    console.log(`Alice's current nonce: ${nonce}`);

    // Get balance to verify connection
    const balance = await hre.ethers.provider.getBalance(alice);
    console.log(`Alice's ETH balance: ${hre.ethers.formatEther(balance)} ETH`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
