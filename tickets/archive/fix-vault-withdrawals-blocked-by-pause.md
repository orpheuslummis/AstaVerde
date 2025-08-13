# Fix Vault Withdrawals Blocked by Pause (Vault + AstaVerde)

## Priority: HIGH (Operational Risk)
- **Status: ✅ FIXED**
- **Last Checked: 2025-08-13**

## ✅ FIXED STATUS

**VULNERABILITY RESOLVED**: AstaVerde now has vault allowlist:
- Line 36: `address public trustedVault` state variable added
- Line 130: `setTrustedVault` function to configure vault address
- Lines 140-143: `_update` allows transfers from/to trustedVault even when paused
- **Fix Applied**: Vault operations continue working during pause, preventing collateral lockup

## Issue

When `AstaVerde` is paused, it blocks ALL ERC1155 transfers including those initiated by the EcoStabilizer vault. Additionally, `AstaVerde.claimPlatformFunds` is also gated by `whenNotPaused`, preventing operations that should be possible during pauses. This can trap vault collateral and block ops.

## Location

- Contracts: `AstaVerde.sol` (lines ~115-122, ~376), `EcoStabilizer.sol`
- Impact: `EcoStabilizer.withdraw()` and `emergencyNFTWithdraw()`; `AstaVerde.claimPlatformFunds()`
- Root cause: `ERC1155Pausable` blocks all transfers via `_update` and `claimPlatformFunds` has `whenNotPaused`

## Vulnerability Details

```solidity
// AstaVerde.sol - blocks ALL transfers when paused
function _update(
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory values
) internal override(ERC1155, ERC1155Pausable) {
    super._update(from, to, ids, values);  // Pausable blocks this
}

// EcoStabilizer.sol - depends on AstaVerde transfers
function withdraw(uint256 tokenId) external nonReentrant whenNotPaused {
    // ...
    ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");  // BLOCKED if AstaVerde paused
    // ...
}
```

## Attack/Risk Scenario

1. Users deposit NFTs as collateral, receive 20 SCC loans
2. Admin pauses AstaVerde due to security concern or maintenance
3. Users with SCC ready to repay cannot withdraw their NFTs
4. Creates cascading issues:
    - Users locked out of their collateral
    - SCC price could crash due to exit inability
    - Trust damage to protocol
    - Potential legal/regulatory issues

## Impact

- **Severity**: High (Operational/Liquidity Risk)
- **Affected Users**: All vault depositors
- **Lock Duration**: Entire pause period
- **Financial Impact**: Inability to access collateral worth potentially millions

## Recommended Fix

### Option 1: Allowlist Vault in AstaVerde Pause Logic

```solidity
// In AstaVerde.sol
address public trustedVault;  // Set during deployment

function setTrustedVault(address _vault) external onlyOwner {
    trustedVault = _vault;
}

function _update(
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory values
) internal override(ERC1155, ERC1155Pausable) {
    // Allow transfers to/from trusted vault even when paused
    if (paused() && from != trustedVault && to != trustedVault) {
        revert EnforcedPause();
    }

    // Otherwise proceed with normal update
    ERC1155._update(from, to, ids, values);  // Skip Pausable check
}
```

### Option 2: Emergency Withdrawal Mode in Vault

```solidity
// In EcoStabilizer.sol
bool public emergencyWithdrawalEnabled;

function enableEmergencyWithdrawals() external onlyOwner {
    emergencyWithdrawalEnabled = true;
}

function emergencyWithdraw(uint256 tokenId) external nonReentrant {
    require(emergencyWithdrawalEnabled, "Emergency withdrawals not enabled");
    Loan memory loan = loans[tokenId];
    require(loan.active && loan.borrower == msg.sender, "not borrower");

    // Try normal withdrawal first
    try ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "") {
        loans[tokenId].active = false;
        scc.burnFrom(msg.sender, SCC_PER_ASSET);
        emit Withdrawn(msg.sender, tokenId);
    } catch {
        // If transfer fails due to pause, at least record intent
        emit EmergencyWithdrawalRequested(msg.sender, tokenId);
        // Admin must manually process after unpause
    }
}
```

### Option 3: Separate Pause Controls

```solidity
// In AstaVerde.sol
bool public marketplacePaused;  // For buy/sell operations
bool public transfersPaused;     // For all transfers

modifier whenMarketplaceNotPaused() {
    require(!marketplacePaused, "Marketplace paused");
    _;
}

function buyBatch(...) external whenMarketplaceNotPaused { /* ... */ }
function sellBatch(...) external whenMarketplaceNotPaused { /* ... */ }

function _update(...) internal override(ERC1155) {
    if (transfersPaused) {
        // Still allow vault transfers
        require(from == trustedVault || to == trustedVault, "Transfers paused");
    }
    super._update(from, to, ids, values);
}
```

### Option 4: Operational Playbook (Non-code)

### Option 5: Permit Owner Fund Claims During Pause (Minimal)

Remove `whenNotPaused` from `claimPlatformFunds` so platform funds can be claimed during an incident response while trading is paused. Keep `onlyOwner` and `nonReentrant`.
Document and enforce operational procedures:

1. Never pause AstaVerde without coordinating vault withdrawals
2. If pause needed, provide advance notice for users to withdraw
3. Consider time-limited pauses with automatic unpause
4. Establish clear communication channels for pause events

## Testing Requirements

1. Test vault withdrawals work when AstaVerde is paused (with fix)
2. Test normal marketplace operations properly blocked when paused
3. Test `claimPlatformFunds` callable by owner during pause if Option 5 chosen
4. Verify emergency procedures if implemented
5. Gas cost analysis of additional checks
6. Integration tests with both contracts

## Acceptance Criteria

- [ ] Users can withdraw from vault even if AstaVerde paused
- [ ] Marketplace operations still properly pausable
- [ ] Owner can claim funds during pause (if Option 5 chosen)
- [ ] Clear documentation of pause procedures
- [ ] Emergency withdrawal path tested if implemented
- [ ] No additional attack vectors introduced

## References

- Compound cToken pause issues
- MakerDAO emergency shutdown procedures
- Best practice: Granular pause controls

## Notes

This is a critical operational risk that could trap user funds. While not a direct code vulnerability, it represents a serious design flaw that could cause significant user harm. Recommend Option 1 (allowlist vault) as cleanest solution.
