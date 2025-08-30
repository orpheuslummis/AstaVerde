# Ticket: Ensure Consistent Token Ordering in Partial Batch Sales

- Component: `contracts/AstaVerde.sol`
- Severity: Low
- Type: UX/Logic Issue

## Background / Justification

`getPartialIds` (lines ~349-365) iterates `batches[batchID - 1].tokenIds` in array order and collects available tokens. This yields a deterministic ascending order based on minting order for that batch, but buyers will still receive non-contiguous token IDs when gaps exist (already sold tokens), which could affect:

- Expected metadata sequence (if CIDs have ordering)
- User expectations about token numbers
- Collection completeness

The function maintains order of the batch's token IDs but, by design, cannot ensure contiguity once some tokens have been sold.

## Impact

- Users may receive non-contiguous token IDs
- Breaks assumptions about token sequences
- Potential confusion for collectors expecting specific numbers
- May affect secondary market value of "complete sets"

## Tasks

1. Document the behavior clearly:
    ```solidity
    /**
     * @notice Returns available tokens from a batch (may be non-sequential)
     * @dev Tokens are returned in order found, not guaranteed sequential
     */
    function getPartialIds(...)
    ```
2. Optional: Enforce contiguous selection only when available (revert otherwise). This changes UX and is likely undesirable; keep as documentation unless strong need arises.

    ```solidity
    function getPartialIds(uint256 batchID, uint256 numberToBuy) internal view returns (uint256[] memory) {
        // Always return the first N available tokens in ID order
        Batch storage batch = batches[batchID - 1];
        uint256[] memory result = new uint256[](numberToBuy);
        uint256 found = 0;

        for (uint256 i = 0; i < batch.tokenIds.length && found < numberToBuy; i++) {
            uint256 tokenId = batch.tokenIds[i];
            if (balanceOf(address(this), tokenId) > 0) {
                result[found++] = tokenId;
            }
        }

        require(found == numberToBuy, "Insufficient tokens");
        return result;
    }
    ```

3. Consider a frontend hint or parameter to surface which token IDs will be received, if needed for UX.

## Acceptance Criteria

- Token ordering behavior is documented
- If sequential ordering implemented, tests verify it
- Partial batch sales work correctly
- Users understand what tokens they'll receive

## Affected Files

- `contracts/AstaVerde.sol`
- `test/AstaVerde.logic.behavior.ts`
- Documentation for users

## Test Plan

- Test partial batch with gaps (tokens 1,3,5 available, buyer gets 1,3)
- Test sequential ordering if implemented
- Verify correct tokens are transferred
- Test edge cases with all patterns of sold tokens
