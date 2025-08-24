# Ticket #102: CRITICAL - Redeemed Token While Collateralized State Inconsistency

## Priority: HIGH

## Component: EcoStabilizer.sol / AstaVerde.sol Integration

## Issue Type: State Management Bug

## Description

There's no mechanism to handle NFTs that get redeemed while they are collateralized in the EcoStabilizer vault. This creates an unrecoverable state where the vault holds a redeemed NFT but still expects it to be withdrawable.

## Location

- Primary: `contracts/EcoStabilizer.sol` - withdraw functions
- Secondary: `contracts/AstaVerde.sol` - redeemToken function
- Integration point: Cross-contract state management

## Current Behavior

1. EcoStabilizer checks redemption status only at deposit (line 142-143)
2. AstaVerde allows any token holder to redeem (line 580-588)
3. No mechanism prevents redemption of vault-held tokens
4. No recovery path if a token gets redeemed while in vault

## Problem Scenario

```
1. User deposits NFT #123 to vault (not redeemed)
2. User receives 20 SCC loan
3. Through some mechanism, NFT #123 gets marked as redeemed
   - Could happen if vault transfers token temporarily
   - Or if there's a reentrancy issue
   - Or through direct manipulation if vault has a bug
4. User tries to repay 20 SCC and withdraw NFT #123
5. Withdrawal succeeds but user gets a redeemed NFT (unexpected)
6. OR if vault adds check, withdrawal could fail (funds locked)
```

## Impact

- **Critical**: User funds could be locked permanently
- **Trust**: Breaks the "always recoverable" guarantee of the vault
- **Economic**: 20 SCC remains in circulation without backing

## Core Issue

The vault assumes token redemption status is immutable while collateralized, but:

1. Nothing prevents the status from changing
2. The vault doesn't check redemption status on withdrawal
3. No emergency recovery mechanism exists

## Recommended Fixes

### Option 1: Check Redemption on Withdrawal (Simple)

```solidity
function _withdrawInternal(uint256 tokenId) internal {
    Loan memory loan = loans[tokenId];
    require(loan.active && loan.borrower == msg.sender, "not borrower");

    // Add redemption check
    (, , , , bool redeemed) = ecoAsset.tokens(tokenId);
    require(!redeemed, "token was redeemed while in vault");

    // ... rest of function
}
```

### Option 2: Emergency Recovery Path (Comprehensive)

```solidity
// Add new function
function emergencyWithdrawRedeemed(uint256 tokenId) external nonReentrant {
    Loan memory loan = loans[tokenId];
    require(loan.active && loan.borrower == msg.sender, "not borrower");

    (, , , , bool redeemed) = ecoAsset.tokens(tokenId);
    require(redeemed, "token not redeemed");

    // Clear loan without requiring SCC burn
    loans[tokenId].active = false;

    // Return the redeemed token
    ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");

    // Emit special event
    emit EmergencyRedeemedWithdrawal(msg.sender, tokenId);
}
```

### Option 3: Prevent Redemption While Collateralized (Requires AstaVerde Change)

Modify AstaVerde.redeemToken to check if token is in vault:

```solidity
function redeemToken(uint256 tokenId) external nonReentrant {
    require(balanceOf(msg.sender, tokenId) > 0, "Caller is not the token owner");
    require(msg.sender != address(ecoStabilizerVault), "Cannot redeem vault tokens");
    // ... rest of function
}
```

## Testing Required

- Unit test: Attempt to withdraw redeemed token
- Integration test: Full redemption while collateralized scenario
- Invariant test: SCC supply vs collateral consistency

## Severity Justification

This is CRITICAL because:

1. Can lock user funds permanently
2. Breaks core vault guarantee
3. No current recovery mechanism
4. Could affect protocol solvency

## References

- EcoStabilizer line 142-143: Redemption check only on deposit
- AstaVerde line 580-588: Anyone can redeem their tokens
- No cross-contract communication about redemption status
