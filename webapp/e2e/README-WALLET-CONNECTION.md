# E2E Wallet Connection Testing

## Overview

This document describes the two-tier approach for testing wallet-connected functionality in E2E tests.

## Tier 1: Fast Dev Lane (Mock Connection)

For rapid development and CI testing without real wallet overhead.

### Setup

1. **Added E2E Event Listener** (`src/contexts/WalletContext.tsx`):
   - Listens for `e2e-connect` event to trigger wallet connection
   - No MetaMask required

2. **Mock Connector** (`src/lib/mock-connector.ts`):
   - Provides simulated wallet functionality
   - Returns hardhat account #0 by default
   - Handles basic eth methods

3. **Wagmi Config** (`src/config/wagmi.ts`):
   - Detects E2E mode via URL param or localStorage
   - Injects mock connector when in E2E mode

4. **Test Helpers** (`e2e/helpers/mock-wallet-connection.ts`):
   - `setupAndConnectWallet()` - Complete setup and connection
   - `getUSDCBalance()` - Read balance from UI
   - `waitForWalletConnection()` - Wait for connection state

### Usage

```typescript
import { test, expect } from "@playwright/test";
import { setupAndConnectWallet, getUSDCBalance } from "../helpers/mock-wallet-connection";

test("user can view balance when connected", async ({ page }) => {
  // Connect mock wallet
  await setupAndConnectWallet(page);

  // Verify connection
  const balance = await getUSDCBalance(page);
  expect(balance).toBeDefined();

  // Navigate while connected
  await page.click('text="My Eco Assets"');
  await expect(page).toHaveURL(/.*\/mytokens/);
});
```

### What Works

- ✅ Connection state UI
- ✅ Balance display
- ✅ Navigation guards
- ✅ Read-only blockchain queries
- ✅ Component conditional rendering

### Limitations

- ❌ Real transaction signing
- ❌ Approval flows
- ❌ Gas estimation
- ❌ Network switching

## Tier 2: Real Wallet Lane (Synpress)

For comprehensive wallet testing with MetaMask.

### Requirements

- Node.js v18 (Synpress v3 compatibility)
- Separate CI job/environment

### Setup

1. **Synpress Config** (`e2e/synpress/cypress.config.js`):
   - MetaMask extension loading
   - Private key import
   - Network configuration

2. **Test Structure** (`e2e/tests/wallet/`):
   - Purchase flows
   - Vault operations
   - Approval management

### Usage

```javascript
// e2e/tests/wallet/01-purchase.wallet.spec.ts
describe("NFT Purchase with MetaMask", () => {
  it("should complete purchase flow", () => {
    cy.setupMetamask(PRIVATE_KEY, "localhost", true);
    cy.visit("http://localhost:3000");
    cy.acceptMetamaskAccess();

    // Purchase flow
    cy.get('[data-testid="buy-button"]').click();
    cy.confirmMetamaskTransaction();

    // Verify ownership
    cy.get('[data-testid="my-tokens"]').should("contain", "Batch #1");
  });
});
```

### What Works

- ✅ Real MetaMask interaction
- ✅ Transaction signing
- ✅ Approval flows
- ✅ Gas handling
- ✅ Multi-step workflows

## CI Configuration

```yaml
# .github/workflows/e2e.yml
jobs:
  e2e-fast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm run test:e2e:mock

  e2e-wallet:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 18 # Required for Synpress v3
      - run: npm run test:e2e:wallet
```

## Test Organization

```
webapp/e2e/
├── tests/
│   ├── 00-smoke.spec.ts              # Basic app loading
│   ├── 01-marketplace.spec.ts        # Mock wallet connection
│   ├── 01-marketplace-connected.spec.ts  # NEW: Mock connection tests
│   ├── 02-vault.spec.ts              # Vault UI tests
│   └── wallet/                       # Real wallet tests
│       ├── 01-purchase.wallet.spec.ts
│       └── 02-vault.wallet.spec.ts
├── helpers/
│   ├── mock-wallet-connection.ts     # NEW: Mock helpers
│   └── wallet-helpers.ts             # Existing helpers
└── fixtures/
    └── wallet-fixture.ts             # Wallet test fixtures
```

## Running Tests

### Mock Connection Tests (Fast)

```bash
# Start environment
npm run dev

# Run mock wallet tests
cd webapp
npx playwright test e2e/tests/*-connected.spec.ts

# Or all non-wallet tests
npx playwright test --grep-invert wallet
```

### Real Wallet Tests (Node 18)

```bash
# In Node 18 environment
nvm use 18
npm run dev

# Run wallet tests
cd webapp
npm install --save-dev @synthetixio/synpress@^3.7.3
npx synpress run
```

## Best Practices

1. **Use Mock for CI**: Default to mock connection for speed
2. **Real Wallet for Critical Paths**: Test purchase/vault with real MetaMask
3. **Stable Selectors**: Use data-testid attributes
4. **Skip Onboarding**: Always set `skipOnboarding` in tests
5. **Wait for Connection**: Use helpers to ensure wallet is connected

## Troubleshooting

### Mock Connection Not Working

- Ensure `e2e-mode` is set in localStorage
- Check that wagmi config includes mock connector
- Verify e2e-connect event listener is present

### Real Wallet Tests Failing

- Use Node.js v18 for Synpress v3
- Import correct private keys
- Ensure hardhat node is running
- Check MetaMask is on correct network

## Future Improvements

1. **Synpress v4 Migration**: When stable, migrate to v4 for Node 22 support
2. **Mock Transaction Support**: Add transaction simulation to mock connector
3. **Network Switching**: Mock multi-chain scenarios
4. **Error Testing**: Simulate wallet errors and rejections
