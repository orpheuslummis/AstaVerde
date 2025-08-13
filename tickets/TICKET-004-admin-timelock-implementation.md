# TICKET-004: Implement Timelock for Admin Functions

**Priority**: HIGH  
**Type**: Security Enhancement  
**Status**: Open  
**Component**: AstaVerde.sol, EcoStabilizer.sol, StabilizedCarbonCoin.sol  
**Security Impact**: High - Reduces centralization risk  

## Summary
Admin functions across all contracts can be executed immediately by the owner, creating centralization risk and potential for malicious or accidental harm. Implementing a timelock mechanism would provide users time to react to proposed changes.

## Current Issue
The following functions can be called immediately by owner:
- AstaVerde: `setPlatformSharePercentage`, `setBasePrice`, `setPriceFloor`, `pause/unpause`
- EcoStabilizer: `pause/unpause`, `setMaxScanRange`, `adminSweepNFT`
- StabilizedCarbonCoin: `grantRole`, `revokeRole`

## Proposed Solution
Implement OpenZeppelin's TimelockController with a 48-hour delay for non-emergency functions.

### Implementation Approach
1. Deploy TimelockController with 48-hour delay
2. Transfer ownership of contracts to TimelockController
3. Set up multi-sig as proposer/executor roles
4. Keep emergency pause on a faster track (2-hour delay)

### Code Changes Required

```solidity
// Deploy TimelockController
TimelockController timelock = new TimelockController(
    48 hours,              // minDelay
    proposers,            // proposers (multi-sig)
    executors,            // executors (multi-sig)
    address(0)            // admin (renounced)
);

// Transfer ownership
astaVerde.transferOwnership(address(timelock));
ecoStabilizer.transferOwnership(address(timelock));
```

## Benefits
- Users have 48 hours to react to parameter changes
- Reduces risk of malicious admin actions
- Increases protocol transparency
- Maintains emergency response capability

## Testing Requirements
- [ ] Test timelock deployment
- [ ] Test proposal and execution flow
- [ ] Test emergency pause on shorter delay
- [ ] Verify all admin functions work through timelock

## Acceptance Criteria
- [ ] TimelockController deployed and configured
- [ ] All contracts owned by timelock
- [ ] Multi-sig controls timelock operations
- [ ] Documentation updated with timelock procedures