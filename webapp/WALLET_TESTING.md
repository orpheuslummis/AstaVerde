# Wallet Testing Guide

## Overview

This guide explains how to run wallet-connected E2E tests using Synpress and MetaMask for the AstaVerde webapp.

## Prerequisites

1. **Node.js** 18+ installed
2. **Chrome/Chromium** browser
3. **Local blockchain** (Hardhat)
4. **Test USDC** funded to test accounts

## Quick Start

```bash
# Run all wallet tests
npm run test:wallet

# Run specific test suites
npm run test:wallet:purchase   # NFT purchase tests
npm run test:wallet:vault      # Vault operation tests
npm run test:wallet:journey    # Complete user journey

# Debug mode (shows browser)
npm run test:wallet:debug
```

## Test Structure

```
e2e/tests/wallet/
├── 01-purchase.wallet.spec.ts  # NFT purchase with USDC
├── 02-vault.wallet.spec.ts     # Deposit/withdraw operations
└── 03-journey.wallet.spec.ts   # Full user journey
```

## What Gets Tested

### Purchase Flow (01-purchase.wallet.spec.ts)

- ✅ Wallet connection via ConnectKit
- ✅ USDC balance display
- ✅ Single NFT purchase with USDC approval
- ✅ Bulk NFT purchase (3+ tokens)
- ✅ Batch availability updates after purchase

### Vault Operations (02-vault.wallet.spec.ts)

- ✅ NFT deposit with SetApprovalForAll
- ✅ Receive exactly 20 SCC per NFT
- ✅ Withdraw NFT by repaying 20 SCC
- ✅ Redeemed NFT rejection
- ✅ Vault statistics accuracy

### Complete Journey (03-journey.wallet.spec.ts)

- ✅ Connect wallet → Purchase NFT → Deposit to vault → Withdraw
- ✅ All balances update correctly
- ✅ State consistency throughout

## Test Wallets

The tests use Hardhat's default test accounts:

```javascript
// Account 1 (Primary)
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

// Account 2 (Alice)
Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

// Account 3 (Bob)
Address: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

## How It Works

1. **MetaMask Setup**: Tests automatically configure MetaMask with test seed phrase
2. **Network Config**: Adds localhost:8545 as a custom network
3. **Auto-approval**: Handles all MetaMask popups programmatically
4. **Transaction Waiting**: Properly waits for blockchain confirmations

## Environment Setup

The test runner (`run-wallet-tests.sh`) automatically:

1. Starts Hardhat node if not running
2. Deploys contracts
3. Funds test accounts with USDC
4. Seeds marketplace with test batches
5. Starts webapp dev server
6. Runs tests with MetaMask

## Troubleshooting

### Tests fail with "MetaMask not found"

- Ensure Synpress is built: `npm run synpress:build`
- Check Chrome is installed: `npx playwright install chromium`

### Wallet doesn't connect

- Clear MetaMask extension data
- Restart test with fresh browser context
- Check localhost:8545 is accessible

### Transactions fail

- Ensure test accounts have ETH for gas
- Check USDC is funded to test accounts
- Verify contracts are deployed

### Slow test execution

- MetaMask automation requires headed mode (can't run headless)
- Each transaction needs block confirmation (~3-5 seconds)
- Total test suite takes ~5-10 minutes

## CI/CD Integration

For CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Setup
  run: |
    npm ci
    npx playwright install chromium
    npm run synpress:build

- name: Start services
  run: |
    npx hardhat node &
    npm run dev &
    sleep 10

- name: Deploy and seed
  run: |
    npx hardhat deploy --network localhost
    npx hardhat run scripts/dev-environment.js --network localhost

- name: Run wallet tests
  run: npm run test:wallet
  env:
    HEADLESS: false # MetaMask requires headed mode
```

## Advanced Configuration

### Custom Test Wallet

Edit `test/wallet-setup/wallet.setup.ts`:

```typescript
const SEED_PHRASE = "your twelve word seed phrase here";
const PASSWORD = "YourPassword123!";
```

### Different Network

Edit network configuration:

```typescript
await metamask.addNetwork({
  name: "Base Sepolia",
  rpcUrl: "https://sepolia.base.org",
  chainId: 84532,
  symbol: "ETH",
});
```

### Test Timeouts

Adjust in `synpress.config.ts`:

```typescript
timeout: 180000, // 3 minutes per test
actionTimeout: 60000, // 1 minute per action
```

## Best Practices

1. **Reset State**: Each test should be independent
2. **Wait Properly**: Use proper waits for transactions
3. **Handle Popups**: Always handle MetaMask popups
4. **Check Balances**: Verify balance changes after transactions
5. **Clean Up**: Tests should clean up their state

## Current Limitations

- Cannot run in headless mode (MetaMask requirement)
- Single test at a time (blockchain state consistency)
- Slower than regular E2E tests (blockchain confirmations)
- Requires manual MetaMask extension management

## Future Improvements

- [ ] Mock wallet provider for faster CI tests
- [ ] Parallel test execution with isolated blockchain forks
- [ ] Better error recovery and retry logic
- [ ] Screenshot capture on failures
- [ ] Performance metrics collection
