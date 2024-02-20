#!/bin/bash

# Mint script
# Do not commit this file to your repository, as it contains sensitive information.
# We use Docker because it's a convenient way to run the process in a controlled environment.

# Client parameters (EDIT THIS HERE! 🌸)
NETWORK="base-sepolia"
CONTRACT_ADDRESS="tbd"
IMAGE_FOLDER="example_nftdata"
CSV_PATH="example_nftdata/nft_metadata.csv"
ALCHEMY_APIKEY="your-api-key"
EMAIL="your-email"
PRIVATE_KEY="your-private-key"

if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker to proceed."
    exit 1
fi

docker build -t astaverde .

echo "Minting NFTs on the $NETWORK network, with contract $CONTRACT_ADDRESS..."

docker run --rm \
    -e NETWORK=$NETWORK \
    -e CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
    -e IMAGE_FOLDER=$IMAGE_FOLDER \
    -e CSV_PATH=$CSV_PATH \
    -e ALCHEMY_APIKEY=$ALCHEMY_APIKEY \
    -e EMAIL=$EMAIL \
    -e PRIVATE_KEY=$PRIVATE_KEY \
    astaverde npm run task:mint

echo "Minting process completed."