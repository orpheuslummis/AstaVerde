# Development Guide

Complete guide for developing on AstaVerde - project structure, setup, and development workflow.

## 🏗️ Project Structure

```
astaverde/
├── contracts/          # Solidity smart contracts (0.8.27)
│   ├── AstaVerde.sol   # Phase 1: Marketplace
│   ├── EcoStabilizer.sol # Phase 2: Vault system
│   ├── StabilizedCarbonCoin.sol # SCC token
│   └── IAstaVerde.sol  # Interface for vault integration
├── test/              # Comprehensive test suite (173 tests)
├── scripts/           # Development and deployment scripts
├── deploy/            # Deployment configurations
├── webapp/            # Next.js frontend application
│   ├── src/
│   │   ├── app/       # App router pages
│   │   ├── components/ # React components
│   │   ├── hooks/     # Custom React hooks
│   │   ├── lib/       # Utilities and helpers
│   │   └── config/    # Contract ABIs and configs
│   └── public/        # Static assets
└── docs/              # Additional documentation
```

### Generated Directories (git-ignored)

- `artifacts/` - Compilation artifacts
- `cache/` - Hardhat cache
- `types/` - TypeScript type definitions
- `coverage/` - Test coverage reports
- `webapp/.next/` - Next.js build output

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Git
- MetaMask or compatible wallet (for webapp testing)

### Initial Setup

```bash
# Clone repository
git clone https://github.com/astaverde/astaverde.git
cd astaverde

# Install dependencies
npm install
cd webapp && npm install && cd ..

# Set up environment (untracked)
cp .env.local.example .env.local
cp webapp/.env.local.example webapp/.env.local
```

### Start Development Environment

```bash
# Deploy contracts to Ethereum Sepolia
npm run deploy:testnet

# Start the webapp on Ethereum Sepolia (http://localhost:3002)
npm run dev:sepolia
```

## 💻 Development Workflow

### Smart Contract Development

1. **Write contracts** in `contracts/`
2. **Compile** with `npm run compile`
3. **Test** with `npm run test`
4. **Deploy to testnet** with `npm run deploy:testnet` (recommended; local stack via `npm run dev:local` is legacy)

```bash
# Useful commands
npm run compile        # Compile contracts
npm run test          # Run test suite
npm run coverage      # Generate coverage report
npm run lint:sol      # Lint Solidity code
```

### Frontend Development

```bash
# Start webapp only (assumes contracts deployed)
cd webapp
npm run dev

# Build for production
npm run build
```

### Key Webapp Features

- **Wallet Integration**: ConnectKit for multi-wallet support
- **Contract Interaction**: Wagmi hooks for blockchain calls
- **State Management**: TanStack Query for caching
- **Styling**: Tailwind CSS with shadcn/ui components

## 🔧 Configuration

### Environment Variables

**.env.local (root)**

```bash
# Deployment wallet
PRIVATE_KEY=0xac09...           # Deployer private key
OWNER_ADDRESS=0x...             # Owner / Safe address (required for AstaVerde deploy)

# RPC (choose one approach)
ETHEREUM_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
ETHEREUM_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
# Or: provide a single Alchemy key used for templated URLs
RPC_API_KEY=your-alchemy-key

# Explorer verification (Etherscan V2: one key covers mainnet and Sepolia)
ETHERSCAN_API_KEY=...
# The per-chain Arbitrum keys still apply to the arbitrum-* targets
ARBITRUM_SEPOLIA_EXPLORER_API_KEY=...
ARBITRUM_MAINNET_EXPLORER_API_KEY=...

# Optional deploy flags
DEPLOY_VAULT_V2=false
USE_EXISTING_ASTAVERDE=false
AV_ADDR=0x...
RENOUNCE_SCC_ADMIN=false
```

**webapp/.env.local**

```bash
# Chain selection
NEXT_PUBLIC_CHAIN_SELECTION=ethereum_sepolia

# Contract addresses
NEXT_PUBLIC_ASTAVERDE_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...
NEXT_PUBLIC_ECOSTABILIZER_ADDRESS=0x...
NEXT_PUBLIC_SCC_ADDRESS=0x...

# RPC (choose one)
NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
NEXT_PUBLIC_ALCHEMY_API_KEY=

# WalletConnect (optional)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=

# IPFS (optional)
NEXT_PUBLIC_IPFS_GATEWAY_URL=https://w3s.link/ipfs/
```

### Network Configuration

Supported networks configured in `hardhat.config.ts`:

- **ethereum-sepolia**: Ethereum Sepolia testnet (chain 11155111) — current QA target
- **ethereum-mainnet**: Ethereum mainnet (chain 1) — current production target
- **arbitrum-sepolia**: Arbitrum Sepolia testnet (chain 421614) — previous target
- **arbitrum-one**: Arbitrum One mainnet (chain 42161) — previous target, still live
- **localhost**: Local Hardhat node (legacy/local-only flows)

## 📦 Module Guidelines

### Smart Contracts

- Solidity 0.8.27 with optimizer enabled
- Use OpenZeppelin contracts where applicable
- Follow checks-effects-interactions pattern
- Comprehensive NatSpec documentation
- Gas optimization targets: <165k deposit, <120k withdraw

### Testing

- Place tests in `test/` directory
- Use TypeScript for type safety
- Follow AAA pattern (Arrange, Act, Assert)
- Include gas consumption tests
- Cover edge cases and security scenarios

### Frontend

- Use Next.js App Router (not Pages)
- Implement proper loading and error states
- Follow React best practices and hooks rules
- Ensure mobile responsiveness
- Handle wallet disconnection gracefully

### Scripts

- Place in `scripts/` for utilities
- Use `tasks/` for Hardhat tasks
- Include help text and examples
- Handle errors gracefully
- Make idempotent where possible

## 🔄 Git Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - New features
- `fix/*` - Bug fixes
- `test/*` - Test implementations

### Commit Convention

```bash
type: subject

# Types:
# feat: New feature
# fix: Bug fix
# test: Test changes
# docs: Documentation
# style: Formatting
# refactor: Code restructuring
# chore: Maintenance
```

### Pre-commit Checks

```bash
npm run lint          # Lint all code
npm run prettier:check # Check formatting
npm run test          # Run tests
npm run compile       # Verify contracts build
```

## 🛠️ Common Tasks

### Adding a New Contract

1. Create contract in `contracts/`
2. Add tests in `test/`
3. Update deployment in `deploy/`
4. Run `npm run compile` to generate ABI
5. Import ABI in webapp from `webapp/src/config/`

### Adding a Webapp Page

1. Create page in `webapp/src/app/[page]/page.tsx`
2. Add any components to `webapp/src/components/`
3. Create hooks in `webapp/src/hooks/` if needed
4. Update navigation if required

### Updating Contract Interfaces

After contract changes:

```bash
npm run compile  # Regenerates ABIs and types
# ABIs are auto-copied to webapp/src/config/
```

## 🐛 Debugging

### Contract Debugging

```bash
# Run specific test
npx hardhat test test/EcoStabilizer.ts

# Run with gas reporting
REPORT_GAS=true npm run test

# Debug with console.log (in Solidity)
import "hardhat/console.sol";
console.log("Value:", value);
```

### Webapp Debugging

```javascript
// Enable debug mode in browser console
localStorage.setItem("DEBUG", "true");

// Check wallet connection
window.ethereum.selectedAddress;

// Verify contract deployment
await provider.getCode(contractAddress);
```

### Common Issues

**Issue**: "Cannot find module"

```bash
npm run clean && npm install
```

**Issue**: "Nonce too high"

```bash
npx hardhat clean
# Restart Hardhat node
```

**Issue**: "Gas estimation failed"

- Check contract is deployed
- Verify correct network
- Ensure sufficient balance

## 📊 Performance Guidelines

### Gas Targets

- Mint batch: <500k gas
- Buy NFT: <250k gas
- Vault deposit: <165k gas
- Vault withdraw: <120k gas

### Frontend Performance

- Lighthouse score: >90
- Initial load: <3s
- Time to interactive: <2s
- Bundle size: <500kb

## 🔗 Useful Commands Reference

```bash
# Development
npm run dev:sepolia   # Webapp against Ethereum Sepolia (port 3002)
npm run dev:local     # Local full stack (HH node + deploy + webapp)

# Testing
npm run test          # Run all tests
npm run coverage      # Coverage report
npm run qa:fast       # Quick QA check

# Building
npm run compile       # Compile contracts
npm run validate:abis # Pre-deployment ABI check

# Utilities
npx hardhat run scripts/mint-local-batch.js --network localhost   # Mint test NFTs
npx hardhat run scripts/fund-all-accounts.js --network localhost  # Fund test accounts
npx hardhat accounts     # List accounts
npx hardhat balance <address> # Check balance
```

## 📚 Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Wagmi Documentation](https://wagmi.sh)
- [Next.js Documentation](https://nextjs.org/docs)
- [Ethereum Developer Documentation](https://ethereum.org/en/developers/docs/)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.
