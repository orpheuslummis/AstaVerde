#!/bin/bash

# Wallet Tests Runner
# Runs E2E tests with MetaMask integration

set -e

echo "🚀 AstaVerde Wallet Tests Runner"
echo "================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if we're in webapp directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: Must run from webapp directory${NC}"
  exit 1
fi

# Parse arguments
TEST_FILE=""
DEBUG_MODE=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --debug)
      DEBUG_MODE="--debug"
      shift
      ;;
    --headed)
      export HEADLESS=false
      shift
      ;;
    --file)
      TEST_FILE="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

echo -e "${YELLOW}Setting up test environment...${NC}"

# Step 1: Check if local blockchain is running
if ! curl -s http://localhost:8545 > /dev/null 2>&1; then
  echo "Starting Hardhat node..."
  cd ..
  npx hardhat node > /tmp/hardhat.log 2>&1 &
  HARDHAT_PID=$!
  sleep 5
  
  # Deploy contracts
  echo "Deploying contracts..."
  npx hardhat deploy --network localhost
  
  # Fund test accounts with USDC
  echo "Funding test accounts..."
  npx hardhat run scripts/simple-fund-usdc.js --network localhost 2>/dev/null || {
    echo -e "${YELLOW}Note: Funding script not found, using default setup${NC}"
  }
  
  # Seed with test data
  echo "Seeding test data..."
  SCENARIO=marketplace npx hardhat run scripts/dev-environment.js --network localhost
  
  cd webapp
else
  echo "✓ Hardhat node already running"
fi

# Step 2: Check if webapp is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "Starting webapp..."
  npm run dev > /tmp/webapp.log 2>&1 &
  WEBAPP_PID=$!
  
  # Wait for webapp to be ready
  echo "Waiting for webapp to start..."
  for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
      echo "✓ Webapp is ready"
      break
    fi
    sleep 2
  done
else
  echo "✓ Webapp already running"
fi

# Step 3: Install Playwright browsers if needed
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
  echo "Installing Playwright browsers..."
  npx playwright install chromium
fi

# Step 4: Install MetaMask extension if needed
if [ ! -d "node_modules/@synthetixio/synpress/dist/extension" ]; then
  echo "Building Synpress extension..."
  npm run synpress:build
fi

echo -e "${GREEN}Environment ready!${NC}"
echo ""

# Step 5: Run tests
echo -e "${YELLOW}Running wallet tests...${NC}"

if [ -n "$TEST_FILE" ]; then
  echo "Running specific test: $TEST_FILE"
  npx playwright test "$TEST_FILE" --config=synpress.config.ts $DEBUG_MODE
else
  echo "Running all wallet tests..."
  npx playwright test --config=synpress.config.ts $DEBUG_MODE
fi

TEST_RESULT=$?

# Cleanup function
cleanup() {
  echo -e "${YELLOW}Cleaning up...${NC}"
  
  if [ ! -z "$HARDHAT_PID" ]; then
    echo "Stopping Hardhat node..."
    kill $HARDHAT_PID 2>/dev/null || true
  fi
  
  if [ ! -z "$WEBAPP_PID" ]; then
    echo "Stopping webapp..."
    kill $WEBAPP_PID 2>/dev/null || true
  fi
}

# Cleanup on exit
trap cleanup EXIT

# Show results
if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ All wallet tests passed!${NC}"
else
  echo -e "${RED}❌ Some tests failed${NC}"
  echo "Check test-results/wallet-tests for details"
fi

# Open report if tests failed
if [ $TEST_RESULT -ne 0 ] && [ -d "test-results/wallet-tests" ]; then
  echo "Opening test report..."
  npx playwright show-report test-results/wallet-tests
fi

exit $TEST_RESULT