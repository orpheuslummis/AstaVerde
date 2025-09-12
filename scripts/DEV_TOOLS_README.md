# Developer Tools Documentation

## 🚀 Quick Reference

### Essential Commands

```bash
npm run dev              # Start everything (recommended)
npm run dev:mint 3       # Mint 3 new NFTs
npm run dev:balances     # Check all account balances
npm run dev:test-flow    # Run automated test flow
npm run dev:dashboard    # Open visual dashboard
```

## 📁 New Files Created

### 1. Environment Configuration

**File:** `.env.development`

- Consolidated all environment variables
- Includes contract addresses, test accounts, and config
- Auto-referenced by dev scripts

### 2. Balance Checker

**File:** `scripts/check-balances.js`
**Command:** `npm run dev:balances`

- Shows ETH, USDC, SCC, and NFT balances
- For all 5 test accounts
- Color-coded output for easy reading

### 3. Local Minting Script

**File:** `scripts/mint-local-batch.js`
**Command:** `npm run dev:mint [count]`

- Simple minting without complex configuration
- Defaults to 3 tokens if count not specified
- Uses hardcoded local addresses

### 4. Automated Test Flow

**File:** `scripts/test-user-flow.js`
**Command:** `npm run dev:test-flow`

- Complete user journey test
- Buy NFT → Deposit to Vault → Withdraw → Redeem
- Detailed step-by-step output
- Automatic error handling

### 5. Dev Dashboard

**File:** `scripts/dev-dashboard.html`
**Command:** `npm run dev:dashboard`

- Visual dashboard in browser
- Shows network status, contracts, balances
- Quick action buttons
- Real-time updates

## 🎯 Usage Examples

### Start Development

```bash
# One command to rule them all
npm run dev
```

### Mint More NFTs

```bash
# Mint 5 new tokens
npm run dev:mint 5

# Or use the simple script directly
node scripts/mint-local-batch.js 10
```

### Check System State

```bash
# View all balances
npm run dev:balances

# Quick system check
npm run qa:status
```

### Test User Flows

```bash
# Run automated test
npm run dev:test-flow

# This will:
# 1. Buy an NFT
# 2. Deposit to vault
# 3. Receive SCC
# 4. Withdraw from vault
# 5. Redeem the token
```

### Visual Dashboard

```bash
# Open in browser
npm run dev:dashboard

# Features:
# - Network status
# - Contract addresses
# - Account balances
# - Quick actions
# - Console output
```

## 🔧 Configuration

All configuration is in `.env.development`:

- Contract addresses (deterministic)
- Test account addresses and private keys
- Network settings
- Default values for testing

## 🧪 Test Accounts

| Name     | Address                                    | Initial Balance       |
| -------- | ------------------------------------------ | --------------------- |
| Deployer | 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 | 10,000 ETH, 100k USDC |
| Alice    | 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 | 10,000 ETH, 100k USDC |
| Bob      | 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC | 10,000 ETH, 100k USDC |
| Charlie  | 0x90F79bf6EB2c4f870365E785982E1f101E93b906 | 10,000 ETH, 100k USDC |
| Dave     | 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 | 10,000 ETH, 0 USDC    |

## 📊 Contract Addresses (Local)

| Contract      | Address                                    |
| ------------- | ------------------------------------------ |
| AstaVerde     | 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 |
| USDC          | 0x5FbDB2315678afecb367f032d93F642f64180aa3 |
| EcoStabilizer | 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9 |
| SCC           | 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 |

## 🎨 Features

### Phase 1 - Marketplace

- Dutch auction pricing
- Batch minting and purchasing
- Token redemption
- Producer payments

### Phase 2 - Vault System

- Deposit NFTs as collateral
- Receive 20 SCC per NFT
- Withdraw by repaying SCC
- No liquidation risk

## 🐛 Troubleshooting

### "Contract not found" errors

Run `npm run dev` to ensure contracts are deployed

### MetaMask issues

1. Add Custom Network: localhost:8545, Chain ID 31337
2. Import test account private key from `.env.development`

### Balance checker shows 0

Ensure `npm run dev` has completed initial setup

### Dashboard not updating

Check that local node is running on port 8545

## 🚦 Development Workflow

1. **Start:** `npm run dev`
2. **Mint:** `npm run dev:mint 5`
3. **Test:** `npm run dev:test-flow`
4. **Monitor:** `npm run dev:balances`
5. **Visualize:** `npm run dev:dashboard`

## ✅ Improvements Made

1. **Consolidated Environment Variables**
    - Single `.env.development` file
    - All addresses and keys in one place

2. **Simple Balance Viewer**
    - Quick command to check all accounts
    - Shows ETH, USDC, SCC, and NFTs

3. **Automated Testing**
    - Complete user flow automation
    - Step-by-step execution with logging

4. **Visual Dashboard**
    - Browser-based monitoring
    - Quick actions and real-time updates

The local development environment is now **simple, effective, and well-documented**!
