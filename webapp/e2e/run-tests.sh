#!/bin/bash

# E2E Test Runner Script
# Comprehensive script for running E2E tests with various configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
TEST_ENV="local"
TEST_SUITE="all"
HEADED="false"
DEBUG="false"
REPORT="false"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env)
      TEST_ENV="$2"
      shift 2
      ;;
    --suite)
      TEST_SUITE="$2"
      shift 2
      ;;
    --headed)
      HEADED="true"
      shift
      ;;
    --debug)
      DEBUG="true"
      shift
      ;;
    --report)
      REPORT="true"
      shift
      ;;
    --help)
      echo "Usage: ./run-tests.sh [options]"
      echo ""
      echo "Options:"
      echo "  --env <local|testnet|mainnet>  Test environment (default: local)"
      echo "  --suite <all|wallet|marketplace|vault|integration>  Test suite (default: all)"
      echo "  --headed                        Run tests in headed mode"
      echo "  --debug                         Run tests in debug mode"
      echo "  --report                        Open HTML report after tests"
      echo "  --help                          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run './run-tests.sh --help' for usage information"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}🚀 AstaVerde E2E Test Runner${NC}"
echo "Environment: $TEST_ENV"
echo "Test Suite: $TEST_SUITE"
echo ""

# Check if we're in the webapp directory
if [ ! -f "package.json" ] || [ ! -d "e2e" ]; then
  echo -e "${RED}Error: Must run from webapp directory${NC}"
  exit 1
fi

# Load environment variables
if [ -f "e2e/.env" ]; then
  export $(cat e2e/.env | grep -v '^#' | xargs)
else
  echo -e "${YELLOW}Warning: e2e/.env not found. Using defaults.${NC}"
fi

# Setup test environment based on --env flag
setup_local_env() {
  echo -e "${YELLOW}Setting up local test environment...${NC}"
  
  # Check if Hardhat node is running
  if ! curl -s http://localhost:8545 > /dev/null 2>&1; then
    echo "Starting Hardhat node..."
    cd ..
    npx hardhat node &
    HARDHAT_PID=$!
    sleep 5
    
    echo "Deploying contracts..."
    npx hardhat deploy --network localhost
    
    echo "Seeding test data..."
    SCENARIO=complete npx hardhat run scripts/dev-environment.js --network localhost
    
    cd webapp
  else
    echo "Hardhat node already running"
  fi
  
  # Check if webapp is running
  if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "Starting webapp..."
    npm run dev &
    WEBAPP_PID=$!
    sleep 10
  else
    echo "Webapp already running"
  fi
}

setup_testnet_env() {
  echo -e "${YELLOW}Configuring for testnet...${NC}"
  export NETWORK_NAME="base-sepolia"
  export RPC_URL="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"
  export CHAIN_ID="84532"
  export BASE_URL="${TESTNET_URL:-http://localhost:3000}"
}

setup_mainnet_env() {
  echo -e "${RED}Mainnet testing not recommended!${NC}"
  echo "Are you sure? (y/N)"
  read -r response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    exit 1
  fi
  
  export NETWORK_NAME="base"
  export RPC_URL="${BASE_MAINNET_RPC_URL:-https://mainnet.base.org}"
  export CHAIN_ID="8453"
  export BASE_URL="${MAINNET_URL:-http://localhost:3000}"
}

# Setup environment
case $TEST_ENV in
  local)
    setup_local_env
    ;;
  testnet)
    setup_testnet_env
    ;;
  mainnet)
    setup_mainnet_env
    ;;
  *)
    echo -e "${RED}Invalid environment: $TEST_ENV${NC}"
    exit 1
    ;;
esac

# Build test command
TEST_CMD="npx playwright test"

# Add test suite filter
case $TEST_SUITE in
  all)
    # Run all tests
    ;;
  wallet)
    TEST_CMD="$TEST_CMD e2e/tests/wallet-connection.test.ts"
    ;;
  marketplace)
    TEST_CMD="$TEST_CMD e2e/tests/marketplace.test.ts"
    ;;
  vault)
    TEST_CMD="$TEST_CMD e2e/tests/vault.test.ts"
    ;;
  integration)
    TEST_CMD="$TEST_CMD e2e/tests/integration.test.ts"
    ;;
  *)
    echo -e "${RED}Invalid test suite: $TEST_SUITE${NC}"
    exit 1
    ;;
esac

# Add mode flags
if [ "$HEADED" = "true" ]; then
  TEST_CMD="$TEST_CMD --headed"
  export HEADLESS="false"
fi

if [ "$DEBUG" = "true" ]; then
  TEST_CMD="$TEST_CMD --debug"
fi

# Run tests
echo -e "${GREEN}Running tests...${NC}"
echo "Command: $TEST_CMD"
echo ""

# Execute tests
if $TEST_CMD; then
  echo -e "${GREEN}✅ Tests completed successfully!${NC}"
  TEST_RESULT=0
else
  echo -e "${RED}❌ Tests failed!${NC}"
  TEST_RESULT=1
fi

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
if [ "$TEST_ENV" = "local" ]; then
  trap cleanup EXIT
fi

# Open report if requested
if [ "$REPORT" = "true" ] || [ "$TEST_RESULT" -ne 0 ]; then
  echo -e "${YELLOW}Opening test report...${NC}"
  npx playwright show-report e2e-reports
fi

exit $TEST_RESULT