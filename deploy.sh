#!/bin/bash

# Deploy script
# Do not commit this file to your repository, as it contains sensitive information.
# We use Docker because it's a convenient way to run the process in a controlled environment.

# Client parameters (EDIT THIS HERE! 🌸)
NETWORK="base-sepolia"
# USDC_ADDRESS="tbd" # if on mainnet
ALCHEMY_APIKEY="tbd"
PRIVATE_KEY="tbd"

if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker to proceed."
    exit 1
fi

IMAGE_NAME="astaverde"
IMAGE_EXISTS=$(docker images -q $IMAGE_NAME)
if [ -z "$IMAGE_EXISTS" ]; then
    docker build -t $IMAGE_NAME .
else
    echo "Image $IMAGE_NAME already exists."
fi

echo "Deploying on the $NETWORK network..."

docker run --rm \
    -e NETWORK=$NETWORK \
    -e CONTRACT_ADDRESS=$USDC_ADDRESS \
    -e ALCHEMY_APIKEY=$ALCHEMY_APIKEY \
    -e PRIVATE_KEY=$PRIVATE_KEY \
    astaverde npm run deploy:contracts -- --network $NETWORK

echo "Minting process completed."