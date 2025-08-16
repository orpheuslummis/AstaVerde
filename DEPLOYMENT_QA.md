# QA Deployment Guide for Base Sepolia Testnet

## Overview
This guide outlines the deployment process for the `ssc-clean` branch to Base Sepolia testnet for QA testing. The deployment includes both smart contracts and the webapp (auto-deployed to Vercel).

## Prerequisites

### Required Environment Variables
Create or update `.env.local` with:
```bash
# Deployment wallet private key (with Base Sepolia ETH)
PRIVATE_KEY=<your_deployment_wallet_private_key>

# Alchemy API key for Base Sepolia RPC
RPC_API_KEY=<your_alchemy_api_key>

# Basescan API key for contract verification
BASE_SEPOLIA_EXPLORER_API_KEY=<your_basescan_api_key>
```

### Required for Webapp
Create `webapp/.env.production`:
```bash
# Network selection
NEXT_PUBLIC_CHAIN_SELECTION=base_sepolia

# Contract addresses (will be filled after deployment)
NEXT_PUBLIC_ASTAVERDE_ADDRESS=
NEXT_PUBLIC_USDC_ADDRESS=
NEXT_PUBLIC_ECOSTABILIZER_ADDRESS=
NEXT_PUBLIC_SCC_ADDRESS=

# V1.1 addresses (if deploying dual-vault architecture)
NEXT_PUBLIC_ASTAVERDE_V11_ADDRESS=
NEXT_PUBLIC_ECOSTABILIZER_V11_ADDRESS=

# Configuration
NEXT_PUBLIC_USDC_DECIMALS=6
NEXT_PUBLIC_IPFS_GATEWAY_URL=https://ipfs.io/ipfs/

# API Keys (production keys required)
NEXT_PUBLIC_ALCHEMY_API_KEY=<your_alchemy_api_key>
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<your_walletconnect_project_id>
```

## Deployment Steps

### Step 1: Fix Build Issues
Before deployment, ensure the webapp builds successfully:

1. **Fix ESLint errors** (currently 5 errors):
   ```bash
   cd webapp
   npm run build
   ```
   
   Common issues to fix:
   - Replace `any` types with proper types
   - Remove unused variables
   - Fix import issues

2. **Fix TypeScript errors** (if any):
   ```bash
   npx tsc --noEmit
   ```

### Step 2: Deploy Smart Contracts

1. **Ensure you have Base Sepolia ETH**:
   - Get test ETH from: https://www.alchemy.com/faucets/base-sepolia
   - Need ~0.1 ETH for deployment

2. **Run deployment script**:
   ```bash
   npm run deploy:testnet
   ```
   
   This will deploy:
   - MockUSDC (test USDC token)
   - AstaVerde (NFT marketplace contract)
   - StabilizedCarbonCoin (SCC token)
   - EcoStabilizer (vault contract)

3. **Save deployed addresses**:
   The script will output addresses like:
   ```
   MockUSDC deployed to: 0x...
   AstaVerde deployed to: 0x...
   StabilizedCarbonCoin deployed to: 0x...
   EcoStabilizer deployed to: 0x...
   ```

### Step 3: Configure Webapp

1. **Update `webapp/.env.production`** with deployed addresses:
   ```bash
   NEXT_PUBLIC_ASTAVERDE_ADDRESS=<deployed_astaverde_address>
   NEXT_PUBLIC_USDC_ADDRESS=<deployed_mockusdc_address>
   NEXT_PUBLIC_ECOSTABILIZER_ADDRESS=<deployed_ecostabilizer_address>
   NEXT_PUBLIC_SCC_ADDRESS=<deployed_scc_address>
   ```

2. **Verify webapp builds**:
   ```bash
   cd webapp
   npm run build
   ```

### Step 4: Deploy to Vercel

1. **Commit all changes**:
   ```bash
   git add .
   git commit -m "Deploy to Base Sepolia for QA testing

   - Deployed contracts to Base Sepolia
   - Updated webapp configuration
   - Fixed build issues"
   ```

2. **Push to trigger Vercel deployment**:
   ```bash
   git push origin ssc-clean
   ```

3. **Get Vercel preview URL**:
   - Check Vercel dashboard for deployment status
   - Preview URL format: `https://astaverde-[branch-hash].vercel.app`

### Step 5: Post-Deployment Setup

1. **Mint test tokens** for QA team:
   ```bash
   npx hardhat run scripts/mint-testnet-batch.js --network base-sepolia
   ```

2. **Verify contracts on Basescan**:
   ```bash
   npx hardhat verify --network base-sepolia <ASTAVERDE_ADDRESS>
   npx hardhat verify --network base-sepolia <SCC_ADDRESS>
   npx hardhat verify --network base-sepolia <ECOSTABILIZER_ADDRESS>
   ```

## QA Testing Information

### Network Details
- **Network**: Base Sepolia Testnet
- **Chain ID**: 84532
- **RPC URL**: `https://sepolia.base.org`
- **Explorer**: https://sepolia.basescan.org

### Contract Addresses (Update after deployment)
| Contract | Address | Explorer Link |
|----------|---------|---------------|
| MockUSDC | `0x...` | [View on Basescan]() |
| AstaVerde | `0x...` | [View on Basescan]() |
| StabilizedCarbonCoin | `0x...` | [View on Basescan]() |
| EcoStabilizer | `0x...` | [View on Basescan]() |

### Test Wallets Setup
1. Add Base Sepolia to MetaMask:
   - Network Name: Base Sepolia
   - RPC URL: https://sepolia.base.org
   - Chain ID: 84532
   - Currency Symbol: ETH

2. Get test ETH from faucet:
   - https://www.alchemy.com/faucets/base-sepolia

3. Get test USDC:
   - Connect to webapp
   - Use "Mint Test USDC" function (if available)
   - Or interact directly with MockUSDC contract

### Features to Test

#### Phase 1 - Marketplace
- [ ] Browse carbon offset NFT batches
- [ ] Purchase NFTs with USDC
- [ ] View owned tokens in "My Tokens"
- [ ] Redeem NFTs for carbon credits
- [ ] Check Dutch auction price updates

#### Phase 2 - Vault System
- [ ] Deposit NFT into vault
- [ ] Receive 20 SCC tokens per NFT
- [ ] Withdraw NFT (burns 20 SCC)
- [ ] Batch deposit (multiple NFTs)
- [ ] Batch withdraw (multiple NFTs)
- [ ] Check vault statistics

### Known Issues
- Webapp may have TypeScript warnings (non-blocking)
- Console logs are present (development artifacts)
- Some components are large and may need optimization

## Troubleshooting

### Build Failures
1. Check for ESLint errors: `cd webapp && npm run build`
2. Fix TypeScript issues: `npx tsc --noEmit`
3. Clear cache: `rm -rf webapp/.next`

### Deployment Failures
1. Check wallet has enough Base Sepolia ETH
2. Verify RPC_API_KEY is valid
3. Check network connectivity

### Vercel Deployment Issues
1. Ensure environment variables are set in Vercel dashboard
2. Check build logs in Vercel
3. Verify branch is pushed correctly

## Support
For deployment issues or questions:
- Technical issues: Check deployment logs
- Contract verification: Use Basescan
- Webapp issues: Check Vercel build logs

## Appendix: Emergency Procedures

### Rollback Deployment
If critical issues found:
1. Deploy previous stable contracts
2. Update webapp configuration
3. Redeploy to Vercel

### Update Contract
If contract update needed:
1. Deploy new contract version
2. Update addresses in webapp
3. Notify QA team of changes

---

*Last Updated: [Date]*
*Branch: ssc-clean*
*Version: Phase 2 Implementation (Vault System)*