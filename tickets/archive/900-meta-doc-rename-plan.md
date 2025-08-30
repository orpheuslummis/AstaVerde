# Archive Ticket Renaming Plan

## Naming Convention

`[number]-[status]-[component]-[brief-description].md`

Status codes:

- fixed: Issue has been resolved in code
- open: Issue still exists
- enhance: Enhancement proposal
- doc: Documentation item
- test: Testing related

## Renaming Map

### FIXED Issues (001-010)

001-fixed-astaverde-refund-siphon.md <- fix-astaverde-buybatch-overpayment-refund-siphon.md
002-fixed-astaverde-redeemed-resale.md <- fix-astaverde-redeemed-nft-resale.md
003-fixed-astaverde-vault-pause.md <- fix-vault-withdrawals-blocked-by-pause.md
004-fixed-astaverde-price-dos.md <- fix-astaverde-price-decrease-loop-dos.md
005-fixed-astaverde-event-order.md <- fix-astaverde-event-ordering.md
006-fixed-astaverde-price-underflow.md <- fix-astaverde-price-underflow-getCurrentBatchPrice.md

### OPEN Issues (011-020)

011-open-astaverde-batch-indexing.md <- fix-astaverde-batch-index-consistency.md
012-open-astaverde-slippage.md <- fix-astaverde-slippage-protection.md
013-open-astaverde-ghost-tokens.md <- fix-astaverde-ghost-token-redemption.md
014-open-astaverde-partial-order.md <- fix-astaverde-partial-batch-ordering.md
015-open-astaverde-platform-max.md <- fix-astaverde-platform-share-maximum.md
016-open-astaverde-zero-producer.md <- fix-astaverde-zero-address-producer.md
017-open-astaverde-frontrun.md <- fix-astaverde-frontrunning-price-updates.md
018-open-scc-role-hardening.md <- fix-scc-role-governance-hardening.md
019-open-mockusdc-safety.md <- fix-deployment-mockusdc-safety.md

### ENHANCEMENTS (021-030)

021-enhance-astaverde-safeerc20.md <- enhance-astaverde-safeerc20.md
022-enhance-astaverde-payout-round.md <- enhance-astaverde-producer-payout-rounding.md
023-enhance-vault-maxscan-event.md <- enhance-ecostabilizer-emit-maxScanRange-change-event.md
024-enhance-vault-view-dos.md <- enhance-ecostabilizer-view-scan-dos-hardening.md
025-enhance-scc-permit.md <- feature-scc-add-eip2612-permit.md

### DOCUMENTATION (031-035)

031-doc-astaverde-owner-field.md <- doc-astaverde-tokeninfo-owner-non-authoritative.md
032-doc-astaverde-usdc-decimals.md <- docs-astaverde-usdc-6-decimals-check.md

### CLEANUP/GUARD (036-040)

036-cleanup-astaverde-modifier.md <- cleanup-astaverde-onlyTokenOwner-modifier.md
037-guard-astaverde-batch-size.md <- guard-astaverde-maxBatchSize-upper-bound.md

### TESTING (041-045)

041-test-e2e-wallet-status.md <- e2e-wallet-testing-status.md
042-test-security-regressions.md <- tests-astaverde-security-regressions.md
