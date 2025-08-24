# Security Action Plan - AstaVerde Protocol

## Status: NOT READY FOR MAINNET DEPLOYMENT

Generated: 2025-08-24  
Audit Date: 2025-08-24

## Executive Summary

External security audit identified 4 critical vulnerabilities that MUST be resolved before mainnet deployment. These issues could lead to economic manipulation, permanent fund loss, or complete system failure.

## Critical Path to Mainnet

### Phase 1: CRITICAL FIXES (Block Mainnet)

#### 1. Price Decrease Bypass Attack (#107)
**Severity:** CRITICAL  
**Contract:** AstaVerde.sol  
**Issue:** Attacker can prevent price decreases by purchasing 1 token from each batch  
**Fix:** Change `_shouldTriggerPriceDecrease()` threshold from 100% to 95% unsold
```solidity
// Current (vulnerable):
if (batch.remainingTokens == batch.tokenIds.length) {
// Change to:
if (batch.remainingTokens >= (batch.tokenIds.length * 95) / 100) {
```
**Test:** Add manipulation attack scenarios to test suite

#### 2. SCC Deployment Role Bricking (#103)
**Severity:** CRITICAL  
**Contracts:** StabilizedCarbonCoin.sol, Deployment Scripts  
**Issue:** Incorrect role management sequence can permanently brick system  
**Fix:** Create bulletproof deployment script with verification:
```javascript
// deploy-phase2.js
1. Deploy SCC contract
2. Deploy Vault contract
3. Grant MINTER_ROLE to Vault (VERIFY!)
4. Verify vault.hasRole(MINTER_ROLE)
5. Only then renounce DEFAULT_ADMIN_ROLE
6. Final verification of all roles
```
**Test:** Deployment dry-run on testnet with role verification

#### 3. Redeemed Token Vault Collateralization (#102)
**Severity:** CRITICAL  
**Contracts:** AstaVerde.sol, EcoStabilizer.sol  
**Issue:** NFTs can be redeemed while locked in vault  
**Fix Options:**
- Option A: Add `isInVault` check to `redeemBatch()`
- Option B: Create registry contract for vault state
- Option C: Emit events and handle off-chain
**Recommendation:** Option A for simplicity and gas efficiency

### Phase 2: HIGH PRIORITY (Pre-Launch)

#### 4. Partial Batch Purchase Failure (#101)
**Severity:** HIGH  
**Contract:** AstaVerde.sol  
**Issue:** `getPartialIds()` excludes legitimate redeemed tokens  
**Fix:** Remove redeemed check from function:
```solidity
function getPartialIds(uint256 batchId) external view returns (uint256[] memory) {
    // Remove: && !tokenRedeemed[tokenId]
    // Keep only: tokenExists[tokenId]
}
```

### Phase 3: MEDIUM PRIORITY (Monitor Post-Launch)

#### 5. USDC Fee-on-Transfer (#108)
**Severity:** MEDIUM  
**Contract:** AstaVerde.sol  
**Fix:** Add balance verification for testnet deployments:
```solidity
uint256 balanceBefore = IERC20(usdcAddress).balanceOf(address(this));
IERC20(usdcAddress).transferFrom(msg.sender, address(this), amount);
uint256 balanceAfter = IERC20(usdcAddress).balanceOf(address(this));
require(balanceAfter - balanceBefore == amount, "Fee-on-transfer detected");
```

#### 6. Price Iteration DoS (#104)
**Severity:** MEDIUM  
**Contract:** AstaVerde.sol  
**Action:** Monitor `maxPriceUpdateIterations` limit events post-deployment

#### 7. Inefficient Loan Queries (#105)
**Severity:** MEDIUM (becomes CRITICAL at scale)  
**Contract:** EcoStabilizer.sol  
**Action:** Plan indexed loan system for v2 upgrade

#### 8. Storage Pattern Inconsistency (#106)
**Severity:** MEDIUM  
**Contract:** EcoStabilizer.sol  
**Fix:** Standardize on `delete` pattern for all withdrawals

## Testing Requirements

### Critical Test Scenarios
1. Price manipulation attack simulation
2. Deployment role management dry-run
3. Vault-redeem interaction edge cases
4. Partial batch purchase with mixed states
5. Gas limit stress testing

### Test Commands
```bash
# Run comprehensive security tests
npm run test:security

# Run gas optimization tests
npm run test:gas

# Run deployment simulation
npm run deploy:dryrun
```

## Deployment Checklist

### Pre-Deployment
- [ ] All critical fixes implemented
- [ ] Security test suite passes
- [ ] Gas optimization verified
- [ ] Deployment script reviewed by 2+ developers
- [ ] Testnet deployment successful

### Deployment Steps
1. [ ] Deploy AstaVerde (if not already deployed)
2. [ ] Deploy StabilizedCarbonCoin
3. [ ] Deploy EcoStabilizer with correct addresses
4. [ ] Grant MINTER_ROLE to vault (VERIFY!)
5. [ ] Test mint operation
6. [ ] Renounce admin roles (VERIFY FIRST!)
7. [ ] Final system verification

### Post-Deployment
- [ ] Monitor price update iterations
- [ ] Watch for unusual gas consumption
- [ ] Track vault usage patterns
- [ ] Plan v2 upgrades based on usage

## Risk Assessment

### Residual Risks After Fixes
- **Low:** Storage pattern inconsistency (non-critical)
- **Medium:** Scaling limitations for loan queries
- **Medium:** Price iteration limits under extreme load

### Mitigation Strategies
- Implement comprehensive monitoring
- Prepare upgrade path for scaling issues
- Maintain emergency pause capability

## Timeline

**Week 1:** Implement critical fixes (#107, #103, #102)  
**Week 2:** Testing and audit of fixes  
**Week 3:** Testnet deployment and verification  
**Week 4:** Mainnet deployment (if all tests pass)

## Contacts

Security Lead: [TBD]  
Deployment Lead: [TBD]  
Emergency Contact: [TBD]

---

*This document must be reviewed and approved by the security team before any mainnet deployment.*