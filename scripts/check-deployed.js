const { ethers } = require("hardhat");

async function main() {
    const usdcAddress = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";

    // Get the bytecode
    const bytecode = await ethers.provider.getCode(usdcAddress);
    console.log("Contract bytecode length:", bytecode.length);
    console.log("First 100 chars:", bytecode.substring(0, 100));

    // Try to call decimals
    const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
    const decimals = await usdc.decimals();
    console.log("Decimals:", decimals);

    // Check if it has owner function
    try {
        const abi = ["function owner() view returns (address)"];
        const contract = new ethers.Contract(usdcAddress, abi, ethers.provider);
        const owner = await contract.owner();
        console.log("Contract has owner():", owner);
    } catch (e) {
        console.log("Contract does not have owner() function");
    }
}

main().catch(console.error);
