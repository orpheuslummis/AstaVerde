# Security: Ghost Supply Recovery for Vault — Deferred (MVP)

**Priority**: MEDIUM  
**Type**: Feature Enhancement  
**Status**: Won't fix (MVP) — Deferred per SSC_PLAN v0.3  
**Component**: EcoStabilizer.sol  
**Security Impact**: Low — Quality of life improvement

## Summary

Users can burn SCC tokens without withdrawing their NFT collateral, creating "ghost supply" — orphaned NFTs locked in the vault forever. While a recovery mechanism would improve capital efficiency, this is intentionally out of scope for the MVP.

## Scope Decision (MVP)

- SSC plan excludes abandoned‑loan forfeiture/recovery for MVP (scope control).  
- Risk is acknowledged and accepted for MVP; UI must communicate clearly to users before deposit.

Rationale excerpts from SSC_PLAN v0.3:

- "No treasury LP, no abandoned‑loan forfeiture mechanism in MVP."  
- Orphaned collateral risk is an "Accepted risk" for MVP; mitigation is strong UX warnings and basic metrics.

## Current Issue

```solidity
// User can burn SCC without withdrawing
scc.burn(20 * 1e18);
// NFT remains locked in vault with loan.active = true
// No mechanism to recover the orphaned NFT (MVP accepts this)
```

## Deferred Proposal (Post‑MVP options)

Time‑based or admin‑mediated recovery could be introduced later. Kept here for future reference only — not to be implemented in MVP.

```solidity
contract EcoStabilizer {
    uint256 public constant RECOVERY_DELAY = 365 days; // 1 year
    mapping(uint256 => uint256) public lastActivityTime;

    function deposit(uint256 tokenId) external {
        // ... existing code ...
        lastActivityTime[tokenId] = block.timestamp;
    }

    function withdraw(uint256 tokenId) external {
        // ... existing code ...
        delete lastActivityTime[tokenId];
    }

    function recoverOrphanedCollateral(uint256 tokenId) external nonReentrant {
        Loan memory loan = loans[tokenId];
        require(loan.active, "No active loan");
        uint256 borrowerSCCBalance = scc.balanceOf(loan.borrower);
        require(borrowerSCCBalance < SCC_PER_ASSET, "Borrower can still repay");
        require(block.timestamp >= lastActivityTime[tokenId] + RECOVERY_DELAY, "Recovery delay not met");
        loans[tokenId].active = false;
        ecoAsset.safeTransferFrom(address(this), loan.borrower, tokenId, 1, "");
        emit CollateralRecovered(loan.borrower, tokenId);
    }
}
```

Alternative (admin‑mediated):

```solidity
function adminRecoverOrphaned(uint256 tokenId, address to) external onlyOwner {
    Loan memory loan = loans[tokenId];
    require(loan.active, "No active loan");
    require(scc.balanceOf(loan.borrower) < SCC_PER_ASSET, "Can still repay");
    require(block.timestamp >= lastActivityTime[tokenId] + RECOVERY_DELAY);
    loans[tokenId].active = false;
    ecoAsset.safeTransferFrom(address(this), to, tokenId, 1, "");
    emit AdminRecoveredCollateral(to, tokenId);
}
```

## MVP Actions (tracking only)

- Add prominent UI warning/confirmation before deposit about orphaned‑collateral risk.  
- Track basic metric in client: count loans where borrower SCC balance appears insufficient to repay (best‑effort UX signal).

## Archival Note

This ticket is archived as "won't fix (MVP)" to reflect scope boundaries. Re‑open for post‑MVP planning if scope changes.


