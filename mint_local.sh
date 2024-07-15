#!/bin/bash

# Mint script
# Do not commit this file to your repository, as it contains sensitive information.
# We use Docker because it's a convenient way to run the process in a controlled environment.

# Client parameters (EDIT THIS HERE! 🌸)
NETWORK="local"
CONTRACT_ADDRESS="0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
NFTDATA_PATH="example_nftdata"
IMAGE_FOLDER="example_nftdata/images"
CSV_PATH="example_nftdata/nft_metadata.csv"
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

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
    --network="host" \
    -e CHAIN_SELECTION=$NETWORK \
    -e CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
    -e IMAGE_FOLDER=$IMAGE_FOLDER \
    -e CSV_PATH=$CSV_PATH \
    -e PRIVATE_KEY=$PRIVATE_KEY \
    -v $(pwd)/"$NFTDATA_PATH":/app/"$NFTDATA_PATH" \
    -p 8545:8545 \
    astaverde npm run task:mintlocal
echo "Minting process completed."
