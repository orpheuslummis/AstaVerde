#!/usr/bin/env node
/**
 * Apply the launch market settings while the signer still owns AstaVerde, i.e. after
 * `npm run deploy:mainnet` and before `npm run handoff`. Idempotent; reads every value back.
 *
 *   ITERATIONS=25 BASE_PRICE_USDC=150 DAILY_DECAY_USDC=5 \
 *     npx hardhat run scripts/set-market-settings.js --network ethereum-mainnet
 *
 * Each variable is optional; an unset one is left as it is. The marketplace must be unpaused.
 */
const hre = require("hardhat");
const { deploymentAddress } = require("./lib/addresses");

async function main() {
    const av = await hre.ethers.getContractAt("AstaVerde", deploymentAddress("AstaVerde", hre.network.name));
    const confirmations = Math.max(1, Number(process.env.DEPLOY_WAIT_CONFIRMATIONS) || 1);
    const usdc = (v) => hre.ethers.parseUnits(String(v), 6);
    const wanted = [];
    if (process.env.ITERATIONS) {
        wanted.push(["maxPriceUpdateIterations", "setMaxPriceUpdateIterations", BigInt(process.env.ITERATIONS)]);
    }
    if (process.env.BASE_PRICE_USDC) wanted.push(["basePrice", "setBasePrice", usdc(process.env.BASE_PRICE_USDC)]);
    if (process.env.DAILY_DECAY_USDC) {
        wanted.push(["dailyPriceDecay", "setDailyPriceDecay", usdc(process.env.DAILY_DECAY_USDC)]);
    }
    if (wanted.length === 0) throw new Error("Set at least one of ITERATIONS, BASE_PRICE_USDC, DAILY_DECAY_USDC");

    let failed = false;
    for (const [getter, setter, value] of wanted) {
        const before = await av[getter]();
        if (before !== value) {
            const tx = await av[setter](value);
            console.log(`${setter}(${value}) tx ${tx.hash}`);
            await tx.wait(confirmations);
        }
        const after = await av[getter]();
        console.log(`${getter}: ${before} -> ${after}${after === value ? "" : `  MISMATCH, expected ${value}`}`);
        if (after !== value) failed = true;
    }
    if (failed) throw new Error("read-back mismatch");
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
