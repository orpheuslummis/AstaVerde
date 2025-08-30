const { ethers } = require("ethers");

async function checkApproval() {
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");

    const astaVerdeAddr = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const vaultAddr = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
    const userAddr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    const abi = ["function isApprovedForAll(address account, address operator) view returns (bool)"];
    const contract = new ethers.Contract(astaVerdeAddr, abi, provider);

    const isApproved = await contract.isApprovedForAll(userAddr, vaultAddr);
    console.log(`Vault ${vaultAddr} approved for user ${userAddr}:`, isApproved);

    return isApproved;
}

checkApproval().catch(console.error);
