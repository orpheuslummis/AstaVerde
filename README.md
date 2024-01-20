# AstaVerde

AstaVerde is a platform for the trading of verified carbon offsets as non-fungible tokens (NFTs).
It is built on Ethereum as an ERC-1155 smart contract.
Each carbon credit is part of a batch. The batch follows a Dutch Auction mechanism.

User personas:
- Credit Producers: Generate and verify carbon offsets, then list them as NFTs.
- Platform Owner: Mints new batches of NFTs and manages the auction.
- Buyers: Bid on and purchase batches of NFTs.


## How to use as platform owner

**Configuring and minting:**

1. `cp .env.example .env`
2. Fill out the parameters in ``.env`` (PRIVATE_KEY, ALCHEMY_APIKEY, etc)
3. Prepare CSV and images in the `nfts/` folder. The image are named according to their token IDs.
4. `npm run task:mint`

**Reading events:**

```shell
npm run task:events -- --from 4984484 --to 4985484 --chain base
```


### How to run as developer

Obtain and run tests locally:

```shell
git clone git@github.com:orpheuslummis/AstaVerde.git
cd AstaVerde
npm i
npm run test
```

Deploy contract on testnet:

```shell
npm run test
npm run compile && npm run postinstall
npm run deploy:contracts -- --network base-sepolia
```

