# AstaVerde

AstaVerde is a platform built on the Ethereum blockchain that facilitates the trading of verified carbon offsets as
non-fungible tokens (NFTs) using an ERC-1155 smart contract. The platform employs a Dutch Auction mechanism for selling
these offsets.

## Dutch Auction Mechanism

The auction starts at 230 USDC/unit and decays linearly over four days to a floor price of 40 USDC/unit. The price is
recalculated every 24 hours using a specific formula. Buyers can purchase at any time within the auction window, but
they must buy the entire batch.

## Roles

- Credit Producers: Generate and verify carbon offsets, then list them as NFTs.
- Platform Owner: Mints new batches of NFTs and manages the auction.
- Buyers: Bid on and purchase batches of NFTs.

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
