# Ticket: Migrate to SafeERC20 for All Token Transfers

- Component: `contracts/AstaVerde.sol`
- Severity: Medium
- Type: Security Enhancement

## Background / Justification

The contract uses direct `transfer` and `transferFrom` calls with `require` statements. Some ERC20 tokens don't return boolean values (USDT), or return false instead of reverting. SafeERC20 handles these cases properly. While we currently target USDC (standards-compliant, 6 decimals), using SafeERC20 is still best practice.

Current pattern:

```solidity
require(usdcToken.transfer(to, amount), "Transfer failed");
```

This will fail with non-standard tokens that don't return a boolean.

## Impact

- Contract may not work with certain ERC20 tokens
- USDT and other non-standard tokens incompatible
- Potential for silent failures with malicious tokens
- Limits token integration options

## Tasks

1. Import SafeERC20 from OpenZeppelin:
    ```solidity
    import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
    ```
2. Add using statement:
    ```solidity
    using SafeERC20 for IERC20;
    ```
3. Replace all token operations:

    ```solidity
    // Before:
    require(usdcToken.transferFrom(msg.sender, address(this), totalCost), "Transfer failed");
    require(usdcToken.transfer(recipient, amount), "Transfer failed");

    // After:
    usdcToken.safeTransferFrom(msg.sender, address(this), totalCost);
    usdcToken.safeTransfer(recipient, amount);
    ```

4. Remove explicit `require` checks for ERC20 transfers (SafeERC20 reverts on failure).
5. Update tests that asserted specific revert messages.
6. If we keep refund logic (alternative in separate ticket), ensure we pull funds before refunding using SafeERC20.

## Acceptance Criteria

- All token transfers use SafeERC20.
- No direct `transfer`/`transferFrom` calls remain.
- Tests updated for SafeERC20 revert behavior.
- Contract interoperates with non-standard tokens in mocks.
  usdcToken.safeTransfer(recipient, amount);

    ```

    ```

4. Remove require statements (SafeERC20 handles reversions)
5. Update error messages if needed

## Locations to Update (current `AstaVerde.sol`)

- ~267: `transferFrom` in `buyBatch`
- ~270: `transfer` for refund
- ~275: `transfer` for producer payments
- ~381: `transfer` in `claimPlatformFunds`

## Acceptance Criteria

- All token transfers use SafeERC20
- No direct transfer/transferFrom calls remain
- Tests pass with SafeERC20
- Contract works with non-standard tokens (test with mock)

## Affected Files

- `contracts/AstaVerde.sol`
- May need to update tests if they check specific revert messages

## Test Plan

- Test with standard ERC20 (MockUSDC)
- Test with non-returning token mock
- Test with token that returns false
- Verify all transfer paths work correctly
