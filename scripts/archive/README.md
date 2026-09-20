# Archived scripts

Quarantined on **2026-09-20**, ahead of the Ethereum mainnet redeploy. Nothing here is wired into
`package.json` or referenced from the docs any more. These files are kept rather than deleted so the
working parts (IPFS upload flow, metadata shape, the vault smoke-test sequence) can be salvaged for a
reviewed Ethereum minting and smoke-test path.

**Do not run any of these against a funded key.** Each was confirmed broken or Base-era by reading the
file against the current contracts; the line references below were verified, not assumed.

| File                  | Why it was archived                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mint.mjs`            | Base-era and unsafe. The RPC host is hardcoded to `https://base-{mainnet,sepolia}.g.alchemy.com/...` (`:33-34`), so any chain id other than `8453` silently connects to Base Sepolia; `CHAIN_ID` defaults to `84532`. Every producer is `ethers.Wallet.createRandom().address` (`:53`), so the producer share of each sale would accrue to addresses nobody holds a key for. |
| `testmint.mjs`        | Base-only. Rejects any chain outside `["8453", "84532"]` (`:40-42`) with a message that calls Base "mainnet", so chain 1 cannot be used at all. Same `Wallet.createRandom()` producers (`:101`), placeholder images, and a default token count of 50.                                                                                                        |
| `verify-vault.js`     | Broken, and mutating despite the name. Calls `vault.astaVerde()` (`:32`); no such getter exists — `EcoStabilizer.sol:60` declares `ecoAsset`. Hardcodes three stale local addresses (`:7-9`). Sends real transactions: `grantRole` (`:53`), `setApprovalForAll` (`:82`), `deposit(1)` (`:96`), `withdraw(1)` (`:106`). Ends with `main().catch(console.error)`, so it exits 0 even when the check throws. |
| `smoke_test_vault.mjs` | Broken, and cannot fail. References an undeclared `tokenInfo` at `:195` (the variable is `redeemed`, `:93-97`). Every assertion is a `console.log` of a boolean, so the run reports success regardless of outcome. Reads the deployment from `deployments/ecostabilizer-${chainId}.json` (`:46`), a path `hardhat-deploy` never writes — it writes `deployments/<network>/<Contract>.json`. RPC comes from `BASE_RPC` (`:38`) with no chain-id assertion. |
| `seed-local.js`       | Broken in two places, both swallowed. Calls `astaVerde.ownerOf(i)` (`:162`) on an ERC-1155, which has no `ownerOf`. Passes the per-token price as the `usdcAmount` argument while buying `needed` tokens (`:195`), which `AstaVerde.buyBatch` rejects; the correct `charlieTotal` is computed at `:189` and used for the `approve` two lines earlier. Both throw into a catch that only warns, so the script prints "Seeding complete!" and exits 0 without creating the redeemed-token fixture the QA docs describe. |

## References removed alongside the move

- `package.json`: the `dev:local:seed` script (it was the only caller of `seed-local.js`;
  `scripts/start-local.js` does not invoke it).
- `scripts/DEV_TOOLS_README.md`: the "Seed" step in the legacy local stack.
- `AGENTS.md`: the `seed-local.js` pointer under "Pointers".
- `docs/TESTING.md`: two `verify-vault.js` pointers, repointed at `scripts/check-vault-state.js`.
- `scripts/README.md`: the `smoke_test_vault.mjs` table row and usage blocks, the legacy
  `mint.mjs` / `testmint.mjs` block, and the `BASE_RPC` environment block that existed only for
  `smoke_test_vault.mjs`.

## What is still missing

There is no reviewed minting path for Ethereum mainnet. `scripts/mint-ethereum-sepolia.js` covers the
testnet; a mainnet equivalent, with real producer addresses and a chain-id assertion, still has to be
written.
