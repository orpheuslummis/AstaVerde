#!/bin/bash

# Deploy script
# Do not commit this file to your repository, as it contains sensitive information.
# We use Docker because it's a convenient way to run the process in a controlled environment.

# Client parameters (EDIT THIS HERE! 🌸)
NETWORK="base-sepolia"
USDC_ADDRESS="tbd"
IMAGE_FOLDER="example_nftdata"
CSV_PATH="example_nftdata/nft_metadata.csv"
ALCHEMY_APIKEY="your-api-key"
PRIVATE_KEY="your-private-key"

if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker to proceed."
    exit 1
fi

docker build -t astaverde .

echo "Deploying on the $NETWORK network..."

docker run --rm \
    -e NETWORK=$NETWORK \
    -e CONTRACT_ADDRESS=$USDC_ADDRESS \
    -e IMAGE_FOLDER=$IMAGE_FOLDER \
    -e CSV_PATH=$CSV_PATH \
    -e ALCHEMY_APIKEY=$ALCHEMY_APIKEY \
    -e EMAIL=$EMAIL \
    -e PRIVATE_KEY=$PRIVATE_KEY \
    astaverde npm run deploy:contracts -- --network $NETWORK

echo "Minting process completed."