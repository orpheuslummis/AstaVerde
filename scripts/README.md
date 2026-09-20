# Scripts Documentation

This directory contains development, testing, and QA utilities for the AstaVerde project (Phase 1 + Phase 2 EcoStabilizer Vault system).

## 📋 Quick Reference

| Script                  | Purpose                                | Usage                              |
| ----------------------- | -------------------------------------- | ---------------------------------- |
| `start-local-node.js`   | Automated Hardhat node + deployment    | `node scripts/start-local-node.js` |
| `manual-qa-flows.js`    | Interactive manual testing interface   | `node scripts/manual-qa-flows.js`  |
| `qa-scenarios.js`       | Automated QA scenario validation       | `node scripts/qa-scenarios.js`     |
| `status-check.js`       | **Ultra-fast system health check**     | `npm run qa:status`                |
| `fast-qa.js`            | **Fast critical path testing**         | `npm run qa:fast`                  |
| `claude-friendly-qa.js` | **Comprehensive QA suite**             | `npm run qa:full`                  |
| `webapp-debug.js`       | **Webapp error monitoring for agents** | `node scripts/webapp-debug.js`     |

## 🚀 Local Development Setup

### Automated Node + Deployment

```bash
# Starts Hardhat node and deploys contracts automatically
node scripts/start-local-node.js
```

**What it does:**

- Starts Hardhat node on localhost:8545
- Automatically deploys contracts with test data
- Keeps running for webapp development
- Handles graceful shutdown

## 🧪 Quality Assurance Testing

### Interactive Manual Testing

```bash
# Launch interactive QA testing interface
node scripts/manual-qa-flows.js
```

**Features:**

- **Phase 1 Testing**: Create batches, buy NFTs, redeem assets
- **Phase 2 Testing**: Deposit to vault, withdraw from vault
- **Edge Case Testing**: Redeemed NFT rejection, insufficient SCC
- **Multi-user Testing**: Switch between test accounts
- **Real-time Monitoring**: View balances, NFT status, vault positions

**Test Flows Available:**

1. Create NFT Batch (Admin)
2. Buy NFTs (User)
3. Redeem NFT (Owner)
4. Deposit NFT to Vault (Get 20 SCC)
5. Withdraw NFT from Vault (Burn 20 SCC)
6. Try deposit REDEEMED NFT (Should fail)
7. View Account Balances & NFTs
8. Switch Active User

### Automated QA Scenarios

```bash
# Run comprehensive automated test scenarios
node scripts/qa-scenarios.js
```

**Scenarios Covered:**

1. **Complete Happy Path**: Buy → Vault → Withdraw → Redeem
2. **Redeemed NFT Rejection**: Validates on-chain protection
3. **Insufficient SCC Balance**: Tests withdrawal failure handling
4. **Multi-User Workflow**: Concurrent user interactions
5. **Gas Usage Validation**: Verifies <150k deposit, <120k withdraw

### Claude Code Optimized QA Suite

```bash
# Run comprehensive testing optimized for AI agent visibility
node scripts/claude-friendly-qa.js
```

**Features:**

- **Non-interactive testing** - No user input required, perfect for automated execution
- **Detailed error reporting** - Specific failure reasons with actionable insights
- **Gas usage analysis** - Validates performance targets with clear pass/fail
- **Production readiness assessment** - Clear recommendation for deployment readiness
- **Structured output** - Machine-readable results for agent processing

**Test Coverage:**

- ✅ Phase 1: Batch creation, NFT purchase, redemption workflows
- ✅ Phase 2: Vault deposit, SCC minting, withdrawal, burning workflows
- ✅ Security: Redeemed NFT rejection, access control validation
- ✅ Integration: Multi-user scenarios, SCC transfers, vault statistics
- ✅ Performance: Gas usage validation against targets (<150k deposit, <120k withdraw)

### Production Readiness Testing

The vault smoke test (`smoke_test_vault.mjs`) was archived on 2026-09-20 — see
`scripts/archive/README.md`. There is currently no replacement; use `npm run qa:full` against a local
node, and check deployed vault state with `node scripts/check-vault-state.js`.

## 📊 Event Monitoring

### Contract Event Tracking

```bash
cd scripts/events
node index.mjs
```

**Configuration (in `events/index.mjs`):**

```javascript
const chain = baseSepolia; // Base-era default: change to `sepolia` or `mainnet` before use
const fromBlock = BigInt("5282940");
const toBlock = BigInt("5282950");
```

**Monitors:**

- `TokenRedeemed` events from AstaVerde contract
- Provides human-readable timestamp and tokenId formatting

## 🛠 Legacy Development Tools

### NFT Minting Utilities

The Base-era `mint.mjs` and `testmint.mjs` were archived on 2026-09-20 — see
`scripts/archive/README.md`. Use `npm run mint:testnet` (Ethereum Sepolia) or
`npm run mint:arbitrum-testnet` instead.

### Development Helpers

```bash
# Generate random Ethereum addresses for testing
node scripts/randomethaddress.mjs
```

## 🔧 Configuration Requirements

### Environment Variables

```ini
# Deploy / helper script secrets (root .env.local)
PRIVATE_KEY=0x...
ETHEREUM_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
ETHEREUM_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
```

### Contract Addresses

No script that targets the local node hardcodes a contract address (`scripts/events/contracts.mjs` carries the
testnet and mainnet ones). `npx hardhat deploy --network localhost` (hardhat-deploy) writes
`deployments/localhost/<Contract>.json`, and every script reads from there:

- Scripts run through `npx hardhat run ... --network localhost` use `(await deployments.get("AstaVerde")).address`.
- Scripts run with plain `node` (own `JsonRpcProvider`) use `scripts/lib/addresses.js`: `deploymentAddress("AstaVerde")`
  reads the record, `assertDeployed(provider, { AstaVerde: addr })` checks the address actually has code.

Both throw instead of guessing. An `eth_call` against an address with no code returns empty data, not a revert, so a
stale address makes a balance check print 0. If the records are missing, run the deploy; if the node was restarted
without one, run it with `--reset`.

## 🌐 Webapp Development & Debugging

### Webapp Error Monitoring (Claude Code Optimized)

```bash
# Start webapp with comprehensive error logging
node scripts/webapp-debug.js

# View recent webapp logs
node scripts/webapp-debug.js logs

# Show help
node scripts/webapp-debug.js help
```

**Features:**

- **Real-time error capture** - All webapp stdout/stderr logged with timestamps
- **Intelligent error detection** - Automatically recognizes common issues
- **Actionable suggestions** - Provides specific fix recommendations
- **Claude Code visibility** - All errors visible to AI agents for debugging
- **Persistent logging** - Complete session logs saved to `webapp-debug.log`

**Auto-detected Error Patterns:**

- `Module not found` → Suggests `npm install` in webapp directory
- `EADDRINUSE :3000` → Suggests killing existing process or using different port
- `Contract not found` → Suggests running `node scripts/start-local-node.js`
- `Failed to compile` → Suggests checking TypeScript types and imports
- `RPC connection` → Suggests checking network configuration
- `Wallet not connected` → Suggests checking wallet setup

**Integration with Development:**

```bash
# Terminal 1: Start local blockchain with contracts
node scripts/start-local-node.js

# Terminal 2: Start webapp with error monitoring
node scripts/webapp-debug.js

# Terminal 3: Run QA testing
node scripts/claude-friendly-qa.js
```

## 📝 Usage Patterns

### Development Workflow

```bash
# 1. Start local environment
node scripts/start-local-node.js

# 2. In another terminal, run interactive QA
node scripts/manual-qa-flows.js

# 3. Test specific scenarios
node scripts/qa-scenarios.js
```

### Claude Code Optimized Workflow (Recommended for AI Agents)

```bash
# 1. Setup environment and run comprehensive testing
node scripts/start-local-node.js
node scripts/claude-friendly-qa.js

# 2. Start webapp with error monitoring
node scripts/webapp-debug.js

# 3. Monitor and debug issues
node scripts/webapp-debug.js logs
```

### Pre-Production Validation

```bash
# 1. Deploy to testnet
npm run deploy:testnet

# 2. Run full QA scenarios
node scripts/qa-scenarios.js

# 3. Monitor events
cd scripts/events && node index.mjs
```

## 🎯 Integration with Development Commands

These scripts integrate with the main development workflow:

```bash
# Compile contracts first (updates webapp configs)
npm run compile

# Then use scripts for testing
node scripts/start-local-node.js

# For webapp development
cd webapp && npm run dev  # Uses contracts deployed by scripts
```

## ⚠️ Important Notes

### Security

- Scripts use test keys and mock contracts for local development
- Production scripts require secure private key management
- Never commit private keys to repository

### Gas Optimization Targets

- **Deposit**: <150,000 gas (currently ~145k)
- **Withdraw**: <120,000 gas (currently ~75k)
- Scripts validate these targets automatically

### Phase 2 Requirements

Scripts validate all Phase 2 specifications:

- Only un-redeemed NFTs can be deposited
- Fixed 20 SCC per NFT issuance
- Exact NFT recovery (no liquidations)
- Proper role-based access control

## 🔍 Troubleshooting

### Common Issues

**"No deployment found for: <Name>"** (also `deployments/localhost/<Name>.json` missing)

- Run `npx hardhat deploy --network localhost` against a running node, or `node scripts/start-local-node.js`

**"<Name> has no code at 0x..."**

- The node was restarted without a redeploy; run `npx hardhat deploy --network localhost --reset`

**"No test NFTs available"**

- Use manual QA flows to create and buy NFTs first
- Or run `node scripts/start-local-node.js` which pre-creates test data

**Gas usage exceeds targets**

- Check for recent contract changes
- Verify optimizer settings in `hardhat.config.ts`

**Events not appearing**

- Verify block range in `events/index.mjs`
- Check contract address in `events/contracts.mjs`

**Webapp errors not visible**

- Use `node scripts/webapp-debug.js` instead of running the webapp dev server directly
- Check `webapp-debug.log` for complete error history
- Run `node scripts/webapp-debug.js logs` to view recent issues

**QA tests failing**

- Run `node scripts/claude-friendly-qa.js` for detailed failure analysis
- Check gas usage targets and contract deployment
- Verify all contracts deployed with `node scripts/start-local-node.js`

**Claude Code can't see webapp issues**

- Always use `scripts/webapp-debug.js` for webapp development
- Use `scripts/claude-friendly-qa.js` for non-interactive testing
- Check log files for persistent error tracking

### Getting Help

- Check contract test suite: `npm run test`
- Review Phase 2 specifications: `docs/SSC_PLAN.md`
- Run ABI verification: `npm run validate:abis`
