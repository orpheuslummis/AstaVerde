# AstaVerde

AstaVerde is a platform for trading verified carbon offsets as non-fungible tokens (NFTs). Built on Ethereum using the ERC-1155 standard, it employs a Dutch Auction mechanism for pricing carbon credit batches.

## Auction and Batch Pricing Mechanism

AstaVerde implements a dynamic pricing system for carbon credit tokens, combining elements of a Dutch auction with automatic price adjustments based on market demand.

### Key Features:

1. **Base Price**: The starting point for new batches, adjusted based on market activity.

2. **Batch Creation**: Each batch starts at the current base price.

3. **Price Decrease**: 
   - Batch prices decrease over time, starting after a threshold period (`dayDecreaseThreshold`).
   - The decrease rate is controlled by `priceDelta`.
   - Prices never fall below the `priceFloor`.

4. **Base Price Adjustments**:
   - Increases: If multiple batches sell out within `dayIncreaseThreshold`, the base price increases.
   - Decreases: If no sales occur for an extended period, the base price decreases.
   - Adjustments are made in increments of `priceDelta`.

5. **Independent Batch Pricing**: Each batch's price is calculated independently based on its creation time.

6. **Price Floor**: A minimum price (`priceFloor`) below which no batch can be sold.

### Key Parameters:

- `basePrice`: Starting price for new batches
- `priceFloor`: Minimum allowed price
- `priceDelta`: Amount of price adjustment (increase or decrease)
- `dayIncreaseThreshold`: Days within which batch sellouts trigger price increases
- `dayDecreaseThreshold`: Days of inactivity before price decreases begin

This system aims to balance supply and demand by adjusting prices based on market activity while maintaining independent pricing for each batch.

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


With local hardhat node:
- `OWNER_ADDRESS=xyz p node`
- `NODE_ENV=development p webapp:dev`

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

1. Update values in `/scripts/events/index.mjs`.
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
