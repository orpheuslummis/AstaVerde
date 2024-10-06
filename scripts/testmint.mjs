import { create } from "@web3-storage/w3up-client";
import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import { formatUnits } from "ethers";

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const ABI = JSON.parse(await fs.readFile("./artifacts/contracts/AstaVerde.sol/AstaVerde.json", 'utf8')).abi;
console.log("ABI loaded:", ABI ? "Success" : "Failed");

const config = {
    contractAddress: process.env.CONTRACT_ADDRESS,
    rpcApiKey: process.env.RPC_API_KEY,
    email: process.env.EMAIL,
    chainId: process.env.CHAIN_ID || "84532",
    privateKey: process.env.PRIVATE_KEY,
};

const EXTERNAL_URL = process.env.EXTERNAL_URL || "https://ecotradezone.bionerg.com/token/";
const IPFS_PREFIX = process.env.IPFS_PREFIX || "ipfs://";

function validateConfig(config) {
    const requiredKeys = ['contractAddress', 'rpcApiKey', 'email', 'chainId', 'privateKey'];
    const missingKeys = requiredKeys.filter(key => !config[key]);

    if (missingKeys.length) {
        throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(config.contractAddress)) {
        throw new Error('Invalid contract address format');
    }

    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(config.email)) {
        throw new Error('Invalid email address');
    }

    if (!['8453', '84532'].includes(config.chainId)) {
        throw new Error('Invalid chainId. Must be either 8453 (mainnet) or 84532 (testnet)');
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(config.privateKey)) {
        throw new Error('Invalid private key format');
    }

    console.log('Using the following configuration:');
    console.log(`- Contract Address: ${config.contractAddress}`);
    console.log(`- Chain ID: ${config.chainId}`);
    console.log(`- Email: ${config.email}`);
    console.log(`- External URL: ${EXTERNAL_URL}`);
    console.log(`- IPFS Prefix: ${IPFS_PREFIX}`);
}

async function setupProvider() {
    let provider, wallet, contract;
    try {
        const networkName = config.chainId === '8453' ? 'mainnet' : 'sepolia';
        const rpcURL = `https://base-${networkName}.g.alchemy.com/v2/${config.rpcApiKey}`;
        console.log(`Connecting to ${networkName} using RPC URL: ${rpcURL}`);

        provider = new ethers.JsonRpcProvider(rpcURL);
        wallet = new ethers.Wallet(config.privateKey, provider);

        console.log(`Connected successfully. Using wallet address: ${wallet.address}`);

        console.log("Using contract address:", config.contractAddress);

        console.log("ABI:", ABI ? "Loaded" : "Not loaded");
        if (!ABI) {
            console.error("ABI is undefined. Make sure the ABI file is loaded correctly.");
            throw new Error("ABI is undefined");
        }

        const contractCode = await provider.getCode(config.contractAddress);
        console.log("Contract code at address:", contractCode === '0x' ? "No code (not deployed)" : "Code found");
        if (contractCode === '0x') {
            console.error("No contract found at the specified address");
            throw new Error("Contract not deployed");
        }

        contract = new ethers.Contract(config.contractAddress, ABI, wallet);
        console.log("Contract created:", contract ? "Success" : "Failed");

        if (!contract.interface) {
            console.error("Contract interface is undefined. Check if the contract is deployed and ABI is correct.");
            throw new Error("Contract interface is undefined");
        }
        return { provider, wallet, contract };
    } catch (error) {
        console.error("Error in setupProvider:", error);
        throw error;
    }
}

function generateRandomTokenData(count) {
    return Array.from({ length: count }, (_, i) => ({
        name: `Random Token ${i + 1}`,
        description: `This is a randomly generated token number ${i + 1}`,
        producer_address: ethers.Wallet.createRandom().address,
    }));
}

async function getRandomImage() {
    const response = await fetch('https://picsum.photos/200');
    return await response.arrayBuffer();
}

async function connectToSpace(spaceName) {
    const client = await create();
    const userAccount = await client.login(config.email);
    const space = await client.createSpace(spaceName);
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for plan selection
    await userAccount.provision(space.did());
    await space.createRecovery(userAccount.did());
    await space.save();
    await client.setCurrentSpace(space.did());
    return client;
}

async function uploadToIPFS(client, content, contentType) {
    const cid = await client.uploadFile(new Blob([content], { type: contentType }));
    return isDevelopment ? `${IPFS_PREFIX}${cid}` : cid.toString();
}

async function mintRandomTokens(tokenCount = 50) {
    try {
        validateConfig(config);
        const { contract, wallet } = await setupProvider();

        console.log(`Minting ${tokenCount} random tokens on network`);
        console.log(`Using wallet address: ${wallet.address}`);

        const tokenData = generateRandomTokenData(tokenCount);

        const client = await connectToSpace("astaverde-test");

        const producers = [];
        const cids = [];

        for (const token of tokenData) {
            const imageBuffer = await getRandomImage();
            const imageCid = await uploadToIPFS(client, imageBuffer, 'image/jpeg');

            const metadata = {
                name: token.name,
                description: token.description,
                external_url: `${EXTERNAL_URL}${producers.length + 1}`,
                image: isDevelopment ? imageCid : `${IPFS_PREFIX}${imageCid}`,
                properties: [{ trait_type: "Producer Address", value: token.producer_address }],
            };

            const metadataCid = await uploadToIPFS(client, JSON.stringify(metadata), 'application/json');

            producers.push(token.producer_address);
            cids.push(metadataCid);

            console.log(`Prepared token ${token.name} with metadata CID: ${metadataCid}`);
        }

        console.log(`Minting batch of ${tokenCount} tokens...`);
        const tx = await contract.mintBatch(producers, cids);
        console.log(`Transaction sent: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
        console.log(`Gas used: ${receipt.gasUsed.toString()}`);

        console.log("Transaction logs:");
        for (const log of receipt.logs) {
            try {
                const parsedLog = contract.interface.parseLog(log);
                console.log(`- Event: ${parsedLog.name}`);
                console.log(`  Args: ${serializeBigInt(parsedLog.args)}`);
            } catch (e) {
                console.log(`- Unable to parse log: ${e.message}`);
            }
        }

        const batchMintedEvent = receipt.logs
            .map(log => { try { return contract.interface.parseLog(log); } catch (e) { return null; } })
            .find(event => event && event.name === 'BatchMinted');

        if (batchMintedEvent) {
            console.log("BatchMinted event found:", batchMintedEvent.args);
            await queryMintedTokens(contract, batchMintedEvent.args.batchId);
        } else {
            console.warn("BatchMinted event not found in transaction logs");
            console.log("Attempting to query the last batch...");
            const lastBatchID = await contract.lastBatchID();
            await queryMintedTokens(contract, lastBatchID);
        }
    } catch (error) {
        console.error("Error in mintRandomTokens:", error);
        throw error;
    }
}

async function queryMintedTokens(contract, batchId) {
    try {
        const batchInfo = await contract.getBatchInfo(batchId);
        console.log(`\nBatch ${batchId} Info:`);
        console.log(`Token IDs: ${batchInfo.tokenIds.map(id => id.toString()).join(', ')}`);
        console.log(`Creation Time: ${new Date(Number(batchInfo.creationTime) * 1000).toLocaleString()}`);
        console.log(`Price: ${formatUnits(batchInfo.price, 6)} USDC`);
        console.log(`Remaining Tokens: ${batchInfo.remainingTokens.toString()}`);
    } catch (error) {
        console.error(`Error querying batch ${batchId}:`, error);
    }
}

const isDevelopment = process.env.NODE_ENV === "development";

(async () => {
    try {
        console.log("Starting random token minting process...");
        console.log(`Running in ${isDevelopment ? 'development' : 'production'} mode`);

        validateConfig(config);

        const tokenCount = parseInt(process.env.TOKEN_COUNT || '50', 10);
        console.log(`Minting ${tokenCount} tokens`);

        await mintRandomTokens(tokenCount);
        console.log("Random token minting process completed successfully.");
    } catch (error) {
        console.error("An error occurred during the random token minting process:", error);
        process.exit(1);
    }
})();