# Ticket #103: CRITICAL - SCC Deployment Role Management Can Brick System (Archived)

## Status: Resolved via Deployment Script Guard

## Summary

The risk of permanently bricking SCC by renouncing `DEFAULT_ADMIN_ROLE` before granting `MINTER_ROLE` to the vault has been mitigated by hardening the deployment script with pre-renounce guards.

## Resolution

- Implemented pre-renounce verification in `scripts/deploy_ecostabilizer.ts`:
  - Verifies `MINTER_ROLE` is granted to the intended vault(s) before renouncing admin.
  - Aborts renunciation with a clear error if verification fails.
- Updated `docs/deployment/DEPLOYMENT.md` to document the guard and show the correct snippet.

## Key Snippet (Implemented)

```typescript
// After granting MINTER_ROLE to vault(s)
const v1MinterOk = await scc.hasRole(MINTER_ROLE, await ecoStabilizer.getAddress());
if (!v1MinterOk) {
    throw new Error("🚨 CRITICAL: Vault (V1) does not have MINTER_ROLE - aborting renounce");
}
if (ecoStabilizerV11) {
    const v11MinterOk = await scc.hasRole(MINTER_ROLE, await ecoStabilizerV11.getAddress());
    if (!v11MinterOk) {
        throw new Error("🚨 CRITICAL: Vault (V1.1) does not have MINTER_ROLE - aborting renounce");
    }
}
await scc.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
```

## Notes

- We intentionally resolved via script-level controls to avoid on-chain complexity; contracts remain immutable and simple.
- If future vault rotation is required, use a managed admin holder (e.g., multisig) instead of immediate renounce.

## Files Updated

- `scripts/deploy_ecostabilizer.ts` – Pre-renounce guard added.
- `docs/deployment/DEPLOYMENT.md` – Documentation updated.

## Closure Rationale

With the guard in place and documented, accidental or mis-sequenced deployments will fail fast before admin renounce, removing the brick risk described.


