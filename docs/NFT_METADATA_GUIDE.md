# NFT Metadata Guide for AstaVerde

## Issue: NFTs Not Visible in Wallets

This guide addresses the common issue where NFTs minted on AstaVerde are not visible in wallets, particularly on testnets like Sepolia (currently Arbitrum Sepolia).

## Root Causes

1. **Missing or Invalid Metadata URIs**: NFTs need properly formatted metadata that wallets can fetch
2. **IPFS Gateway Issues**: Metadata must be accessible via public IPFS gateways
3. **Testnet Limitations**: Not all wallets fully support NFT display on testnets
4. **Contract URI Configuration**: The base URI in the contract must be properly set

## Solution Overview

### 1. Ensure Proper Metadata Structure

Each NFT's metadata must follow the ERC-1155 metadata standard:

```json
{
    "name": "Carbon Offset #1",
    "description": "Verified carbon offset from renewable energy project",
    "image": "ipfs://QmXxx...",
    "external_url": "https://astaverde.com/token/1",
    "attributes": [
        {
            "trait_type": "Type",
            "value": "Carbon Offset"
        },
        {
            "trait_type": "Project",
            "value": "Solar Farm Alpha"
        },
        {
            "trait_type": "Tons CO2",
            "value": "1"
        }
    ]
}
```

### 2. Upload Metadata to IPFS

Before minting, ensure:

1. Metadata JSON is uploaded to IPFS
2. Image files are uploaded to IPFS
3. Both are pinned using a service like Pinata, Web3.Storage, or Infura

### 3. Set Contract Base URI

Run the provided script to ensure the contract's base URI is properly configured:

```bash
# For Sepolia testnet (currently Arbitrum Sepolia)
node scripts/set-metadata-uri.js sepolia

# For local development
node scripts/set-metadata-uri.js localhost
```

### 4. Check NFT Metadata

Use the diagnostic script to verify metadata is properly set:

```bash
# Check all tokens on Sepolia
node scripts/check-nft-metadata.js sepolia

# Check specific token
node scripts/check-nft-metadata.js sepolia 1
```

## Wallet-Specific Instructions

### MetaMask

1. Go to NFTs tab
2. Click "Import NFTs"
3. Enter contract address and token ID
4. If not visible, wait 5-10 minutes for indexing

### Rainbow Wallet

- Generally has good testnet support
- NFTs should appear automatically after a few minutes

### Coinbase Wallet

- Limited testnet NFT support
- May not display testnet NFTs at all

### OpenSea Testnet

If you use a marketplace/indexer for verification, make sure it supports your target network (Sepolia / Arbitrum Sepolia).
Otherwise, validate directly by reading onchain `uri(tokenId)` and fetching the IPFS JSON via a public gateway.

## Minting Process with Proper Metadata

### Step 1: Prepare Metadata Files

Create metadata JSON files for each token:

```javascript
// Example: prepare-metadata.js
const metadata = {
    name: `Carbon Offset #${tokenId}`,
    description: "Verified carbon offset from renewable energy project",
    image: `ipfs://${imageCID}`,
    attributes: [
        { trait_type: "Type", value: "Carbon Offset" },
        { trait_type: "Vintage", value: "2024" },
        { trait_type: "Tons CO2", value: "1" },
    ],
};

// Upload to IPFS and get CID
const metadataCID = await uploadToIPFS(metadata);
```

### Step 2: Mint with CIDs

When minting through the admin interface or scripts, provide the metadata CIDs:

```javascript
// Each token needs its metadata CID
const producers = ["0x...", "0x..."];
const cids = ["QmMetadata1...", "QmMetadata2..."];

await astaVerde.mintBatch(producers, cids);
```

## Troubleshooting Checklist

- [ ] Contract base URI is set to "ipfs://"
- [ ] Each token has a valid CID in the contract
- [ ] Metadata JSON is accessible via IPFS gateways
- [ ] Metadata includes required fields (name, description, image)
- [ ] Image URIs in metadata are valid IPFS links
- [ ] Content is pinned to IPFS (not just cached)
- [ ] Waited 10-30 minutes for wallet indexing
- [ ] Checked OpenSea testnet for visibility

## Testing Tools

### Check Metadata Accessibility

```bash
# Test if metadata is accessible
curl https://ipfs.io/ipfs/[YOUR_CID]

# Alternative gateways to try
curl https://cloudflare-ipfs.com/ipfs/[YOUR_CID]
curl https://gateway.pinata.cloud/ipfs/[YOUR_CID]
```

### Force Metadata Refresh

Some wallets allow manual refresh:

- MetaMask: Settings → Advanced → Clear activity tab data
- OpenSea: Click the refresh metadata button on token page

## Common Issues and Solutions

### Issue: "Token does not exist" error

**Solution**: Token hasn't been minted yet. Check `lastTokenID` on contract.

### Issue: Metadata loads but no image

**Solution**: Image CID in metadata is invalid or not pinned. Re-upload image to IPFS.

### Issue: NFT visible on OpenSea but not wallet

**Solution**: Wallet may not support testnet NFTs. Try importing manually or use different wallet.

### Issue: Changes not reflecting

**Solution**: Clear wallet cache, wait for re-indexing, or try different RPC endpoint.

## Production Considerations

For mainnet deployment:

1. Use reliable IPFS pinning service with redundancy
2. Consider using IPFS cluster or multiple pinning services
3. Set up monitoring for IPFS gateway availability
4. Implement metadata backup/recovery procedures
5. Test thoroughly on testnet first

## References

- [ERC-1155 Metadata Standard](https://eips.ethereum.org/EIPS/eip-1155#metadata)
- [OpenSea Metadata Standards](https://docs.opensea.io/docs/metadata-standards)
- [IPFS Best Practices](https://docs.ipfs.io/how-to/best-practices-for-nfts/)
- [Arbitrum Documentation](https://docs.arbitrum.io/)
