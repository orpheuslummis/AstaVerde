# Ticket: Emit Event on `maxScanRange` Change in EcoStabilizer

- Component: `contracts/EcoStabilizer.sol`
- Severity: Low (Ops/Observability)
- Type: Enhancement

## Background / Justification

`setMaxScanRange` changes a view-scan safety limit that impacts indexers/UX. Emitting an event helps off-chain services react to changes and improves transparency.

## Tasks

1. Add an event `MaxScanRangeUpdated(uint256 oldValue, uint256 newValue)`.
2. Emit it in `setMaxScanRange` after updating the state.
3. Add/adjust tests to assert the event fires with correct values.

## Acceptance Criteria

- Event is emitted whenever `maxScanRange` changes with old and new values.
- No functional changes to deposit/withdraw logic.

## Affected Files

- `contracts/EcoStabilizer.sol`
- `test/EcoStabilizer.ts`
