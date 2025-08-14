# Production Deployment Checklist

## Pre-Deployment Requirements

### 1. Environment Configuration

- [ ] Create production `.env` file with:
    ```bash
    PRIVATE_KEY=<your-deployer-private-key>
    RPC_API_KEY=<your-alchemy-api-key>
    BASE_MAINNET_EXPLORER_API_KEY=<your-basescan-api-key>
    AV_ADDR=<existing-astaverde-contract-on-base>
    ```

### 2. Webapp Configuration

- [ ] Create production `webapp/.env.local`:
    ```bash
    NEXT_PUBLIC_CHAIN_SELECTION=base_mainnet
    NEXT_PUBLIC_ASTAVERDE_ADDRESS=<existing-astaverde-address>
    NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    NEXT_PUBLIC_ECOSTABILIZER_ADDRESS=<after-deployment>
    NEXT_PUBLIC_SCC_ADDRESS=<after-deployment>
    NEXT_PUBLIC_ALCHEMY_API_KEY=<your-alchemy-key>
    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<your-walletconnect-id>
    ```

### 3. Pre-Deployment Validation

- [ ] Run all tests: `npm run test`
- [ ] Check test coverage: `npm run coverage`
- [ ] Verify webapp build: `cd webapp && npm run build`
- [ ] Run lint checks: `npm run lint`

## Deployment Steps

### 1. Deploy Contracts to Base Mainnet

```bash
# Set network to Base mainnet
export HARDHAT_NETWORK=base_mainnet

# Deploy Phase 2 contracts
npx hardhat run deploy/deploy_ecostabilizer.ts --network base_mainnet

# Save deployment addresses
```

### 2. Verify Contracts on BaseScan

```bash
# Verify SCC
npx hardhat verify --network base_mainnet <SCC_ADDRESS>

# Verify EcoStabilizer
npx hardhat verify --network base_mainnet <ECOSTABILIZER_ADDRESS> <AV_ADDR> <SCC_ADDRESS>
```

### 3. Update Webapp Configuration

- [ ] Update `webapp/.env.local` with deployed addresses
- [ ] Update `webapp/src/app.config.ts` if needed
- [ ] Build webapp: `cd webapp && npm run build`

### 4. Post-Deployment Testing

- [ ] Test deposit flow on mainnet with small amount
- [ ] Test withdraw flow
- [ ] Verify SCC minting works
- [ ] Check vault status displays correctly
- [ ] Verify gas costs match expectations (<165k deposit, <120k withdraw)

## Security Verification

### Critical Checks

- [ ] Deployer admin roles renounced
- [ ] Vault has exclusive MINTER_ROLE on SCC
- [ ] No other addresses have MINTER_ROLE
- [ ] Pause functionality works (test then unpause)
- [ ] Redeemed assets cannot be deposited

### Monitoring Setup

- [ ] Set up event monitoring for Deposit/Withdraw events
- [ ] Configure alerts for pause/unpause events
- [ ] Monitor SCC total supply
- [ ] Track vault TVL

## Liquidity Deployment (External)

### Client Responsibilities

- [ ] Deploy SCC/USDC pool on Uniswap V3 or Aerodrome
- [ ] Seed initial liquidity ($10-20k minimum recommended)
- [ ] Set up price monitoring
- [ ] Configure arbitrage bots if needed

## Final Verification

### User Experience

- [ ] Test complete user flow from wallet connection to vault operations
- [ ] Verify mobile wallet compatibility
- [ ] Check error messages are user-friendly
- [ ] Ensure loading states work properly

### Documentation

- [ ] Update README with mainnet addresses
- [ ] Document gas costs from actual transactions
- [ ] Create user guide for vault operations
- [ ] Prepare FAQ for common issues

## Emergency Contacts

- **Technical Issues**: [Your contact]
- **Smart Contract Emergency**: [Emergency multisig if applicable]
- **Frontend Issues**: [Your contact]

## Notes

- Keep deployment transaction hashes for reference
- Save deployment artifacts in secure location
- Consider using hardware wallet for deployment
- Have at least 0.01 ETH in deployer for gas costs
