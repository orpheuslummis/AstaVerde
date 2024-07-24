/*
Mint a batch of tokens for Asta Verde in a local development environment without IPFS.

1. Reads token data from a CSV file. Each row represents a token and should include the token's name, producer address, arbitrary text, and timestamp of production.
2. Builds the metadata for each token using the data from the CSV file.
3. Calls the mintBatch function in the Asta Verde contract to mint the tokens.

To run this script, you need to provide the following data and parameters:
- Contract Address: The address of the Asta Verde contract on the Ethereum network.
- Chain Selection: Whether it is on mainnet or sepolia.
- CSV Path: The path to the CSV file containing the token data.
- Private Key: Your private key for the Ethereum account that will be used to mint the tokens.

These parameters can be provided as environment variables or as command line arguments in the order specified above.

Before running this script, ensure the following:
- The ABI for the Asta Verde contract is built and up-to-date locally. The script imports the ABI from "./artifacts/contracts/AstaVerde.sol/AstaVerde.json".
*/

import csv from "csv-parser";
import dotenv from "dotenv";
import { ethers } from "ethers";
import fs, { readFileSync } from "fs";
import path from "path";

const astaverdejson = JSON.parse(
  readFileSync("./artifacts/contracts/AstaVerde.sol/AstaVerde.json"),
);
const abi = astaverdejson.abi;

console.log("Debug: ABI loaded:", !!abi);
console.log("Debug: ABI type:", typeof abi);
console.log("Debug: ABI length:", Array.isArray(abi) ? abi.length : "N/A");
console.log("Debug: ABI functions:", abi.filter(item => item.type === 'function').map(item => item.name));

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const rpcURL = "http://localhost:8545";
const contractAddress = process.env.CONTRACT_ADDRESS;

console.log("Debug: CONTRACT_ADDRESS=", contractAddress);

async function mint() {
  const provider = new ethers.JsonRpcProvider(rpcURL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  try {
    console.log("Debug: Initializing contract...");
    console.log("Debug: Contract address:", contractAddress);
    console.log("Debug: ABI length:", abi.length);
    
    const contract = new ethers.Contract(contractAddress, abi, wallet);
    
    console.log("Debug: Contract initialized successfully");
    console.log("Debug: Contract object type:", typeof contract);
    console.log("Debug: Contract methods:", Object.keys(contract));
    
    // Check if mintBatch exists in the ABI
    const mintBatchABI = abi.find(item => item.name === 'mintBatch' && item.type === 'function');
    console.log("Debug: mintBatch in ABI:", mintBatchABI ? "Found" : "Not found");
    if (mintBatchABI) {
      console.log("Debug: mintBatch ABI:", JSON.stringify(mintBatchABI));
    }

    // Check signer balance
    const balance = await provider.getBalance(wallet.address);
    console.log("Signer balance:", ethers.formatEther(balance), "ETH");
    
    if (balance <= BigInt(0)) {
      throw new Error("Signer has no balance to pay for gas");
    }

    // Use getFeeData() instead of getGasPrice()
    const feeData = await provider.getFeeData();
    console.log("Current gas price:", ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei");

    const data = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(process.env.CSV_PATH)
        .pipe(csv())
        .on("data", (row) => {
          data.push(row);
        })
        .on("end", resolve)
        .on("error", reject);
    });

    if (data.length === 0) {
      throw new Error("CSV file is empty or could not be read");
    }

    const producers = [];
    const metadata = [];
    for (const row of data) {
      const tokenMetadata = {
        name: row.name,
        description: row.description,
        producer_address: row.producer_address,
      };
      metadata.push(JSON.stringify(tokenMetadata));
      producers.push(row.producer_address);
    }

    console.log("Debug: Producers:", producers);
    console.log("Debug: Metadata:", metadata);

    try {
      console.log("Debug: Attempting to call mintBatch...");
      const estimatedGas = await contract.mintBatch.estimateGas(producers, metadata);
      console.log("Estimated gas:", estimatedGas.toString());
      const tx = await contract.mintBatch(producers, metadata);
      console.log("Debug: Transaction sent. Hash:", tx.hash);
      const receipt = await tx.wait();
      console.log("Debug: Transaction confirmed in block:", receipt.blockNumber);

      // Set up event listener with a timeout
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log("No more events received. Exiting.");
          resolve();
        }, 5000); // Wait for 5 seconds after the last event

        contract.on("BatchMinted", (batchId, tokenIds, event) => {
          console.log("BatchMinted event:", batchId, tokenIds);
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            console.log("No more events received. Exiting.");
            resolve();
          }, 5000);
        });
      });
    } catch (error) {
      console.error("Failed to send transaction: ", error);
      if (error.reason) {
        console.error("Error reason: ", error.reason);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error("Error in mint function:", error);
    process.exit(1);
  }
}

(async () => {
  try {
    await mint();
    console.log("Minting process completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("An error occurred:", error);
    process.exit(1);
  }
})();