const { ethers } = require("ethers");
const { deploymentAddress, assertDeployed } = require("./lib/addresses");

async function checkApproval() {
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");

    const astaVerdeAddr = deploymentAddress("AstaVerde");
    const vaultAddr = deploymentAddress("EcoStabilizer");
    await assertDeployed(provider, { AstaVerde: astaVerdeAddr, EcoStabilizer: vaultAddr });
    const userAddr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    const abi = ["function isApprovedForAll(address account, address operator) view returns (bool)"];
    const contract = new ethers.Contract(astaVerdeAddr, abi, provider);

    const isApproved = await contract.isApprovedForAll(userAddr, vaultAddr);
    console.log(`Vault ${vaultAddr} approved for user ${userAddr}:`, isApproved);

    return isApproved;
}

checkApproval().catch((error) => {
    console.error(error);
    process.exit(1);
});
