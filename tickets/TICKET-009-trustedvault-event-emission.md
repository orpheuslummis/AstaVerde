# TICKET-009: Add Event Emission for TrustedVault Changes

**Priority**: LOW  
**Type**: Enhancement  
**Status**: Open  
**Component**: AstaVerde.sol  
**Security Impact**: Low - Improves transparency and auditability  

## Summary
The `setTrustedVault` function doesn't emit an event when the trusted vault address is changed. Adding an event would improve transparency and allow off-chain monitoring of this critical configuration change.

## Current Issue
```solidity
function setTrustedVault(address _vault) external onlyOwner {
    require(_vault != address(0), "Invalid vault address");
    trustedVault = _vault;
    // No event emitted
}
```

## Proposed Solution
Add an event and emit it when the trusted vault is set or changed.

### Implementation

```solidity
contract AstaVerde {
    // Add new event
    event TrustedVaultSet(address indexed previousVault, address indexed newVault);
    
    // Update function
    function setTrustedVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Invalid vault address");
        address previousVault = trustedVault;
        trustedVault = _vault;
        emit TrustedVaultSet(previousVault, _vault);
    }
}
```

### Alternative: Include timestamp
```solidity
event TrustedVaultSet(
    address indexed previousVault, 
    address indexed newVault,
    uint256 timestamp
);

emit TrustedVaultSet(previousVault, _vault, block.timestamp);
```

## Benefits
- Provides audit trail for vault changes
- Enables off-chain monitoring and alerts
- Improves protocol transparency
- Helps debug integration issues
- Standard best practice for configuration changes

## Testing Requirements
- [ ] Test event emission on vault set
- [ ] Test event emission on vault change
- [ ] Verify event parameters are correct
- [ ] Test integration with monitoring tools

## Acceptance Criteria
- [ ] Event defined with proper indexing
- [ ] Event emitted in setTrustedVault
- [ ] Previous and new vault addresses included
- [ ] Tests verify event emission
- [ ] Documentation updated