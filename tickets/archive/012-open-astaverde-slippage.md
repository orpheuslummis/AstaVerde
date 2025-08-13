# Ticket: Add Slippage Protection to buyBatch

- Component: `contracts/AstaVerde.sol`
- Severity: Medium
- Type: Security/UX

## Background / Justification

`buyBatch` has no deadline or maximum price protection. Users submit transactions expecting current price, but if the transaction is delayed (network congestion, low gas), it executes at a potentially different price. Dutch auction means prices decay over time, but users might overpay if they submit when price is 100 USDC but transaction executes days later at 40 USDC (they still pay their approved amount).

## Impact

- Users can be forced to buy at unexpected prices
- Transactions sitting in mempool for days execute at stale prices
- Poor UX during network congestion
- Some MEV/time-arbitrage risk without user-side bounds

## Tasks

1. Add parameters to `buyBatch`:
    - `uint256 maxPrice` - Maximum price per token user is willing to pay
    - `uint256 deadline` - Timestamp after which transaction should revert
2. Add validation:
    ```solidity
    require(block.timestamp <= deadline, "Transaction expired");
    require(currentPrice <= maxPrice, "Price exceeds maximum");
    ```
3. Update all callers (tests, frontend) to provide these parameters
4. Frontend should set deadline to current time + 30 minutes by default

## Acceptance Criteria

- Transactions revert if executed after deadline
- Transactions revert if current price exceeds maxPrice
- Tests verify both protection mechanisms work
- Frontend provides sensible defaults

## Affected Files

- `contracts/AstaVerde.sol`
- `test/AstaVerde.logic.behavior.ts`
- `webapp/src/hooks/useContractInteraction.ts`

## Test Plan

- Test transaction expiry after deadline
- Test price protection when currentPrice > maxPrice
- Test normal flow with valid deadline and maxPrice
- Test edge case where price equals maxPrice exactly
