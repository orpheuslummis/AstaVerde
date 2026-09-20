# AstaVerde - Carbon Offset NFT Ecosystem

Carbon offset NFT marketplace with Dutch auction pricing and collateralized lending vault on Ethereum.

## System Status

- **v1**: ✅ Dutch auction marketplace
- **v2**: ✅ Released (2025-08-25) - EcoStabilizer vault (236 tests passing)
- **QA Testing**: 🧪 Available on Ethereum Sepolia testnet
- **Deployment**: Ready for Ethereum mainnet
- **Gas Efficiency**: Deposit <150k, Withdraw <120k

### Networks

Current target is Ethereum mainnet, with Ethereum Sepolia as the QA testnet. The earlier Arbitrum One
deployment remains live and is untouched by this workflow; its commands survive under the `arbitrum-*`
script names. See the [Deployment Guide](./docs/DEPLOYMENT.md) for the network table and env setup.

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
- Access control; SCC admin renunciation is opt-in (`RENOUNCE_SCC_ADMIN=true`, non-Sepolia networks only)

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm run test

# Configure webapp env (untracked)
cp webapp/.env.local.example webapp/.env.local

# Start dev webapp (Ethereum Sepolia)
npm run dev:sepolia

# Access webapp at http://localhost:3002
```

## Key Commands

```bash
npm run test              # Run all tests
npm run compile           # Compile contracts
npm run dev:sepolia       # Start webapp (Ethereum Sepolia)
npm run qa:fast           # Quick contract verification
npm run deploy:testnet    # Deploy to Ethereum Sepolia
npm run deploy:mainnet    # Deploy to Ethereum mainnet
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
- Role-based access control; SCC admin renunciation is opt-in at deploy time
- Reentrancy protection and pausability
- Comprehensive test coverage (236 tests)
- Redeemed NFT protection in vault

## 🧪 v2 QA Testing

The EcoStabilizer vault system is deployed on Ethereum Sepolia testnet for client testing.

### For Testers

- **[QA Testing Guide](./docs/QA_TESTING.md)** - Complete guide for testing the vault system
- **Test URL**: [Vercel deployment URL - to be provided]
- **Network**: Ethereum Sepolia (testnet)

### For Developers

1. **Deploy Contracts to Testnet**:

    ```bash
    npm run deploy:testnet
    ```

2. **Configure Webapp**:

    ```bash
    cp webapp/.env.local.example webapp/.env.local
    # Edit webapp/.env.local with testnet addresses + RPC
    ```

3. **Deploy to Vercel**:
    ```bash
    vercel --prod
    ```

See [QA Testing Guide](./docs/QA_TESTING.md) for detailed testing instructions.

## License

MIT
