# Ticket #103: CRITICAL - SCC Deployment Role Management Can Brick System

## Priority: HIGH

## Component: StabilizedCarbonCoin.sol Deployment

## Issue Type: Deployment Risk / Access Control

## Description

The deployment sequence for StabilizedCarbonCoin has a critical vulnerability where incorrect role management can permanently brick the entire Phase 2 system. If DEFAULT_ADMIN_ROLE is renounced before MINTER_ROLE is granted to the vault, no one can ever mint SCC tokens.

## Location

- File: `contracts/StabilizedCarbonCoin.sol`
- Constructor: Lines 63-71
- Role Management: AccessControl inheritance

## Current Code

```solidity
constructor(address vault) ERC20("Stabilized Carbon Coin", "SCC") {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    // Optionally grant MINTER_ROLE during deployment
    if (vault != address(0)) {
        _grantRole(MINTER_ROLE, vault);
    }
    // If vault is address(0), MINTER_ROLE granted explicitly after vault deployment
}
```

## Problem Scenarios

### Scenario 1: Premature Admin Renunciation

```
1. Deploy SCC with vault = address(0) (vault not yet deployed)
2. Deploy EcoStabilizer vault
3. Admin accidentally renounces DEFAULT_ADMIN_ROLE
4. Try to grant MINTER_ROLE to vault - FAILS (no admin)
5. System is permanently broken - no one can mint SCC
```

### Scenario 2: Wrong Vault Address

```
1. Deploy SCC with wrong vault address
2. Admin renounces DEFAULT_ADMIN_ROLE for "security"
3. Realize mistake - need to change minter
4. Cannot change - no admin exists
5. Must redeploy entire system
```

### Scenario 3: Vault Upgrade Path Blocked

```
1. Deploy SCC with VaultV1
2. Renounce admin role
3. Need to upgrade to VaultV2
4. Cannot grant MINTER_ROLE to new vault
5. Stuck with old vault forever
```

## Impact

- **Catastrophic**: Entire Phase 2 system becomes unusable
- **Irreversible**: No recovery without full redeployment
- **Economic**: All deployment costs wasted
- **Reputation**: Major failure if happens on mainnet

## Root Cause

- No safety checks before admin renunciation
- No multi-step or time-delayed renunciation
- No emergency recovery mechanism
- Single point of failure in access control

## Recommended Fixes

### Option 1: Deployment Script Safety Checks

```javascript
// deploy script
async function deploySCC(vaultAddress) {
    const scc = await SCC.deploy(vaultAddress);

    // Verify minter role before renouncing
    if (vaultAddress !== ethers.constants.AddressZero) {
        const hasMinterRole = await scc.hasRole(MINTER_ROLE, vaultAddress);
        if (!hasMinterRole) {
            throw new Error("Vault does not have MINTER_ROLE - aborting");
        }
    }

    // Only renounce after verification
    // Consider not renouncing at all for upgradability
}
```

### Option 2: Two-Step Admin Transfer (Contract Change)

```solidity
contract StabilizedCarbonCoin is ERC20, AccessControl {
    address public pendingAdmin;
    uint256 public adminTransferInitiated;
    uint256 constant TRANSFER_DELAY = 2 days;

    function initiateAdminTransfer(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        pendingAdmin = newAdmin;
        adminTransferInitiated = block.timestamp;
    }

    function acceptAdminTransfer() external {
        require(msg.sender == pendingAdmin, "Not pending admin");
        require(block.timestamp >= adminTransferInitiated + TRANSFER_DELAY, "Too early");

        _grantRole(DEFAULT_ADMIN_ROLE, pendingAdmin);
        _revokeRole(DEFAULT_ADMIN_ROLE, getRoleMember(DEFAULT_ADMIN_ROLE, 0));

        pendingAdmin = address(0);
    }
}
```

### Option 3: Require Minter Before Renunciation

```solidity
function renounceRole(bytes32 role, address account) public override {
    if (role == DEFAULT_ADMIN_ROLE) {
        // Ensure at least one minter exists
        require(getRoleMemberCount(MINTER_ROLE) > 0, "Cannot renounce admin without minter");
    }
    super.renounceRole(role, account);
}
```

## Deployment Best Practices

1. **Never** renounce admin immediately after deployment
2. **Always** verify role assignments before renunciation
3. **Consider** keeping admin with multisig for future upgrades
4. **Test** entire deployment sequence on testnet first
5. **Document** exact deployment steps with verification

## Testing Required

- Deployment script with role verification
- Test admin renunciation scenarios
- Verify minter role functionality
- Test recovery scenarios

## Severity Justification

CRITICAL because:

1. Can permanently brick entire Phase 2 system
2. No recovery mechanism exists
3. Easy mistake to make during deployment
4. Affects mainnet deployment directly

## References

- OpenZeppelin AccessControl: Once admin is renounced, it's permanent
- No built-in safety mechanisms in AccessControl
- Common issue in production deployments
