# AstaVerde - Carbon Offset NFT Ecosystem

Carbon offset NFT marketplace with Dutch auction pricing and collateralized lending vault on Base L2.

## System Status

- **v1**: ✅ Live on Base Mainnet (2024-11-15) - Dutch auction marketplace
- **v2**: ✅ Released (2025-08-25) - EcoStabilizer vault (221 tests passing)
- **QA Testing**: 🧪 Available on Base Sepolia testnet
- **Deployment**: Ready for Base mainnet
- **Gas Efficiency**: Deposit <150k, Withdraw <120k

## 📚 Documentation

- **[Agents Guide](./AGENTS.md)** - Canonical instructions for AI assistants and contributors
- **[Development Guide](./docs/DEV_GUIDE.md)** - Setup, structure, and workflow
- **[Testing Guide](./docs/TESTING.md)** - Comprehensive testing documentation
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment and checklist
- **[QA Testing Guide](./docs/QA_TESTING.md)** - QA testing guide and checklist
- **[SSC Plan](./docs/SSC_PLAN.md)** - v2 vault technical specification

## Architecture

### v1: Dutch Auction Marketplace (Live)

- ERC-1155 NFTs representing verified carbon offsets
- Dynamic pricing: Base price adjusts with market demand
- Dutch auction: Daily 1 USDC decrease to 40 USDC floor
- 30% default platform commission (configurable up to 50%), remainder to producers

### v2: EcoStabilizer Vault (Released)

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

# Start local development environment
npm run dev:local

# Access webapp at http://localhost:3000
```

## Key Commands

```bash
npm run test              # Run all tests
npm run compile           # Compile contracts
npm run dev:local         # Start local development environment
npm run qa:fast           # Quick contract verification
npm run deploy:testnet    # Deploy to Base Sepolia
npm run deploy:mainnet    # Deploy to Base mainnet
```

See [AGENTS.md](AGENTS.md) for the complete command reference and workflows.

## Documentation

- [AGENTS.md](AGENTS.md) - Canonical guide for agents and developer workflows
- [SSC_PLAN.md](docs/SSC_PLAN.md) - v2 vault specification
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deployment instructions
- [contracts/README.md](contracts/README.md) - Contract specifications
- [test/TESTING_GUIDE.md](test/TESTING_GUIDE.md) - Testing documentation

## Security

- Immutable contracts with no upgrade mechanisms
- Role-based access control with automated admin renunciation
- Reentrancy protection and pausability
- Comprehensive test coverage (221 tests)
- Redeemed NFT protection in vault

## 🧪 v2 QA Testing

The EcoStabilizer vault system is deployed on Base Sepolia testnet for client testing.

### For Testers

- **[QA Testing Guide](./docs/QA_TESTING.md)** - Complete guide for testing the vault system
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

See [QA Testing Guide](./docs/QA_TESTING.md) for detailed testing instructions.

## License

MIT
