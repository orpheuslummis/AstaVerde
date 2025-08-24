## Coexistence Plan: V1 + V1.1 with Two Vaults, One SCC (Concise)

Why

- AstaVerde v1 is live; security hardening (refund‑siphon fix, SafeERC20, pause bridge, price guards, stricter bounds) should not be back‑ported.
- Deploy AstaVerde v1.1 for all future batches and keep v1 NFTs usable in the vault with zero migrations.
- Keep implementation simple for a solo dev and low budget.

What (Architecture)

- AstaVerde v1: keep for existing NFTs; no new batches.
- AstaVerde v1.1: hardened; all future batches.
- EcoStabilizer Vault‑V1 ← binds to v1; EcoStabilizer Vault‑V11 ← binds to v1.1.
- SCC: single token shared by both vaults (both have `MINTER_ROLE`).
- Optional: set `trustedVault` on both contracts so vault transfers continue when the marketplace is paused (if v1 supports it).

How (Steps)

1. Deploy AstaVerde v1.1 (current hardened code)
2. Deploy SCC (or reuse existing)
3. Deploy Vault‑V1 (bind v1) and Vault‑V11 (bind v1.1)
4. Grant SCC `MINTER_ROLE` to both vaults; renounce SCC admin
5. Set `trustedVault` on v1 (if available) and v1.1
6. Freeze new batches on v1; mint on v1.1
7. Update frontend routing and envs; ship

Frontend routing (minimal)

```ts
export function getVaultForAsset(assetAddress: `0x${string}`) {
    return assetAddress.toLowerCase() === process.env.NEXT_PUBLIC_ASTAVERDE_V1!.toLowerCase()
        ? (process.env.NEXT_PUBLIC_ECOSTABILIZER_V1 as `0x${string}`)
        : (process.env.NEXT_PUBLIC_ECOSTABILIZER_V11 as `0x${string}`);
}
```

Environment (webapp)

```ini
NEXT_PUBLIC_ASTAVERDE_V1=0x...
NEXT_PUBLIC_ASTAVERDE_V11=0x...
NEXT_PUBLIC_ECOSTABILIZER_V1=0x...
NEXT_PUBLIC_ECOSTABILIZER_V11=0x...
NEXT_PUBLIC_SCC_ADDRESS=0x...
```

Ops notes

- One SCC pool/venue; no bridges, wrappers, or migrations.
- Vaults keep working during marketplace pauses via `trustedVault`.
- Cross‑vault totals can be added later; not required now.

Risks

- Two vault addresses to maintain (slight config overhead).
- `trustedVault` on v1 only if the deployed v1 includes that function.

Checklist

- [ ] SCC deployed (or reused) and `MINTER_ROLE` granted to both vaults
- [ ] EcoStabilizer‑V1 (AV_ADDR) and EcoStabilizer‑V11 (AV_ADDR_V11) deployed
- [ ] SCC admin renounced from deployer
- [ ] `trustedVault` set on AstaVerde v1 (if supported) and v1.1
- [ ] Primary market UI points to AstaVerde v1.1 only
- [ ] Webapp env configured for V1/V1.1 + both vaults + SCC
- [ ] Per‑token vault routing implemented in frontend
