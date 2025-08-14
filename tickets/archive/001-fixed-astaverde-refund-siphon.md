# Ticket: Fix Overpayment Refund Siphon in AstaVerde.buyBatch

- Component: `contracts/AstaVerde.sol`
- Severity: Critical
- Type: Logic/Security Bug
- **Status: ✅ FIXED**
- **Last Checked: 2025-08-13**

## ✅ FIXED STATUS

**VULNERABILITY RESOLVED**: The contract now properly handles overpayments:

- Line 295: Contract pulls FULL `usdcAmount` via `safeTransferFrom`
- Line 277: Calculates `refundAmount = usdcAmount > totalCost ? usdcAmount - totalCost : 0`
- Line 304: Refunds from pulled funds, not contract balance
- **Fix Applied**: Full amount pulled first, then excess refunded - prevents siphon attack

## Background / Justification

`buyBatch(batchID, usdcAmount, tokenAmount)` computes `refundAmount = usdcAmount - totalCost` but only pulls `totalCost` via `usdcToken.transferFrom`. If `usdcAmount > totalCost`, the function refunds the difference from the contract’s existing USDC balance, enabling an attacker to siphon previously accumulated funds (e.g., platform share) without depositing the overage.

## Impact

- Attacker can drain the contract’s USDC reserves by calling `buyBatch` with inflated `usdcAmount` while approving only `totalCost`.
- Loss of funds; breaks financial invariants and platform payouts.

## Tasks (Preferred Option A)

1. Change `buyBatch` signature to remove `usdcAmount` parameter.
2. Compute `totalCost = getCurrentBatchPrice(batchID) * tokenAmount` and pull exactly `totalCost` via `transferFrom`.
3. Remove refund logic entirely (no surplus paths).
4. Update frontend/tasks/tests to stop passing `usdcAmount` and to approve only exact `totalCost`.

## Alternative (Option B, if overpay UX is desired)

1. Keep `usdcAmount` param, require `usdcAmount >= totalCost`.
2. First pull `usdcAmount` using `transferFrom`.
3. Refund `usdcAmount - totalCost` back to `msg.sender` (emit `RefundIssued(buyer, amount)`).
4. (Optional) Cap overpay to a small multiple of `totalCost` to limit griefing.

## Acceptance Criteria

- `buyBatch` cannot cause the contract to transfer out more USDC than was transferred in for the purchase.
- New or updated tests assert that over-declaring payment cannot drain prior balances.
- All existing behavior (price calc, platform/producers split, transfers) remains correct.

## Affected Files

- `contracts/AstaVerde.sol`
- `test/AstaVerde.logic.behavior.ts` (adjust tests)
- `webapp` purchase flow if it relied on `usdcAmount`

## Test Plan

- Add a test where the attacker attempts overpay; verify no funds are siphoned and transaction behaves as expected.
- Regression on normal purchase path and partial-batch purchases.
