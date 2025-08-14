# Security: Batch Purchase Cooldown

**Priority**: MEDIUM  
**Type**: Security Enhancement  
**Status**: Open  
**Component**: AstaVerde.sol  
**Security Impact**: Medium - Prevents price manipulation

## Summary

A malicious actor could manipulate the base price by rapidly purchasing multiple batches to trigger price increases. Adding a cooldown period between purchases would prevent this manipulation.

## Current Issue

The `updateBasePrice()` function increases base price by 10 USDC for each batch sold within 2 days:

```solidity
if (saleDurationInDays < dayIncreaseThreshold) {
    quickSaleCount++;
}
// No restriction on same buyer triggering multiple increases
```

Attack scenario:

1. Attacker buys 5 small batches quickly
2. Base price increases by 50 USDC
3. Legitimate users pay inflated prices
4. Attacker may profit from arbitrage

## Proposed Solution

Implement a per-address cooldown period between batch purchases.

### Implementation

```solidity
contract AstaVerde {
    // New state variable
    mapping(address => uint256) public lastPurchaseTime;
    uint256 public constant PURCHASE_COOLDOWN = 1 hours;

    function buyBatch(
        uint256 batchID,
        uint256 usdcAmount,
        uint256 tokenAmount
    ) external whenNotPaused nonReentrant {
        // Cooldown check
        require(
            block.timestamp >= lastPurchaseTime[msg.sender] + PURCHASE_COOLDOWN,
            "Purchase cooldown active"
        );

        // ... existing validation ...

        // Update last purchase time
        lastPurchaseTime[msg.sender] = block.timestamp;

        // ... rest of function ...
    }

    // Optional: Allow owner to adjust cooldown
    function setPurchaseCooldown(uint256 newCooldown) external onlyOwner {
        require(newCooldown <= 24 hours, "Cooldown too long");
        PURCHASE_COOLDOWN = newCooldown;
        emit PurchaseCooldownUpdated(newCooldown);
    }
}
```

### Alternative: Limit Quick Sales Per Address

```solidity
mapping(address => uint256) public recentQuickSales;
mapping(address => uint256) public quickSaleResetTime;
uint256 public constant MAX_QUICK_SALES_PER_ADDRESS = 2;
uint256 public constant QUICK_SALE_WINDOW = 7 days;

function buyBatch(...) external {
    // Reset counter if window expired
    if (block.timestamp > quickSaleResetTime[msg.sender]) {
        recentQuickSales[msg.sender] = 0;
        quickSaleResetTime[msg.sender] = block.timestamp + QUICK_SALE_WINDOW;
    }

    // Check if this would be a quick sale
    uint256 saleDuration = block.timestamp - batch.creationTime;
    if (saleDuration < dayIncreaseThreshold * SECONDS_IN_A_DAY) {
        require(
            recentQuickSales[msg.sender] < MAX_QUICK_SALES_PER_ADDRESS,
            "Too many quick sales"
        );
        recentQuickSales[msg.sender]++;
    }

    // ... rest of function ...
}
```

## Benefits

- Prevents single actor from manipulating prices
- Maintains organic price discovery
- Reduces MEV opportunities
- Protects legitimate users

## Drawbacks

- May slow down legitimate bulk purchases
- Adds complexity to buyer experience
- Could be circumvented with multiple addresses

## Mitigation for Multiple Addresses

Consider additional measures:

- Require minimum USDC balance
- KYC for large purchases
- Gradual price increases instead of immediate

## Testing Requirements

- [ ] Test cooldown enforcement
- [ ] Test with multiple addresses
- [ ] Test cooldown reset
- [ ] Test interaction with price updates
- [ ] Gas cost impact

## Acceptance Criteria

- [ ] Cooldown mechanism implemented
- [ ] Cannot bypass with same address
- [ ] Clear error messages
- [ ] Events for monitoring
- [ ] Documentation updated
