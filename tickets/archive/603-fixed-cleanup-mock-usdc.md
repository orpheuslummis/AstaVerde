# Cleanup: MockUSDC Constructor

**Priority**: LOW  
**Type**: Code Quality  
**Status**: Open  
**Component**: MockUSDC.sol  
**Security Impact**: None - Test contract only

## Summary

MockUSDC constructor accepts an `initialSupply` parameter that is never used (the mint call is commented out). This is misleading and should be cleaned up.

## Current Issue

```solidity
constructor(uint256 initialSupply) ERC20("Mock USDC", "USDC") {
    require(
        block.chainid == 31337 || // Hardhat local
        block.chainid == 84532 || // Base Sepolia
        block.chainid == 11155111, // Sepolia
        "MockUSDC: Production deployment forbidden"
    );
    // _mint(msg.sender, initialSupply);  // <-- Commented out
}
```

The parameter suggests initial tokens will be minted, but they aren't.

## Proposed Solutions

### Option 1: Remove the unused parameter

```solidity
constructor() ERC20("Mock USDC", "USDC") {
    require(
        block.chainid == 31337 || // Hardhat local
        block.chainid == 84532 || // Base Sepolia
        block.chainid == 11155111, // Sepolia
        "MockUSDC: Production deployment forbidden"
    );
}
```

### Option 2: Use the parameter

```solidity
constructor(uint256 initialSupply) ERC20("Mock USDC", "USDC") {
    require(
        block.chainid == 31337 || // Hardhat local
        block.chainid == 84532 || // Base Sepolia
        block.chainid == 11155111, // Sepolia
        "MockUSDC: Production deployment forbidden"
    );
    if (initialSupply > 0) {
        _mint(msg.sender, initialSupply);
    }
}
```

### Option 3: Add comment explaining why unused

```solidity
constructor(uint256 /* initialSupply - kept for interface compatibility */)
    ERC20("Mock USDC", "USDC") {
    // initialSupply parameter maintained for backwards compatibility
    // but not used - tokens are minted via mint() function instead
    require(
        block.chainid == 31337 || // Hardhat local
        block.chainid == 84532 || // Base Sepolia
        block.chainid == 11155111, // Sepolia
        "MockUSDC: Production deployment forbidden"
    );
}
```

## Impact on Deployment Scripts

Need to check if any deployment scripts pass initialSupply:

- If yes: Keep parameter, add comment
- If no: Remove parameter entirely

## Benefits

- Clearer code intent
- No confusion for developers
- Cleaner test setup

## Testing Requirements

- [ ] Check all deployment scripts for MockUSDC usage
- [ ] Update scripts if parameter is removed
- [ ] Verify tests still pass
- [ ] Confirm no breaking changes

## Acceptance Criteria

- [ ] Constructor parameter issue resolved
- [ ] All deployment scripts updated if needed
- [ ] Tests pass
- [ ] Code is clear about intent
