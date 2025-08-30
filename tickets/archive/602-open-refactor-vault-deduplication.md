# Refactor: EcoStabilizer Code Deduplication

**Priority**: LOW  
**Type**: Code Quality  
**Status**: Closed  
**Component**: EcoStabilizer.sol  
**Security Impact**: None - Code quality improvement

## Summary

Deduplicated withdraw logic in `EcoStabilizer` by extracting a shared internal function and consolidating to a single external entrypoint `withdraw(uint256)`. The former `repayAndWithdraw` function was removed on‑chain; a frontend alias still routes to `withdraw` to preserve UX.

## Resolution

Removed duplication and aligned with plan: single `withdraw` entrypoint that collects repayment via `transferFrom` and then `burn`s.

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

        // Collect repayment and return collateral
        scc.transferFrom(msg.sender, address(this), SCC_PER_ASSET);
        scc.burn(SCC_PER_ASSET);
        ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");

        emit Withdrawn(msg.sender, tokenId);
    }

    // Single public entrypoint
    function withdraw(uint256 tokenId) external nonReentrant whenNotPaused {
        _withdrawInternal(tokenId);
    }
}
```

### Alternative considered

- Keep `repayAndWithdraw` as an alias calling the internal function. Decided against it on‑chain; alias maintained only in the frontend, routing to `withdraw`.

## Benefits

- Reduces code duplication
- Single source of truth for withdrawal logic
- Easier maintenance and updates
- Smaller contract size (saves deployment gas)
- Cleaner codebase

## Risks

- Minor external interface change: `repayAndWithdraw` removed on‑chain. Mitigated by frontend alias and updated tests/docs.
- No behavioral change to withdrawal semantics.

## Testing Results

- [x] Withdraw works via single entrypoint
- [x] Gas costs comparable or improved
- [x] Edge cases covered (paused, not borrower, inactive loan, allowance)
- [x] Events unchanged and emitted correctly

## Acceptance Criteria

- [x] Common logic extracted to internal function
- [x] Single `withdraw` entrypoint on‑chain; `repayAndWithdraw` removed
- [x] Frontend alias preserved, routing to `withdraw`
- [x] All existing tests pass
- [x] Documentation updated where applicable
