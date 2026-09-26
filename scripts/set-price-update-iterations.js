#!/usr/bin/env node
/**
 * Set AstaVerde.maxPriceUpdateIterations (default 25, the L1 gas setting) while the signer still owns
 * the contract, i.e. after `npm run deploy:mainnet` and before `npm run handoff`. Idempotent.
 *
 *   npx hardhat run scripts/set-price-update-iterations.js --network ethereum-mainnet
 *   ITERATIONS=25 DEPLOY_WAIT_CONFIRMATIONS=2 npx hardhat run ... (optional overrides)
 */
const hre = require("hardhat");
const { deploymentAddress } = require("./lib/addresses");

async function main() {
    const target = Number(process.env.ITERATIONS || 25);
    const av = await hre.ethers.getContractAt("AstaVerde", deploymentAddress("AstaVerde", hre.network.name));
    const before = Number(await av.maxPriceUpdateIterations());
    if (before !== target) {
        const tx = await av.setMaxPriceUpdateIterations(target);
        console.log(`setMaxPriceUpdateIterations(${target}) tx ${tx.hash}`);
        await tx.wait(Math.max(1, Number(process.env.DEPLOY_WAIT_CONFIRMATIONS) || 1));
    }
    const after = Number(await av.maxPriceUpdateIterations());
    console.log(`maxPriceUpdateIterations ${before} -> ${after}`);
    if (after !== target) throw new Error(`read back ${after}, expected ${target}`);
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
