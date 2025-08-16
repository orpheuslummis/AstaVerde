# QA Deployment Guide for Base Sepolia Testnet (Dual‑Vault, Single SCC)

## Overview
This guide outlines the deployment process for the `ssc-clean` branch to Base Sepolia testnet for QA testing. The deployment includes smart contracts (two marketplaces + two vaults sharing one SCC) and webapp (auto-deployed to Vercel).

## Important Notes
- **Deployment Scope**: The standard `npm run deploy:testnet` deploys MockUSDC and AstaVerde (V1). You will also deploy the hardened AstaVerde V1.1, then deploy SCC + two EcoStabilizer vaults (one per marketplace) that share a single SCC.
- **Vault Version**: This QA uses EcoStabilizer V1 for both vaults (single operations only). Batch operations (V2) are not included.
- **Explorer**: Contract verification uses Blockscout (https://base-sepolia.blockscout.com), not Basescan.

## Prerequisites

### Required Environment Variables
Create or update `.env.local` with:
```bash
# Deployment wallet private key (with Base Sepolia ETH)
PRIVATE_KEY=<your_deployment_wallet_private_key>

# Alchemy API key for Base Sepolia RPC
RPC_API_KEY=<your_alchemy_api_key>

# Blockscout API key for contract verification
BASE_SEPOLIA_EXPLORER_API_KEY=<your_blockscout_api_key>
```

### Required for Webapp
Create `webapp/.env.production`:
```bash
# Network selection
NEXT_PUBLIC_CHAIN_SELECTION=base_sepolia

# Contract addresses (filled after deployment)
NEXT_PUBLIC_ASTAVERDE_ADDRESS=
NEXT_PUBLIC_ASTAVERDE_V11_ADDRESS=
NEXT_PUBLIC_USDC_ADDRESS=
NEXT_PUBLIC_ECOSTABILIZER_ADDRESS=
NEXT_PUBLIC_ECOSTABILIZER_V11_ADDRESS=
NEXT_PUBLIC_SCC_ADDRESS=

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

2. **Deploy V1 marketplace contracts** (MockUSDC + AstaVerde V1):
   ```bash
   npm run deploy:testnet
   ```
   
   This deploys:
   - MockUSDC (test USDC token)
   - AstaVerde (NFT marketplace contract)
   
   Save the AstaVerde address from the output.

3. **Deploy AstaVerde V1.1 (hardened)**:
   Deploy the hardened `AstaVerde.sol` as a new contract using the same constructor args as V1 (owner, USDC address). Capture the address for the next step.

4. **Deploy SCC + both EcoStabilizer vaults** (dual‑vault):
   ```bash
   # Set marketplace addresses
   export AV_ADDR=0x[deployed_astaverde_v1]
   export AV_ADDR_V11=0x[deployed_astaverde_v11]

   # Deploy SCC and both vaults, grant MINTER_ROLE to both, renounce SCC admin,
   # and configure trustedVault (V1.1; V1 attempted if supported)
   npx hardhat run scripts/deploy_ecostabilizer.ts --network base-sepolia
   ```
   
   This deploys and configures:
   - StabilizedCarbonCoin (SCC token, single instance)
   - EcoStabilizer (vault for V1)
   - EcoStabilizer (vault for V1.1)
   - MINTER_ROLE for both vaults on SCC
   - Admin role renounced on SCC
   - trustedVault set on V1.1 (and attempted on V1)
   
5. **Save all deployed addresses**:
   ```
   MockUSDC deployed to: 0x...
   AstaVerde (V1) deployed to: 0x...
   AstaVerde (V1.1) deployed to: 0x...
   StabilizedCarbonCoin deployed to: 0x...
   EcoStabilizer (V1) deployed to: 0x...
   EcoStabilizer (V1.1) deployed to: 0x...
   ```

### Step 3: Configure Webapp

1. **Update `webapp/.env.production`** with deployed addresses:
   ```bash
   NEXT_PUBLIC_ASTAVERDE_ADDRESS=<deployed_astaverde_v1>
   NEXT_PUBLIC_ASTAVERDE_V11_ADDRESS=<deployed_astaverde_v11>
   NEXT_PUBLIC_USDC_ADDRESS=<deployed_mockusdc_address>
   NEXT_PUBLIC_ECOSTABILIZER_ADDRESS=<deployed_vault_v1>
   NEXT_PUBLIC_ECOSTABILIZER_V11_ADDRESS=<deployed_vault_v11>
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

1. **Seed test data** for QA team (choose one):
   ```bash
   # Option A: Use generic minter
   node scripts/mint.mjs --count 6
   
   # Option B: Use test seeder (recommended)
   ASTAVERDE_ADDRESS=0x[...] USDC_ADDRESS=0x[...] \
   SCC_ADDRESS=0x[...] ECOSTABILIZER_ADDRESS=0x[...] \
   npx hardhat run scripts/test-seed.js --network base-sepolia
   ```

2. **Verify contracts on Blockscout**:
   ```bash
   npx hardhat verify --network base-sepolia <ASTAVERDE_V1_ADDRESS>
   npx hardhat verify --network base-sepolia <ASTAVERDE_V11_ADDRESS>
   npx hardhat verify --network base-sepolia <SCC_ADDRESS>
   npx hardhat verify --network base-sepolia <ECOSTABILIZER_V1_ADDRESS>
   npx hardhat verify --network base-sepolia <ECOSTABILIZER_V11_ADDRESS>
   ```
   
   Note: Verification targets Blockscout (https://base-sepolia.blockscout.com) per hardhat.config.ts

## QA Testing Information

### Network Details
- **Network**: Base Sepolia Testnet
- **Chain ID**: 84532
- **RPC URL**: `https://sepolia.base.org`
- **Explorer**: https://base-sepolia.blockscout.com

### Contract Addresses (Update after deployment)
| Contract | Address | Explorer Link |
|----------|---------|---------------|
| MockUSDC | `0x...` | [View on Blockscout]() |
| AstaVerde | `0x...` | [View on Blockscout]() |
| StabilizedCarbonCoin | `0x...` | [View on Blockscout]() |
| EcoStabilizer | `0x...` | [View on Blockscout]() |

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

#### Phase 1 - Marketplace ✅
- [ ] Browse carbon offset NFT batches
- [ ] Purchase NFTs with USDC
- [ ] View owned tokens in "My Tokens"
- [ ] Redeem NFTs for carbon credits
- [ ] Check Dutch auction price updates

#### Phase 2 - Vault System (Dual‑Vault, V1) ✅
- [ ] Deposit single NFT into correct vault based on NFT source (V1 vs V1.1)
- [ ] Receive 20 SCC tokens per NFT
- [ ] Withdraw single NFT (burns 20 SCC)
- [ ] Check vault statistics
- [ ] Approve NFT transfers to vault
- [ ] Approve SCC spending for withdrawals

#### Cross‑version behavior ✅
- [ ] Ensure V1 and V1.1 NFTs route to respective vaults
- [ ] Verify vault operations continue when V1.1 marketplace is paused (trustedVault)

#### Not Available in This Deployment ❌
- [ ] Batch deposit (requires EcoStabilizer V2)
- [ ] Batch withdraw (requires EcoStabilizer V2)

### Known Issues
- Webapp has 5 ESLint errors that need fixing before build
- TypeScript compilation shows ~70 errors (some may be non-blocking)
- Console logs are present (development artifacts)
- Some components are large and may need optimization
- Batch operations UI may be visible but won't work (V2 not deployed)

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
- Contract verification: Use Blockscout (Base Sepolia)
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

## Summary of Key Changes from Original Plan

1. **Dual‑vault deployment**: V1 + V1.1 marketplaces, each with their own vault; single shared SCC
2. **Correct mint scripts**: Use `mint.mjs` or `test-seed.js`
3. **Explorer target**: Blockscout for Base Sepolia
4. **Vault limitations**: V1 contracts only (no batch operations)
5. **Frontend routing**: Use per‑asset vault routing with V1/V1.1 envs

---

*Last Updated: 2025-08-16*
*Branch: ssc-clean*
*Version: Phase 2 Implementation (Vault System V1)*