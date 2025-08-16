# Security: Batch Purchase Cooldown — Won't fix (MVP)

**Priority**: MEDIUM  
**Type**: Security Enhancement  
**Status**: Won't fix (MVP) — Accepted behavior per initial spec; out of scope of SSC_PLAN v0.3  
**Component**: AstaVerde.sol  
**Security Impact**: Medium — Behavior accepted in Phase 1 design

## Summary

The `AstaVerde` primary-market mechanism increases `basePrice` by a fixed delta for each batch that sells within the `dayIncreaseThreshold` window. This behavior is buyer‑agnostic; the same address can complete multiple quick sales and trigger multiple increases.

Original proposal suggested a per‑address purchase cooldown to mitigate potential manipulation.

## Scope Decision (MVP)

- Per `SSC_PLAN.md` v0.3, the Vault (Phase 2) is deployed alongside the already‑live `AstaVerde` contract — no changes to `AstaVerde` are in scope:
  > Vault is deployed alongside the already‑live `AstaVerde` contract (address passed in constructor — no changes to the original code).
- Therefore, modifying `AstaVerde` to add a per‑address cooldown is out of scope for the MVP.
- The Phase 1 design intentionally accepts buyer‑agnostic price adjustments as part of organic price discovery.

## Current Behavior (verified)

- `updateBasePrice()` counts quick sales of recently completed batches and increases `basePrice` by `priceAdjustDelta` per qualifying batch. This is buyer‑agnostic and matches tests asserting +10 USDC per quick sale within 2 days.

## Rationale

- Cooldown is sybil‑bypassable and may degrade UX/liquidity.
- The accepted design treats repeated quick sales as demand, reflected in higher `basePrice` for future batches.
- Any change belongs to a separate Phase 1 (`AstaVerde`) revision, not SSC v0.3.

## Archival Note

This ticket is archived as "won't fix (MVP)" to reflect scope boundaries and the accepted behavior in the initial spec. Re‑open post‑MVP if priorities change and we decide to alter `AstaVerde` pricing semantics.

## Original Proposal (for reference)

Implement a per‑address cooldown between batch purchases (or per‑address quick‑sale limits). Note: if adjustable on‑chain, the cooldown cannot be declared `constant`; use a mutable state variable with a setter and event.


