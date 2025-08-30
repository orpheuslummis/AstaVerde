# Ticket: Prevent Accidental MockUSDC Deployment to Production

- Component: Deployment Scripts / `contracts/MockUSDC.sol`
- Severity: Critical
- Type: Deployment Safety

## Background / Justification

MockUSDC has a public `mint` function that allows anyone to create unlimited tokens:

```solidity
function mint(address to, uint256 amount) public {
    _mint(to, amount);
}
```

If accidentally deployed to production instead of real USDC, this would:

- Allow unlimited money printing
- Completely break the economic model
- Enable massive theft/exploitation
- Destroy platform credibility

## Impact

- Total platform compromise if deployed to mainnet
- Anyone could mint billions in fake USDC
- All revenue and escrow could be stolen
- Irreversible reputation damage

## Tasks

1. Add explicit production safety check to MockUSDC:
    ```solidity
    constructor(uint256 initialSupply) ERC20("USDC", "USDC") {
        require(
            block.chainid == 31337 || // Hardhat
            block.chainid == 84532 || // Base Sepolia
            block.chainid == 11155111, // Sepolia
            "MockUSDC: Production deployment forbidden"
        );
    }
    ```
2. Rename contract to make purpose clear:
    - Change `MockUSDC.sol` to `TestOnlyMockUSDC.sol`
    - Add warning comment at top of file
3. Update deployment scripts with safety checks:
    ```javascript
    if (network.name === "mainnet" || network.name === "base") {
        if (usdcAddress.toLowerCase().includes("mock")) {
            throw new Error("FATAL: Attempting to use Mock USDC on mainnet!");
        }
    }
    ```
4. Add `.sol` linting rule to flag mock contracts
5. Create separate `contracts/test/` folder for test-only contracts

## Acceptance Criteria

- MockUSDC cannot be deployed to mainnet (reverts)
- Deployment scripts verify USDC address isn't mock
- Clear warnings in code about test-only nature
- Tests still work on test networks

## Affected Files

- `contracts/MockUSDC.sol` → `contracts/test/TestOnlyMockUSDC.sol`
- `deploy/deploy.ts`
- `hardhat.config.ts`
- All test files importing MockUSDC

## Test Plan

- Try deploying MockUSDC to mainnet fork (should revert)
- Verify deployment works on test networks
- Check deployment scripts catch mock addresses
- Ensure tests still function properly
