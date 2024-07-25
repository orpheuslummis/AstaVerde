#!/bin/bash

# Deploy script
# Do not commit this file to your repository, as it contains sensitive information.
# We use Docker because it's a convenient way to run the process in a controlled environment.

# Client parameters (EDIT THIS HERE! 🌸)
NETWORK="base-sepolia"
ALCHEMY_APIKEY="iLBP5cYsA21h9sQw1rBl9_n7sng_zlMZ"
PRIVATE_KEY="0x8b3a350d51c93764315498386d8471c3355e564b124f0d103b605a8ca8f6f52a"

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
    -e ALCHEMY_APIKEY=$ALCHEMY_APIKEY \
    -e PRIVATE_KEY=$PRIVATE_KEY \
    astaverde npm run deploy:contracts -- --network $NETWORK

echo "Minting process completed."