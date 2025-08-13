# Ticket: Set Reasonable Maximum Platform Share Percentage

- Component: `contracts/AstaVerde.sol`
- Severity: Medium
- Type: Business Logic Protection

## Background / Justification

`setPlatformSharePercentage` only requires `< 100`, allowing up to 99% platform share. This means producers could receive only 1% of sales revenue, which:

- Destroys economic incentives for producers
- Could be seen as exploitative
- May be set accidentally (typo: 80 instead of 8)
- Reduces trust in the platform

Current check (line 133): `require(newSharePercentage < 100, "Share must be between 0 and 99")`

## Impact

- Producers could receive only 1% of sales
- Accidental misconfiguration could drain producer revenues
- Loss of producer trust and participation
- Potential legal/reputational issues

## Tasks

1. Add reasonable maximum cap in `setPlatformSharePercentage`:
    ```solidity
    function setPlatformSharePercentage(uint256 newSharePercentage) external onlyOwner {
        require(newSharePercentage <= 50, "Platform share cannot exceed 50%");
        platformSharePercentage = newSharePercentage;
        emit PlatformSharePercentageSet(newSharePercentage);
    }
    ```
2. Document the rationale for the 50% cap (or choose different reasonable max like 40%)
3. Update tests to verify the new maximum
4. Consider adding a timelock for platform share increases (optional, more complex)

## Alternative Approach

- Implement a two-step change with timelock
- Require multiple signatures for increases above certain threshold
- Add producer voting mechanism for share changes

## Acceptance Criteria

- Platform share cannot be set above 50% (or chosen maximum)
- Existing functionality with reasonable percentages unchanged
- Tests verify both valid and invalid percentage values
- Clear error message when exceeding maximum

## Affected Files

- `contracts/AstaVerde.sol`
- `test/AstaVerde.logic.behavior.ts`
- Documentation/README to explain the cap

## Test Plan

- Test setting platform share to 51% (should revert)
- Test setting platform share to 50% (should succeed)
- Test setting platform share to 0% (should succeed)
- Test setting platform share to 30% (should succeed)
