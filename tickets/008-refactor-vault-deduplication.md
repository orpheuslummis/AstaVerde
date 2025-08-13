# Refactor: EcoStabilizer Code Deduplication

**Priority**: LOW  
**Type**: Code Quality  
**Status**: Open  
**Component**: EcoStabilizer.sol  
**Security Impact**: None - Code quality improvement  

## Summary
The `withdraw` and `repayAndWithdraw` functions in EcoStabilizer contain identical logic. This duplication can be eliminated by extracting the common code into an internal function.

## Current Issue
Both functions have identical implementation:
```solidity
function withdraw(uint256 tokenId) external nonReentrant whenNotPaused {
    Loan memory loan = loans[tokenId];
    require(loan.active && loan.borrower == msg.sender, "not borrower");
    loans[tokenId].active = false;
    scc.burnFrom(msg.sender, SCC_PER_ASSET);
    ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");
    emit Withdrawn(msg.sender, tokenId);
}

function repayAndWithdraw(uint256 tokenId) external nonReentrant whenNotPaused {
    Loan memory loan = loans[tokenId];
    require(loan.active && loan.borrower == msg.sender, "not borrower");
    loans[tokenId].active = false;
    scc.burnFrom(msg.sender, SCC_PER_ASSET);
    ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");
    emit Withdrawn(msg.sender, tokenId);
}
```

## Proposed Solution
Extract common logic into an internal function.

### Implementation

```solidity
contract EcoStabilizer {
    // Internal function with common logic
    function _withdrawInternal(uint256 tokenId) internal {
        Loan memory loan = loans[tokenId];
        require(loan.active && loan.borrower == msg.sender, "not borrower");
        
        // Update state first (CEI pattern)
        loans[tokenId].active = false;
        
        // External interactions after state changes
        scc.burnFrom(msg.sender, SCC_PER_ASSET);
        ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");
        
        emit Withdrawn(msg.sender, tokenId);
    }
    
    // Public functions become simple wrappers
    function withdraw(uint256 tokenId) external nonReentrant whenNotPaused {
        _withdrawInternal(tokenId);
    }
    
    /// @notice Convenience function: identical to withdraw but with different name for UX
    /// @dev Still requires user to approve vault for 20 SCC spend before calling
    function repayAndWithdraw(uint256 tokenId) external nonReentrant whenNotPaused {
        _withdrawInternal(tokenId);
    }
}
```

### Alternative: Single function with alias
```solidity
// Keep only one function
function withdraw(uint256 tokenId) external nonReentrant whenNotPaused {
    // ... implementation ...
}

// Add comment explaining that repayAndWithdraw was merged
// Update documentation and frontend to use withdraw
```

## Benefits
- Reduces code duplication
- Single source of truth for withdrawal logic
- Easier maintenance and updates
- Smaller contract size (saves deployment gas)
- Cleaner codebase

## Risks
- None - purely internal refactoring
- External interface remains unchanged
- No functional changes

## Testing Requirements
- [ ] Verify both functions still work identically
- [ ] Confirm gas costs remain similar
- [ ] Test all edge cases for both entry points
- [ ] Verify events are still emitted correctly

## Acceptance Criteria
- [ ] Common logic extracted to internal function
- [ ] Both external functions use internal function
- [ ] All existing tests pass
- [ ] Gas usage comparable or improved
- [ ] Documentation updated if needed