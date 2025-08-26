const { ethers } = require("hardhat");

async function main() {
    const [deployer, alice] = await ethers.getSigners();
    const astaVerde = await ethers.getContractAt("AstaVerde", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
    
    console.log("\n=== PRICE DEBUG ===");
    
    const price1 = await astaVerde.getCurrentBatchPrice(1);
    
    console.log("Batch 1 getCurrentBatchPrice:", price1.toString(), "wei");
    console.log("In USDC (6 decimals):", ethers.formatUnits(price1, 6));
    
    // Check calculations
    console.log("\nFor 1 token:");
    console.log("Cost:", price1.toString(), "wei =", ethers.formatUnits(price1, 6), "USDC");
    
    console.log("\nFor 20 tokens:");
    const cost20 = price1 * 20n;
    console.log("Total cost:", cost20.toString(), "wei =", ethers.formatUnits(cost20, 6), "USDC");
    
    // The error shows 4600000000000
    console.log("\nError amount: 4600000000000 wei =", ethers.formatUnits(4600000000000n, 6), "USDC");
    console.log("That would be for:", 4600000000000n / price1, "tokens");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });