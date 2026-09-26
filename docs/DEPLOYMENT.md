# AstaVerde Deployment Guide (Ethereum)

This guide documents the current deployment workflow for AstaVerde (marketplace) + EcoStabilizer (vault) on Ethereum.

**Canonical commands**

- Testnet (Ethereum Sepolia): `npm run deploy:testnet`
- Mainnet (Ethereum mainnet): `npm run deploy:mainnet`
- Webapp (Sepolia): `npm run dev:sepolia` (runs on port 3002)

Deployments are executed via `scripts/deploy-with-validation.js` (compile + ABI validation + `hardhat deploy`).

Arbitrum One remains deployed and is not touched by this workflow. Its commands still exist under the
`arbitrum-*` script names: `npm run deploy:arbitrum-testnet`, `npm run deploy:arbitrum-mainnet`,
`npm run mint:arbitrum-testnet`.

---

## Networks

| Network          | Hardhat name       | Chain ID |
| ---------------- | ------------------ | -------- |
| Ethereum Sepolia | `ethereum-sepolia` | 11155111 |
| Ethereum mainnet | `ethereum-mainnet` | 1        |
| Arbitrum Sepolia | `arbitrum-sepolia` | 421614   |
| Arbitrum One     | `arbitrum-one`     | 42161    |

Notes:

- In repo scripts/docs, “Sepolia” is a pointer to the current testnet target (currently **Ethereum Sepolia**).
- The network name carries behaviour: `deploy/deploy.ts` auto-deploys the vault and refuses to renounce
  SCC admin on any network whose name contains `sepolia`.
- Local Hardhat (`npm run dev:local`) still exists but is not the primary workflow.

---

## Environment Setup

### Root `.env.local` (secrets, untracked)

Create from `.env.local.example` and fill in your values. This is what Hardhat itself reads
(`hardhat.config.ts` loads `.env` then `.env.local`), and what standalone helper scripts such as
`npm run mint:testnet` read.

Required for deploys:

```bash
PRIVATE_KEY=0x...                 # deployer key
RPC_API_KEY=...                   # Alchemy key (used if *_RPC_URL overrides not set)

# Optional direct RPC overrides (recommended to avoid 429s / rate limits)
ETHEREUM_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
ETHEREUM_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key

# Optional owner override (if omitted, deployer is used as owner)
OWNER_ADDRESS=0x...

# Verification: Etherscan V2 uses one key for both mainnet and Sepolia
ETHERSCAN_API_KEY=...
```

### Per-network `.env.ethereum-sepolia` / `.env.ethereum-mainnet` (untracked)

`scripts/deploy-with-validation.js` loads `.env`, then `.env.local`, then `.env.<network>` with
override. Templates are tracked as `.env.ethereum-sepolia.example` and `.env.ethereum-mainnet.example`;
copy and fill. Put chain-specific flags there rather than in `.env.local`.

**Precedence gotcha.** The wrapper applies `.env.<network>` last, but then spawns
`npx hardhat deploy`, and `hardhat.config.ts` re-loads `.env.local` with override inside that child
process. Any key present in `.env.local` therefore wins — including an empty `KEY=`, which dotenv
parses as `""`. Keep `DEPLOY_VAULT_V2`, `USE_EXISTING_ASTAVERDE`, `AV_ADDR`, `RENOUNCE_SCC_ADMIN`,
`DEPLOY_WAIT_CONFIRMATIONS` and `USDC_ADDRESS` out of `.env.local` (commented out in the example)
so the per-network file is the one that decides. This predates the Ethereum work; it applies to the
`arbitrum-*` targets too.

### Webapp `webapp/.env.local` (public, untracked)

Create from `webapp/.env.local.example`. This is the **single source of truth** for local webapp runtime config.

- Local dev (Sepolia): `npm run dev:sepolia` reads `webapp/.env.local` and forces
  `NEXT_PUBLIC_CHAIN_SELECTION`. It defaults to `ethereum_sepolia`; set `CHAIN_SELECTION=arbitrum_sepolia`
  in the shell to point the same runner at the Arbitrum testnet.
- Production: set the same `NEXT_PUBLIC_*` variables in Vercel (don’t commit an env file).

---

## Deploy to Sepolia (Ethereum Sepolia)

1. Fund the deployer account with Sepolia ETH.
2. Deploy:

```bash
npm run deploy:testnet
```

MockUSDC is deployed automatically: chain 11155111 is in `mockSupportedChainIds` in `deploy/deploy.ts`,
so no `USDC_ADDRESS` is needed. The vault (SCC + EcoStabilizer) is always deployed on a `sepolia` network.

3. Copy the printed addresses into `webapp/.env.local`:

- `NEXT_PUBLIC_ASTAVERDE_ADDRESS`
- `NEXT_PUBLIC_ECOSTABILIZER_ADDRESS`
- `NEXT_PUBLIC_SCC_ADDRESS`
- `NEXT_PUBLIC_USDC_ADDRESS` (the deployed MockUSDC)

4. Optionally mint a test batch:

```bash
npm run mint:testnet -- --count 3
```

5. Start the webapp:

```bash
npm run dev:sepolia
```

---

## Deploy to Mainnet (Ethereum mainnet)

1. Prepare `.env.ethereum-mainnet` from `.env.ethereum-mainnet.example`. The flags that matter:

```bash
PRIVATE_KEY=0x...
OWNER_ADDRESS=                    # empty: deploy as deployer, transferOwnership afterwards
ETHEREUM_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
ETHERSCAN_API_KEY=...

DEPLOY_VAULT_V2=true              # vault is opt-in on a production network
USE_EXISTING_ASTAVERDE=false      # fresh marketplace deploy
AV_ADDR=                          # only with USE_EXISTING_ASTAVERDE=true
RENOUNCE_SCC_ADMIN=false          # irreversible; set true only on the owner's decision
DEPLOY_WAIT_CONFIRMATIONS=2       # L1 blocks are ~12s; 2 confirmations before dependent reads
USDC_ADDRESS=                     # empty: Circle USDC 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

Keep `PRIVATE_KEY`, `ETHEREUM_MAINNET_RPC_URL` and `ETHERSCAN_API_KEY` in the root `.env.local`; the
per-network file only needs the flags. Plain `npx hardhat deploy` does not read `.env.ethereum-mainnet`;
`npm run deploy:mainnet` does, so use that entry point.

2. Pre-checks, all must hold:

- `deployments/ethereum-mainnet/` does not exist (hardhat-deploy would reuse recorded addresses).
- The base fee is under about 1 gwei (the deployer then pays about 0.0013 ETH in total; the whole run is
  about 7M gas). The script clamps the mainnet tip to 0.1–1 gwei.
- `npx hardhat test` passes.

3. Deploy:

```bash
npm run deploy:mainnet
```

It deploys AstaVerde (owner = deployer), SCC and EcoStabilizer, grants `MINTER_ROLE` on SCC to the vault
and waits for that receipt, renounces the deployer's SCC admin role when `RENOUNCE_SCC_ADMIN=true`, and
sets `AstaVerde.trustedVault` to the vault. Inline Etherscan verification usually fails this soon after
deployment; that is not fatal (see Verification below).

If the run is interrupted and restarted: when hardhat-deploy asks about a pending transaction, choose
**continue waiting**, never _skip_ (skip deploys a second AstaVerde). Do not change `OWNER_ADDRESS` or
`USDC_ADDRESS` between runs (that also forces a second AstaVerde). A re-run after the SCC renounce stops at
`grantRole` with `AccessControlUnauthorizedAccount`: that is expected; continue with step 4, `handoff`
sets `trustedVault` if it is missing.

4. Set the L1 price-update cap while the deployer still owns AstaVerde (the marketplace must be unpaused):

```bash
npx hardhat run scripts/set-price-update-iterations.js --network ethereum-mainnet
```

5. Hand over to the owner Safe. The script refuses unless the Safe matches what you verified:

```bash
NEW_OWNER=0x... EXPECTED_SAFE_THRESHOLD=<n> EXPECTED_SAFE_OWNERS=0x..,0x..,0x.. RENOUNCE_SCC_ADMIN=true \
  npm run handoff -- --network ethereum-mainnet
```

6. Read everything back and verify the three contracts on Etherscan (next section):

```bash
npx hardhat run scripts/check-deployment.js --network ethereum-mainnet
```

Expect: both owners = the Safe, `usdcToken` = Circle USDC, `trustedVault` = the vault, the vault holds
`MINTER_ROLE`, the deployer is not SCC admin, `maxBatchSize` 50, `maxPriceUpdateIterations` 25. Commit
`deployments/ethereum-mainnet/`.

7. In Vercel, set the Production `NEXT_PUBLIC_*` env vars for Ethereum mainnet (see
   `webapp/.env.local.example`), including a dedicated `NEXT_PUBLIC_ETHEREUM_MAINNET_RPC_URL` and the server-side
   `PINATA_JWT`, and remove `NEXT_PUBLIC_ARBITRUM_MAINNET_RPC_URL` (it would be inlined into the bundle).
   `NEXT_PUBLIC_*` values are build-time: redeploy after changing them.

---

## Verification

Verification runs inline during deploy (`deploy/deploy.ts` calls `verify:verify` from
`@nomicfoundation/hardhat-verify`). To re-run it for one contract:

```bash
npx hardhat verify --network ethereum-mainnet <address> <constructor args...>
```

ABI sanity check: `npm run validate:abis`.

Do **not** rely on `npm run verify:contracts` for Ethereum: that is `hardhat-deploy`'s
`etherscan-verify`, which builds Etherscan **V1** hosts (`api.etherscan.io`,
`api-sepolia.etherscan.io`) with no `chainid` parameter. Use `npx hardhat verify` instead.

`@nomicfoundation/hardhat-verify` is Etherscan V2 capable, so **one** `ETHERSCAN_API_KEY` covers both
`mainnet` and `sepolia`. Neither needs a `customChains` entry: both are built into the plugin
(`npx hardhat verify --list-networks` lists them). The per-chain Arbitrum and Base explorer keys
(`ARBITRUM_*_EXPLORER_API_KEY`, `BASE_*_EXPLORER_API_KEY`) still apply to those networks only.

---

## Where to Find Addresses

Hardhat Deploy artifacts are written under:

- `deployments/ethereum-sepolia/*.json`
- `deployments/ethereum-mainnet/*.json`
- `deployments/arbitrum-sepolia/*.json` (previous target)
- `deployments/arbitrum-one/*.json` (previous target, still live)

Each contract file contains an `address` field.
