#!/bin/bash

# Mint script
# Do not commit this file to your repository, as it contains sensitive information.
# We use Docker because it's a convenient way to run the process in a controlled environment.

# Client parameters (EDIT THIS HERE! 🌸)
NETWORK="base-sepolia"
CONTRACT_ADDRESS="tbd"
NFTDATA_PATH="example_nftdata"
IMAGE_FOLDER="example_nftdata/images"
CSV_PATH="example_nftdata/nft_metadata.csv"
ALCHEMY_APIKEY="tbd"
EMAIL="tbd"
PRIVATE_KEY="tbd"

if [ ! -d "$NFTDATA_PATH" ]; then
    echo "Error: Directory $NFTDATA_PATH not found."
    exit 1
fi

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

echo "Minting NFTs on the $NETWORK network, with contract $CONTRACT_ADDRESS..."
echo "Using the metadata from $CSV_PATH and images from $IMAGE_FOLDER/..."

docker run --rm \
    -e CHAIN_SELECTION=$NETWORK \
    -e CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
    -e IMAGE_FOLDER=$IMAGE_FOLDER \
    -e CSV_PATH=$CSV_PATH \
    -e ALCHEMY_APIKEY=$ALCHEMY_APIKEY \
    -e EMAIL=$EMAIL \
    -e PRIVATE_KEY=$PRIVATE_KEY \
    -v $(pwd)/"$NFTDATA_PATH":/app/"$NFTDATA_PATH" \
    astaverde npm run task:mint

echo "Minting process completed."