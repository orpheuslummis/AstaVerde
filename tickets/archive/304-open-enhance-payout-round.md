# Ticket: Producer Payout Rounding Correctness

- Component: `contracts/AstaVerde.sol`
- Severity: Medium
- Type: Logic/Fairness

## Background / Justification

`calculateTransferDetails` distributes the producer share using integer division. Any remainder from the division currently accrues to the platform, which is unfair though not an outright theft vector under our 6‑decimal USDC assumptions and price floors. We should distribute the remainder deterministically to producers and enforce a payout invariant for correctness.

## Tasks

1. Compute per‑token producer amount and remainder:
    - `perToken = producerShare / ids.length;`
    - `remainder = producerShare % ids.length;`
2. Aggregate `perToken` amounts by producer as today.
3. Assign the `remainder` deterministically to a producer (e.g., the first producer in the purchase set) or via a simple round‑robin; document the rule.
4. Ensure: `sum(producerPayments) + platformShare == totalPrice`.
5. Update tests to cover multiple producers and remainder scenarios; add an invariant assertion.

## Acceptance Criteria

- Total producer payouts plus platform share equals total price.
- Remainders are assigned to producers deterministically (documented).
- No regression in partial batch purchases and multi‑producer scenarios.

## Affected Files

- `contracts/AstaVerde.sol`
- `test/AstaVerde.logic.behavior.ts`
