# AstaVerde

AstaVerde is a platform for trading verified carbon offsets as non-fungible tokens (NFTs). Built on Ethereum using the ERC-1155 standard, it employs a Dutch Auction mechanism for pricing carbon credit batches.

## Dutch Auction Mechanism

The AstaVerde platform uses a Dutch auction mechanism for pricing carbon credit batches. Here are the key features of the auction:

-   **Starting Price**: The initial base price is set to `basePrice` (default: 230 USDC) per unit.
-   **Price Floor**: A minimum price of `priceFloor` (default: 40 USDC) per unit is enforced.
-   **Daily Price Reduction**: The price decreases by `priceDecreaseRate` (default: 1 USDC) per day for unsold tokens.
-   **Dynamic Pricing**: The base price for new batches is adjusted based on recent sales:
    -   If a sale occurs within `dayIncreaseThreshold` days (default: 2) of the last price adjustment, the base price increases by `priceDelta` (default: 10 USDC).
    -   If no sales occur for `dayDecreaseThreshold` days (default: 4), the base price decreases according to the daily reduction rate.
-   **Revenue Split**: `100 - platformSharePercentage`% (default: 70%) of each sale goes to the token producer, while `platformSharePercentage`% (default: 30%) goes to the platform.
-   **Batch Pricing**: All tokens within a batch share the same price, which follows the Dutch auction dynamics.

The smart contract owner can adjust various parameters, including:

-   `platformSharePercentage`: The percentage of sales that goes to the platform
-   `maxBatchSize`: The maximum number of tokens in a batch
-   `basePrice`: The starting price for new batches
-   `priceFloor`: The minimum price for tokens
-   `priceDelta`: The amount by which the base price increases after a quick sale
-   `priceDecreaseRate`: The daily price reduction rate
-   `dayIncreaseThreshold`: The number of days within which a sale triggers a price increase
-   `dayDecreaseThreshold`: The number of days without sales that trigger a price decrease

These parameters allow for fine-tuning of the auction mechanism to respond to market conditions and platform requirements. The contract owner can modify these values using specific setter functions provided in the smart contract.

## User Roles

-   **Credit Producers**: Generate and verify carbon offsets, listing them as NFTs.
-   **Platform Owner**: Mints new batches of NFTs and manages the auction.
-   **Buyers**: Bid on and purchase batches of NFTs.

## Prerequisites

-   Node.js and npm
-   MetaMask or another Ethereum wallet
-   Docker (for deployment)

## Local Development Setup

1. Clone the repository:

    ```bash
    git clone git@github.com:orpheuslummis/AstaVerde.git
    cd AstaVerde
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Set up environment variables:

    ```bash
    cp .env.local.example .env.local
    cp ./webapp/.env.local.example ./webapp/.env.local
    ```

    Edit `.env.local` and `webapp/.env.local` with your specific private values.

4. Compile the contracts:

    ```bash
    npm run compile
    ```

5. Start a local Hardhat node:

    ```bash
    npm run node
    ```

6. In a new terminal, deploy contracts to the local network:

    ```bash
    npm run deploy:local
    ```

7. Start the webapp in development mode:

    ```bash
    npm run webapp:dev
    ```

8. (Optional) For automatic recompilation and redeployment on contract changes:

    ```bash
    npm run watch:dev
    ```

9. (Optional) For local minting:
    ```bash
    npm run task:mintlocal
    ```

## Deployment

### Deploy for an owner address

-   `OWNER_ADDRESS=0x... p deploy:testnet`

### Using Docker

1. Install Docker Desktop from https://docs.docker.com/desktop/install/mac-install/
2. Clone the repository:
    ```bash
    git clone git@github.com:orpheuslummis/AstaVerde.git && cd AstaVerde
    ```
3. To deploy: Configure and run `./deploy.sh`
4. To mint: Configure and run `./mint.sh`

### Manual Deployment

1. Deploy contract on testnet:

    ```bash
    npm run test
    npm run compile && npm run postinstall
    npm run deploy:contracts -- --network base-sepolia
    ```

2. Set environment variables on Vercel:
    - CHAIN_SELECTION
    - ALCHEMY_API_KEY
    - WALLET_CONNECT_PROJECT_ID

## Minting

1. Prepare a CSV file with token metadata and an image folder.
2. Update the `.env.local` file with the correct paths.
3. Run `npm run task:mint`

## Reading Events

1. Update default values in `/scripts/events/index.mjs`.
2. Run `npm run task:events`

## Updating the Contract

When updating the contract, remember to update the contract address and ABI in:

-   `webapp/src/lib/contracts.ts`
-   `scripts/events/contracts.mjs`
-   `.env.local` for minting scripts

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security

-   The market can be paused if USDC becomes depegged.
-   Always ensure your `.env.local` and `webapp/.env.local` files are up to date and never committed to the repository.
