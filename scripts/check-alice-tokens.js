const { ethers, deployments } = require("hardhat");

async function main() {
    const alice = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const astaVerde = await ethers.getContractAt("AstaVerde", (await deployments.get("AstaVerde")).address);

    console.log("Checking tokens for Alice:", alice);

    const lastTokenID = await astaVerde.lastTokenID();
    console.log("Last token ID:", lastTokenID.toString());

    let totalTokens = 0;
    for (let i = 1n; i <= lastTokenID; i++) {
        const balance = await astaVerde.balanceOf(alice, i);
        if (balance > 0n) {
            console.log("Token", i.toString(), "balance:", balance.toString());
            totalTokens += Number(balance);
        }
    }
    console.log("Total tokens owned by Alice:", totalTokens);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
