# Testing Guide

Comprehensive testing guide for AstaVerde - covering automated tests, local QA, and webapp testing.

## 🚀 Quick Start

### One-Command Testing Solutions

```bash
# Complete local dev environment (contracts + webapp + test data)
npm run dev

# Fast QA testing (~450ms)
npm run qa:fast

# Full test suite
npm run test

# Coverage analysis
npm run coverage
```

## 📊 Test Coverage Status

**173/173 tests passing** covering:

- ✅ Contract logic: deposit, withdraw, redemption, access control
- ✅ Security: reentrancy, redeemed NFT rejection, role management
- ✅ Gas optimization: deposit <165k, withdraw <120k
- ✅ Edge cases: insufficient funds, zero amounts, invalid inputs
- ✅ Phase 1↔2 integration: marketplace + vault interactions

## 🧪 Testing Environments

### 1. Local Development (`npm run dev`)

Provides complete environment with:

- Local Hardhat node
- Deployed contracts
- Funded test accounts
- Mock IPFS data
- Test NFTs and scenarios

**Test Scenarios Available:**

- `npm run dev:basic` - Simple marketplace with few tokens
- `npm run dev:marketplace` - Active marketplace simulation
- `npm run dev:vault` - Vault testing with deposits/withdrawals
- `npm run dev:complete` - All scenarios combined

### 2. Quick QA Scripts

```bash
# Ultra-fast system health check (~400ms)
npm run qa:status

# Fast critical path testing (~450ms)
npm run qa:fast

# Comprehensive testing with reports
npm run qa:full
```

### 3. Manual Testing Pages

Access these pages when running `npm run dev`:

- `http://localhost:3001/` - Main marketplace
- `http://localhost:3001/mytokens` - Token management & vault
- `http://localhost:3001/test-vault` - Vault testing interface
- `http://localhost:3001/debug-approve` - Approval debugging
- `http://localhost:3001/admin` - Admin functions

## 🔍 Webapp Testing Focus

### What Needs Manual Testing

Since contracts are thoroughly tested (173 passing tests), focus webapp testing on:

#### 1. User Flows

- **Wallet Connection**: MetaMask, WalletConnect, Coinbase
- **NFT Purchase**: Browse → Select → Approve USDC → Buy → Confirm
- **Vault Operations**: Deposit NFT → Receive SCC → Withdraw
- **Multi-tab Behavior**: State sync across browser tabs

#### 2. Edge Cases to Test

- Insufficient USDC balance
- Rejected transactions
- Network switching mid-flow
- Browser refresh during transactions
- Mobile responsiveness

#### 3. Visual/UX Testing

- Loading states during transactions
- Error message clarity
- Transaction feedback
- Mobile layout
- Dark mode (if implemented)

### Testing Checklist

#### Pre-Transaction

- [ ] Wallet connects successfully
- [ ] Correct network displayed
- [ ] Balances update correctly
- [ ] Gas estimates shown

#### During Transaction

- [ ] Loading indicators appear
- [ ] Can't double-submit
- [ ] Clear status messages
- [ ] Transaction hash displayed

#### Post-Transaction

- [ ] Success confirmation
- [ ] Balances update
- [ ] UI reflects new state
- [ ] Can continue with next action

#### Error Handling

- [ ] User rejection handled gracefully
- [ ] Network errors show clear message
- [ ] Insufficient funds message helpful
- [ ] Recovery actions available

## 🛠️ Test Data Setup

### Quick Test Data

```bash
# Fund all test accounts with USDC and ETH
npm run task:fund-all

# Mint test NFT batches
npm run task:mint:local

# Setup vault test scenarios
node scripts/setup-vault-webapp.js
```

### Test Accounts (Local)

```javascript
// Available test accounts (all funded in dev mode)
const TEST_ACCOUNTS = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Account 0 (Admin)
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Account 1
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Account 2
    // ... up to Account 19
];
```

## 🔧 Debugging Tools

### Console Commands

When webapp is running, use browser console:

```javascript
// Check wallet connection
await ethereum.request({ method: "eth_accounts" });

// Get current network
await ethereum.request({ method: "eth_chainId" });

// Check contract deployment
await ethereum.request({
    method: "eth_getCode",
    params: ["0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", "latest"],
});
```

### Useful Scripts

```bash
# Verify contract state
node scripts/verify-vault.js

# Debug approval issues
node scripts/debug-approve.js

# Reset vault to clean state
node scripts/reset-vault-state.js
```

## 📈 Performance Benchmarks

### Contract Gas Usage

- **Mint Batch**: ~450k gas
- **Buy NFT**: ~235k gas
- **Deposit to Vault**: ~155k gas
- **Withdraw from Vault**: ~76k gas
- **Full Workflow**: ~525k gas

### Webapp Performance

- Initial Load: < 2s
- Wallet Connection: < 1s
- Transaction Confirmation: Network dependent (3-5s on local)
- State Updates: Immediate on local

## 🐛 Common Issues & Solutions

### Issue: "Cannot read properties of undefined"

**Solution**: Ensure wallet is connected and on correct network

### Issue: "Insufficient funds"

**Solution**: Run `npm run task:fund-all` to fund test accounts

### Issue: "Transaction reverted"

**Solution**: Check contract state with `verify-vault.js`, might need to unpause

### Issue: "IPFS timeout"

**Solution**: Local dev uses mock data, no IPFS needed

### Issue: "Gas estimation failed"

**Solution**: Usually indicates the transaction will fail, check requirements

## 🔄 Continuous Integration

### GitHub Actions Workflow

```yaml
- Run on every PR
- Execute full test suite
- Check gas benchmarks
- Verify compilation
- Run linting
```

### Pre-commit Checks

```bash
npm run lint          # Solidity + TypeScript linting
npm run prettier:check # Code formatting
npm run test          # Full test suite
npm run build:all     # Verify builds
```

## 📝 Writing New Tests

### Contract Tests (Hardhat)

Place in `test/` directory:

```typescript
describe("Feature", function () {
    it("should behave correctly", async function () {
        // Test implementation
    });
});
```

### E2E Tests (Synpress)

Place in `webapp/e2e/synpress/specs/`:

```javascript
describe("User Flow", () => {
    it("completes purchase", () => {
        // E2E test
    });
});
```

## 📚 Additional Resources

- [Hardhat Testing](https://hardhat.org/tutorial/testing-contracts)
- [Wagmi Testing](https://wagmi.sh/react/guides/testing)
- [Synpress Docs](https://github.com/Synthetixio/synpress)
- [OpenZeppelin Test Helpers](https://docs.openzeppelin.com/test-helpers)
