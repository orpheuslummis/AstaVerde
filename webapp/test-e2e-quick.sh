#!/bin/bash

# Quick E2E Test Setup Script
# One-command setup and run for E2E tests

set -e

echo "🚀 AstaVerde E2E Quick Test Setup"
echo "================================="
echo ""

# Check if running from webapp directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
  echo "❌ Error: Must run from webapp directory"
  exit 1
fi

# Install Playwright if needed
if [ ! -d "node_modules/@playwright" ]; then
  echo "📦 Installing Playwright..."
  npm run test:e2e:setup
fi

# Check if local blockchain is running
if ! curl -s http://localhost:8545 > /dev/null 2>&1; then
  echo ""
  echo "⚠️  Local blockchain not running!"
  echo ""
  echo "Please run in another terminal:"
  echo "  npm run dev"
  echo ""
  echo "Then run this script again."
  exit 1
fi

# Check if webapp is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo ""
  echo "⚠️  Webapp not running!"
  echo ""
  echo "The 'npm run dev' command should start both blockchain and webapp."
  echo "Please check that it's running correctly."
  exit 1
fi

echo "✅ Environment ready!"
echo ""
echo "Select test suite to run:"
echo "1) All tests"
echo "2) Wallet connection only"
echo "3) Marketplace (Phase 1) only"
echo "4) Vault (Phase 2) only"
echo "5) Integration tests only"
echo "6) Quick smoke test"
echo ""
read -p "Enter choice (1-6): " choice

case $choice in
  1)
    echo "Running all tests..."
    npm run test:e2e
    ;;
  2)
    echo "Running wallet tests..."
    npx playwright test e2e/tests/wallet-connection.test.ts
    ;;
  3)
    echo "Running marketplace tests..."
    npx playwright test e2e/tests/marketplace.test.ts
    ;;
  4)
    echo "Running vault tests..."
    npx playwright test e2e/tests/vault.test.ts
    ;;
  5)
    echo "Running integration tests..."
    npx playwright test e2e/tests/integration.test.ts
    ;;
  6)
    echo "Running smoke tests..."
    npx playwright test --grep "@smoke"
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "✅ Tests complete!"
echo ""
echo "View report with: npx playwright show-report e2e-reports"