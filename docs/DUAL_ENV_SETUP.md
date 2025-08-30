# Dual Environment Setup

Run local and remote test environments simultaneously without any configuration switching.

## 🚀 Quick Start

### Local Development (Port 3000/3001)

```bash
npm run dev:local
```

- Starts Hardhat node locally
- Deploys fresh contracts
- Seeds test data
- Runs webapp connected to local blockchain

### Base Sepolia Testing (Port 3002)

```bash
# First, deploy contracts to Sepolia (one time)
npm run deploy:testnet

# Update webapp/.env.sepolia with deployed addresses

# Run Sepolia-connected webapp
npm run dev:sepolia
```

- Connects to Base Sepolia testnet
- Uses deployed contracts
- Runs webapp on different port

### Run Both Simultaneously

```bash
npm run dev:both
```

- Local environment on port 3000/3001
- Sepolia environment on port 3002
- No conflicts, no switching needed

## 📋 Setup Instructions

### Local Environment

Already configured and ready to use:

```bash
npm run dev:local
```

### Sepolia Environment

1. **Deploy contracts** (one time):

```bash
# Configure .env.local with deployment credentials
PRIVATE_KEY=your_private_key
RPC_API_KEY=your_alchemy_key
BASE_SEPOLIA_EXPLORER_API_KEY=your_basescan_key

# Deploy
npm run deploy:testnet
```

2. **Update `webapp/.env.sepolia`** with deployed addresses:

```env
NEXT_PUBLIC_ASTAVERDE_ADDRESS=0x... # From deployment
NEXT_PUBLIC_ECOSTABILIZER_ADDRESS=0x...
NEXT_PUBLIC_SCC_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...
```

3. **Run Sepolia environment**:

```bash
npm run dev:sepolia
```

## 🎯 Key Features

- **No switching**: Both environments use separate configs
- **No conflicts**: Different ports prevent collisions
- **Independent**: Each environment is self-contained
- **Simultaneous**: Run both at the same time

## 📊 Environment Details

| Feature        | Local          | Sepolia        |
| -------------- | -------------- | -------------- |
| **Port**       | 3000/3001      | 3002           |
| **Config**     | `.env.local`   | `.env.sepolia` |
| **Blockchain** | Local Hardhat  | Base Sepolia   |
| **State**      | Fresh each run | Persistent     |
| **Gas**        | Free           | Test ETH       |

## 🔧 Commands Reference

```bash
# Development
npm run dev:local    # Local only
npm run dev:sepolia  # Sepolia only
npm run dev:both     # Both simultaneously

# Deployment
npm run deploy:testnet  # Deploy to Sepolia
npm run deploy:mainnet  # Deploy to mainnet

# QA Testing
npm run qa:status  # Quick health check
npm run qa:fast    # Fast tests
npm run qa:full    # Full test suite
```

## 🌐 Test Resources

- [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia) - Get test ETH
- [Base Sepolia Explorer](https://sepolia.basescan.org) - View transactions
- [Alchemy Dashboard](https://dashboard.alchemy.com) - Manage RPC endpoints

## 📝 Notes

- Local environment resets on each run
- Sepolia environment persists between runs
- Each environment reads its own config file
- No file modification or switching required
