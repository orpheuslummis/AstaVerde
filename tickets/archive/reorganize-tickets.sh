#!/bin/bash

# Ticket Archive Reorganization Script
# Created: 2025-08-27
# Purpose: Safely rename tickets to resolve duplicates and standardize naming

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Ticket Archive Reorganization Script"
echo "========================================="

# Check we're in the right directory
if [[ ! -f "REORGANIZATION_PLAN.md" ]]; then
    echo -e "${RED}Error: Must run from tickets/archive/ directory${NC}"
    exit 1
fi

# Count files before
BEFORE_COUNT=$(ls -1 *.md 2>/dev/null | wc -l)
echo -e "Files before: ${YELLOW}$BEFORE_COUNT${NC}"

# Create rename log
LOG_FILE="reorganization.log"
echo "Reorganization started at $(date)" > "$LOG_FILE"
echo "----------------------------------------" >> "$LOG_FILE"

# Function to safely rename
safe_rename() {
    local old="$1"
    local new="$2"
    
    if [[ ! -f "$old" ]]; then
        echo -e "${YELLOW}Skip: $old not found${NC}"
        echo "SKIP: $old not found" >> "$LOG_FILE"
        return
    fi
    
    if [[ -f "$new" ]]; then
        echo -e "${RED}Error: $new already exists${NC}"
        echo "ERROR: $new already exists (from $old)" >> "$LOG_FILE"
        return 1
    fi
    
    mv "$old" "$new"
    echo -e "${GREEN}✓${NC} $old → $new"
    echo "RENAMED: $old → $new" >> "$LOG_FILE"
}

echo ""
echo "Starting renames..."
echo ""

# === DUPLICATES RESOLUTION ===
echo "Resolving duplicates..."

# 001 duplicates
safe_rename "001-fixed-astaverde-refund-siphon.md" "001-fixed-security-astaverde-refund-siphon.md"
safe_rename "001-fixed-webapp-vault-error-handling.md" "201-fixed-webapp-vault-error-handling.md"

# 002 duplicates  
safe_rename "002-fixed-astaverde-redeemed-resale.md" "002-fixed-security-astaverde-redeemed-resale.md"
safe_rename "002-future-security-admin-timelock.md" "102-future-security-admin-timelock.md"

# 003 duplicates
safe_rename "003-fixed-astaverde-vault-pause.md" "003-fixed-security-astaverde-vault-pause.md"
safe_rename "003-wontfix-security-slippage-protection.md" "103-wontfix-security-slippage-protection.md"

# 004 duplicates
safe_rename "004-fixed-astaverde-price-dos.md" "004-fixed-security-astaverde-price-dos.md"
safe_rename "004-fixed-security-role-renunciation.md" "104-fixed-security-role-renunciation.md"

# 005 duplicates
safe_rename "005-fixed-astaverde-event-order.md" "005-fixed-contract-astaverde-event-order.md"
safe_rename "005-wontfix-ecostabilizer-ghost-supply.md" "105-wontfix-security-ecostabilizer-ghost-supply.md"

# 006 duplicates
safe_rename "006-fixed-astaverde-price-underflow.md" "006-fixed-security-astaverde-price-underflow.md"
safe_rename "006-wontfix-security-purchase-cooldown.md" "106-wontfix-security-purchase-cooldown.md"

# 031 duplicates
safe_rename "031-coexistence-plan-v1-v11-two-vaults.md" "301-resolved-enhance-coexistence-plan.md"
safe_rename "031-doc-astaverde-owner-field.md" "501-fixed-doc-astaverde-owner-field.md"

# 032 duplicates
safe_rename "032-doc-astaverde-usdc-decimals.md" "502-fixed-doc-astaverde-usdc-decimals.md"
safe_rename "032-fixed-webapp-getUserLoans-pagination.md" "202-fixed-webapp-getUserLoans-pagination.md"
safe_rename "032-implemented-dual-vault-frontend-routing.md" "203-fixed-webapp-dual-vault-routing.md"

# 036 duplicates
safe_rename "036-cleanup-astaverde-modifier.md" "601-open-cleanup-astaverde-modifier.md"
safe_rename "036-fixed-webapp-event-listener-cleanup.md" "204-fixed-webapp-event-listener-cleanup.md"

# 104 duplicates
safe_rename "104-medium-astaverde-price-iteration-dos.md" "107-fixed-security-price-iteration-dos.md"
safe_rename "104-wontfix-astaverde-price-iteration-dos.md" "108-wontfix-security-price-iteration-dos.md"

echo ""
echo "Standardizing naming conventions..."

# === CATEGORY STANDARDIZATION ===

# Enhancement tickets
safe_rename "007-fixed-enhancement-vault-events.md" "302-fixed-enhance-vault-events.md"
safe_rename "008-refactor-vault-deduplication.md" "602-open-refactor-vault-deduplication.md"
safe_rename "009-fixed-cleanup-mock-usdc.md" "603-fixed-cleanup-mock-usdc.md"
safe_rename "010-fixed-doc-buybatch-signature.md" "503-fixed-doc-buybatch-signature.md"

# Open tickets standardization
safe_rename "011-open-astaverde-batch-indexing.md" "011-open-contract-batch-indexing.md"
safe_rename "013-open-astaverde-ghost-tokens.md" "013-open-security-ghost-tokens.md"
safe_rename "014-open-astaverde-partial-order.md" "014-open-contract-partial-order.md"
safe_rename "015-open-astaverde-platform-max.md" "015-open-contract-platform-max.md"
safe_rename "016-open-astaverde-zero-producer.md" "016-open-contract-zero-producer.md"
safe_rename "017-open-astaverde-frontrun.md" "017-open-security-frontrun.md"
safe_rename "018-open-scc-role-hardening.md" "109-open-security-scc-role-hardening.md"
safe_rename "019-open-mockusdc-safety.md" "110-open-security-mockusdc-safety.md"

# Enhance tickets
safe_rename "021-enhance-astaverde-safeerc20.md" "303-open-enhance-safeerc20.md"
safe_rename "022-enhance-astaverde-payout-round.md" "304-open-enhance-payout-round.md"
safe_rename "023-enhance-vault-maxscan-event.md" "305-open-enhance-vault-maxscan-event.md"
safe_rename "024-enhance-vault-view-dos.md" "306-open-enhance-vault-view-dos.md"
safe_rename "025-enhance-scc-permit.md" "307-open-enhance-scc-permit.md"

# Test tickets
safe_rename "041-test-e2e-wallet-status.md" "401-open-test-e2e-wallet-status.md"
safe_rename "042-test-security-regressions.md" "402-open-test-security-regressions.md"

# Security/Critical tickets
safe_rename "103-critical-scc-deployment-role-brick.md" "111-fixed-security-scc-deployment-role.md"
safe_rename "105-fixed-vault-inefficient-loan-queries.md" "308-fixed-enhance-vault-loan-queries.md"
safe_rename "106-resolved-vault-storage-pattern-inconsistency.md" "604-resolved-refactor-vault-storage.md"
safe_rename "107-wontfix-astaverde-price-decrease-bypass.md" "112-wontfix-security-price-decrease-bypass.md"
safe_rename "108-fixed-astaverde-usdc-fee-on-transfer.md" "113-fixed-security-usdc-fee-on-transfer.md"

# Webapp tickets (200 series)
safe_rename "201-webapp-duplicate-utils.md" "205-open-webapp-duplicate-utils.md"
safe_rename "202-webapp-duplicate-batch-hooks.md" "206-open-webapp-duplicate-batch-hooks.md"
safe_rename "204-webapp-react-hook-dependencies.md" "207-open-webapp-react-hook-dependencies.md"
safe_rename "205-webapp-large-components.md" "208-open-webapp-large-components.md"
safe_rename "206-webapp-usdc-decimals-import.md" "209-open-webapp-usdc-decimals-import.md"
safe_rename "207-webapp-unused-variable.md" "210-open-webapp-unused-variable.md"
safe_rename "210-webapp-console-statements.md" "211-open-webapp-console-statements.md"
safe_rename "211-webapp-image-optimization.md" "212-open-webapp-image-optimization.md"
safe_rename "212-fixed-webapp-remove-invalid-functions-and-allowlists.md" "213-fixed-webapp-remove-invalid-functions.md"
safe_rename "213-fixed-webapp-fix-token-tuple-shape-and-parsing.md" "214-fixed-webapp-token-tuple-shape.md"
safe_rename "214-fixed-webapp-consolidate-contract-config-and-types.md" "215-fixed-webapp-consolidate-config.md"
safe_rename "215-fixed-webapp-useContractInteraction-abi-inference.md" "216-fixed-webapp-abi-inference.md"

# Special files
safe_rename "RENAME_PLAN.md" "900-meta-doc-rename-plan.md"

echo ""
echo "========================================="

# Count files after
AFTER_COUNT=$(ls -1 *.md 2>/dev/null | wc -l)
echo -e "Files after: ${YELLOW}$AFTER_COUNT${NC}"

# Check file count preservation
if [[ $BEFORE_COUNT -eq $AFTER_COUNT ]]; then
    echo -e "${GREEN}✓ File count preserved - no data lost!${NC}"
    echo "SUCCESS: File count preserved ($BEFORE_COUNT files)" >> "$LOG_FILE"
else
    echo -e "${RED}Warning: File count changed! Before: $BEFORE_COUNT, After: $AFTER_COUNT${NC}"
    echo "WARNING: File count changed! Before: $BEFORE_COUNT, After: $AFTER_COUNT" >> "$LOG_FILE"
fi

echo ""
echo "Reorganization complete at $(date)" >> "$LOG_FILE"
echo -e "${GREEN}Reorganization complete!${NC}"
echo "Log file: $LOG_FILE"
echo ""

# Show duplicates check
echo "Checking for remaining duplicates..."
DUPES=$(ls -1 | grep -E '^[0-9]{3}.*\.md$' | awk -F'-' '{print $1}' | sort | uniq -d)
if [[ -z "$DUPES" ]]; then
    echo -e "${GREEN}✓ No duplicate numbers found!${NC}"
else
    echo -e "${RED}Remaining duplicates found:${NC}"
    echo "$DUPES"
fi