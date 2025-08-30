# Fix SCC Role Governance Hardening

## Priority: CRITICAL (Operational/Trust)

## Issue

StabilizedCarbonCoin.sol maintains DEFAULT_ADMIN_ROLE with the deployer, allowing arbitrary MINTER_ROLE grants. This creates a centralization risk where a compromised admin key could enable unlimited SCC minting.

## Location

- Contract: `StabilizedCarbonCoin.sol`
- Constructor: lines 13-21
- Risk: Admin can grant MINTER_ROLE to any address post-deployment

## Vulnerability Details

```solidity
constructor(address vault) ERC20("Stabilized Carbon Coin", "SCC") {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);  // Deployer gets admin
    if (vault != address(0)) {
        _grantRole(MINTER_ROLE, vault);
    }
}
```

The deployer retains DEFAULT_ADMIN_ROLE indefinitely, allowing:

1. Granting MINTER_ROLE to arbitrary addresses
2. Revoking MINTER_ROLE from the vault
3. Undermining the 1:1 collateralization model

## Impact

- **Severity**: Critical (Trust/Governance)
- **Risk**: Unlimited SCC minting if admin key compromised
- **Trust Model**: Breaks decentralization promises
- **Economic Impact**: Complete protocol insolvency possible

## Recommended Fix

### 1. Deployment Script Update

```javascript
// deploy/deploy_ecostabilizer.ts
async function main() {
    // ... existing deployment ...

    // After vault deployment and MINTER_ROLE grant
    const MINTER_ROLE = await scc.MINTER_ROLE();
    const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();

    // Verify vault has MINTER_ROLE
    assert(await scc.hasRole(MINTER_ROLE, vault.address));

    // Transfer admin to multisig or renounce
    if (network.name === "mainnet") {
        const multisig = process.env.MULTISIG_ADDRESS;
        await scc.grantRole(DEFAULT_ADMIN_ROLE, multisig);
        await scc.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    } else if (network.name === "testnet") {
        // Keep admin for testnet flexibility
    } else {
        // Local: optionally renounce for testing
        await scc.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    }

    // Verify final state
    console.log("Admin renounced:", !(await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)));
    console.log("Vault is sole minter:", await scc.hasRole(MINTER_ROLE, vault.address));
}
```

### 2. Add Deployment Guards

```solidity
// Optional: Add to StabilizedCarbonCoin.sol
uint256 public constant MAX_MINTERS = 1;
mapping(address => bool) public mintersEverGranted;

function grantRole(bytes32 role, address account) public override {
    if (role == MINTER_ROLE) {
        require(!mintersEverGranted[account], "Minter already granted once");
        mintersEverGranted[account] = true;

        // Count current minters
        uint256 minterCount = 0;
        // Would need to track this properly
        require(minterCount < MAX_MINTERS, "Max minters reached");
    }
    super.grantRole(role, account);
}
```

### 3. Testing Requirements

```javascript
// test/SecurityDeployment.ts
it("Should renounce admin after deployment", async function () {
    // Deploy contracts
    await deployFixture();

    // Check vault has MINTER_ROLE
    expect(await scc.hasRole(MINTER_ROLE, vault.address)).to.be.true;

    // Renounce admin
    await scc.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);

    // Verify admin cannot grant new roles
    await expect(scc.grantRole(MINTER_ROLE, attacker.address)).to.be.revertedWith("AccessControl");

    // Verify vault can still mint
    await vault.deposit(tokenId, user.address);
    expect(await scc.balanceOf(user.address)).to.equal(SCC_PER_ASSET);
});
```

## Acceptance Criteria

- [ ] Deployment script transfers or renounces admin role
- [ ] Vault confirmed as sole MINTER_ROLE holder
- [ ] Tests verify admin cannot grant roles post-deployment
- [ ] Multisig setup documented for mainnet
- [ ] Emergency procedures documented if multisig needed
- [ ] Deployment dry-run on testnet confirms role setup

## References

- Similar issue: Compound COMP token admin key risk
- Best practice: Minimal admin privileges, time-locked governance
- OpenZeppelin AccessControl documentation

## Notes

This is an operational/trust issue rather than a code bug. Critical for mainnet deployment credibility. Consider using a timelock contract for any retained admin functions.
