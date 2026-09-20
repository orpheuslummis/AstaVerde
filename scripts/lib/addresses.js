/**
 * Local-deployment addresses for the dev scripts that build their own ethers provider.
 *
 * `npx hardhat deploy --network localhost` (hardhat-deploy) writes deployments/localhost/<Contract>.json.
 * Scripts run through `hardhat run` read those records with `deployments.get(name)`; this module is the
 * equivalent for scripts that use a plain `ethers.JsonRpcProvider` and have no hre.
 *
 * Both helpers throw rather than fall back to a placeholder. An eth_call against an address with no
 * code returns empty data instead of reverting, so a stale hardcoded address makes a balance check
 * print 0 rather than fail.
 */
const fs = require("fs");
const path = require("path");

const DEPLOYMENTS_DIR = path.join(__dirname, "..", "..", "deployments");

/** Address recorded by hardhat-deploy for `name` on `network`. Sync, so it can seed a module-level constant. */
function deploymentAddress(name, network = "localhost") {
    const file = path.join(DEPLOYMENTS_DIR, network, `${name}.json`);
    if (!fs.existsSync(file)) {
        throw new Error(
            `No deployment found for: ${name} (expected ${path.relative(process.cwd(), file)}). ` +
                `Run: npx hardhat deploy --network ${network}`,
        );
    }
    const { address } = JSON.parse(fs.readFileSync(file, "utf8"));
    if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
        throw new Error(`Deployment record ${file} has no valid "address" field`);
    }
    return address;
}

/**
 * Throw unless every address in `{ label: address }` has code on `provider`.
 * Catches the other way the records go stale: `npx hardhat node` restarted without a redeploy.
 */
async function assertDeployed(provider, addresses) {
    for (const [label, address] of Object.entries(addresses)) {
        const code = await provider.getCode(address);
        if (code === "0x") {
            throw new Error(
                `${label} has no code at ${address}. The deployment record is stale (node restarted?). ` +
                    "Run: npx hardhat deploy --network localhost --reset",
            );
        }
    }
}

module.exports = { deploymentAddress, assertDeployed };
