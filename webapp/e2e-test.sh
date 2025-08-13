#!/bin/bash

# E2E Test Runner - Automated setup and execution
# This script handles the complete test environment setup and teardown

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
HARDHAT_PID=""
WEBAPP_PID=""
CLEANUP_NEEDED=false

# Cleanup function
cleanup() {
    if [ "$CLEANUP_NEEDED" = true ]; then
        echo -e "${YELLOW}🧹 Cleaning up...${NC}"
        
        if [ ! -z "$HARDHAT_PID" ]; then
            echo "Stopping Hardhat node..."
            kill $HARDHAT_PID 2>/dev/null || true
        fi
        
        if [ ! -z "$WEBAPP_PID" ]; then
            echo "Stopping webapp..."
            kill $WEBAPP_PID 2>/dev/null || true
        fi
        
        # Kill any remaining node processes on ports
        lsof -ti:8545 | xargs kill -9 2>/dev/null || true
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Parse arguments
TEST_ONLY=false
HEADED=false
DEBUG=false
SMOKE_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --test-only)
            TEST_ONLY=true
            shift
            ;;
        --headed)
            HEADED=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --smoke)
            SMOKE_ONLY=true
            shift
            ;;
        --help)
            echo "Usage: ./e2e-test.sh [options]"
            echo ""
            echo "Options:"
            echo "  --test-only    Skip environment setup (assumes already running)"
            echo "  --headed       Run tests with browser visible"
            echo "  --debug        Run tests in debug mode"
            echo "  --smoke        Run smoke tests only"
            echo "  --help         Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run './e2e-test.sh --help' for usage"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}🚀 AstaVerde E2E Test Runner${NC}"
echo "================================"

# Check we're in the right directory
if [ ! -f "../package.json" ] || [ ! -d "e2e" ]; then
    echo -e "${RED}Error: Must run from webapp directory${NC}"
    echo "Current directory: $(pwd)"
    echo "Please cd to webapp/ and run again"
    exit 1
fi

if [ "$TEST_ONLY" = false ]; then
    CLEANUP_NEEDED=true
    
    # Step 1: Start Hardhat node
    echo -e "${YELLOW}📦 Starting local blockchain...${NC}"
    cd ..
    npx hardhat node > /tmp/hardhat.log 2>&1 &
    HARDHAT_PID=$!
    
    # Wait for Hardhat to be ready
    echo -n "Waiting for Hardhat node"
    for i in {1..10}; do
        if curl -s http://localhost:8545 > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
    
    if ! curl -s http://localhost:8545 > /dev/null 2>&1; then
        echo -e " ${RED}✗${NC}"
        echo "Failed to start Hardhat node. Check /tmp/hardhat.log for errors"
        exit 1
    fi
    
    # Step 2: Deploy contracts and seed data
    echo -e "${YELLOW}🚀 Deploying contracts...${NC}"
    npx hardhat deploy --network localhost > /tmp/deploy.log 2>&1
    
    # Step 3: Seed test data
    echo -e "${YELLOW}🌱 Seeding test data...${NC}"
    npx hardhat run scripts/test-seed.js --network localhost > /tmp/seed.log 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Test data seeded${NC}"
    else
        echo -e "${YELLOW}⚠ Test data seeding had issues, continuing...${NC}"
    fi
    
    # Step 4: Start webapp
    echo -e "${YELLOW}🌐 Starting webapp...${NC}"
    cd webapp
    npm run dev > /tmp/webapp.log 2>&1 &
    WEBAPP_PID=$!
    
    # Wait for webapp to be ready
    echo -n "Waiting for webapp"
    for i in {1..20}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
    
    if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e " ${RED}✗${NC}"
        echo "Failed to start webapp. Check /tmp/webapp.log for errors"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Environment ready!${NC}"
    echo ""
else
    echo -e "${YELLOW}⏭️  Skipping environment setup (--test-only mode)${NC}"
fi

# Step 5: Run tests
echo -e "${YELLOW}🧪 Running E2E tests...${NC}"

# Build test command
TEST_CMD="npx playwright test"

if [ "$SMOKE_ONLY" = true ]; then
    TEST_CMD="$TEST_CMD e2e/tests/00-smoke.spec.ts"
fi

if [ "$HEADED" = true ]; then
    TEST_CMD="$TEST_CMD --headed"
    export HEADLESS=false
fi

if [ "$DEBUG" = true ]; then
    TEST_CMD="$TEST_CMD --debug"
fi

# Add reporter
TEST_CMD="$TEST_CMD --reporter=list"

echo "Command: $TEST_CMD"
echo ""

# Run the tests
if $TEST_CMD; then
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
    TEST_RESULT=0
else
    echo ""
    echo -e "${RED}❌ Some tests failed${NC}"
    TEST_RESULT=1
fi

# Show report location
echo ""
echo -e "${YELLOW}📊 Test report available at:${NC}"
echo "   webapp/e2e-reports/index.html"
echo ""
echo "To view: npx playwright show-report e2e-reports"

exit $TEST_RESULT