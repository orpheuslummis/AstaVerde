# Developer Tools (Current + Legacy)

This repo’s **current** workflow is testnet-only (Sepolia → Arbitrum Sepolia):

1. `npm run deploy:testnet`
2. Copy printed addresses into `webapp/.env.local`
3. `npm run dev:sepolia` (webapp on `http://localhost:3002`)

## Env Files

- Deploy/scripts secrets (untracked): `.env.local` (copy from `.env.local.example`)
- Webapp runtime config (untracked): `webapp/.env.local` (copy from `webapp/.env.local.example`)

Legacy `.env.development` is **not used**.

## Useful Commands

- Validate ABIs/config: `npm run validate:abis`
- Mint testnet NFTs (Arbitrum Sepolia): `npm run mint:testnet`

## Legacy Local Stack (Optional)

The old Hardhat-local full stack still exists but is not the primary workflow:

- Start: `npm run dev:local`
- Stop: `npm run dev:local:stop`
- Seed: `npm run dev:local:seed`

It deploys to a local Hardhat node, writes `webapp/.env.local` with local addresses, then runs the webapp on port 3000/3001.
