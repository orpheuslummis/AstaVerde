# Ticket: Block Zero Address Producers in mintBatch

- Component: `contracts/AstaVerde.sol`
- Severity: High
- Type: Security/Logic Bug

## Background / Justification

`mintBatch` allows `producers[i] == address(0)`. When tokens with zero address producers are sold, the contract attempts to transfer USDC to address(0), which will either:

1. Succeed and burn the funds (lost forever)
2. Revert if the USDC contract blocks transfers to zero address

This breaks the economic model where producers should receive 70% of sales (or configured percentage).

## Impact

- Producer funds lost/burned when sent to address(0)
- Breaks accounting and economic incentives
- Potential transaction reverts during payout
- Lost funds cannot be recovered

## Tasks

1. Add validation in `mintBatch` function:
    ```solidity
    for (uint256 i = 0; i < producers.length; i++) {
        require(producers[i] != address(0), "Invalid producer address");
        // ... rest of minting logic
    }
    ```
2. Add similar check in any other functions that set producers
3. Update tests to verify zero address is rejected
4. Consider validating producer addresses are not contract addresses (optional)

## Acceptance Criteria

- `mintBatch` reverts when any producer is address(0)
- Existing valid mints still work correctly
- Tests verify zero address validation
- Error message clearly indicates the issue

## Affected Files

- `contracts/AstaVerde.sol`
- `test/AstaVerde.logic.behavior.ts`

## Test Plan

- Test mintBatch with address(0) in producers array (should revert)
- Test mintBatch with all valid addresses (should succeed)
- Test edge case with address(0) in middle of array
- Verify error message is descriptive
