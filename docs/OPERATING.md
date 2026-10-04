# Operating the marketplace (Ethereum mainnet)

For the owner of the live marketplace at https://ecotradezone.bionerg.com. Developer setup and
deployment are in [DEPLOYMENT.md](./DEPLOYMENT.md); pricing mechanics in [PRICING.md](./PRICING.md).

## What is deployed

| Contract                          | Address                                      | Owner                             |
| --------------------------------- | -------------------------------------------- | --------------------------------- |
| AstaVerde (marketplace, ERC-1155) | `0x34eceD602B9DB47e0B56932B491ca59c4b02Ecc5` | owner wallet                      |
| EcoStabilizer (vault)             | `0xFBfcE641BCB6BF1E06CB859c41788699BBC84B46` | owner wallet                      |
| StabilizedCarbonCoin (SCC)        | `0xd5949461Ac560619a5d9261a5b4F3E5373123eD0` | no admin; only the vault can mint |

Payment token: Circle USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. All three contracts are verified
on Etherscan. The test site https://test.ecotradezone.bionerg.com runs the same app on Ethereum Sepolia
with test USDC; use it to rehearse anything new before doing it on mainnet.

Ownership is one key. The owner can mint, pause, change prices and claim platform funds. Ownership can be
moved (for example to a Safe) from the admin page's "Ownership Transfer (QA/Test)" card, which works on
mainnet too, one transaction per contract; the transfer is immediate and cannot be undone by the old owner, so check the address twice.

## Minting a batch

1. Open the site, connect the owner wallet, go to Admin → Mint.
2. Add up to 50 tokens: name, image, description and the producer's wallet address for each (name and
   producer address are required). The producer
   address receives that token's share of every sale, so check it.
3. Press Mint Batch. The wallet asks twice:
    - a message signature that authorizes the image upload (no gas, nothing on chain);
    - the mint transaction.
4. The images and metadata go to the Pinata account behind the site; the batch then shows on the market page.

Gas, measured on a mainnet fork on 2026-10-04: about 245,000 + 163,000 per token, so 50 tokens is about
8.4M gas: roughly 0.002 to 0.0035 ETH at early-October 2026 gas prices, 0.0084 ETH at 1 gwei. The owner
wallet needs ETH for this.

Keep the batch size at 50. Ethereum caps a single transaction at 16.78M gas; a 100-token mint is about
16.6M gas, within 1% of that cap, so it could be refused.

## Prices

Launch settings: base price 150 USDC for new batches, each batch's price drops 5 USDC a day down to a
40 USDC floor. The contract also adjusts the base price for new batches on its own:

- a batch that sells out within 2 days raises the base price by 10 USDC;
- when nothing has sold out for 4 days, each batch older than 4 days that has had no sale at all lowers it
  by 10 USDC (once per batch), at the next mint or purchase. With many such batches this can bring the base
  price down to the floor in one step.

The owner can change the base price, the daily drop and the price-update cap from the admin page; the
marketplace must be unpaused to do so. A change to the daily drop applies to every unsold batch at once; a
change to the base price applies only to batches minted afterwards. Leave the price-update cap at 25: it bounds the gas each buyer pays
for these adjustments, and raising it makes purchases cost more.

## Money

- Each sale splits the price: 30% platform share, 70% to the token's producer (the contract's default).
- Platform share: Admin → Claim Platform Funds. The recipient field takes any address, for example the
  treasury Safe; it defaults to the connected owner wallet.
- Producers claim their own USDC: they connect their wallet on the site and open the Producer page.
- A producer's USDC can only ever be paid to the producer address set at mint, and that address cannot be
  changed later. If Circle blocklists it, the USDC owed to it stays locked in the contract for as long as
  the block lasts: nobody, the owner included, can send it to another address.

## Pausing

Admin → Pause stops purchases, minting, vault deposits and token transfers between users. Vault
withdrawals keep working while paused, so users can always take their token back by repaying their SCC.
Unpause to resume, and before changing any setting.

## Token files

Every token's image and metadata is pinned in the Pinata account, including the 14 Arbitrum tokens
restored under their original addresses. Pinata is the only pinning service holding them (checked
2026-10-04), so if that account lapses, token images stop loading on this site and on marketplaces. Keep
the account in good standing, and keep the original image files.

## The upload key

Minting uploads through a Pinata key stored on the server (Vercel env var `PINATA_JWT`); the browser never
sees it. The key in use expires on 2027-09-20; the Mint card on the admin page shows the date. Before then:

1. In the Pinata account, create a new API key with Files: write permission and copy its JWT.
2. In Vercel (project astaverde → Settings → Environment Variables), replace `PINATA_JWT` for Production
   and for Preview (the test site uses the same variable).
3. Redeploy production (and the test site): Vercel applies env changes to new deployments only.
4. On the admin page, check that the Mint card shows the new expiry date.

## Other upkeep

- The site's Alchemy key is visible in the page code by design. In the Alchemy dashboard, restrict it to
  `ecotradezone.bionerg.com` and `test.ecotradezone.bionerg.com` so nobody else can spend its quota.
- Pushes to `main` on GitHub deploy to production through Vercel; after a push, check that a new production
  deployment appears in Vercel.
- The previous Arbitrum One deployment stays on chain, owned by the treasury Safe: AstaVerde
  `0x688A8fADA4c684Cc7d0fc32806F359B20ebd0672`, vault `0xb397d1546B8E2f51C018132C25f32ee5e6dAaeBd`, SCC
  `0x695B030B8fE57e67293Be3f7a5d7DA3Ce3654d5F`. The new site does not show it. Its contracts are verified on
  arbitrum.blockscout.com (not on Arbiscan), so anything owed there can still be claimed from Blockscout's
  Write contract tab, with a little ETH on Arbitrum for gas:
    - a producer: connect the producer wallet on the old AstaVerde contract and call `claimProducerFunds`;
    - the platform share: the Safe calls `claimPlatformFunds(to)` on the old AstaVerde contract through its
      Transaction Builder (paste the ABI from Blockscout if the builder does not load it);
    - a vault position: the holder calls `approve` on the old SCC contract with the old vault as spender and
      `20000000000000000000` (20 SCC) as the amount, then `withdraw(tokenId)` on the old vault.
