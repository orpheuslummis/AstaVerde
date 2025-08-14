# E2E Testing

## Quick Start

```bash
# From webapp directory
./e2e-test.sh           # Run all tests with automatic setup
./e2e-test.sh --smoke   # Run smoke tests only (fast)
./e2e-test.sh --headed  # Run tests with browser visible
```

## Test Structure

```
e2e/
├── tests/
│   ├── 00-smoke.spec.ts         # Quick sanity checks (~30s)
│   ├── 01-marketplace.spec.ts   # NFT marketplace & Dutch auction
│   ├── 02-vault.spec.ts         # Vault deposit/withdraw operations
│   ├── 03-user-journey.spec.ts  # Complete end-to-end flows
│   ├── 04-error-handling.spec.ts # Error scenarios & edge cases
│   └── 05-contract-features.spec.ts # Contract-specific features
├── fixtures/                     # Test helpers and data
├── e2e-test.sh                  # Automated test runner
└── README.md                    # This file
```

## Manual Test Execution

If you need more control:

```bash
# 1. Start local blockchain
cd .. && npx hardhat node

# 2. Deploy contracts
npx hardhat deploy --network localhost

# 3. Seed test data
npx hardhat run scripts/test-seed.js --network localhost

# 4. Start webapp
cd webapp && npm run dev

# 5. Run tests
npm run test:e2e
```

## Writing Tests

Tests use Playwright with these patterns:

```typescript
// Use data-testid for reliable selectors
await page.locator('[data-testid="batch-card"]').click();

// Wait for data to load
await page.waitForLoadState("networkidle");

// Handle dynamic content
await expect(page.locator(".batch-card")).toBeVisible({ timeout: 10000 });
```

## Key Components with Test IDs

- `data-testid="batch-card"` - Marketplace batch cards
- `data-testid="buy-button"` - Purchase buttons
- `data-testid="quantity-slider"` - Quantity selectors
- `data-testid="vault-card"` - Vault operations
- `data-testid="deposit-button"` - Vault deposit
- `data-testid="withdraw-button"` - Vault withdraw

## Troubleshooting

**Tests fail with "Connection refused"**

- Ensure local blockchain is running: `npx hardhat node`
- Check webapp is on port 3000: `lsof -i:3000`

**"No batches available" in tests**

- Run seed script: `npx hardhat run scripts/test-seed.js --network localhost`
- Check deployment: `npx hardhat deploy --network localhost`

**Tests timeout**

- Increase timeout in `playwright.config.ts`
- Check network tab in headed mode: `./e2e-test.sh --headed`

**Flaky tests**

- Tests retry once automatically
- Use `waitForLoadState('networkidle')` after navigation
- Add explicit waits for dynamic content

## CI/CD

Tests run automatically on:

- Push to main/develop branches
- Pull requests
- Manual workflow dispatch

GitHub Actions workflow handles full environment setup.

## Maintenance

- Keep tests focused on user flows, not implementation details
- Update data-testid attributes when UI changes
- Run smoke tests frequently during development
- Full suite before merging PRs
