#!/usr/bin/env node
/**
 * Read-only: print every owner, role and setting of a deployment as JSON.
 *
 *   npx hardhat run scripts/check-deployment.js --network ethereum-mainnet
 */
const hre = require("hardhat");
const { deploymentAddress } = require("./lib/addresses");

async function main() {
    const n = hre.network.name;
    const avAddr = deploymentAddress("AstaVerde", n);
    const vaultAddr = deploymentAddress("EcoStabilizer", n);
    const sccAddr = deploymentAddress("StabilizedCarbonCoin", n);
    const av = await hre.ethers.getContractAt("AstaVerde", avAddr);
    const vault = await hre.ethers.getContractAt("EcoStabilizer", vaultAddr);
    const scc = await hre.ethers.getContractAt("StabilizedCarbonCoin", sccAddr);
    const [signer] = await hre.ethers.getSigners();
    const MINTER = await scc.MINTER_ROLE();
    const ADMIN = await scc.DEFAULT_ADMIN_ROLE();
    const out = {
        network: n,
        AstaVerde: avAddr,
        EcoStabilizer: vaultAddr,
        StabilizedCarbonCoin: sccAddr,
        astaVerdeOwner: await av.owner(),
        vaultOwner: await vault.owner(),
        usdcToken: await av.usdcToken(),
        trustedVault: await av.trustedVault(),
        vaultEcoAsset: await vault.ecoAsset(),
        vaultScc: await vault.scc(),
        vaultHasMinterRole: await scc.hasRole(MINTER, vaultAddr),
        signer: signer ? signer.address : null,
        signerIsSccAdmin: signer ? await scc.hasRole(ADMIN, signer.address) : null,
        basePriceUsdc: hre.ethers.formatUnits(await av.basePrice(), 6),
        dailyPriceDecayUsdc: hre.ethers.formatUnits(await av.dailyPriceDecay(), 6),
        priceFloorUsdc: hre.ethers.formatUnits(await av.priceFloor(), 6),
        priceAdjustDeltaUsdc: hre.ethers.formatUnits(await av.priceAdjustDelta(), 6),
        platformSharePercentage: (await av.platformSharePercentage()).toString(),
        maxBatchSize: (await av.maxBatchSize()).toString(),
        maxPriceUpdateIterations: (await av.maxPriceUpdateIterations()).toString(),
        paused: await av.paused(),
        vaultPaused: await vault.paused(),
    };
    console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
