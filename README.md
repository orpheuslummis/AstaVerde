# AstaVerde

AstaVerde is a platform for the trading of verified carbon offsets as non-fungible tokens (NFTs).
It is built on Ethereum as an ERC-1155 smart contract.
Each carbon credit is part of a batch. The batch follows a Dutch Auction mechanism.

## Dutch Auction Mechanism

The auction starts at 230 USDC/unit and decays linearly over four days to a floor price of 40 USDC/unit. The price is
recalculated every 24 hours using a specific formula. Buyers can purchase at any time within the auction window, but
they must buy the entire batch.

## User personas

- Credit Producers: Generate and verify carbon offsets, then list them as NFTs.
- Platform Owner: Mints new batches of NFTs and manages the auction.
- Buyers: Bid on and purchase batches of NFTs.

## Requirements

Wallet. We recommend Metamask to interact with the webapp
ETH for transaction fee
USDC for buying batches

## Usage

Interact with the platform via EcoTradeZone. As a Credit Producer, generate and verify carbon offsets, then list them.
As a Buyer, browse available batches and use the buyBatch function to purchase. As the Platform Owner, maintain the
smart contract, mint new batches, and oversee the auction.

Pause the market if USDC becomes depegged.

## Contribution

Understand the smart contract implementation, identify potential improvements or security vulnerabilities, and
contribute to the codebase by implementing new features or optimizations.

## Contract

The contract AstaVerde.sol includes functions for setting the platform share percentage, price floor, starting price,
and maximum batch size. It also includes functions for minting batches, getting the current price, buying batches, and
redeeming tokens. The contract uses OpenZeppelin's ERC1155, ERC1155Burnable, Ownable, Pausable, and ReentrancyGuard
contracts


## How to use as platform owner or developer

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

Verify contract on explorer
```shell
npx hardhat verify --network base-sepolia <address>
```

Configuring and minting:

1. `cp .env.example .env`
2. Fill out the parameters in ``.env`` (PRIVATE_KEY, ALCHEMY_APIKEY, etc)
3. Obtain CSV and image folder
4. `npm run task:mint`


Reading events:

1. Go to `/scripts/events/index.mjs` and follow the instructions to update the default values
2. Run `npm run task:events`
