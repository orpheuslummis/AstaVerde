# AstaVerde - Carbon Offset NFT Ecosystem

Carbon offset NFT marketplace with Dutch auction pricing and collateralized lending vault on Base L2.

## System Status

- **Phase 1**: ✅ Live on Base Mainnet - Dutch auction marketplace
- **Phase 2**: ✅ Implementation Complete - EcoStabilizer vault (173 tests passing)
- **Deployment**: Ready for Base mainnet
- **Gas Efficiency**: Deposit <150k, Withdraw <120k

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

## License

MIT
