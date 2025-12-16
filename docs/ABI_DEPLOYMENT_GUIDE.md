# ABI Deployment Guide

## Problem Solved

The webapp was encountering `getUserLoansIndexed` function not found errors because the contract ABIs were not being properly generated or synchronized during deployment. This caused runtime errors when the webapp tried to call contract functions.

## Solution Overview

We've implemented a comprehensive ABI validation and deployment system that ensures:

1. **Contracts are always compiled before deployment** - Guarantees ABIs are up-to-date
2. **ABI validation** - Verifies critical functions exist in generated ABIs
3. **Automated deployment process** - Reduces human error in deployment steps

## New Commands

### For Development

```bash
# Run the webapp against Sepolia (currently Arbitrum Sepolia)
npm run dev:sepolia

# Validate ABIs are properly generated
npm run validate:abis

# Safe deployment with validation
npm run deploy:safe
```

### For Production Deployment

```bash
# Deploy to Sepolia (currently Arbitrum Sepolia) with validation
npm run deploy:testnet

# Deploy to Arbitrum One (with validation)
npm run deploy:mainnet
```

## How It Works

### 1. Local Development (`npm run dev:local`) (legacy)

The updated `scripts/start-local.js` now:

1. **Compiles contracts first** (`npm run compile`)
2. Starts Hardhat node
3. Deploys contracts
4. Updates webapp configuration
5. Starts webapp

This ensures ABIs are always current before the webapp starts.

### 2. Network Deployment (`npm run deploy:testnet/mainnet`)

The new `scripts/deploy-with-validation.js`:

1. **Cleans and compiles** all contracts
2. **Validates ABIs** contain expected functions
3. **Deploys contracts** to specified network
4. **Copies ABIs** to webapp (for local)
5. **Shows deployment addresses** for configuration

### 3. ABI Validation (`npm run validate:abis`)

The `scripts/validate-abis.js` tool:

- Checks all contract ABIs exist
- Verifies expected functions are present
- Special validation for critical functions like `getUserLoansIndexed`
- Validates webapp configuration files

## Deployment Checklist

### For Local Development (legacy)

1. Run `npm run dev:local`
2. Everything is handled automatically (deploys + writes `webapp/.env.local`)

### For Sepolia (Arbitrum Sepolia)

1. Set deploy secrets in `.env.local` (copy from `.env.local.example`)
2. Run `npm run deploy:testnet`
3. Copy displayed addresses to `webapp/.env.local`
4. Run `npm run dev:sepolia`

### For Arbitrum One Mainnet

1. Set production environment variables
2. Run `npm run deploy:mainnet`
3. Copy displayed addresses to production config
4. Verify contracts on Arbiscan
5. Run smoke tests

## Troubleshooting

### If you see ABI-related errors:

1. **Clean and rebuild:**

    ```bash
    npm run clean
    npm run compile
    npm run validate:abis
    ```

2. **For persistent issues:**

    ```bash
    # Force complete rebuild
    rm -rf artifacts cache
    npm run compile
    ```

3. **Verify ABIs are valid:**
    ```bash
    npm run validate:abis
    ```
    This will show which functions are missing or invalid.

## Key Files

- `scripts/start-local.js` - Enhanced local development starter
- `scripts/deploy-with-validation.js` - Safe deployment script
- `scripts/validate-abis.js` - ABI validation tool
- `webapp/src/config/local-dev.json` - Generated config for local dev

## Best Practices

1. **Always validate before production deployment:**

    ```bash
    npm run validate:abis
    npm run qa:status
    ```

2. **Use the safe deployment scripts** instead of raw hardhat commands

3. **Monitor the validation output** - it will warn about missing functions

4. **Keep expected functions updated** in `validate-abis.js` when contracts change

## Security Notes

- The validation system ensures critical security functions are present
- Prevents deployment of contracts with missing ABI entries
- Automated compilation reduces human error
- Validation scripts are non-destructive (read-only checks)

## Future Improvements

Consider adding:

- CI/CD integration for automated validation
- Pre-commit hooks for ABI validation
- Automated contract verification after deployment
- Integration tests that verify ABI compatibility
