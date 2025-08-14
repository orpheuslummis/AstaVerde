# AstaVerde EcoStabilizer Deployment Guide

This guide covers the complete deployment process for the EcoStabilizer vault system (Phase 2) alongside the existing AstaVerde marketplace (Phase 1) on Base mainnet.

## 🎯 Deployment Overview

### System Architecture

```
Phase 1 (Live): AstaVerde Marketplace on Base Mainnet
                     ↓
Phase 2 (New):  EcoStabilizer Vault System
                     ├── StabilizedCarbonCoin (SCC)
                     └── EcoStabilizer (Vault)
```

### Deployment Strategy

- **Non-intrusive**: Phase 2 deploys alongside existing Phase 1 without modifications
- **Immutable**: Contracts are non-upgradeable for maximum security
- **Role-based**: Automatic role renunciation ensures decentralization

## 🌐 Network Configuration

### Target Networks

| Network           | Chain ID | RPC Endpoint                                      | Explorer                     |
| ----------------- | -------- | ------------------------------------------------- | ---------------------------- |
| **Base Mainnet**  | 8453     | `https://base-mainnet.g.alchemy.com/v2/{API_KEY}` | https://basescan.org         |
| Base Sepolia      | 84532    | `https://base-sepolia.g.alchemy.com/v2/{API_KEY}` | https://sepolia.basescan.org |
| Local Development | 31337    | `http://localhost:8545`                           | N/A                          |

### Required Environment Variables

```bash
# Deployment Configuration
AV_ADDR="0x..." # Existing AstaVerde contract address on Base mainnet
PRIVATE_KEY="0x..." # Deployer private key (keep secure!)
RPC_API_KEY="..." # Alchemy API key for Base network access

# Explorer Verification
BASE_MAINNET_EXPLORER_API_KEY="..." # BaseScan API key for contract verification
BASE_SEPOLIA_EXPLORER_API_KEY="..." # Sepolia BaseScan API key (for testing)

# Optional - Development
MNEMONIC="..." # 12-word phrase for local development
OWNER_ADDRESS="0x..." # Override owner address if needed
```

## 📋 Pre-Deployment Checklist

### Code Verification

- [ ] All tests pass: `npm run test`
- [ ] Code quality checks: `npm run lint`
- [ ] Gas targets verified: Deposit <165k, Withdraw <120k
- [ ] Integration tests validate Phase 1↔2 compatibility

### Environment Setup

- [ ] Base mainnet RPC access configured
- [ ] Deployer wallet funded with sufficient ETH for gas
- [ ] AstaVerde contract address verified on Base mainnet
- [ ] BaseScan API key obtained for contract verification
- [ ] Environment variables configured in `.env.local`

### Security Validation

- [ ] Private keys stored securely (never in code)
- [ ] Deployment script includes role renunciation
- [ ] Multi-signature or hardware wallet for production deployment
- [ ] Backup of deployment configuration

## 🚀 Deployment Process

### Step 1: Environment Configuration

Create `.env.local` file:

```bash
# Required for Base Mainnet Deployment
AV_ADDR=0x... # Replace with actual AstaVerde address on Base
PRIVATE_KEY=0x... # Replace with deployer private key
RPC_API_KEY=... # Replace with Alchemy API key
BASE_MAINNET_EXPLORER_API_KEY=... # Replace with BaseScan API key
```

### Step 2: Validate Prerequisites

```bash
# Verify environment setup
npm run compile
node -e "
  require('dotenv').config({ path: '.env.local' });
  console.log('AV_ADDR:', process.env.AV_ADDR ? '✅ Set' : '❌ Missing');
  console.log('PRIVATE_KEY:', process.env.PRIVATE_KEY ? '✅ Set' : '❌ Missing');
  console.log('RPC_API_KEY:', process.env.RPC_API_KEY ? '✅ Set' : '❌ Missing');
"

# Verify existing AstaVerde contract
npx hardhat run scripts/verify-astaverde.js --network base-mainnet
```

### Step 3: Execute Deployment

```bash
# Deploy to Base mainnet
npm run deploy:mainnet

# Alternative: Direct hardhat deployment
npx hardhat run deploy/deploy_ecostabilizer.ts --network base-mainnet
```

### Step 4: Post-Deployment Verification

The deployment script:

1. ✅ Deploys StabilizedCarbonCoin
2. ✅ Deploys EcoStabilizer vault
3. ✅ Grants MINTER_ROLE to vault
4. ✅ Renounces deployer admin roles
5. ✅ Saves deployment info to `deployments/ecostabilizer-<chainId>.json`

## 📊 Deployment Script Breakdown

### deploy/deploy_ecostabilizer.ts (excerpt)

```typescript
// 1. Deploy StabilizedCarbonCoin (SCC)
const scc = await SCCFactory.deploy(ethers.ZeroAddress);

// 2. Deploy EcoStabilizer vault
const ecoStabilizer = await EcoStabilizerFactory.deploy(
    astaVerdeAddress, // Existing contract
    scc.target, // New SCC contract
);

// 3. Configure roles
await scc.grantRole(MINTER_ROLE, ecoStabilizer.target);

// 4. CRITICAL: Renounce deployer roles for decentralization
await scc.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);

// 5. Verification checks
assert(!(await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)));
assert(await scc.hasRole(MINTER_ROLE, ecoStabilizer.target));
```

### Security Features

- **Automatic Role Renunciation**: Deployer loses admin control
- **Immutable Configuration**: No upgrade mechanisms
- **Verification Checks**: Deployment fails if security requirements not met
- **Role Validation**: Confirms proper MINTER_ROLE assignment

## 🔧 Testing Deployment

### Sepolia Testnet Deployment

```bash
# Deploy to Sepolia for testing
AV_ADDR=0x... npm run deploy:testnet

# Run smoke tests
node scripts/smoke_test_vault.mjs --network base-sepolia
```

### Local Development Deployment

```bash
# Start local network
npx hardhat node

# Deploy locally (separate terminal)
AV_ADDR=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 npm run deploy:local

# Run integration tests
npm run test test/IntegrationPhase1Phase2.ts
```

## 📁 Deployment Artifacts

### Generated Files

```
deployments/
├── ecostabilizer-8453.json      # Base mainnet deployment info
├── ecostabilizer-84532.json     # Base Sepolia deployment info
└── ecostabilizer-31337.json     # Local development deployment

webapp/src/config/
├── AstaVerde.json              # Updated ABI (if needed)
├── EcoStabilizer.json          # New vault contract ABI
└── StabilizedCarbonCoin.json   # New SCC contract ABI
```

### Deployment Info Structure

```json
{
    "network": { "chainId": 8453, "name": "base" },
    "timestamp": "2025-08-05T12:00:00.000Z",
    "deployer": "0x...",
    "contracts": {
        "AstaVerde": "0x...",
        "StabilizedCarbonCoin": "0x...",
        "EcoStabilizer": "0x..."
    },
    "constants": {
        "SCC_PER_ASSET": "20.0",
        "SCC_DECIMALS": "18"
    },
    "verification": {
        "vaultHasMinterRole": true,
        "securityState": "deployer roles renounced"
    }
}
```

## 🔍 Post-Deployment Validation

### Functional Testing

```bash
# Smoke test - basic functionality
node scripts/smoke_test_vault.mjs --network base-mainnet

# Integration test - Phase 1↔2 compatibility
npm run test test/IntegrationPhase1Phase2.ts -- --network base-mainnet

# Gas analysis
node scripts/gas_analysis.mjs --network base-mainnet
```

### Security Audit

```bash
# Verify role assignments
npx hardhat run scripts/audit-roles.js --network base-mainnet

# Validate contract state
npx hardhat run scripts/validate-deployment.js --network base-mainnet
```

### Frontend Integration

```bash
# Update webapp configuration
npm run webapp:build

# Test webapp with new contracts
npm run webapp:dev
```

## 🚨 Emergency Procedures

### Pause Mechanism

```typescript
// Emergency pause (vault owner only)
await ecoStabilizer.pause();

// Resume operations
await ecoStabilizer.unpause();
```

### Admin NFT Sweep

```typescript
// Recover NFTs sent directly to vault (not through deposit)
await ecoStabilizer.adminSweepNFT(tokenId, rescueAddress);
```

### Monitoring & Alerts

- **Transaction Monitoring**: Track deposit/withdraw transactions
- **Gas Price Alerts**: Monitor Base network congestion
- **Role Changes**: Alert on any admin function calls
- **Error Patterns**: Monitor for failed transactions

## 📈 Expected Gas Costs

### Deployment Costs (Base Mainnet)

| Contract             | Estimated Gas | Estimated Cost (0.001 ETH/gas) |
| -------------------- | ------------- | ------------------------------ |
| StabilizedCarbonCoin | ~1.2M gas     | ~0.0012 ETH                    |
| EcoStabilizer        | ~2.8M gas     | ~0.0028 ETH                    |
| Role Configuration   | ~200k gas     | ~0.0002 ETH                    |
| **Total Deployment** | **~4.2M gas** | **~0.0042 ETH**                |

### Runtime Operations

| Operation    | Gas Used | Target | Status |
| ------------ | -------- | ------ | ------ |
| Deposit NFT  | ~152k    | <165k  | ✅     |
| Withdraw NFT | ~75k     | <120k  | ✅     |
| SCC Approval | ~46k     | N/A    | ✅     |
| NFT Approval | ~24k     | N/A    | ✅     |

## 🔗 Integration Points

### Webapp Configuration Updates

```typescript
// webapp/src/app.config.ts
export const ECOSTABILIZER_CONTRACT_ADDRESS = "0x..."; // From deployment
export const SCC_CONTRACT_ADDRESS = "0x..."; // From deployment
```

### Contract Interaction Examples

```typescript
// Deposit NFT to vault
const tx = await ecoStabilizer.deposit(tokenId);
await tx.wait();

// Check vault status
const loan = await ecoStabilizer.loans(tokenId);
const isActive = loan.active;

// Withdraw NFT from vault
await scc.approve(ecoStabilizer.address, parseEther("20"));
const tx2 = await ecoStabilizer.withdraw(tokenId);
await tx2.wait();
```

## 📞 Support & Troubleshooting

### Common Issues

1. **Deployment Fails**: Check environment variables and network connectivity
2. **Role Assignment Error**: Verify MINTER_ROLE grant before renunciation
3. **Gas Estimation Error**: Increase gas limit or check Base network status
4. **Verification Failed**: Ensure BaseScan API key is valid

### Debug Commands

```bash
# Check deployment status
npx hardhat run scripts/debug-deployment.js --network base-mainnet

# Verify contract bytecode
npx hardhat verify --network base-mainnet <CONTRACT_ADDRESS>

# Test contract interaction
npx hardhat run scripts/test-interaction.js --network base-mainnet
```

### Resources

- **Base Documentation**: https://docs.base.org
- **BaseScan Explorer**: https://basescan.org
- **Hardhat Documentation**: https://hardhat.org/docs
- **OpenZeppelin Contracts**: https://docs.openzeppelin.com/contracts

---

## 📋 Production Deployment Checklist

### Pre-Deployment Validation

- [ ] **Tests**: All 173 tests passing
- [ ] **Coverage**: Run `npm run coverage` and verify >90%
- [ ] **Gas targets**: Deposit <165k, Withdraw <120k verified
- [ ] **Webapp build**: `cd webapp && npm run build` succeeds
- [ ] **Lint checks**: `npm run lint` shows no errors
- [ ] **Audit**: Security audit completed (if applicable)

### Deployment Environment

- [ ] **Deployer wallet**: Has at least 0.01 ETH for gas
- [ ] **Hardware wallet**: Consider using for production deployment
- [ ] **Environment variables**: All required vars set in `.env`
- [ ] **Network selection**: Confirmed targeting Base mainnet (chainId: 8453)
- [ ] **AstaVerde address**: Verified correct Phase 1 contract address

### Post-Deployment Verification

#### Contract Verification
- [ ] **SCC deployed**: Address saved and verified on BaseScan
- [ ] **EcoStabilizer deployed**: Address saved and verified on BaseScan
- [ ] **Role configuration**: Vault has exclusive MINTER_ROLE on SCC
- [ ] **Admin roles**: Deployer admin roles properly renounced
- [ ] **Pause test**: Pause functionality tested then unpaused

#### Integration Testing
- [ ] **Small deposit**: Test with minimal amount (e.g., 1 NFT)
- [ ] **SCC minting**: Verify 20 SCC minted per deposit
- [ ] **Withdraw flow**: Complete withdrawal successfully
- [ ] **Gas costs**: Actual costs match expectations
- [ ] **Redeemed check**: Verify redeemed NFTs cannot be deposited

#### Webapp Configuration
- [ ] **Update addresses**: Add deployed addresses to `webapp/.env.local`
- [ ] **Rebuild webapp**: `cd webapp && npm run build`
- [ ] **Deploy webapp**: Update production webapp deployment
- [ ] **Test connection**: Verify webapp connects to new contracts

### Security Checklist

- [ ] **Access control**: No unauthorized MINTER_ROLE holders
- [ ] **Reentrancy**: Protection confirmed active
- [ ] **Supply cap**: MAX_SUPPLY enforcement verified
- [ ] **Emergency functions**: adminSweepNFT tested
- [ ] **Event monitoring**: Deposit/Withdraw events tracked

### Documentation Updates

- [ ] **README.md**: Update with mainnet addresses
- [ ] **Contract addresses**: Document all deployed addresses
- [ ] **Transaction hashes**: Save deployment tx hashes
- [ ] **Gas costs**: Document actual mainnet gas usage
- [ ] **User guide**: Create/update vault operation guide

### Liquidity & Market Setup (External)

- [ ] **DEX pool**: SCC/USDC pool deployed on Uniswap/Aerodrome
- [ ] **Initial liquidity**: $10-20k minimum seeded
- [ ] **Price monitoring**: Tracking tools configured
- [ ] **Arbitrage**: Bots configured if needed

### Final Verification

- [ ] **End-to-end test**: Complete user flow on mainnet
- [ ] **Mobile wallets**: Test with MetaMask Mobile, Coinbase Wallet
- [ ] **Error handling**: Verify user-friendly error messages
- [ ] **Loading states**: Confirm proper UI feedback
- [ ] **Multi-browser**: Test on Chrome, Firefox, Safari

### Emergency Preparedness

- [ ] **Pause capability**: Ensure pause function accessible
- [ ] **Contact list**: Technical support contacts documented
- [ ] **Rollback plan**: Document contingency procedures
- [ ] **Monitoring alerts**: Configure for critical events

---

**⚠️ Security Reminder**: Always verify contract addresses and test thoroughly on Sepolia before mainnet deployment. The EcoStabilizer system is immutable once deployed.

**💡 Pro Tips**:
- Use hardware wallet for deployment
- Save all deployment artifacts securely
- Consider time-delayed announcement
- Have support team ready for launch
