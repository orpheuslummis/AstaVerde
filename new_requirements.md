we have new requirements for the project ...

=======================================================

# Status Quo Snapshot (2025-12-13)

This section is the current, repo-backed snapshot of what is actually deployed / configured today. It’s meant to complement (not replace) the original plan text below.

## Confirmed in repo

### Arbitrum Sepolia deployment exists (fresh deploy)

Artifacts are present under `deployments/arbitrum-sepolia/`:

- AstaVerde: `0xdE8b55d782634a9adbCF0815fec4f09665e9c5ea`
- MockUSDC: `0x32b5E192aC9C941b4B5F0216Cdb13053aB74e124`
- EcoStabilizer: `0x8C04a27dED3aCf8635A0c1dfA6708F5c3bBC10fC`
- StabilizedCarbonCoin (SCC): `0x695B030B8fE57e67293Be3f7a5d7DA3Ce3654d5F`

Local webapp QA env (`webapp/.env.local`) is configured to point at these addresses and uses `NEXT_PUBLIC_CHAIN_SELECTION=arbitrum_sepolia`.

### Arbitrum One deployment does not exist yet

- No `deployments/arbitrum-one/` artifacts are present.

## Notes / deviations from the original plan text

- The current Arbitrum Sepolia deployment uses **MockUSDC** (mintable test token) rather than Circle native USDC (`0x75fa…AA4d`). This is fine for QA, but copy/FAQ that says “Circle-issued native USDC” is only strictly true on mainnet unless we redeploy Sepolia using native USDC.
- There is a large set of uncommitted webapp changes focused on RPC provider stability (429 avoidance): global rate-limited transports, reduced polling/watch, and chunked reads.
- Root `.env` was historically tracked in git; it is deleted locally but not yet committed as a removal.

## Updated “what’s left” checklist (as of 2025-12-13)

- Land and validate the uncommitted RPC stability changes (lint/test/build).
- QA the Arbitrum Sepolia deployment end-to-end (wallet connect, buy/redeem, vault deposit/withdraw, admin flows).
- Prepare Arbitrum One env (`.env.local` + production webapp env / Vercel vars), then deploy to Arbitrum One using native USDC `0xaf88…e5831` (not USDC.e).
- Verify mainnet deployment on Arbiscan (optional, but recommended before shipping).

=======================================================

› our new requirement is that we should instead deploy (afresh) to
arbitrum ... instead of base. we don't need migration of state. let's
figure this out

Ah we need to change that intro page to explain Arbitrum rather than Base is that ok?

We can just remove link? And swap the word Base with Arbitrum

---

You're about to enter a revolutionary marketplace for environmental assets. Before you dive in, here's what you need to know:

Web3 Powered Security
AstaVerde operates on secure blockchain technology. Connect your crypto wallet to participate and ensure the safety of your transactions.

USDC Transactions
We use Arbitrum native USDC for all transactions. Ensure your wallet is compatible and funded.
Learn more about Arbitrum and USDC

Understanding Eco Assets
Eco Assets represent real environmental impact. Once redeemed, they're recorded in your wallet and lose their tradable value.
Explore Eco Assets

Your Responsibilities
Trading Eco Assets may have tax implications. You're responsible for complying with local regulations.
Read our Terms of Service
By entering AstaVerde, you acknowledge that you understand and agree to these terms.

---

The link for Learn more about Arbitrum and USDC
Is
https://docs.arbitrum.io/arbitrum-bridge/usdc-arbitrum-one

---

The FAQ
Q: Why don't the Ethereums work here to buy eco assets?
A: This is on the Arbitrum network, which runs in parallel to the main Ethereum network and has responsibilities to it in terms of its data integrity. But this means that you need the currencies that are used on this Arbitrum network. Rainbow, Rabbi, Coinbase wallets work natively with Arbitrum and the currency that you purchase in is USDC so make sure that the currency you have on your Arbitrum network wallet.
Q: What do I need to know about using my wallet here?
A: Transactions here are conducted using Arbitrum native USDC, issued by Circle. For more understanding:
Learn about Arbitrum
USDC on Arbitrum
Q: What do I need to buy eco assets?
A: You need two currencies:
Enough USDC to make the auction price, and
A few dollars worth of Ethereums ON Arbitrum to pay for the transaction gas.

---

Link for
Learn about Arbitrum
https://arbitrum.io/

Link for
USDC on Arbitrum
https://docs.arbitrum.io/arbitrum-bridge/usdc-arbitrum-one

---

Link for
Learn about Arbitrum
https://arbitrum.io/

Link for
USDC on Arbitrum
https://docs.arbitrum.io/arbitrum-bridge/usdc-arbitrum-one

---

On “About Eco Assets”

Just delete
Note: Different exchanges and wallets will have different or no fees to get USDC on Base and Ethereum on Base.

---

Ok and the Eco Asset Guide (PDF) needs to switch to this

(see Everything about eco asset.pdf in webapp/public/)

=======================================================

# Arbitrum Deployment Plan (fresh deploy, no state migration)

## Goal and scope

- Shift the stack from Base to Arbitrum with a fresh deployment (no on-chain state migration).
- Target Arbitrum One for production and Arbitrum Sepolia for QA.
- Keep existing Base deployments untouched; all new user traffic should point to Arbitrum once live.

## Target networks and assets

- Arbitrum One (mainnet, chainId 42161), explorer: https://arbiscan.io, RPC from `ARBITRUM_MAINNET_RPC_URL` (preferred) or provider key. Native USDC: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (per Arbitrum docs).
- Arbitrum Sepolia (testnet, chainId 421614), explorer: https://sepolia.arbiscan.io, RPC from `ARBITRUM_SEPOLIA_RPC_URL`. Native USDC: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`.
- Gas: ETH on Arbitrum; payments: **native USDC (Circle)**. Explicitly avoid bridged USDC.e (0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8 on mainnet); surface a warning in UI/FAQ.
- No state migration required; deploy new AstaVerde + SCC + EcoStabilizer stack.

## Backend/contract work to plan

- Add Arbitrum networks to `hardhat.config.ts` with RPC and Etherscan (Arbiscan) settings; keep `defaultNetwork` as `hardhat`.
- Extend `scripts/deploy-with-validation.js` (and any helpers) to accept Arbitrum network names (use `arbitrum-one` and `arbitrum-sepolia`) and rely on `.env.local` + `webapp/.env.local` (avoid per-network env files).
- Add env vars for Arbitrum RPC and explorer keys: `ARBITRUM_MAINNET_RPC_URL`, `ARBITRUM_SEPOLIA_RPC_URL`, `ARBITRUM_MAINNET_EXPLORER_API_KEY`, `ARBITRUM_SEPOLIA_EXPLORER_API_KEY`; keep `RPC_API_KEY` only if we retain a templated provider URL.
- Update deployment/seed scripts to reference Arbitrum native USDC (address lookup step) and to write/read artifacts under `deployments/arbitrum-one` and `deployments/arbitrum-sepolia`.
- Keep `npm run validate:abis` flow unchanged; ensure any Base-specific assumptions (chain IDs, explorers) are removed.

## Webapp plan

- Add Arbitrum chains to `webapp/src/config/environment.ts`, `webapp/src/config/chains.ts`, and chain selection logic; new `CHAIN_OPTIONS` should include `arbitrum_mainnet` and `arbitrum_sepolia`.
- Provide Arbitrum-focused env examples (`webapp/.env.local.example` + `.env.local.example`) and set `NEXT_PUBLIC_CHAIN_SELECTION` to the Arbitrum key; wire `NEXT_PUBLIC_USDC_ADDRESS` to native USDC.
- Swap UI copy/links from Base to Arbitrum, remove Base-specific notes on About Eco Assets, and replace `webapp/public/Everything about eco asset.pdf` with the Arbitrum version.
- Ensure wagmi uses Arbitrum RPCs and that wallet connectors default to Arbitrum; keep WalletConnect/project ID handling the same.

## Deployment runbook (draft)

1. Prep env: set Arbitrum RPC URLs, explorer keys, deployer key, owner address; lock in native USDC addresses (Sepolia + mainnet).
2. Implement network config/script updates (naming: `arbitrum-sepolia`, `arbitrum-one`), then run `npm run lint` and `npm run test`.
3. QA deploy to Arbitrum Sepolia via updated deploy script (fresh stack), save `deployments/arbitrum-sepolia` artifacts, and populate `webapp/.env.local` for testing with USDC: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`.
4. Webapp QA against Arbitrum Sepolia: wallet connect, USDC detection, deposit/withdraw flows, and updated copy/PDF.
5. Mainnet deploy to Arbitrum One via same flow, using native USDC: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`; verify on Arbiscan, capture addresses/tx hashes, and update production env files.
6. Post-deploy: smoke test (deposit/withdraw), confirm MINTER_ROLE + admin renounce, publish addresses/docs, and monitor gas/fees.

## Copy updates to execute during implementation

- Intro page: replace Base with Arbitrum and use native USDC messaging. Learn more link: https://docs.arbitrum.io/arbitrum-bridge/usdc-arbitrum-one. Copy block to use:

```
You're about to enter a revolutionary marketplace for environmental assets. Before you dive in, here's what you need to know:

Web3 Powered Security
AstaVerde operates on secure blockchain technology. Connect your crypto wallet to participate and ensure the safety of your transactions.

USDC Transactions
We use Arbitrum native USDC for all transactions. Ensure your wallet is compatible and funded.
Learn more about Arbitrum and USDC

Understanding Eco Assets
Eco Assets represent real environmental impact. Once redeemed, they're recorded in your wallet and lose their tradable value.
Explore Eco Assets

Your Responsibilities
Trading Eco Assets may have tax implications. You're responsible for complying with local regulations.
Read our Terms of Service
By entering AstaVerde, you acknowledge that you understand and agree to these terms.
```

- FAQ (add/update entries):
    - Q: Why don't the Ethereums work here to buy eco assets?
        - A: This is on the Arbitrum network, which runs in parallel to the main Ethereum network and has responsibilities to it in terms of its data integrity. But this means that you need the currencies that are used on this Arbitrum network. Rainbow, Rabbi, Coinbase wallets work natively with Arbitrum and the currency that you purchase in is USDC so make sure that the currency you have on your Arbitrum network wallet.
    - Q: What do I need to know about using my wallet here?
        - A: Transactions here are conducted using Arbitrum native USDC, issued by Circle. For more understanding:
            - Learn about Arbitrum: https://arbitrum.io/
            - USDC on Arbitrum: https://docs.arbitrum.io/arbitrum-bridge/usdc-arbitrum-one
        - Add note: we require native USDC (`0xaf88...` on Arbitrum One; `0x75fa...` on Arbitrum Sepolia). Bridged USDC.e (`0xff97...`) will not work for purchases.
    - Q: What do I need to buy eco assets?
        - A: You need two currencies:
            - Enough USDC to make the auction price, and
            - A few dollars worth of Ethereums ON Arbitrum to pay for the transaction gas.
- About Eco Assets: delete the Base-specific note about fees on Base.
- Swap in the Arbitrum-version Eco Asset Guide PDF at `webapp/public/Everything about eco asset.pdf`.

### Copy status (2025-12-07)

- [x] Intro modal copy updated to Arbitrum native USDC with link to Arbitrum USDC docs.
- [x] FAQ answers/links updated to Arbitrum, including native USDC vs USDC.e warning and gas note.
- [x] Removed Base-specific fee note from About Eco Assets page.
- [x] Site metadata updated to Arbitrum (title/keywords).
- [x] Replaced Eco Asset Guide PDF with Arbitrum version at `webapp/public/Everything about eco asset.pdf`.

### Config status (2025-12-07)

- [x] Webapp chain options extended to `arbitrum_mainnet` / `arbitrum_sepolia` (defaulting to `arbitrum_sepolia`).
- [x] Wagmi chain configs updated to use Arbitrum RPCs with Alchemy fallback.
- [x] Admin/testnet gating updated to recognize Arbitrum Sepolia.
- [x] `dev:sepolia` script repointed to Arbitrum Sepolia and `webapp/.env.local`.
- [x] `deploy:testnet` / `deploy:mainnet` default to Arbitrum networks; deploy script preflight supports Arbitrum RPC envs.
- [x] Updated `webapp/.env.local.example` with native USDC addresses (421614 and mainnet note).

## Decisions (current)

- Network naming: use `arbitrum-one` (mainnet) and `arbitrum-sepolia` (testnet) consistently across Hardhat, scripts, env files, webapp; map to wagmi `arbitrum`/`arbitrumSepolia`.
- Base: deprecated for now but configs/docs kept for easy re-enable; default experience moves to Arbitrum.
- USDC positioning: use native USDC (0xaf88... mainnet, 0x75fa... Sepolia) and include a USDC.e (`0xff97...`) incompatibility warning in UI/FAQ.
- Bridge/faucet guidance: no extra guidance beyond current links (keep minimal).

## Remaining execution plan (2025-12-07)

1. Configure env: set `ARBITRUM_SEPOLIA_RPC_URL`, `ARBITRUM_MAINNET_RPC_URL`, `ARBITRUM_SEPOLIA_EXPLORER_API_KEY`, `ARBITRUM_MAINNET_EXPLORER_API_KEY`, deployer `PRIVATE_KEY`, and `OWNER_ADDRESS`; keep `RPC_API_KEY` only if using templated URLs.
2. Fund deployer on Arbitrum Sepolia with ETH (gas) and native USDC (0x75fa…AA4d).
3. Deploy to Arbitrum Sepolia via `npm run deploy:testnet`; capture addresses/artifacts under `deployments/arbitrum-sepolia` and update `webapp/.env.local`.
4. QA on Arbitrum Sepolia: wallet connect, USDC detection, deposit/withdraw flows, UI copy and PDF.
5. Deploy to Arbitrum One via `npm run deploy:mainnet` using native USDC 0xaf88…e5831; capture addresses/tx hashes and update production env files.
6. Mainnet verification: follow-up decision (currently optional per stakeholder); if enabled, run Arbiscan verify; otherwise skip.

## Progress update (2025-12-13)

- Step 3 (Arbitrum Sepolia deploy): DONE (see `deployments/arbitrum-sepolia/` addresses in the Status Quo Snapshot).
- Step 4 (QA on Arbitrum Sepolia): IN PROGRESS (significant RPC-stability work is currently uncommitted).
- Step 5 (Arbitrum One deploy): TODO (no `deployments/arbitrum-one/` yet).
- Step 6 (Mainnet verification): TODO (depends on Step 5).
