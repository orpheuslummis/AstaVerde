# Ticket: Fix Event Emission Ordering for Failed Transactions

- Component: `contracts/AstaVerde.sol`
- Severity: Low
- Type: Code Style/Best Practice

## Background / Justification

Events are emitted after state changes but before external transfers complete. While Ethereum rolls back all events on transaction revert (no persistence), emitting events after all operations complete is considered better practice for:

- Code readability
- Clearer execution flow
- Consistency with checks-effects-interactions pattern

Example in `buyBatch`: Events emitted at lines 260-262, but transfers happen at lines 267-278.

## Impact

- Minor: No actual security risk since events roll back on revert
- Style preference for cleaner code organization
- May improve code maintainability
- Aligns with best practices

## Tasks

1. Move event emissions to after all external calls succeed:

    ```solidity
    function buyBatch(...) {
        // ... state changes ...

        // All external transfers
        require(usdcToken.transferFrom(msg.sender, address(this), totalCost), "Transfer failed");
        // ... producer payments ...
        _safeBatchTransferFrom(address(this), msg.sender, ids, tokenAmounts, "");

        // Only emit events after everything succeeds
        if (batch.remainingTokens == 0) {
            emit BatchSold(batchID, block.timestamp, tokenAmount);
        } else {
            emit PartialBatchSold(batchID, block.timestamp, batch.remainingTokens);
        }
    }
    ```

2. Apply same pattern to all functions with events + external calls
3. Document the event emission strategy

## Alternative Approach

- Keep current order but add "pending" and "confirmed" event pairs
- Use try/catch for external calls and emit failure events

## Acceptance Criteria

- Events only emitted after all operations succeed
- Failed transactions don't emit success events
- Event ordering documented
- Tests verify events aren't emitted on revert

## Affected Files

- `contracts/AstaVerde.sol`
- Event-dependent tests may need updates

## Test Plan

- Test transaction that fails on transfer (no events emitted)
- Test successful transaction (events emitted correctly)
- Verify event order matches execution order
- Check all functions with external calls + events
