# Ticket 108: MEDIUM - AstaVerde USDC Fee-on-Transfer Token Vulnerability

## Status: OPEN
## Severity: MEDIUM
## Component: contracts/AstaVerde.sol
## Function: buyBatch()

## Issue Description

The contract assumes canonical USDC behavior and doesn't verify the actual amount received after `safeTransferFrom`. If a fee-on-transfer or deflationary token is used instead of canonical USDC, the contract would under-credit itself while proceeding as if the full amount was received.

## Vulnerability Details

**Location**: contracts/AstaVerde.sol:438

```solidity
// Pull the full usdcAmount from buyer
usdcToken.safeTransferFrom(msg.sender, address(this), usdcAmount);

// Contract assumes it received exactly usdcAmount
// No verification of actual balance change
```

## Risk Scenarios

1. **Non-canonical USDC on testnet**: Testing with fee-on-transfer tokens breaks accounting
2. **Malicious token deployment**: If wrong USDC address is used, funds could be lost
3. **Future USDC changes**: If USDC ever implements fees, existing deployments break
4. **Cross-chain deployments**: Different USDC implementations on different chains

## Business Impact

- **Accounting Mismatch**: Contract credits less than it actually receives
- **Producer Underpayment**: Producers receive less than entitled share
- **Platform Loss**: Platform share calculation becomes incorrect
- **Invariant Violation**: `usdcBalance >= platformShareAccumulated + totalProducerBalances` could break

## Recommended Fix

### For Testnet/Development

```solidity
function buyBatch(uint256 batchID, uint256 usdcAmount, uint256 tokenAmount) 
    external whenNotPaused nonReentrant {
    // ... existing checks ...
    
    // Add balance delta verification for non-mainnet
    uint256 balanceBefore = usdcToken.balanceOf(address(this));
    usdcToken.safeTransferFrom(msg.sender, address(this), usdcAmount);
    uint256 balanceAfter = usdcToken.balanceOf(address(this));
    
    // Only enforce on non-mainnet (use deployment flag)
    if (!isMainnet) {
        require(
            balanceAfter - balanceBefore == usdcAmount, 
            "Fee-on-transfer tokens not supported"
        );
    }
    
    // ... rest of function ...
}
```

### For Production

```solidity
// In constructor or deployment
constructor(address _usdcToken, ...) {
    // Mainnet Base USDC
    require(
        _usdcToken == 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, 
        "Invalid USDC address"
    );
    usdcToken = IERC20(_usdcToken);
    // ...
}
```

## Alternative Solutions

1. **Always verify balance delta** (higher gas cost)
2. **Use pull pattern** for USDC transfers (UX degradation)
3. **Implement slippage protection** (complexity increase)

## Test Requirements

1. **Mock Fee-on-Transfer Token Test**
   - Create mock token that takes 1% fee
   - Verify buyBatch reverts with balance check
   - Verify accounting remains correct

2. **Canonical USDC Test**
   - Ensure no regression with standard USDC
   - Gas cost comparison with/without check

3. **Edge Cases**
   - Zero amount transfers
   - Exact balance scenarios
   - Reentrancy with balance checks

## Implementation Checklist

- [ ] Add `isMainnet` deployment flag
- [ ] Implement balance delta check for non-mainnet
- [ ] Create fee-on-transfer mock for testing
- [ ] Add tests for fee scenarios
- [ ] Document USDC requirements clearly
- [ ] Consider adding USDC address validation

## Related Issues

- MockUSDC safety (#019 in archive)
- Platform accounting invariants

## Gas Impact

- Additional SLOAD for balance check: ~2,100 gas
- Additional subtraction and comparison: ~50 gas
- Total overhead: ~2,150 gas (acceptable for safety on testnet)

## Deployment Notes

**Mainnet**: Can skip check if deploying with canonical USDC
**Testnet**: Should always include check for safety
**Local**: Essential for development with mock tokens

## Priority Justification

**SHOULD FIX**: While mainnet will use canonical USDC, this protects against deployment errors and makes testing more robust. The fix is simple and has minimal gas impact when properly gated.