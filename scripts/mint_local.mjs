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
import fs from "fs";
import { readFileSync } from "fs";

const astaverdejson = JSON.parse(
  readFileSync("./artifacts/contracts/AstaVerde.sol/AstaVerde.json"),
);
const abi = astaverdejson.abi;

dotenv.config({ path: "./webapp/.env" });

const rpcURL = "http://host.docker.internal:8545";

const config = {
  contractAddress: process.env.CONTRACT_ADDRESS,
  csvPath: process.env.CSV_PATH,
  privateKey: process.env.PRIVATE_KEY,
};

function validateConfig(config) {
  Object.entries(config).forEach(([key, value]) => {
    if (!value) {
      throw new Error(
        `Missing ${key}. Please provide it as an environment variable or as a command line argument.`,
      );
    }
  });
}

function validateCSVShape(csvpath) {
  const requiredFields = ["id", "name", "description", "producer_address"];
  fs.createReadStream(csvpath)
    .pipe(csv())
    .on("data", (row) => {
      for (const field of requiredFields) {
        if (!row[field]) {
          throw new Error(`CSV data is missing required field: ${field}`);
        }
      }
    });
}

async function mint() {
  validateConfig(config);
  validateCSVShape(config.csvPath);

  const provider = new ethers.JsonRpcProvider(rpcURL);
  const wallet = new ethers.Wallet(config.privateKey);
  const signer = wallet.connect(provider);
  const contract = new ethers.Contract(config.contractAddress, abi, signer);

  const data = [];
  fs.createReadStream(config.csvPath)
    .pipe(csv())
    .on("data", (row) => {
      data.push(row);
    })
    .on("end", async () => {
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

      try {
        const tx = await contract.mintBatch(producers, metadata);
        console.log(`Transaction hash: ${tx.hash}`);
      } catch (error) {
        console.error("Failed to send transaction: ", error);
        process.exit(1);
      }
    });
}

(async () => {
  try {
    await mint();
  } catch (error) {
    console.error("An error occurred:", error);
  }
})();
