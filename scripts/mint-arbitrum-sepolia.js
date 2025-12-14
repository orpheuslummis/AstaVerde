#!/usr/bin/env node

/**
 * Mint a new batch on the Arbitrum Sepolia deployment of AstaVerde.
 *
 * Usage:
 *   # Minimal (dummy CIDs; UI metadata will not resolve)
 *   node scripts/mint-arbitrum-sepolia.js --count 3
 *
 *   # Full flow (upload images + metadata to IPFS via Pinata, then mint)
 *   PINATA_JWT=... node scripts/mint-arbitrum-sepolia.js --ipfs pinata --count 3
 *
 * Options:
 *   --count/-c      How many NFTs to include in the batch (default: 3)
 *   --address/-a    AstaVerde contract address (optional; defaults to deployments/arbitrum-sepolia/AstaVerde.json)
 *   --cidPrefix/-p  Prefix for mock CIDs when --ipfs=none (default: QmArbTest)
 *   --producer/-u   Producer address (default: signer[0] / deployer)
 *   --ipfs          IPFS upload mode: none|pinata (default: pinata if PINATA_JWT set, else none)
 *   --imageMode     Image mode in Pinata flow: auto|dir|generated|none (default: auto)
 *   --imagesDir     Folder of images to cycle through (default: ./example_nftdata/images) [dir mode]
 *   --images        Legacy: include images (default: true; use --no-images to disable)
 *   --namePrefix    Metadata name prefix (default: Carbon Offset)
 *
 * Requirements:
 *   - PRIVATE_KEY configured for the owner/deployer in your Hardhat env
 *   - Arbitrum Sepolia RPC configured (RPC_API_KEY or ARBITRUM_SEPOLIA_RPC_URL)
 *   - deployments/arbitrum-sepolia/AstaVerde.json present, or pass --address
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const DEFAULT_EXTERNAL_URL = "https://ecotradezone.bionerg.com/token/";
const IPFS_PREFIX = "ipfs://";

function loadEnv() {
  // Load base env first, then allow .env.local to override, then network-specific override.
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

  const arbSepoliaEnv = path.resolve(process.cwd(), ".env.arbitrum-sepolia");
  if (fs.existsSync(arbSepoliaEnv)) {
    dotenv.config({ path: arbSepoliaEnv, override: true });
  }
}

loadEnv();

function loadAstaVerdeDeployment(cliAddress) {
  const deploymentPath = path.join(__dirname, "../deployments/arbitrum-sepolia/AstaVerde.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("AstaVerde address not found. Pass --address or add deployments/arbitrum-sepolia/AstaVerde.json");
  }
  const artifact = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const address = cliAddress || artifact.address;
  if (!address) {
    throw new Error("Deployment artifact missing address");
  }
  const abi = artifact.abi;
  if (!abi || !Array.isArray(abi)) {
    throw new Error("Deployment artifact missing ABI");
  }
  return { address, abi };
}

function buildCids(count, prefix) {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i + 1}`);
}

function buildProducers(count, producerAddress) {
  return Array.from({ length: count }, () => producerAddress);
}

function isSupportedImageExt(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".webp" || ext === ".gif";
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function listImageFiles(imagesDir) {
  if (!imagesDir) return [];
  const abs = path.isAbsolute(imagesDir) ? imagesDir : path.resolve(process.cwd(), imagesDir);
  if (!fs.existsSync(abs)) return [];
  const entries = fs.readdirSync(abs, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && isSupportedImageExt(e.name))
    .map((e) => path.join(abs, e.name))
    .sort((a, b) => a.localeCompare(b));
}

async function pinataPinJson(jwt, json, name) {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataMetadata: name ? { name } : undefined,
      pinataContent: json,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pinata pinJSONToIPFS failed: ${res.status} ${res.statusText} ${text}`.trim());
  }
  const out = await res.json();
  const cid = out?.IpfsHash;
  if (!cid || typeof cid !== "string") {
    throw new Error("Pinata pinJSONToIPFS returned no IpfsHash");
  }
  return cid;
}

async function pinataPinFile(jwt, filePath, name) {
  const fileName = path.basename(filePath);
  const contentType = guessMimeType(filePath);
  const buf = await fs.promises.readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: contentType }), fileName);
  if (name) {
    form.append("pinataMetadata", JSON.stringify({ name }));
  }

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pinata pinFileToIPFS failed: ${res.status} ${res.statusText} ${text}`.trim());
  }
  const out = await res.json();
  const cid = out?.IpfsHash;
  if (!cid || typeof cid !== "string") {
    throw new Error("Pinata pinFileToIPFS returned no IpfsHash");
  }
  return cid;
}

function svgToDataUri(svg) {
  // Keep this compatible with the webapp placeholder approach: data:image/svg+xml,<encoded>
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function generateSimpleTokenSvg(tokenIdLabel) {
  const seed = Number.parseInt(String(tokenIdLabel).replace(/\D/g, ""), 10) || 1;
  const hue1 = (seed * 131.508) % 360;
  const hue2 = (seed * 211.508) % 360;
  const saturation = 78 + (seed % 15);
  const lightness = 55 + (seed % 12);
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue1},${saturation}%,${lightness}%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(${hue2},${saturation}%,${lightness}%);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      <circle cx="200" cy="200" r="140" fill="rgba(255,255,255,0.15)" />
      <text x="200" y="212" font-family="Arial, sans-serif" font-size="28" fill="white" text-anchor="middle">
        Token ${tokenIdLabel}
      </text>
    </svg>
  `.trim();
}

function buildMetadata({ tokenId, namePrefix, producerAddress, externalUrlBase, imageUri }) {
  const name = `${namePrefix} #${tokenId}`;
  const description =
    "Verified carbon offset NFT for testnet QA. Metadata generated by automated minting script.";
  const external_url = `${externalUrlBase}${tokenId}`;
  const attributes = [
    { trait_type: "Type", value: "Carbon Offset" },
    { trait_type: "Token ID", value: String(tokenId) },
    { trait_type: "Producer Address", value: producerAddress },
  ];

  const metadata = {
    name,
    description,
    external_url,
    producer_address: producerAddress,
    attributes,
    // Keep "properties" for backward-compat with older metadata expectations.
    properties: [{ trait_type: "Producer Address", value: producerAddress }],
  };

  if (imageUri) {
    metadata.image = imageUri;
  }

  return metadata;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryGetBatchInfo(contract, batchId, { retries = 8, delayMs = 1500 } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await contract.getBatchInfo(batchId);
    } catch (err) {
      lastErr = err;
    }
    if (attempt < retries) {
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("count", { alias: "c", type: "number", default: 3, describe: "Number of NFTs to mint" })
    .option("address", { alias: "a", type: "string", describe: "AstaVerde contract address override" })
    .option("cidPrefix", { alias: "p", type: "string", default: "QmArbTest", describe: "CID prefix for mock metadata" })
    .option("producer", { alias: "u", type: "string", describe: "Producer address (defaults to signer[0])" })
    .option("ipfs", {
      type: "string",
      choices: ["none", "pinata"],
      default: process.env.PINATA_JWT ? "pinata" : "none",
      describe: "IPFS upload mode",
    })
    .option("imagesDir", {
      type: "string",
      default: "./example_nftdata/images",
      describe: "Folder of images to cycle through",
    })
    .option("images", {
      type: "boolean",
      default: true,
      describe: "Upload images (Pinata mode only)",
    })
    .option("imageMode", {
      type: "string",
      choices: ["auto", "dir", "generated", "none"],
      default: "auto",
      describe: "How to set metadata.image when --ipfs=pinata",
    })
    .option("namePrefix", {
      type: "string",
      default: "Carbon Offset",
      describe: "Metadata name prefix",
    })
    .strict()
    .help().argv;

  if (!Number.isFinite(argv.count) || argv.count <= 0) {
    throw new Error("count must be a positive number");
  }

  const rpcUrl =
    process.env.ARBITRUM_SEPOLIA_RPC_URL ||
    (process.env.RPC_API_KEY ? `https://arb-sepolia.g.alchemy.com/v2/${process.env.RPC_API_KEY}` : "");
  if (!rpcUrl) {
    throw new Error("Missing RPC URL. Set ARBITRUM_SEPOLIA_RPC_URL (preferred) or RPC_API_KEY.");
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing PRIVATE_KEY in environment");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const network = await provider.getNetwork();
  if (network.chainId !== 421614n) {
    console.warn(`⚠️  Warning: connected to chainId ${network.chainId} (expected 421614 for Arbitrum Sepolia)`);
  }

  const { address: contractAddress, abi } = loadAstaVerdeDeployment(argv.address);
  const producerAddress = argv.producer || signer.address;

  if (!ethers.isAddress(contractAddress)) {
    throw new Error(`Invalid contract address: ${contractAddress}`);
  }
  if (!ethers.isAddress(producerAddress) || producerAddress.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
    throw new Error(`Invalid producer address: ${producerAddress}`);
  }

  console.log(`\nNetwork: ${network.name} (chainId: ${network.chainId})`);
  console.log(`Signer:  ${signer.address}`);
  console.log(`Contract: ${contractAddress}`);
  console.log(`Producer: ${producerAddress}`);
  console.log(`Count:    ${argv.count}`);
  console.log(`CID base: ${argv.cidPrefix}\n`);

  const astaVerde = new ethers.Contract(contractAddress, abi, signer);
  const [owner, paused, maxBatchSize] = await Promise.all([
    astaVerde.owner(),
    astaVerde.paused(),
    astaVerde.maxBatchSize(),
  ]);
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer is not contract owner (owner=${owner}, signer=${signer.address})`);
  }
  if (paused) {
    throw new Error("Contract is paused; mintBatch is disabled");
  }
  if (BigInt(argv.count) > maxBatchSize) {
    throw new Error(`count exceeds maxBatchSize (${maxBatchSize.toString()})`);
  }

  const lastTokenId = await astaVerde.lastTokenID();
  console.log(`Current lastTokenID: ${lastTokenId.toString()}`);

  const expectedTokenIds = Array.from({ length: argv.count }, (_, i) => (lastTokenId + BigInt(i) + 1n).toString());
  const producers = buildProducers(argv.count, producerAddress);

  let cids;
  if (argv.ipfs === "pinata") {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      throw new Error("PINATA_JWT is required when --ipfs=pinata");
    }

    const imageFiles = argv.images ? listImageFiles(argv.imagesDir) : [];
    const resolvedImageMode = (() => {
      if (!argv.images) return "none";
      if (argv.imageMode !== "auto") return argv.imageMode;
      if (imageFiles.length > 0) return "dir";
      return "generated";
    })();
    if (resolvedImageMode === "dir" && imageFiles.length === 0) {
      throw new Error(`No images found in ${argv.imagesDir}. Use --imageMode generated or --no-images.`);
    }

    console.log(`Uploading ${argv.count} metadata item(s) to IPFS via Pinata...`);
    const externalUrlBase = process.env.EXTERNAL_URL || DEFAULT_EXTERNAL_URL;

    cids = [];
    for (let i = 0; i < argv.count; i++) {
      const expectedTokenId = lastTokenId + BigInt(i) + 1n;
      const imageUri = await (async () => {
        if (resolvedImageMode === "none") return null;
        if (resolvedImageMode === "generated") {
          return svgToDataUri(generateSimpleTokenSvg(expectedTokenId.toString()));
        }
        // dir mode
        const imagePath = imageFiles[i % imageFiles.length];
        const imageCid = await pinataPinFile(jwt, imagePath, `AstaVerde:image:${expectedTokenId.toString()}`);
        return `${IPFS_PREFIX}${imageCid}`;
      })();
      const metadata = buildMetadata({
        tokenId: expectedTokenId.toString(),
        namePrefix: argv.namePrefix,
        producerAddress,
        externalUrlBase,
        imageUri,
      });
      const metadataCid = await pinataPinJson(jwt, metadata, `AstaVerde:metadata:${expectedTokenId.toString()}`);
      if (metadataCid.length > 100) {
        throw new Error(`Metadata CID too long for contract (len=${metadataCid.length})`);
      }
      cids.push(metadataCid);
      console.log(`  ✓ Token #${expectedTokenId.toString()} metadata CID: ${metadataCid}`);
    }
  } else {
    cids = buildCids(argv.count, argv.cidPrefix);
  }

  console.log("Submitting mintBatch...");
  const tx = await astaVerde.mintBatch(producers, cids);
  console.log(`Tx hash: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Mined in block ${receipt.blockNumber}`);

  let batchId = null;
  const parsedEvents = receipt.logs
    .map((log) => {
      try {
        return astaVerde.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const batchEvent = parsedEvents.find((evt) => evt && evt.name === "BatchMinted");
  if (batchEvent) {
    batchId = batchEvent.args.batchId;
    console.log(`Batch ID:   ${batchId.toString()}`);
    console.log(`Created at: ${batchEvent.args.batchCreationTime.toString()}`);
  } else {
    console.log("BatchMinted event not found in receipt; verify on-chain if needed.");
  }

  const resolvedBatchId = batchId ?? (await astaVerde.lastBatchID());

  // Token IDs are sequential; print the expected IDs even if the RPC node is temporarily stale.
  console.log(`Expected Token IDs: ${expectedTokenIds.join(", ")}`);

  try {
    const batchInfo = await tryGetBatchInfo(astaVerde, resolvedBatchId);
    const tokenIds = batchInfo[1].map((t) => t.toString());
    console.log(`Batch Token IDs:    ${tokenIds.join(", ")}`);
  } catch (err) {
    const msg = err?.shortMessage || err?.message || String(err);
    console.warn(`⚠️  Could not fetch getBatchInfo(${resolvedBatchId.toString()}) yet: ${msg}`);
    console.warn("   Mint succeeded; try again in ~10–30s if you need batch details immediately.");
  }
}

main().catch((err) => {
  console.error("❌ Failed to mint:", err.message || err);
  process.exit(1);
});
