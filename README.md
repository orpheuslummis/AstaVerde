# AstaVerde

AstaVerde is a platform for trading verified carbon offsets as non-fungible tokens (NFTs). Built on Ethereum using the ERC-1155 standard, it employs a Dutch Auction mechanism for pricing carbon credit batches.

## Features

-   **Dutch Auction Mechanism**: Prices start at 230 USDC/unit and decay linearly over four days to a floor of 40 USDC/unit.
-   **Batch Trading**: Carbon credits are grouped into batches, with all tokens in a batch sharing the same price.
-   **ERC-1155 Smart Contract**: Utilizes OpenZeppelin's ERC1155, ERC1155Burnable, Ownable, Pausable, and ReentrancyGuard contracts.

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

## Usage

-   **Credit Producers**: Generate and verify carbon offsets, then list them on the platform.
-   **Buyers**: Browse available batches and use the `buyBatch` function to purchase.
-   **Platform Owner**: Maintain the smart contract, mint new batches, and oversee the auction.

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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security

-   The market can be paused if USDC becomes depegged.
-   Always ensure your `.env.local` and `webapp/.env.local` files are up to date and never committed to the repository.

## Support

For support, please open an issue in the GitHub repository.
