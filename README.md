# AstaVerde - Carbon Offset NFT Ecosystem

Carbon offset NFT marketplace with Dutch auction pricing and collateralized lending vault on Base L2.

## System Status

- **Phase 1**: ✅ Live on Base Mainnet - Dutch auction marketplace
- **Phase 2**: ✅ Implementation Complete - EcoStabilizer vault (173 tests passing)
- **QA Testing**: 🧪 Available on Base Sepolia testnet
- **Deployment**: Ready for Base mainnet
- **Gas Efficiency**: Deposit <150k, Withdraw <120k

## 📚 Documentation

- **[Development Guide](./DEV_GUIDE.md)** - Setup, structure, and workflow
- **[Testing Guide](./TESTING.md)** - Comprehensive testing documentation
- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment and checklist
- **[SSC Plan](./SSC_PLAN.md)** - Phase 2 technical specification
- **[Claude Instructions](./CLAUDE.md)** - AI assistant configuration

## Architecture

### Phase 1: Dutch Auction Marketplace (Live)

- ERC-1155 NFTs representing verified carbon offsets
- Dynamic pricing: Base price adjusts with market demand
- Dutch auction: Daily 1 USDC decrease to 40 USDC floor
- 30% platform commission, 70% to producers

### Phase 2: EcoStabilizer Vault (Complete)

- Deposit NFTs to mint 20 SCC stablecoins
- No liquidations - withdraw your exact NFT by repaying loan
- Redeemed NFTs cannot be used as collateral
- Access control with automated admin renunciation

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm run test

# Deploy locally with test data
npm run dev

# Access webapp at http://localhost:3000
```

## Key Commands

```bash
npm run test              # Run all tests
npm run compile           # Compile contracts
npm run dev               # Start complete local environment
npm run dev:complete      # Deploy with all test scenarios
npm run qa:fast           # Quick contract verification
npm run deploy:testnet    # Deploy to Base Sepolia
npm run deploy:mainnet    # Deploy to Base mainnet
```

See [CLAUDE.md](CLAUDE.md) for complete command reference.

## Documentation

- [CLAUDE.md](CLAUDE.md) - Development guide and commands
- [SSC_PLAN.md](SSC_PLAN.md) - Phase 2 vault specification
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment instructions
- [contracts/README.md](contracts/README.md) - Contract specifications
- [test/TESTING_GUIDE.md](test/TESTING_GUIDE.md) - Testing documentation

## Security

- Immutable contracts with no upgrade mechanisms
- Role-based access control with automated admin renunciation
- Reentrancy protection and pausability
- Comprehensive test coverage (173 tests)
- Redeemed NFT protection in vault

## 🧪 Phase 2 QA Testing

The EcoStabilizer vault system is deployed on Base Sepolia testnet for client testing.

### For Testers

- **[QA Testing Guide](./QA_GUIDE.md)** - Complete guide for testing the vault system
- **[QA Checklist](./QA_CHECKLIST.md)** - Structured test scenarios and expected outcomes
- **Test URL**: [Vercel deployment URL - to be provided]
- **Network**: Base Sepolia (testnet)

### For Developers

1. **Deploy Contracts to Testnet**:
   ```bash
   npm run deploy:testnet
   ```

2. **Configure Webapp**:
   ```bash
   cd webapp
   cp .env.example .env.local
   # Edit .env.local with testnet addresses
   ```

3. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

See [QA_GUIDE.md](./QA_GUIDE.md) for detailed testing instructions.

## License

MIT
