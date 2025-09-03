const { ethers } = require("hardhat");

async function main() {
  console.log("\n=== Checking Token State ===\n");

  const [signer] = await ethers.getSigners();
  console.log("User:", signer.address);

  // Get contract addresses from env
  const VAULT_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const ASSET_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  // Load ABIs
  const vaultAbi = require("../artifacts/contracts/EcoStabilizer.sol/EcoStabilizer.json").abi;
  const assetAbi = require("../artifacts/contracts/AstaVerde.sol/AstaVerde.json").abi;

  const vault = new ethers.Contract(VAULT_ADDRESS, vaultAbi, signer);
  const asset = new ethers.Contract(ASSET_ADDRESS, assetAbi, signer);

  // Check tokens 2, 3, 4, 5
  const tokenIds = [2n, 3n, 4n, 5n];
  
  for (const tokenId of tokenIds) {
    console.log(`\n--- Token #${tokenId} ---`);
    
    // Check ownership
    const userBalance = await asset.balanceOf(signer.address, tokenId);
    const vaultBalance = await asset.balanceOf(VAULT_ADDRESS, tokenId);
    console.log(`User balance: ${userBalance}`);
    console.log(`Vault balance: ${vaultBalance}`);
    
    // Check if redeemed
    const isRedeemed = await asset.isRedeemed(tokenId);
    console.log(`Is redeemed: ${isRedeemed}`);
    
    // Check loan status
    try {
      const loan = await vault.loans(tokenId);
      console.log(`Loan active: ${loan.active}`);
      console.log(`Loan borrower: ${loan.borrower}`);
    } catch (e) {
      console.log("No loan data");
    }
  }

  // Check user's active loans
  const userLoans = await vault.getUserLoans(signer.address);
  console.log(`\n\nUser's active loans: [${userLoans.map(id => id.toString()).join(", ")}]`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});