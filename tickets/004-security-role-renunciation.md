# Security: SCC Admin Role Renunciation

**Priority**: HIGH  
**Type**: Security Enhancement  
**Status**: Open  
**Component**: StabilizedCarbonCoin.sol, Deployment Scripts  
**Security Impact**: High - Prevents unauthorized minting  

## Summary
The DEFAULT_ADMIN_ROLE in StabilizedCarbonCoin is not renounced after deployment, allowing the admin to grant MINTER_ROLE to any address at any time. This creates a trust assumption and potential security risk.

## Current Issue
```solidity
constructor(address vault) ERC20("Stabilized Carbon Coin", "SCC") {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    if (vault != address(0)) {
        _grantRole(MINTER_ROLE, vault);
    }
}
```
Admin retains ability to:
- Grant MINTER_ROLE to any address
- Revoke MINTER_ROLE from vault
- Create unlimited SCC supply through new minters

## Proposed Solutions

### Option 1: Immediate Renunciation (Recommended)
Renounce admin role immediately after deployment:

```solidity
// In deployment script
async function deploySCC() {
    // Deploy SCC
    const scc = await SCC.deploy(vaultAddress);
    
    // Verify vault has MINTER_ROLE
    assert(await scc.hasRole(MINTER_ROLE, vaultAddress));
    
    // Renounce admin role
    await scc.renounceRole(DEFAULT_ADMIN_ROLE, deployer);
    
    // Verify admin role is renounced
    assert(!await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer));
}
```

### Option 2: Transfer to Timelock
Transfer admin role to timelock for future governance:

```solidity
// After timelock deployment
await scc.grantRole(DEFAULT_ADMIN_ROLE, timelockAddress);
await scc.renounceRole(DEFAULT_ADMIN_ROLE, deployer);
```

### Option 3: Multi-sig Control
Transfer to multi-sig for emergency response:

```solidity
await scc.grantRole(DEFAULT_ADMIN_ROLE, multiSigAddress);
await scc.renounceRole(DEFAULT_ADMIN_ROLE, deployer);
```

## Deployment Checklist
```javascript
// deploy/deploy_ecostabilizer.ts additions
console.log("=== CRITICAL: SCC Role Management ===");
console.log("[ ] SCC deployed");
console.log("[ ] Vault has MINTER_ROLE");
console.log("[ ] No other addresses have MINTER_ROLE");
console.log("[ ] DEFAULT_ADMIN_ROLE renounced/transferred");
console.log("[ ] Verify only vault can mint SCC");
```

## Benefits
- Eliminates trust assumptions
- Prevents unauthorized minting
- Ensures only vault controls SCC supply
- Improves protocol decentralization

## Risks of Current State
- Admin key compromise = unlimited SCC minting
- Requires trust in admin not to mint
- Centralization concerns for users/auditors

## Testing Requirements
- [ ] Test deployment with immediate renunciation
- [ ] Verify vault can still mint after renunciation
- [ ] Verify no one can grant new MINTER_ROLE
- [ ] Test all three implementation options

## Acceptance Criteria
- [ ] Deployment script updated with role management
- [ ] Admin role properly handled (renounced/transferred)
- [ ] Only vault can mint SCC
- [ ] No way to add new minters
- [ ] Documentation updated with security model