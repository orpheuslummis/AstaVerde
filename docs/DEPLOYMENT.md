# AstaVerde Deployment Guide (Arbitrum)

This guide documents the current deployment workflow for AstaVerde (marketplace) + EcoStabilizer (vault) on Arbitrum.

**Canonical commands**

- Testnet (Sepolia → Arbitrum Sepolia): `npm run deploy:testnet`
- Mainnet (Arbitrum One): `npm run deploy:mainnet`
- Webapp (Sepolia): `npm run dev:sepolia` (runs on port 3002)

Deployments are executed via `scripts/deploy-with-validation.js` (compile + ABI validation + `hardhat deploy`).

---

## Networks

| Network          | Hardhat name       | Chain ID |
| ---------------- | ------------------ | -------- |
| Arbitrum Sepolia | `arbitrum-sepolia` | 421614   |
| Arbitrum One     | `arbitrum-one`     | 42161    |

Notes:

- In repo scripts/docs, “Sepolia” is a pointer to the current testnet target (currently **Arbitrum Sepolia**).
- Local Hardhat (`npm run dev:local`) still exists but is not the primary workflow.

---

## Environment Setup

### Root `.env.local` (secrets, untracked)

Create from `.env.local.example` and fill in your values.

Required for deploys:

```bash
PRIVATE_KEY=0x...                 # deployer key
RPC_API_KEY=...                   # Alchemy key (used if *_RPC_URL overrides not set)

# Optional direct RPC overrides (recommended to avoid 429s / rate limits)
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/your-key
ARBITRUM_MAINNET_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/your-key

# Optional owner override (if omitted, deployer is used as owner)
OWNER_ADDRESS=0x...

# Optional verification keys
ARBITRUM_SEPOLIA_EXPLORER_API_KEY=...
ARBITRUM_MAINNET_EXPLORER_API_KEY=...

# Mainnet vault controls (only needed on arbitrum-one)
DEPLOY_VAULT_V2=false
USE_EXISTING_ASTAVERDE=false
AV_ADDR=0x...
RENOUNCE_SCC_ADMIN=false
```

### Webapp `webapp/.env.local` (public, untracked)

Create from `webapp/.env.local.example`. This is the **single source of truth** for local webapp runtime config.

- Local dev (Sepolia): `npm run dev:sepolia` reads `webapp/.env.local` and forces `NEXT_PUBLIC_CHAIN_SELECTION=arbitrum_sepolia`.
- Production: set the same `NEXT_PUBLIC_*` variables in Vercel (don’t commit an env file).

---

## Deploy to Sepolia (Arbitrum Sepolia)

1. Fund the deployer account with test ETH.
2. Deploy:

```bash
npm run deploy:testnet
```

3. Copy the printed addresses into `webapp/.env.local`:

- `NEXT_PUBLIC_ASTAVERDE_ADDRESS`
- `NEXT_PUBLIC_ECOSTABILIZER_ADDRESS` (optional if vault not deployed)
- `NEXT_PUBLIC_SCC_ADDRESS` (optional if vault not deployed)

4. Start the webapp:

```bash
npm run dev:sepolia
```

---

## Deploy to Mainnet (Arbitrum One)

1. Prepare `.env.local` with mainnet RPC + explorer key.
2. Decide whether to deploy a fresh marketplace contract:

- Fresh deploy: leave `USE_EXISTING_ASTAVERDE=false`.
- Reuse an existing marketplace: set `USE_EXISTING_ASTAVERDE=true` and `AV_ADDR=0x...`.

3. Vault on mainnet is **opt-in**: set `DEPLOY_VAULT_V2=true` to deploy SCC + EcoStabilizer.
4. Deploy:

```bash
npm run deploy:mainnet
```

5. In Vercel, set `NEXT_PUBLIC_*` env vars (see `webapp/.env.local.example`) for Arbitrum One.

---

## Verification

- Contract verification helper: `npm run verify:contracts`
- ABI sanity check: `npm run validate:abis`

---

## Where to Find Addresses

Hardhat Deploy artifacts are written under:

- `deployments/arbitrum-sepolia/*.json`
- `deployments/arbitrum-one/*.json`

Each contract file contains an `address` field.
