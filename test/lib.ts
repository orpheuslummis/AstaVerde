// test/lib.ts
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { AstaVerde, MockUSDC } from "../types";
import { expect } from "chai";

export const USDC_PRECISION = 10n ** 6n;
export const SECONDS_IN_A_DAY = 86400n;

/**
 * Generates an array of random Ethereum addresses.
 * @param num Number of addresses to generate.
 * @returns Array of randomly generated addresses.
 */
export function genAddresses(num: number): string[] {
    const addresses = [];
    for (let i = 0; i < num; i++) {
        addresses.push(ethers.Wallet.createRandom().address);
    }
    return addresses;
}

/**
 * Advances the blockchain time by a specified number of seconds and mines a new block.
 * @param n Number of seconds to advance.
 */
export async function waitNSeconds(n: bigint): Promise<void> {
    console.log(`Advancing time by ${n} seconds`);
    await network.provider.send("evm_increaseTime", [Number(n)]);
    await network.provider.send("evm_mine");
}

/**
 * Advances the blockchain time past a specified threshold in days.
 * @param astaVerde Instance of the AstaVerde contract.
 * @param thresholdGetter The threshold to retrieve ('dayIncreaseThreshold' or 'dayDecreaseThreshold').
 */
export async function advancePastThreshold(
    astaVerde: AstaVerde,
    thresholdGetter: "dayIncreaseThreshold" | "dayDecreaseThreshold",
): Promise<void> {
    const threshold: bigint = await astaVerde[thresholdGetter]();
    const thresholdNumber: bigint = threshold;

    console.log(
        `Threshold for ${thresholdGetter}: ${thresholdNumber} days (${thresholdNumber * SECONDS_IN_A_DAY} seconds)`,
    );
    const secondsToAdvance = thresholdNumber * SECONDS_IN_A_DAY; // number * number = number
    await waitNSeconds(secondsToAdvance);
}

/**
 * Sets up a new batch by minting and performing an initial purchase.
 * @param astaVerde Instance of the AstaVerde contract.
 * @param admin Admin signer (contract owner).
 * @param user User signer who will purchase tokens.
 * @param cids Array of CID strings for token metadata.
 * @param tokenAmount Number of tokens to purchase.
 * @returns An object containing batchID, price, and producers.
 */
export async function setupBatchAndBuy(
    astaVerde: AstaVerde,
    admin: SignerWithAddress,
    user: SignerWithAddress,
    cids: string[],
    tokenAmount: number,
): Promise<{ batchID: number; price: bigint; producers: string[] }> {
    const producers = genAddresses(cids.length);

    // Admin mints the batch
    await astaVerde.connect(admin).mintBatch(producers, cids);

    // Retrieve the latest batch ID
    const batchIDBigNumber: bigint = await astaVerde.lastBatchID();
    const batchID = Number(batchIDBigNumber);

    // Retrieve batch information
    const batchInfo = await astaVerde.getBatchInfo(batchID);
    const price = BigInt(batchInfo.price);

    console.log(`Minted Batch ID: ${batchID} with Starting Price: ${price}`);

    // User buys the specified number of tokens
    await astaVerde.connect(user).buyBatch(batchID, tokenAmount);
    console.log(`User ${user.address} bought ${tokenAmount} tokens from Batch ID: ${batchID}`);

    return { batchID, price, producers };
}

/**
 * Calculates the platform and producer shares based on the total USDC amount and platform percentage.
 * @param usdcAmount Total USDC amount for the transaction.
 * @param platformPercentage Percentage of the sale that goes to the platform.
 * @returns An object containing platformShare and producerShare.
 */
export function calculateShares(
    usdcAmount: bigint,
    platformPercentage: number,
): { platformShare: bigint; producerShare: bigint } {
    const platformShare = (usdcAmount * BigInt(platformPercentage)) / 100n;
    const producerShare = usdcAmount - platformShare;
    return { platformShare, producerShare };
}

/**
 * Asserts that the USDC balances of producers and the platform match the expected shares.
 * @param mockUSDC Instance of the MockUSDC contract.
 * @param producers Array of producer addresses.
 * @param platform Platform address.
 * @param platformShare Expected USDC share for the platform.
 * @param producerShare Expected total USDC share for all producers.
 */
export async function expectBalancesAfterPurchase(
    mockUSDC: MockUSDC,
    producers: string[],
    platform: string,
    platformShare: bigint,
    producerShare: bigint,
): Promise<void> {
    const perProducerShare = producerShare / BigInt(producers.length);
    console.log(`Expecting each producer to receive ${perProducerShare} USDC`);

    for (const producer of producers) {
        const producerBalance = await mockUSDC.balanceOf(producer);
        expect(producerBalance).to.equal(perProducerShare, `Producer ${producer} has incorrect USDC balance`);
        console.log(`Producer ${producer} balance correctly updated to ${producerBalance}`);
    }

    const platformBalance = await mockUSDC.balanceOf(platform);
    expect(platformBalance).to.equal(platformShare, `Platform balance is incorrect`);
    console.log(`Platform balance correctly updated to ${platformBalance}`);
}
