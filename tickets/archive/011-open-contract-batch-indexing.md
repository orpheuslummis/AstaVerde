# Ticket: Fix Batch Array Index Consistency

- Component: `contracts/AstaVerde.sol`
- Severity: Low
- Type: Code Quality/Potential Bug
- **Status: OPEN** - Pattern still exists (line 234: `batches[batchID - 1]`)

## Background / Justification

The contract mixes 0-based and 1-based indexing for batches:

- `batches` array uses 0-based indexing (standard for arrays)
- `batchID` starts at 1 (line 90: `lastBatchID = 0`, incremented before use)
- Access pattern: `batches[batchID - 1]` appears multiple times

This pattern is error-prone and could lead to:

- Off-by-one errors
- Confusion during maintenance
- Potential array access issues if not handled carefully

Example (line 198): `batchCreationIndex[lastBatchID] = newIndex` where newIndex is array position.

## Impact

- Increased risk of index-related bugs
- Code harder to understand and maintain
- Potential for future developers to introduce errors
- May cause unexpected behavior if assumptions are violated

## Tasks

1. Document the indexing strategy clearly with comments:
    ```solidity
    // Batches use 1-based IDs for external reference
    // Internal storage uses 0-based array indexing
    // Conversion: storage index = batchID - 1
    ```
2. Consider creating helper functions:

    ```solidity
    function _getBatchIndex(uint256 batchID) private pure returns (uint256) {
        require(batchID > 0, "Invalid batch ID");
        return batchID - 1;
    }

    function _getBatch(uint256 batchID) private view returns (Batch storage) {
        return batches[_getBatchIndex(batchID)];
    }
    ```

3. Add validation in all functions using batchID
4. Update all direct array accesses to use helpers

## Alternative Approach

- Start batchID at 0 to match array indexing (breaking change)
- Use a mapping instead of array (gas implications)

## Acceptance Criteria

- Clear documentation of indexing strategy
- Consistent access pattern throughout contract
- No direct `batches[batchID - 1]` outside of helper
- Tests verify boundary conditions (batchID = 0, 1, max)

## Affected Files

- `contracts/AstaVerde.sol`
- Tests may need updates if helpers change interface

## Test Plan

- Test batchID = 0 handling (should revert)
- Test batchID = 1 (first batch)
- Test batchID = batches.length (last batch)
- Test batchID > batches.length (should revert)
