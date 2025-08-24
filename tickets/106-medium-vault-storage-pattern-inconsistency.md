# Ticket #106: MEDIUM - Storage Pattern Inconsistency Between Withdraw Methods

## Priority: MEDIUM

## Component: EcoStabilizer.sol

## Issue Type: Code Consistency / Potential Bug

## Description

The vault uses different storage cleanup patterns for single vs batch withdrawals. The single `withdraw()` function sets `loans[tokenId].active = false`, while `withdrawBatch()` uses `delete loans[tokenId]`. This inconsistency could lead to unexpected behavior and maintenance issues.

## Location

- File: `contracts/EcoStabilizer.sol`
- Single withdraw: Line 181 (`loans[tokenId].active = false`)
- Batch withdraw: Line 366 (`delete loans[tokenId]`)

## Current Implementation

### Single Withdraw

```solidity
function _withdrawInternal(uint256 tokenId) internal {
    Loan memory loan = loans[tokenId];
    require(loan.active && loan.borrower == msg.sender, "not borrower");

    // Update state first (CEI pattern)
    loans[tokenId].active = false;  // <-- Keeps borrower address, sets active=false

    // ... rest of function
}
```

### Batch Withdraw

```solidity
function withdrawBatch(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
    // ... validation ...

    for (uint256 i = 0; i < tokenIds.length; i++) {
        uint256 tokenId = tokenIds[i];

        // ... verification ...

        // Clear the loan
        delete loans[tokenId];  // <-- Completely removes the struct

        emit Withdrawn(msg.sender, tokenId);
    }

    // ... rest of function
}
```

## Problems

### 1. Different Storage States After Withdrawal

After single withdrawal:

```solidity
loans[tokenId] = Loan({
    borrower: 0x123...,  // Original borrower preserved
    active: false        // Marked inactive
});
```

After batch withdrawal:

```solidity
loans[tokenId] = Loan({
    borrower: address(0),  // Zero address
    active: false          // Default false
});
```

### 2. Inconsistent Gas Costs

- `delete` gets gas refund for clearing storage
- Setting `active = false` keeps storage allocated
- Batch operations more gas efficient per token

### 3. Historical Data Preservation

- Single withdrawals preserve borrower history
- Batch withdrawals erase all loan data
- Inconsistent for analytics/debugging

### 4. Potential Edge Cases

```solidity
// After single withdrawal
if (loans[tokenId].borrower != address(0)) {
    // This executes even though loan is inactive
}

// After batch withdrawal
if (loans[tokenId].borrower != address(0)) {
    // This doesn't execute
}
```

## Impact

- **Confusion**: Developers expect consistent behavior
- **Gas**: Inefficient storage usage in single withdrawals
- **Testing**: Need to test both patterns separately
- **Future Bugs**: Easy to introduce bugs when modifying

## Recommended Fix

### Option 1: Standardize on `delete` (Preferred)

```solidity
function _withdrawInternal(uint256 tokenId) internal {
    Loan memory loan = loans[tokenId];
    require(loan.active && loan.borrower == msg.sender, "not borrower");

    // Consistent with batch withdrawal
    delete loans[tokenId];  // <-- Use delete for consistency

    // ... rest of function
}
```

Benefits:

- Gas refund from storage cleanup
- Consistent behavior across methods
- Cleaner state

### Option 2: Standardize on Setting Inactive

```solidity
function withdrawBatch(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
    // ...
    for (uint256 i = 0; i < tokenIds.length; i++) {
        // ...

        // Consistent with single withdrawal
        loans[tokenId].active = false;  // <-- Keep borrower data

        // ...
    }
}
```

Benefits:

- Preserves historical data
- Could be useful for analytics

### Option 3: Add Explicit History Tracking

```solidity
// Add separate history mapping
mapping(uint256 => address) public loanHistory;

function _withdrawInternal(uint256 tokenId) internal {
    // ...

    // Save history before deletion
    loanHistory[tokenId] = loan.borrower;

    // Then consistently delete
    delete loans[tokenId];

    // ...
}
```

## Testing Required

- Verify gas costs for both patterns
- Test re-deposit after withdrawal (both methods)
- Check view functions with mixed withdrawal types
- Verify event emissions are consistent

## Code Quality Impact

- Reduces cognitive load for developers
- Prevents future bugs from assumption mismatches
- Makes code review easier
- Improves test coverage efficiency

## References

- Line 181: Single withdrawal keeps data
- Line 366: Batch withdrawal deletes data
- Gas refund: 15,000 gas for storage deletion
- Similar pattern in many DeFi protocols
