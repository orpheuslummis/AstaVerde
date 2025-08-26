const { ethers } = require('ethers');

async function approveVault() {
  const provider = new ethers.JsonRpcProvider('http://localhost:8545');
  
  // Use the first test account
  const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const astaVerdeAddr = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
  const vaultAddr = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
  
  const abi = [
    'function setApprovalForAll(address operator, bool approved)',
    'function isApprovedForAll(address account, address operator) view returns (bool)'
  ];
  
  const contract = new ethers.Contract(astaVerdeAddr, abi, wallet);
  
  console.log('Setting approval for vault...');
  const tx = await contract.setApprovalForAll(vaultAddr, true);
  console.log('Transaction sent:', tx.hash);
  
  await tx.wait();
  console.log('Transaction confirmed!');
  
  // Check the approval
  const isApproved = await contract.isApprovedForAll(wallet.address, vaultAddr);
  console.log('Vault approved:', isApproved);
}

approveVault().catch(console.error);