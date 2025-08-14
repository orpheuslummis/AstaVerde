# Security: Ghost Supply Recovery for Vault

**Priority**: MEDIUM  
**Type**: Feature Enhancement  
**Status**: Open  
**Component**: EcoStabilizer.sol  
**Security Impact**: Low - Quality of life improvement

## Summary

Users can burn SCC tokens without withdrawing their NFT collateral, creating "ghost supply" - orphaned NFTs locked in the vault forever. While this is tested behavior, adding a recovery mechanism would improve capital efficiency.

## Current Issue

```solidity
// User can burn SCC without withdrawing
scc.burn(20 * 1e18);
// NFT remains locked in vault with loan.active = true
// No mechanism to recover the orphaned NFT
```

Test confirms this is possible:

- `test/SCCInvariants.ts`: "Should create ghost supply when user burns SCC without withdrawing"

## Proposed Solution

Add a time-based recovery mechanism for orphaned collateral.

### Implementation

```solidity
contract EcoStabilizer {
    uint256 public constant RECOVERY_DELAY = 365 days; // 1 year
    mapping(uint256 => uint256) public lastActivityTime;

    // Update on deposit/withdraw
    function deposit(uint256 tokenId) external {
        // ... existing code ...
        lastActivityTime[tokenId] = block.timestamp;
    }

    function withdraw(uint256 tokenId) external {
        // ... existing code ...
        delete lastActivityTime[tokenId];
    }

    // New recovery function
    function recoverOrphanedCollateral(uint256 tokenId) external nonReentrant {
        Loan memory loan = loans[tokenId];
        require(loan.active, "No active loan");

        // Check if loan is orphaned (borrower has no SCC to repay)
        uint256 borrowerSCCBalance = scc.balanceOf(loan.borrower);
        require(borrowerSCCBalance < SCC_PER_ASSET, "Borrower can still repay");

        // Require significant time has passed
        require(
            block.timestamp >= lastActivityTime[tokenId] + RECOVERY_DELAY,
            "Recovery delay not met"
        );

        // Option 1: Return to original borrower
        loans[tokenId].active = false;
        ecoAsset.safeTransferFrom(address(this), loan.borrower, tokenId, 1, "");
        emit CollateralRecovered(loan.borrower, tokenId);

        // Option 2: Allow anyone to claim by burning 20 SCC
        // scc.burnFrom(msg.sender, SCC_PER_ASSET);
        // loans[tokenId].active = false;
        // ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");
    }
}
```

### Alternative: Admin Recovery

```solidity
function adminRecoverOrphaned(
    uint256 tokenId,
    address to
) external onlyOwner {
    Loan memory loan = loans[tokenId];
    require(loan.active, "No active loan");
    require(scc.balanceOf(loan.borrower) < SCC_PER_ASSET, "Can still repay");
    require(block.timestamp >= lastActivityTime[tokenId] + RECOVERY_DELAY);

    loans[tokenId].active = false;
    ecoAsset.safeTransferFrom(address(this), to, tokenId, 1, "");
    emit AdminRecoveredCollateral(to, tokenId);
}
```

## Design Considerations

### Option 1: Return to Borrower

- **Pros**: Fair to original owner, simple
- **Cons**: Borrower gets free loan if SCC burned

### Option 2: Public Auction

- **Pros**: Market-based, maintains SCC peg
- **Cons**: More complex, requires auction mechanism

### Option 3: Admin Discretion

- **Pros**: Flexible, simple
- **Cons**: Centralized, trust required

## Benefits

- Recovers locked capital
- Improves vault efficiency
- Provides closure for orphaned loans
- Maintains system health

## Testing Requirements

- [ ] Test recovery after delay period
- [ ] Test rejection before delay period
- [ ] Test with various SCC balances
- [ ] Test access control
- [ ] Gas cost analysis

## Acceptance Criteria

- [ ] Recovery mechanism implemented
- [ ] Time delay enforced
- [ ] Cannot recover active loans with SCC balance
- [ ] Events emitted for tracking
- [ ] Documentation updated
