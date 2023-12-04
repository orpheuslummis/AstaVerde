/*
This script is designed to mint a batch of tokens for the Asta Verde project. It performs the following operations:

1. Reads token data from a CSV file. Each row in the CSV file represents a token and should include the token's name, producer address, arbitrary text, and timestamp of production.
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
*/
import astaverdejson from "../artifacts/contracts/AstaVerde.sol/AstaVerde.json" assert { type: "json" };
import { create } from "@web3-storage/w3up-client";
import csv from "csv-parser";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { filesFromPaths } from "files-from-path";
import fs from "fs";

const abi = astaverdejson.abi;

dotenv.config();

const config = {
  contractAddress: process.env.CONTRACT_ADDRESS,
  imageFolder: process.env.IMAGE_FOLDER,
  csvPath: process.env.CSV_PATH,
  infuraApiKey: process.env.INFURA_API_KEY,
  email: process.env.EMAIL,
  chainSelection: process.env.CHAIN_SELECTION,
  privateKey: process.env.PRIVATE_KEY,
};

function validateConfig(config) {
  Object.entries(config).forEach(([key, value]) => {
    if (!value) {
      console.error(`Missing ${key}. Please provide it as an environment variable or as a command line argument.`);
      process.exit(1);
    }
  });
}

const explorerURL = config.chainSelection === 'mainnet' ? 'https://etherscan.io/' : 'https://sepolia.etherscan.io/';


async function mint() {
  validateConfig(config);

  const provider = new ethers.InfuraProvider(config.chainSelection, config.infuraApiKey);
  const wallet = new ethers.Wallet(config.privateKey);
  const signer = wallet.connect(provider);
  const contract = new ethers.Contract(config.contractAddress, abi, signer);

  const client = await create();
  console.log("Logging in with email: " + config.email + ". A confirmation email will be sent to this address.");
  let userAccount;
  try {
    userAccount = await client.login(config.email);
  } catch (error) {
    console.error("Failed to login: ", error);
    process.exit(1);
  }
  const space = await client.createSpace("astaverde-dev");

  // wait for payment plan to be selected
  let res = await userAccount.plan.get();
  while (!res.ok) {
    console.log('Waiting for payment plan to be selected...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    res = await userAccount.plan.get();
  }

  await userAccount.provision(space.did())
  await client.addSpace(await space.createAuthorization(client)); // why
  await client.setCurrentSpace(space.did());

  // Step 1: Load and validate the csv file
  const data = [];
  fs.createReadStream(config.csvPath)
    .pipe(csv())
    .on("data", (row) => {
      data.push(row);
    })
    .on("end", async () => {
      // Step 2: Upload to IPFS
      const producers = [];
      const cids = [];
      for (const row of data) {
        console.log("Processing row", row);
        const metadata = {
          description: "TBD carbon credit",
          external_url: `https://tbd.xyz/${row.id}`,
          image: `https://w3s.link/ipfs/${row.image_path}`,
          name: "TBD name",
          attributes: [
            {
              trait_type: "Producer Address",
              value: row.producer_address,
            },
            {
              trait_type: "Timestamp",
              value: row.timestamp,
            },
          ],
        };
        const imagefile = await filesFromPaths([`${config.imageFolder}/${row.image_path}`]);
        console.log(`Uploading ${row.image_path}...`);
        const cid = await client.uploadFile(imagefile[0]);
        console.log(`Gateway URL: https://w3s.link/ipfs/${cid}`);

        console.log(`Uploading metadata for ${row.id}...`);
        const metadataFile = new Blob([JSON.stringify(metadata)], { type: "application/json" });
        const metadataCid = await client.uploadFile(metadataFile);
        console.log(`Gateway URL: https://w3s.link/ipfs/${metadataCid}`);

        producers.push(row.producer_address);
        cids.push(cid);
      }

      // Step 3: Call the mintBatch contract function with the resulting metadata
      const tx = await contract.mintBatch(producers, cids);
      console.log(`Transaction URL: ${explorerURL}${tx.hash}`);
    });
}
(async () => {
  try {
    await mint();
  } catch (error) {
    console.error("An error occurred:", error);
  }
})();
