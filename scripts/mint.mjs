/*
Mint a batch of tokens for Asta Verde.

1. Reads token data from a CSV file. Each row represents a token and should include the token's name, producer address, arbitrary text, and timestamp of production.
2. Uploads an image for each token. The images should be located in a specified folder.
3. Builds the metadata for each token using the data from the CSV file and the URI of the uploaded image.
4. Calls the mintBatch function in the Asta Verde contract to mint the tokens.

To run this script, you need to provide the following data and parameters:
- Contract Address: The address of the Asta Verde contract on the Ethereum network.
- Chain Selection: Whether it is on mainnet or sepolia.
- Image Folder: The path to the folder containing the images for the tokens.
- CSV Path: The path to the CSV file containing the token data.
- Infura API Key: Your Infura API key to interact with the Ethereum network.
- Email: Your email address for notifications.
- Private Key: Your private key for the Ethereum account that will be used to mint the tokens.

These parameters can be provided as environment variables or as command line arguments in the order specified above.

Before running this script, ensure the following:
- The ABI for the Asta Verde contract is built and up-to-date locally. The script imports the ABI from "./artifacts/contracts/AstaVerde.sol/AstaVerde.json".
- You have created a space for the project. The script requires the DID of the space as an input.

The script checks for token ID alignment, i.e. if the first token ID of the batch is the `lastTokenID + 1` of the contract.
The script checks if all necessary images are present in the folder.
*/

import { create } from "@web3-storage/w3up-client";
import csv from "csv-parser";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { filesFromPaths } from "files-from-path";
import fs from "fs";
import { readFileSync } from "fs";

const astaverdejson = JSON.parse(readFileSync("./artifacts/contracts/AstaVerde.sol/AstaVerde.json"));
const abi = astaverdejson.abi;

dotenv.config();

const rpcURL = "https://base-sepolia.g.alchemy.com/v2/" + process.env.ALCHEMY_APIKEY;

const EXTERNAL_URL = "https://marketplace.ecotradezone.com/token/";
const IPFS_PREFIX = "ipfs://";

const config = {
  contractAddress: process.env.CONTRACT_ADDRESS,
  imageFolder: process.env.IMAGE_FOLDER,
  csvPath: process.env.CSV_PATH,
  alchemyAPIKey: process.env.ALCHEMY_APIKEY,
  email: process.env.EMAIL,
  chainSelection: process.env.CHAIN_SELECTION,
  privateKey: process.env.PRIVATE_KEY,
};

function validateConfig(config) {
  Object.entries(config).forEach(([key, value]) => {
    if (!value) {
      throw new Error(`Missing ${key}. Please provide it as an environment variable or as a command line argument.`);
    }

    // Additional checks for specific fields
    if (key === "email" && !validateEmail(value)) {
      throw new Error(`Invalid email address. Please provide a valid email.`);
    }
  });
}

function validateEmail(email) {
  const re =
    /^(([^<>()\\.,;:\s@"']+(\.[^<>()\\.,;:\s@"']+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

function validateTokenIDAlignment(csvPath, contract) {
  const tokenData = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row) => {
        tokenData.push(row);
      })
      .on("end", () => {
        if (tokenData.length === 0) {
          reject(new Error("CSV file is empty."));
        }

        const firstTokenIDFromCSV = parseInt(tokenData[0].id);
        contract.lastTokenID().then((lastTokenIDFromContract) => {
          if (firstTokenIDFromCSV !== Number(lastTokenIDFromContract) + 1) {
            reject(new Error(`Token ID ${firstTokenIDFromCSV} does not align with lastTokenID ${lastTokenIDFromContract}.`));
          }
        }).catch((error) => {
          reject(error);
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

const explorerTxnURL =
  config.chainSelection === "mainnet" ? "https://basescan.org/tx/" : "https://sepolia.basescan.org/tx/";

async function connectToSpace(config, spaceName) {
  const client = await create();
  // console.log("Logging in with email: " + config.email + ". A confirmation email will be sent to this address.");
  let userAccount;
  try {
    userAccount = await client.login(config.email); // as `${string}@${string}`);
  } catch (error) {
    console.error("Failed to login: ", error);
    process.exit(1);
  }

  let space;
  try {
    space = await client.createSpace(spaceName);
    // console.log(`Successfully created space: ${spaceName}`);
  } catch (error) {
    console.error("Failed to create space: ", error);
    process.exit(1);
  }
  // wait for payment plan to be selected
  let res = await userAccount.plan.get();
  while (!res.ok) {
    console.log("Waiting for payment plan to be selected...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    res = await userAccount.plan.get();
  }

  try {
    const provisioning_result = await userAccount.provision(space.did());
    const recovery_result = await space.createRecovery(userAccount.did());
    await space.save();
    await client.setCurrentSpace(space.did());
    return client;
  } catch (error) {
    console.error("Error while connecting to space: ", error);
    process.exit(1);
  }
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

// The script checks if all necessary images are present in the folder.
function validateImages(csvpath, imageFolder) {
  const tokenData = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvpath)
      .pipe(csv())
      .on("data", (row) => {
        tokenData.push(row);
      })
      .on("end", () => {
        if (tokenData.length === 0) {
          reject(new Error("CSV file is empty."));
        }

        for (const row of tokenData) {
          const imagepath = `${imageFolder}/${row.id}.jpg`;
          if (!fs.existsSync(imagepath)) {
            reject(new Error(`Image ${imagepath} does not exist.`));
          }
        }
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

async function mint() {
  validateConfig(config);
  validateCSVShape(config.csvPath);
  validateImages(config.csvPath, config.imageFolder);

  const provider = new ethers.JsonRpcProvider(rpcURL);
  const wallet = new ethers.Wallet(config.privateKey);
  const signer = wallet.connect(provider);
  const contract = new ethers.Contract(config.contractAddress, abi, signer);

  const client = await connectToSpace(config, "astaverde-dev");

  validateTokenIDAlignment(config.csvPath, contract);

  // Upload to IPFS
  // Call the mintBatch contract function with the resulting metadata
  const data = [];
  fs.createReadStream(config.csvPath)
    .pipe(csv())
    .on("data", (row) => {
      data.push(row);
    })
    .on("end", async () => {
      const producers = [];
      const cids = [];
      for (const row of data) {
        console.log("Processing row", row);

        const imagefile = await filesFromPaths([`${config.imageFolder}/${row.id}.jpg`]);
        console.log(`Uploading ${row.id}.jpg...`);
        const imageCid = await client.uploadFile(imagefile[0]);
        console.log(`Image URL: ${IPFS_PREFIX}${imageCid}`);

        const metadata = {
          name: `${row.name}`,
          description: `${row.description}`,
          external_url: `${EXTERNAL_URL}${row.id}`,
          image: `${IPFS_PREFIX}${imageCid}`,
          properties: [
            {
              trait_type: "Producer Address",
              value: row.producer_address,
            },
          ],
        };

        console.log(`Uploading metadata for ${row.id}...`);
        const metadataFile = new Blob([JSON.stringify(metadata)], { type: "application/json" });
        const metadataCid = await client.uploadFile(metadataFile);
        console.log(`Metadata URL: ${IPFS_PREFIX}${metadataCid}`);

        producers.push(row.producer_address);

        cids.push(metadataCid.toString());
      }

      try {
        console.log("Sending transaction... mintBatch", producers, cids);
        const tx = await contract.mintBatch(producers, cids);
        console.log(`Transaction URL: ${explorerTxnURL}${tx.hash}`);
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
