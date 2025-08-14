# Development Guide

Complete guide for developing on AstaVerde - project structure, setup, and development workflow.

## 🏗️ Project Structure

```
astaverde/
├── contracts/          # Solidity smart contracts (0.8.27)
│   ├── AstaVerde.sol   # Phase 1: Marketplace (live on Base)
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

# Set up environment
cp .env.example .env
cp webapp/.env.example webapp/.env.local
```

### Start Development Environment

```bash
# One command to start everything
npm run dev

# This runs:
# 1. Local blockchain (Hardhat node)
# 2. Contract deployment
# 3. Test data seeding
# 4. Webapp on http://localhost:3001
```

## 💻 Development Workflow

### Smart Contract Development

1. **Write contracts** in `contracts/`
2. **Compile** with `npm run compile`
3. **Test** with `npm run test`
4. **Deploy locally** with `npm run dev`

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

# Run type checking
npm run type-check
```

### Key Webapp Features
- **Wallet Integration**: ConnectKit for multi-wallet support
- **Contract Interaction**: Wagmi hooks for blockchain calls
- **State Management**: TanStack Query for caching
- **Styling**: Tailwind CSS with shadcn/ui components

## 🔧 Configuration

### Environment Variables

**.env (root)**
```bash
# Deployment
PRIVATE_KEY=0xac09...  # Deployer private key
RPC_API_KEY=your-alchemy-key

# Contract addresses (for existing deployments)
AV_ADDR=0x...         # AstaVerde address
VAULT_ADDR=0x...      # EcoStabilizer address
SCC_ADDR=0x...        # SCC token address
```

**webapp/.env.local**
```bash
# Chain selection
NEXT_PUBLIC_CHAIN=localhost  # or baseSepolia, base

# API keys
NEXT_PUBLIC_ALCHEMY_ID=your-key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-key

# IPFS (optional for local dev)
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud
```

### Network Configuration

Supported networks configured in `hardhat.config.ts`:
- **localhost**: Local Hardhat node
- **baseSepolia**: Base testnet
- **base**: Base mainnet

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
npm run build:all     # Verify builds
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
localStorage.setItem('DEBUG', 'true');

// Check wallet connection
window.ethereum.selectedAddress

// Verify contract deployment
await provider.getCode(contractAddress)
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
npm run dev           # Start everything
npm run dev:basic     # Minimal test data
npm run dev:complete  # Full test scenarios

# Testing
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run coverage      # Coverage report
npm run qa:fast       # Quick QA check

# Building
npm run compile       # Compile contracts
npm run build:all     # Build everything
npm run verify:deploy # Pre-deployment check

# Utilities
npm run task:mint:local  # Mint test NFTs
npm run task:fund-all    # Fund test accounts
npx hardhat accounts     # List accounts
npx hardhat balance <address> # Check balance
```

## 📚 Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Wagmi Documentation](https://wagmi.sh)
- [Next.js Documentation](https://nextjs.org/docs)
- [Base Documentation](https://docs.base.org)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.