#!/bin/bash

# Kill any lingering dev environment processes

echo "🧹 Cleaning up development environment processes..."

# Kill Next.js dev server
if pgrep -f "next dev" > /dev/null; then
    echo "   Stopping Next.js dev server..."
    pkill -f "next dev"
fi

# Kill Hardhat node
if pgrep -f "hardhat node" > /dev/null; then
    echo "   Stopping Hardhat node..."
    pkill -f "hardhat node"
fi

# Kill any npm processes related to dev environment
if pgrep -f "dev-environment.js" > /dev/null; then
    echo "   Stopping dev environment script..."
    pkill -f "dev-environment.js"
fi

# Check specific ports and kill processes using them
for port in 8545 3000 3001 3002; do
    if lsof -i :$port > /dev/null 2>&1; then
        echo "   Killing process on port $port..."
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    fi
done

echo "✅ Cleanup complete!"
echo ""
echo "To verify all processes are stopped, run:"
echo "   ps aux | grep -E 'hardhat|next' | grep -v grep"