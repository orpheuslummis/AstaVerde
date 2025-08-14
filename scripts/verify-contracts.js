const { ethers } = require("hardhat");

async function main() {
    const addresses = {
        USDC: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
        AstaVerde: "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
    };

    for (const [name, addr] of Object.entries(addresses)) {
        const code = await ethers.provider.getCode(addr);
        const hasCode = code.length > 2;
        console.log(name + " at " + addr + ":");
        console.log("  - Has code: " + (hasCode ? "YES" : "NO"));
        console.log("  - Code length: " + code.length);

        if (hasCode && name === "USDC") {
            try {
                const abi = ["function decimals() view returns (uint8)", "function name() view returns (string)"];
                const contract = new ethers.Contract(addr, abi, ethers.provider);
                const decimals = await contract.decimals();
                const tokenName = await contract.name();
                console.log("  - Decimals: " + decimals);
                console.log("  - Name: " + tokenName);
            } catch (e) {
                console.log("  - Error calling functions: " + e.message);
            }
        }
    }

    // Check if there are any OTHER MockUSDC contracts deployed
    const [deployer] = await ethers.getSigners();
    console.log("\nDeployer address:", deployer.address);

    // Get nonce to see how many transactions have been made
    const nonce = await ethers.provider.getTransactionCount(deployer.address);
    console.log("Deployer nonce:", nonce);
}

main().catch(console.error);
