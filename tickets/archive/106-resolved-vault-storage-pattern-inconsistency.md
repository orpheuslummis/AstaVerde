# 106: Fixed - Vault Storage Pattern Consistency

## Status: FIXED (Archived)

## Component: EcoStabilizer.sol

## Summary
- Single and batch withdrawals now both clear loan storage with `delete`, ensuring consistent state, lower storage footprint, and gas refunds on cleanup.

## Evidence
```192:201:contracts/EcoStabilizer.sol
function _withdrawInternal(uint256 tokenId) internal {
    Loan memory loan = loans[tokenId];
    require(loan.active && loan.borrower == msg.sender, "not borrower");

    // Update state first (CEI pattern)
    _removeFromUserIndex(loan.borrower, tokenId);
    totalActiveLoans -= 1;
    delete loans[tokenId];

    // Collect repayment then return collateral
    scc.transferFrom(msg.sender, address(this), SCC_PER_ASSET);
```

```332:336:contracts/EcoStabilizer.sol
// Clear the loan via index removal and delete
_removeFromUserIndex(msg.sender, tokenId);
totalActiveLoans -= 1;
delete loans[tokenId];
```

## Notes
- Older reports mentioned `loans[tokenId].active = false` in single withdraw. That is no longer present.
- See ticket 105 for related refactors that standardized delete-based cleanup and added indices.

## Date
- 2025-08-24


