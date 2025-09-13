# QA Environment Guide

This guide shows how to quickly spin up different testing environments for manual and automated QA.

## 🚀 One-Command Solutions

### For Manual QA Testing (Human Testers)

```bash
npm run dev
```

**What it does:**

- ✅ Starts Hardhat node
- ✅ Deploys all contracts (AstaVerde, USDC, SCC, EcoStabilizer)
- ✅ Seeds realistic test data
- ✅ Configures webapp with contract addresses
- ✅ Starts webapp on http://localhost:3000
- ✅ Provides test accounts with 50k USDC each

**Ready for testing:**

- NFT marketplace with batches ready to purchase
- Vault system for collateralizing NFTs
- Pre-configured test scenarios (Alice owns NFT, Bob has redeemed NFT)
- MetaMask integration with test accounts

### For Automated QA (Claude Code)

```bash
npm run qa:fast        # 450ms - Critical path validation
npm run qa:status      # 400ms - Health check only
npm run qa:full        # 30s - Complete analysis
```

## 📋 Testing Scenarios

### Basic Marketplace

```bash
npm run dev:basic
```

- Simple marketplace testing
- 1 batch with 3 NFTs ready for purchase
- Clean slate for basic functionality testing

### Active Marketplace

```bash
npm run dev:marketplace
```

- Multiple batches in different states
- Some NFTs already sold
- Some NFTs redeemed
- Various user states for edge case testing

### Vault Testing

```bash
npm run dev:vault
```

- Alice: Has 20 SCC from vault deposit
- Bob: Owns NFT ready for vault deposit
- Charlie: Owns redeemed NFT (should be rejected)
- Perfect for testing vault functionality and security

### Complete Testing

```bash
npm run dev:local
```

- All scenarios combined
- Maximum test data variety
- Full system integration testing

## 🔑 Test Accounts (Import into MetaMask)

All accounts have 50,000 USDC for testing.

**Alice:** `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`

- Private Key: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
- Usually owns NFTs / SCC for testing

**Bob:** `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`

- Private Key: `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`
- Often has redeemed NFTs for rejection testing

**Charlie:** `0x90F79bf6EB2c4f870365E785982E1f101E93b906`

- Private Key: `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6`
- Fresh account with USDC, ready for any testing

## 🌐 MetaMask Setup

1. **Add Local Network:**
    - Network Name: `Localhost 8545`
    - RPC URL: `http://localhost:8545`
    - Chain ID: `31337`
    - Currency Symbol: `ETH`

2. **Import Test Account:**
    - Copy any private key above
    - Import into MetaMask
    - Switch to the localhost network

3. **Start Testing!**
    - Visit http://localhost:3000
    - Connect MetaMask wallet
    - Test marketplace and vault features

## 🧪 What You Can Test

### Phase 1 - NFT Marketplace

- ✅ Browse available NFT batches
- ✅ Check pricing (Dutch auction mechanics)
- ✅ Purchase NFTs with USDC
- ✅ View owned NFTs in "My Eco Assets"
- ✅ Redeem NFTs for carbon credits

### Phase 2 - Vault System

- ✅ Deposit NFTs to vault (get 20 SCC each)
- ✅ Withdraw NFTs from vault (burn 20 SCC)
- ✅ Transfer SCC between accounts
- ✅ Test security: Redeemed NFTs rejected by vault

### Integration Testing

- ✅ Multi-user workflows
- ✅ Cross-feature interactions
- ✅ Error handling and edge cases

## ⚡ Quick Commands Reference

```bash
# ONE-COMMAND FULL ENVIRONMENT
npm run dev                # Complete setup: contracts + webapp + data

# QUICK VALIDATION
npm run qa:fast            # 450ms critical path test
npm run qa:status          # 400ms health check

# SCENARIO-SPECIFIC SETUPS
npm run dev:basic          # Basic marketplace
npm run dev:vault          # Vault testing focus
npm run dev:local          # Local full stack

# AUTOMATED TESTING
npm run qa:full            # Comprehensive analysis
npm run test               # Contract unit tests
```

## 🛑 Stopping the Environment

Press `Ctrl+C` to stop all processes (Hardhat node + webapp).

## 🔍 Troubleshooting

**Webapp won't connect?**

- Check MetaMask is on localhost:8545, Chain ID 31337
- Refresh webapp page
- Try switching MetaMask accounts

**Transactions failing?**

- Check account has USDC balance
- Verify NFT ownership
- Reset MetaMask account (Settings → Advanced → Reset Account)

**Environment won't start?**

- Kill any existing processes: `pkill -f hardhat`
- Restart: `npm run dev`

## 📊 Performance Expectations

| Command             | Time    | Use Case               |
| ------------------- | ------- | ---------------------- |
| `npm run qa:status` | ~400ms  | Quick health check     |
| `npm run qa:fast`   | ~450ms  | Critical functionality |
| `npm run dev`       | ~10-15s | Full environment setup |
| `npm run qa:full`   | ~30s    | Complete analysis      |

The QA environment is optimized for rapid iteration and comprehensive manual testing!
