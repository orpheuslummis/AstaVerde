# QA Testing Guide - Local Development Environment Optimization

## Overview

This PR optimizes the local development environment for the AstaVerde webapp by eliminating external service dependencies and providing a cleaner console experience during local testing.

## Changes Made

### 1. IPFS Mock Data for Local Development

- **File Modified**: `webapp/src/utils/ipfsHelper.ts`
- **Change**: Returns mock NFT metadata with base64 SVG images when `CHAIN_SELECTION=local`
- **Benefit**: Eliminates 400/422 errors from external IPFS gateways (w3s.link, dweb.link)

### 2. WalletConnect Configuration

- **Files Modified**:
    - `webapp/src/wagmi.ts`
    - `webapp/src/components/Providers.tsx`
- **Change**: Conditionally excludes WalletConnect for local development
- **Benefit**: Reduces WebSocket connection errors in console

### 3. ConnectKit Optimization

- **File Modified**: `webapp/src/components/Providers.tsx`
- **Change**: Disables WebSocket providers and debug mode for local development
- **Benefit**: Minimizes console noise from third-party services

## Prerequisites

1. **Install Dependencies**

    ```bash
    npm install
    npm run webapp:install
    ```

2. **Environment Setup**
    - Ensure `.env.local` exists with proper configuration
    - Verify `webapp/.env.local` has `NEXT_PUBLIC_CHAIN_SELECTION=local`

## Testing Procedures

### A. Quick Verification (2 minutes)

1. **Start the development environment**

    ```bash
    npm run dev
    ```

    Wait for "✅ All systems ready!" message

2. **Open webapp**
    - Navigate to http://localhost:3000
    - Open browser console (F12)

3. **Verify console is cleaner**
    - ✅ No IPFS gateway 400/422 errors for QmTest1, QmTest3, QmVault1, QmVault2
    - ✅ Reduced WalletConnect WebSocket errors
    - ⚠️ Coinbase analytics 401 errors still present (unavoidable, from ConnectKit)

### B. Functional Testing (5 minutes)

#### 1. Test Wallet Connection

1. Import test account to Brave/MetaMask:
    - Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
    - Add Hardhat network: RPC `http://127.0.0.1:8545`, Chain ID `31337`

2. Connect wallet on webapp
    - Click "Connect Wallet"
    - Select your wallet provider
    - Approve connection

3. **Expected Result**:
    - Wallet connects successfully
    - Address shown in top-right
    - Balance shows 10,000 ETH

#### 2. Test NFT Display with Mock Data

1. Navigate to Market page (http://localhost:3000/)
2. Observe NFT batch cards

3. **Expected Results**:
    - ✅ All 6 batches display correctly
    - ✅ Each shows green "EcoAsset" SVG image (mock data)
    - ✅ No "Failed to load image" errors
    - ✅ Batch info loads (price, supply, etc.)

#### 3. Test NFT Purchase Flow

1. On Market page, click "Buy Batch" on any batch
2. Approve USDC spending if prompted
3. Confirm transaction
4. Navigate to "My Eco Assets" page

5. **Expected Results**:
    - ✅ Transaction completes successfully
    - ✅ Tokens appear in "My Eco Assets"
    - ✅ Each token shows mock green SVG image
    - ✅ Token metadata displays correctly

#### 4. Test Vault Functionality

1. Go to "My Eco Assets" with owned tokens
2. Select tokens for vault deposit
3. Click "Deposit to Vault"
4. Approve and confirm transaction

5. **Expected Results**:
    - ✅ Deposit successful
    - ✅ SCC tokens received (20 per NFT)
    - ✅ Vault status updates correctly

### C. Console Error Verification

#### Errors That Should NOT Appear:

- ❌ `GET https://w3s.link/ipfs/QmTest1 400`
- ❌ `GET https://dweb.link/ipfs/QmVault1 422`
- ❌ `Failed to fetch IPFS metadata`

#### Errors That May Still Appear (Expected):

- ⚠️ `POST https://cca-lite.coinbase.com/metrics 401` - Hardcoded telemetry
- ⚠️ CSP warnings from maintain--tab-focus.js - Browser extension
- ⚠️ Occasional WalletConnect warnings (greatly reduced)

#### Console Filtering Tip:

Add these filters in Chrome DevTools Console to hide expected errors:

- `-cca-lite.coinbase.com`
- `-maintain--tab-focus`
- `-walletconnect`

### D. Performance Testing

1. **Initial Page Load**
    - Market page should load in < 2 seconds
    - NFT images (mock SVGs) should appear immediately
    - No delays waiting for external IPFS gateways

2. **Transaction Speed**
    - Buy batch transaction: < 3 seconds
    - Vault deposit: < 3 seconds
    - No external service timeouts

### E. Edge Cases

1. **Test with Multiple Wallets**
    - Import Account #1 and #2
    - Test switching between accounts
    - Verify each account's tokens display correctly

2. **Test Rapid Navigation**
    - Quickly switch between Market and My Eco Assets
    - Verify no console errors accumulate
    - Check mock data loads consistently

3. **Test Offline IPFS Scenario**
    - Mock data should always work
    - No dependency on internet for local testing

## Regression Testing

Ensure these features still work:

- ✅ Wallet connection flow
- ✅ NFT purchase functionality
- ✅ Vault deposit/withdraw
- ✅ Token balance updates
- ✅ Transaction history
- ✅ Price calculations
- ✅ Dutch auction pricing

## Success Criteria

The PR is successful if:

1. **Console Errors Reduced by 80%+**
    - Baseline: ~20+ errors on page load
    - Target: < 5 errors (only unavoidable third-party telemetry)

2. **All Functionality Works**
    - NFT purchases complete
    - Vault operations succeed
    - Wallet connections stable

3. **Performance Improved**
    - No IPFS gateway timeouts
    - Faster page loads
    - Immediate image display

## Known Limitations

1. **Coinbase Analytics**: Cannot be disabled (hardcoded in ConnectKit)
    - Workaround: Use console filters

2. **Browser Extensions**: May cause CSP warnings
    - Not related to our changes

3. **Mock Data**: Shows generic green SVG for all NFTs
    - Intentional for local development
    - Production uses real IPFS data

## Rollback Plan

If issues occur, revert these files:

```bash
git checkout HEAD -- webapp/src/utils/ipfsHelper.ts
git checkout HEAD -- webapp/src/wagmi.ts
git checkout HEAD -- webapp/src/components/Providers.tsx
```

## Additional Testing Commands

```bash
# Quick system check
npm run qa:status

# Fast critical path testing
npm run qa:fast

# Comprehensive testing
npm run qa:full

# Build verification (before deployment)
npm run verify:deploy
```

## Support

For issues during testing:

1. Check the console for specific error messages
2. Verify `.env.local` configuration
3. Ensure local blockchain is running (port 8545)
4. Restart with `npm run dev` if needed

## Sign-off Checklist

- [ ] Console errors significantly reduced
- [ ] NFT display works with mock data
- [ ] Wallet connection stable
- [ ] Purchase flow completes
- [ ] Vault operations succeed
- [ ] No functional regressions
- [ ] Performance improved
- [ ] Documentation reviewed

---

**Testing Duration**: ~10 minutes for complete QA
**Priority**: Medium (Developer Experience)
**Risk Level**: Low (Local development only)
