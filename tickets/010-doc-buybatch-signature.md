# Ticket: Update Documentation for buyBatch Signature

- Component: `contracts/AstaVerde.sol`, Documentation
- Severity: Low (Documentation Inconsistency)
- Type: Documentation

## Background / Justification

The actual `buyBatch` function signature is `(batchID, usdcAmount, tokenAmount)` with a full-amount pull and refund mechanism. Some documentation may still reference an older `maxPrice` parameter or incorrect behavior description.

## Current Implementation

```solidity
function buyBatch(uint256 batchID, uint256 usdcAmount, uint256 tokenAmount) external
```

The function:
1. Pulls the full `usdcAmount` from the buyer
2. Calculates actual cost based on current Dutch auction price
3. Refunds any excess USDC to the buyer

## Impact

- Potential confusion for integrators about the function parameters
- Mismatch between documentation and actual implementation

## Tasks

1. Update README.md to reflect the correct `buyBatch` signature
2. Update contracts/README.md with the correct signature and behavior
3. Ensure all documentation describes the full-amount pull with refund mechanism
4. Verify webapp integration uses the correct signature

## Acceptance Criteria

- All documentation accurately reflects the three-parameter signature
- The full-amount pull and refund mechanism is clearly documented
- No references to `maxPrice` parameter remain in documentation

## Affected Files

- `README.md`
- `contracts/README.md`
- Any integration documentation