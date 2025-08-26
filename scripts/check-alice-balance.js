const { ethers } = require('ethers');

async function checkAliceBalance() {
  const provider = new ethers.JsonRpcProvider('http://localhost:8545');
  
  const aliceAddr = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const astaVerdeAddr = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
  const vaultAddr = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
  const sccAddr = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
  
  // Check NFT balances for all token IDs (1-20 based on seeding)
  const nftAbi = [
    'function balanceOf(address account, uint256 id) view returns (uint256)',
    'function lastTokenID() view returns (uint256)'
  ];
  const nftContract = new ethers.Contract(astaVerdeAddr, nftAbi, provider);
  
  // Check SCC balance
  const sccAbi = ['function balanceOf(address account) view returns (uint256)'];
  const sccContract = new ethers.Contract(sccAddr, sccAbi, provider);
  
  // Check vault loans
  const vaultAbi = [
    'function getUserLoans(address user) view returns (uint256[])',
    'function loans(uint256) view returns (address user, uint256 tokenId, uint256 amount, uint256 timestamp)'
  ];
  const vaultContract = new ethers.Contract(vaultAddr, vaultAbi, provider);
  
  console.log('\n=== Alice Account Status ===');
  console.log('Address:', aliceAddr);
  
  // Get last token ID
  const lastTokenId = await nftContract.lastTokenID();
  console.log('\nTotal tokens minted:', lastTokenId.toString());
  
  // Check NFT balances
  console.log('\nNFT Holdings:');
  let hasNFTs = false;
  for (let i = 1n; i <= lastTokenId; i++) {
    const balance = await nftContract.balanceOf(aliceAddr, i);
    if (balance > 0n) {
      console.log(`  Token #${i}: ${balance} NFT(s)`);
      hasNFTs = true;
    }
  }
  if (!hasNFTs) {
    console.log('  No NFTs owned');
  }
  
  // Check SCC balance
  const sccBalance = await sccContract.balanceOf(aliceAddr);
  console.log('\nSCC Balance:', ethers.formatEther(sccBalance), 'SCC');
  
  // Check vault loans
  try {
    const loans = await vaultContract.getUserLoans(aliceAddr);
    console.log('\nVault Loans:', loans.length, 'active loan(s)');
    for (const tokenId of loans) {
      const loan = await vaultContract.loans(tokenId);
      console.log(`  Token #${tokenId}: ${ethers.formatEther(loan.amount)} SCC borrowed`);
    }
  } catch (err) {
    console.log('\nVault Loans: Unable to check (may not have any)');
  }
}

checkAliceBalance().catch(console.error);