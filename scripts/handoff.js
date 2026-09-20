#!/usr/bin/env node
/**
 * Hand a deployment over to its final owner, then read every role back on-chain.
 *
 *   NEW_OWNER=0x... npx hardhat run scripts/handoff.js --network ethereum-sepolia
 *   NEW_OWNER=0x... TRANSFER_SCC_ADMIN=true npx hardhat run scripts/handoff.js --network ethereum-mainnet
 *
 * - AstaVerde.transferOwnership(NEW_OWNER)      (skipped if already the owner)
 * - EcoStabilizer.transferOwnership(NEW_OWNER)  (skipped if not deployed or already the owner)
 * - if TRANSFER_SCC_ADMIN=true: grant SCC DEFAULT_ADMIN_ROLE to NEW_OWNER, then the signer renounces
 * - if RENOUNCE_SCC_ADMIN=true: the signer renounces SCC DEFAULT_ADMIN_ROLE (only if the vault holds MINTER_ROLE)
 * Exits non-zero unless every read-back matches.
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

function readDeployment(network, name) {
    const file = path.join(__dirname, "..", "deployments", network, `${name}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")).address;
}

async function main() {
    const { ethers, network } = hre;
    const newOwner = process.env.NEW_OWNER;
    if (!newOwner || !ethers.isAddress(newOwner)) {
        throw new Error("Set NEW_OWNER=0x... (checksummed or lowercase address)");
    }
    const [signer] = await ethers.getSigners();
    const me = await signer.getAddress();
    console.log(`network ${network.name}, signer ${me}, new owner ${newOwner}`);

    const failures = [];
    const want = newOwner.toLowerCase();

    for (const name of ["AstaVerde", "EcoStabilizer"]) {
        const addr = readDeployment(network.name, name);
        if (!addr) {
            console.log(`${name}: no deployment record, skipped`);
            continue;
        }
        const c = await ethers.getContractAt(name, addr);
        const before = (await c.owner()).toLowerCase();
        if (before === want) {
            console.log(`${name} ${addr}: already owned by ${newOwner}`);
        } else if (before !== me.toLowerCase()) {
            failures.push(`${name}: signer is not the owner (owner is ${before}), cannot transfer`);
            continue;
        } else {
            const tx = await c.transferOwnership(newOwner);
            await tx.wait();
            console.log(`${name} ${addr}: transferOwnership tx ${tx.hash}`);
        }
        const after = (await c.owner()).toLowerCase();
        console.log(`${name}: owner() = ${after}`);
        if (after !== want) failures.push(`${name}: owner() is ${after}, expected ${want}`);
    }

    const sccAddr = readDeployment(network.name, "StabilizedCarbonCoin");
    const vaultAddr = readDeployment(network.name, "EcoStabilizer");
    if (sccAddr) {
        const scc = await ethers.getContractAt("StabilizedCarbonCoin", sccAddr);
        const ADMIN = await scc.DEFAULT_ADMIN_ROLE();
        const MINTER = await scc.MINTER_ROLE();
        if (process.env.TRANSFER_SCC_ADMIN === "true") {
            if (!(await scc.hasRole(ADMIN, newOwner))) {
                const tx = await scc.grantRole(ADMIN, newOwner);
                await tx.wait();
                console.log(`SCC: granted DEFAULT_ADMIN_ROLE to ${newOwner} (tx ${tx.hash})`);
            }
            if (!(await scc.hasRole(ADMIN, newOwner)))
                failures.push("SCC: new owner did not receive DEFAULT_ADMIN_ROLE");
            if (await scc.hasRole(ADMIN, me)) {
                const tx = await scc.renounceRole(ADMIN, me);
                await tx.wait();
                console.log(`SCC: signer renounced DEFAULT_ADMIN_ROLE (tx ${tx.hash})`);
            }
        } else if (process.env.RENOUNCE_SCC_ADMIN === "true") {
            if (vaultAddr && !(await scc.hasRole(MINTER, vaultAddr))) {
                failures.push("SCC: vault lacks MINTER_ROLE, refusing to renounce admin");
            } else if (await scc.hasRole(ADMIN, me)) {
                const tx = await scc.renounceRole(ADMIN, me);
                await tx.wait();
                console.log(`SCC: signer renounced DEFAULT_ADMIN_ROLE (tx ${tx.hash})`);
            }
        }
        console.log(
            `SCC ${sccAddr}: admin(newOwner)=${await scc.hasRole(ADMIN, newOwner)} admin(signer)=${await scc.hasRole(ADMIN, me)} minter(vault)=${vaultAddr ? await scc.hasRole(MINTER, vaultAddr) : "n/a"}`,
        );
    }

    if (failures.length) {
        console.error("\nHANDOFF INCOMPLETE:");
        for (const f of failures) console.error(` - ${f}`);
        process.exit(1);
    }
    console.log("\nHandoff complete; every read-back matches.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
