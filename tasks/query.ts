import { task } from "hardhat/config";

task("query-contract", "Queries the AstaVerde contract").setAction(async (taskArgs, hre: any) => {
    const contractAddress = process.env.CONTRACT_ADDRESS;
    if (!contractAddress) {
        throw new Error("CONTRACT_ADDRESS is not set in .env.local");
    }

    console.log("Contract Address:", contractAddress);

    try {
        const AstaVerde = await hre.ethers.getContractFactory("AstaVerde");
        const contract = AstaVerde.attach(contractAddress);

        // Check contract state
        console.log("\nContract State:");
        try {
            const lastBatchID = await contract.lastBatchID();
            console.log("- Last Batch ID:", lastBatchID.toString());
        } catch (error: unknown) {
            console.log("- Error getting lastBatchID:", (error as Error).message);
        }

        try {
            const lastTokenID = await contract.lastTokenID();
            console.log("- Last Token ID:", lastTokenID.toString());
        } catch (error: unknown) {
            console.log("- Error getting lastTokenID:", (error as Error).message);
        }

        // Try to get info for the first batch (if it exists)
        try {
            const batchInfo = await contract.getBatchInfo(1);
            console.log("\nBatch 1 Info:");
            console.log("- Token IDs:", batchInfo.tokenIds.map((id: any) => id.toString()).join(", "));
            console.log("- Creation Time:", new Date(Number(batchInfo.creationTime) * 1000).toLocaleString());
            console.log("- Price:", hre.ethers.formatUnits(batchInfo.price, 6), "USDC");
            console.log("- Remaining Tokens:", batchInfo.remainingTokens.toString());
        } catch (error: unknown) {
            console.log("\nError getting batch info:", (error as Error).message);
        }

        // Check token balance of the contract for the first token (if it exists)
        try {
            const balance = await contract.balanceOf(contractAddress, 1);
            console.log("\nContract Token Balance (ID 1):", balance.toString());
        } catch (error: unknown) {
            console.log("\nError getting token balance:", (error as Error).message);
        }

        // Check some constant values
        try {
            const basePrice = await contract.basePrice();
            console.log("\nBase Price:", hre.ethers.formatUnits(basePrice, 6), "USDC");
        } catch (error: unknown) {
            console.log("\nError getting base price:", (error as Error).message);
        }

        try {
            const priceFloor = await contract.priceFloor();
            console.log("Price Floor:", hre.ethers.formatUnits(priceFloor, 6), "USDC");
        } catch (error: unknown) {
            console.log("Error getting price floor:", (error as Error).message);
        }
    } catch (error: unknown) {
        console.error("Error querying contract:", error);
    }
});
