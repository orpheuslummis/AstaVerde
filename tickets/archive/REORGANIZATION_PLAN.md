# Ticket Archive Reorganization Plan

## Current Issues
1. **Duplicate Numbers**: 9 ticket numbers have 2-3 duplicates (001, 002, 003, 004, 005, 006, 031, 032, 036, 104)
2. **Inconsistent Naming**: Mixed patterns for status, category, and descriptions
3. **Non-standard Files**: RENAME_PLAN.md doesn't follow numbering
4. **Number Gaps**: Jumps in sequence (025→031, 037→041, 042→103, 108→201)

## Proposed Solutions

### 1. New Numbering Scheme
```
001-099: General/Mixed tickets
100-199: Security/Critical tickets  
200-299: Webapp-specific tickets
300-399: Enhancement tickets
400-499: Testing/QA tickets
500-599: Documentation tickets
600-699: Refactor/Cleanup tickets
700+:    Future/Reserved
```

### 2. Standard Naming Convention
```
XXX-STATUS-CATEGORY-description.md

Where:
- XXX: Three-digit number (with leading zeros)
- STATUS: fixed | wontfix | open | future | resolved
- CATEGORY: security | webapp | contract | enhance | test | doc | refactor | cleanup
- description: kebab-case description (keep existing where sensible)
```

### 3. Renaming Map for Duplicates

#### 001 duplicates:
- 001-fixed-astaverde-refund-siphon.md → 001-fixed-security-astaverde-refund-siphon.md
- 001-fixed-webapp-vault-error-handling.md → 201-fixed-webapp-vault-error-handling.md

#### 002 duplicates:
- 002-fixed-astaverde-redeemed-resale.md → 002-fixed-security-astaverde-redeemed-resale.md  
- 002-future-security-admin-timelock.md → 102-future-security-admin-timelock.md

#### 003 duplicates:
- 003-fixed-astaverde-vault-pause.md → 003-fixed-security-astaverde-vault-pause.md
- 003-wontfix-security-slippage-protection.md → 103-wontfix-security-slippage-protection.md

#### 004 duplicates:
- 004-fixed-astaverde-price-dos.md → 004-fixed-security-astaverde-price-dos.md
- 004-fixed-security-role-renunciation.md → 104-fixed-security-role-renunciation.md

#### 005 duplicates:
- 005-fixed-astaverde-event-order.md → 005-fixed-contract-astaverde-event-order.md
- 005-wontfix-ecostabilizer-ghost-supply.md → 105-wontfix-security-ecostabilizer-ghost-supply.md

#### 006 duplicates:
- 006-fixed-astaverde-price-underflow.md → 006-fixed-security-astaverde-price-underflow.md
- 006-wontfix-security-purchase-cooldown.md → 106-wontfix-security-purchase-cooldown.md

#### 031 duplicates:
- 031-coexistence-plan-v1-v11-two-vaults.md → 301-resolved-enhance-coexistence-plan.md
- 031-doc-astaverde-owner-field.md → 501-fixed-doc-astaverde-owner-field.md

#### 032 duplicates:
- 032-doc-astaverde-usdc-decimals.md → 502-fixed-doc-astaverde-usdc-decimals.md
- 032-fixed-webapp-getUserLoans-pagination.md → 202-fixed-webapp-getUserLoans-pagination.md
- 032-implemented-dual-vault-frontend-routing.md → 203-fixed-webapp-dual-vault-routing.md

#### 036 duplicates:
- 036-cleanup-astaverde-modifier.md → 601-open-cleanup-astaverde-modifier.md
- 036-fixed-webapp-event-listener-cleanup.md → 204-fixed-webapp-event-listener-cleanup.md

#### 104 duplicate (already has 104 from above):
- 104-medium-astaverde-price-iteration-dos.md → 107-fixed-security-price-iteration-dos.md
- 104-wontfix-astaverde-price-iteration-dos.md → 108-wontfix-security-price-iteration-dos.md

### 4. Other Renamings for Consistency

#### Add category to tickets missing it:
- 007-fixed-enhancement-vault-events.md → 302-fixed-enhance-vault-events.md
- 008-refactor-vault-deduplication.md → 602-open-refactor-vault-deduplication.md
- 009-fixed-cleanup-mock-usdc.md → 603-fixed-cleanup-mock-usdc.md
- 010-fixed-doc-buybatch-signature.md → 503-fixed-doc-buybatch-signature.md

#### Standardize "open" tickets:
- 011-open-astaverde-batch-indexing.md → 011-open-contract-batch-indexing.md
- 013-open-astaverde-ghost-tokens.md → 013-open-security-ghost-tokens.md
- 014-open-astaverde-partial-order.md → 014-open-contract-partial-order.md
- 015-open-astaverde-platform-max.md → 015-open-contract-platform-max.md
- 016-open-astaverde-zero-producer.md → 016-open-contract-zero-producer.md
- 017-open-astaverde-frontrun.md → 017-open-security-frontrun.md
- 018-open-scc-role-hardening.md → 109-open-security-scc-role-hardening.md
- 019-open-mockusdc-safety.md → 110-open-security-mockusdc-safety.md

#### Enhance tickets:
- 021-enhance-astaverde-safeerc20.md → 303-open-enhance-safeerc20.md
- 022-enhance-astaverde-payout-round.md → 304-open-enhance-payout-round.md
- 023-enhance-vault-maxscan-event.md → 305-open-enhance-vault-maxscan-event.md
- 024-enhance-vault-view-dos.md → 306-open-enhance-vault-view-dos.md
- 025-enhance-scc-permit.md → 307-open-enhance-scc-permit.md

#### Test tickets:
- 041-test-e2e-wallet-status.md → 401-open-test-e2e-wallet-status.md
- 042-test-security-regressions.md → 402-open-test-security-regressions.md

#### Already properly numbered security tickets:
- 103-critical-scc-deployment-role-brick.md → 111-fixed-security-scc-deployment-role.md
- 105-fixed-vault-inefficient-loan-queries.md → 308-fixed-enhance-vault-loan-queries.md
- 106-resolved-vault-storage-pattern-inconsistency.md → 604-resolved-refactor-vault-storage.md
- 107-wontfix-astaverde-price-decrease-bypass.md → 112-wontfix-security-price-decrease-bypass.md
- 108-fixed-astaverde-usdc-fee-on-transfer.md → 113-fixed-security-usdc-fee-on-transfer.md

#### Webapp tickets (200s - already mostly correct):
- 201-webapp-duplicate-utils.md → 205-open-webapp-duplicate-utils.md
- 202-webapp-duplicate-batch-hooks.md → 206-open-webapp-duplicate-batch-hooks.md
- 204-webapp-react-hook-dependencies.md → 207-open-webapp-react-hook-dependencies.md
- 205-webapp-large-components.md → 208-open-webapp-large-components.md
- 206-webapp-usdc-decimals-import.md → 209-open-webapp-usdc-decimals-import.md
- 207-webapp-unused-variable.md → 210-open-webapp-unused-variable.md
- 210-webapp-console-statements.md → 211-open-webapp-console-statements.md
- 211-webapp-image-optimization.md → 212-open-webapp-image-optimization.md
- 212-fixed-webapp-remove-invalid-functions-and-allowlists.md → 213-fixed-webapp-remove-invalid-functions.md
- 213-fixed-webapp-fix-token-tuple-shape-and-parsing.md → 214-fixed-webapp-token-tuple-shape.md
- 214-fixed-webapp-consolidate-contract-config-and-types.md → 215-fixed-webapp-consolidate-config.md
- 215-fixed-webapp-useContractInteraction-abi-inference.md → 216-fixed-webapp-abi-inference.md

#### Special files:
- RENAME_PLAN.md → 900-meta-doc-rename-plan.md

### 5. Implementation Steps

1. **Create backup**: `cp -r archive archive.backup.$(date +%Y%m%d)`
2. **Run validation**: Check for conflicts in new numbering
3. **Execute renames**: Using a script with mv commands
4. **Update references**: Search for any internal references to old ticket numbers
5. **Clean up**: Remove backup after verification

### 6. Benefits
- No duplicate numbers
- Clear categorization by number range
- Consistent status-category-description format
- Easier to find related tickets
- Better organization for future tickets