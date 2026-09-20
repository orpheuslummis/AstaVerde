import { create } from "@web3-storage/w3up-client";
import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs/promises";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const ABI = JSON.parse(await fs.readFile("./artifacts/contracts/AstaVerde.sol/AstaVerde.json", "utf8")).abi;

const config = {
    contractAddress: process.env.CONTRACT_ADDRESS,
    imageFolder: process.env.IMAGE_FOLDER || "./example_nftdata/images/",
    rpcApiKey: process.env.RPC_API_KEY,
    email: process.env.EMAIL,
    chainId: process.env.CHAIN_ID || "84532",
    privateKey: process.env.PRIVATE_KEY,
    localRpcUrl: process.env.LOCAL_RPC_URL || "http://localhost:8545",
};

const EXTERNAL_URL = "https://marketplace.ecotradezone.com/token/";
const IPFS_PREFIX = "ipfs://";

function validateConfig(config) {
    const missingKeys = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
    if (missingKeys.length) throw new Error(`Missing config values: ${missingKeys.join(", ")}`);
    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(config.email)) throw new Error("Invalid email address");
}

async function setupProvider(isLocal) {
    const rpcURL = isLocal ? config.localRpcUrl :
        `https://base-${config.chainId === "8453" ? "mainnet" : "sepolia"}.g.alchemy.com/v2/${config.rpcApiKey}`;
    const provider = new ethers.JsonRpcProvider(rpcURL);
    const wallet = new ethers.Wallet(config.privateKey, provider);
    const contract = new ethers.Contract(config.contractAddress, ABI, wallet);
    return { provider, wallet, contract };
}

async function getLastTokenId(contract) {
    const lastTokenID = await contract.lastTokenID();
    console.log("Last token ID type:", typeof lastTokenID);
    console.log("Last token ID value:", lastTokenID.toString());
    return Number(lastTokenID);
}

function generateTokenData(startId, count) {
    return Array.from({ length: count }, (_, i) => ({
        id: (startId + i).toString(),
        name: `Token ${startId + i}`,
        description: `This is token number ${startId + i}`,
        producer_address: ethers.Wallet.createRandom().address,
    }));
}

function getImagePath(id) {
    const imageFiles = ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"];
    return path.join(config.imageFolder, imageFiles[(id - 1) % imageFiles.length]);
}

async function connectToSpace(spaceName) {
    const client = await create();
    const userAccount = await client.login(config.email);
    const space = await client.createSpace(spaceName);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for plan selection
    await userAccount.provision(space.did());
    await space.createRecovery(userAccount.did());
    await space.save();
    await client.setCurrentSpace(space.did());
    return client;
}

async function uploadToIPFS(client, content, contentType) {
    return await client.uploadFile(new Blob([content], { type: contentType }));
}

function getExplorerUrl(txHash, chainId) {
    const baseUrl = chainId === "8453" ? "https://basescan.org" : "https://sepolia.basescan.org";
    return `${baseUrl}/tx/${txHash}`;
}

async function mintTokens(isLocal, tokenCount) {
    try {
        validateConfig(config);
        const { provider, wallet, contract } = await setupProvider(isLocal);

        const balance = await provider.getBalance(wallet.address);
        console.log(`Current wallet balance: ${ethers.formatEther(balance)} ETH`);
        if (balance <= BigInt(0)) throw new Error("Insufficient balance for gas");

        console.log(`Minting ${tokenCount} tokens ${isLocal ? "locally" : "on network"}`);

        const lastTokenId = await getLastTokenId(contract);
        console.log(`Last token ID: ${lastTokenId}`);
        const tokenData = generateTokenData(lastTokenId + 1, tokenCount);

        const client = isLocal ? null : await connectToSpace("astaverde-dev");

        const producers = [];
        const cids = [];

        for (const token of tokenData) {
            const imagePath = getImagePath(Number.parseInt(token.id));
            const imageCid = isLocal ? imagePath : await uploadToIPFS(client, await fs.readFile(imagePath), "image/jpeg");

            const metadata = {
                name: token.name,
                description: token.description,
                external_url: `${EXTERNAL_URL}${token.id}`,
                image: `${IPFS_PREFIX}${imageCid}`,
                attributes: [
                    { trait_type: "Type", value: "Carbon Offset" },
                    { trait_type: "Producer Address", value: token.producer_address },
                ],
                // Keep properties for backward-compat with older metadata expectations
                properties: [{ trait_type: "Producer Address", value: token.producer_address }],
            };

            const metadataCid = isLocal ? imagePath : await uploadToIPFS(client, JSON.stringify(metadata), "application/json");

            producers.push(token.producer_address);
            cids.push(isLocal ? imagePath : metadataCid.toString());

            console.log(`Prepared token ${token.id} with metadata CID: ${metadataCid}`);
        }

        console.log(`Minting batch of ${tokenCount} tokens...`);
        const tx = await contract.mintBatch(producers, cids);
        const explorerUrl = getExplorerUrl(tx.hash, config.chainId);
        console.log(`Transaction sent: ${tx.hash}`);
        console.log(`View transaction on explorer: ${explorerUrl}`);

        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

        const batchMintedEvent = receipt.logs
            .map(log => { try { return contract.interface.parseLog(log); } catch (e) { return null; } })
            .find(event => event && event.name === "BatchMinted");

        if (batchMintedEvent) {
            console.log("BatchMinted event found:", batchMintedEvent.args);
            await queryMintedTokens(contract, batchMintedEvent.args.batchId);
        } else {
            console.warn("BatchMinted event not found in transaction logs");
        }
    } catch (error) {
        console.error("Error in mintTokens:", error);
        throw error;
    }
}

async function queryMintedTokens(contract, batchId) {
    const batchInfo = await contract.getBatchInfo(batchId);
    console.log(`\nBatch ${batchId} Info:`);
    console.log(`Token IDs: ${batchInfo.tokenIds.map(id => id.toString()).join(", ")}`);
    console.log(`Creation Time: ${new Date(Number(batchInfo.creationTime) * 1000).toLocaleString()}`);
    console.log(`Price: ${ethers.formatUnits(batchInfo.price, 6)} USDC`);
    console.log(`Remaining Tokens: ${batchInfo.remainingTokens.toString()}`);

    console.log("\nView tokens on marketplace:");
    batchInfo.tokenIds.forEach(id => {
        console.log(`Token ${id}: ${EXTERNAL_URL}${id}`);
    });
}

const argv = yargs(hideBin(process.argv))
    .option("local", { alias: "l", type: "boolean", description: "Mint locally", default: false })
    .option("count", { alias: "c", type: "number", description: "Number of tokens to mint", default: 6 })
    .help().alias("help", "h").argv;

(async () => {
    try {
        console.log("Starting minting process...");
        await mintTokens(argv.local, argv.count);
        console.log("Minting process completed successfully.");
    } catch (error) {
        console.error("An error occurred during the minting process:", error);
        process.exit(1);
    }
})();
