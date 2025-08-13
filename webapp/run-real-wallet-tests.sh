#!/bin/bash

echo "🚀 Starting Real Wallet Test Suite"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Ensure clean state
echo -e "${YELLOW}Step 1: Cleaning previous test artifacts...${NC}"
rm -rf test-results e2e-reports

# Step 2: Start services
echo -e "${YELLOW}Step 2: Starting blockchain and webapp...${NC}"

# Check if hardhat node is running
if ! curl -s http://localhost:8545 > /dev/null 2>&1; then
    echo "Starting Hardhat node..."
    npx hardhat node --no-deploy > /tmp/hardhat.log 2>&1 &
    HARDHAT_PID=$!
    sleep 5
else
    echo "Hardhat node already running"
fi

# Check if webapp is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "Starting webapp..."
    npm run dev > /tmp/webapp.log 2>&1 &
    WEBAPP_PID=$!
    
    # Wait for webapp to be ready
    echo "Waiting for webapp to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo -e "${GREEN}Webapp is ready!${NC}"
            break
        fi
        sleep 2
    done
else
    echo "Webapp already running"
fi

# Step 3: Deploy contracts if needed
echo -e "${YELLOW}Step 3: Checking contract deployment...${NC}"
if [ -z "$SKIP_DEPLOYMENT" ]; then
    cd .. && npx hardhat deploy --network localhost && cd webapp
    echo -e "${GREEN}Contracts deployed${NC}"
else
    echo "Skipping deployment (SKIP_DEPLOYMENT set)"
fi

# Step 4: Run tests
echo -e "${YELLOW}Step 4: Running real wallet tests...${NC}"

# Set environment for tests
export SKIP_DEPLOYMENT=true
export NETWORK_NAME=localhost

# Run different test suites
echo "Running smoke tests..."
npx playwright test e2e/tests/00-smoke.spec.ts --reporter=list
SMOKE_RESULT=$?

echo "Running real wallet tests..."
npx playwright test e2e/tests/01-marketplace-real-wallet.spec.ts --reporter=list
WALLET_RESULT=$?

echo "Running vault tests..."
npx playwright test e2e/tests/02-vault-real-wallet.spec.ts --reporter=list
VAULT_RESULT=$?

# Step 5: Report results
echo -e "${YELLOW}Step 5: Test Results${NC}"
echo "================================="

if [ $SMOKE_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Smoke tests: PASSED${NC}"
else
    echo -e "${RED}❌ Smoke tests: FAILED${NC}"
fi

if [ $WALLET_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Real wallet tests: PASSED${NC}"
else
    echo -e "${RED}❌ Real wallet tests: FAILED${NC}"
fi

if [ $VAULT_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Vault tests: PASSED${NC}"
else
    echo -e "${RED}❌ Vault tests: FAILED${NC}"
fi

# Cleanup
if [ ! -z "$HARDHAT_PID" ]; then
    echo "Stopping Hardhat node..."
    kill $HARDHAT_PID 2>/dev/null
fi

if [ ! -z "$WEBAPP_PID" ]; then
    echo "Stopping webapp..."
    kill $WEBAPP_PID 2>/dev/null
fi

# Generate HTML report
echo -e "${YELLOW}Generating HTML report...${NC}"
npx playwright show-report e2e-reports

# Exit with appropriate code
if [ $SMOKE_RESULT -ne 0 ] || [ $WALLET_RESULT -ne 0 ] || [ $VAULT_RESULT -ne 0 ]; then
    exit 1
fi

exit 0