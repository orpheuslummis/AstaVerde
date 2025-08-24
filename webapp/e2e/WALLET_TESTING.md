# Wallet Testing Guide

## Overview

This guide explains how to run wallet tests for the AstaVerde platform using Synpress v3 with Cypress and MetaMask.

## Architecture

We use a **hybrid testing approach**:

- **Playwright**: For all non-wallet tests (fast, parallel execution)
- **Synpress v3 (Cypress)**: For wallet-specific tests (stable MetaMask integration)

## Prerequisites

1. **Node.js**: Version 18.x LTS recommended for best stability
2. **Local Blockchain**: Hardhat node running on port 8545
3. **Webapp**: Next.js app running on port 3000
4. **Funded Test Wallet**: Test accounts with ETH and USDC

## Setup

### 1. Start Local Environment

```bash
# Terminal 1: Start Hardhat node
npx hardhat node --no-deploy

# Terminal 2: Deploy contracts and seed data
npx hardhat deploy --network localhost
SCENARIO=complete npx hardhat run scripts/dev-environment.js --network localhost

# Terminal 3: Start webapp
npm run dev
```

### 2. Install Dependencies

```bash
# Install Cypress and Synpress v3
npm install --save-dev @synthetixio/synpress@^3.7.2 cypress@^12.17.0
```

## Running Tests

### Quick Commands

```bash
# Run all wallet tests (headless)
npm run test:wallet

# Open Cypress UI for interactive testing
npm run test:wallet:open

# Run specific test suites
npm run test:wallet:connect   # Connection tests only
npm run test:wallet:purchase  # Purchase flow tests
npm run test:wallet:vault     # Vault operation tests

# Run all tests (Playwright + Synpress)
npm run test:all
```

### Manual Testing

1. Open Cypress UI:

   ```bash
   npm run test:wallet:open
   ```

2. Select a test file to run
3. Watch tests execute in real-time
4. Debug failures interactively

## Test Structure

```
e2e/
├── synpress/                    # Wallet tests (Synpress v3)
│   ├── cypress.config.js        # Cypress configuration
│   ├── support/
│   │   ├── e2e.js              # Test setup
│   │   └── commands.js         # Custom commands
│   └── specs/
│       ├── wallet-connect.cy.js # Connection tests
│       ├── purchase.cy.js       # Purchase flow tests
│       └── vault.cy.js          # Vault operations
├── tests/                       # Non-wallet tests (Playwright)
│   ├── 00-smoke.spec.ts
│   ├── 01-marketplace.spec.ts
│   └── ...
└── helpers/
    └── modal-bypass.ts          # Modal bypass helper
```

## Key Features

### Modal Bypass

The onboarding modal is automatically bypassed in test environments:

- Sets `localStorage.skipOnboarding = 'true'`
- Modal component checks for this flag
- No manual dismissal needed

### Test Wallet

Uses Hardhat's default test wallet:

- Seed: `test test test test test test test test test test test junk`
- Address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- Pre-funded with ETH and USDC

### Custom Commands

- `cy.connectWallet()` - Connects MetaMask to dapp
- `cy.getUSDCBalance()` - Gets USDC balance from UI
- `cy.getSCCBalance()` - Gets SCC balance from UI
- `cy.purchaseNFT(quantity)` - Purchases NFTs

## Troubleshooting

### Common Issues

1. **"MetaMask not found"**
   - Ensure Cypress is running with Synpress plugins
   - Check `cypress.config.js` includes synpress setup

2. **"Transaction failed"**
   - Verify Hardhat node is running
   - Check test wallet has sufficient USDC
   - Ensure contracts are deployed

3. **"Modal blocking clicks"**
   - Verify `OnboardingModal.tsx` has test bypass
   - Check localStorage is set correctly
   - Try manual dismissal as fallback

4. **"Tests timeout"**
   - Increase timeouts in `cypress.config.js`
   - Check network connection to local node
   - Verify webapp is running

### Debug Mode

Enable debug output:

```bash
# Set debug environment variable
DEBUG=synpress:* npm run test:wallet

# Or use Cypress UI for visual debugging
npm run test:wallet:open
```

### Clean State

Reset test environment:

```bash
# Stop all processes
pkill -f hardhat
pkill -f next

# Clear test data
rm -rf .cache-synpress
rm -rf cypress/screenshots
rm -rf cypress/videos

# Restart environment
npm run dev  # In project root
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Install browsers
        run: npx playwright install chromium

      - name: Run Playwright tests
        run: npm run test:e2e

      - name: Run wallet tests (optional)
        if: github.ref == 'refs/heads/main'
        run: |
          npm run dev &
          sleep 10
          npm run test:wallet
```

## Best Practices

1. **Keep wallet tests minimal** - Only test what requires real MetaMask
2. **Use mocks for most tests** - Faster and more reliable
3. **Run wallet tests locally** - Before pushing to CI
4. **Monitor gas usage** - Ensure sufficient ETH for transactions
5. **Clean state between runs** - Prevent test pollution

## Migration Notes

### From Synpress v4 to v3

We migrated from v4 (alpha) to v3 (stable) because:

- v4 cache building was hanging
- MetaMask extension wasn't loading properly
- v3 is production-tested and reliable

Key differences:

- v3 uses Cypress (not Playwright)
- Different command syntax
- No cache mechanism (simpler setup)

### Future: Back to v4

When Synpress v4 becomes stable:

1. Update dependency to v4
2. Migrate test syntax
3. Implement cache mechanism
4. Update CI/CD pipeline

## Support

For issues or questions:

- Check the [Synpress documentation](https://github.com/Synthetixio/synpress)
- Review test examples in `e2e/synpress/specs/`
- Run tests with debug output for more details
