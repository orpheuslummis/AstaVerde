# EcoStabilizer View Function DoS Analysis

## 🔍 Current Implementation Analysis

### The Problem

The EcoStabilizer contract has three view functions that scan through token IDs to find active loans:
1. `getUserLoans(address user)` - Returns array of user's active loan token IDs
2. `getTotalActiveLoans()` - Returns count of all active loans
3. `getUserLoanCount(address user)` - Returns count of user's active loans

**Current Scanning Behavior:**
- Iterates from tokenId 1 to min(lastTokenID, maxScanRange)
- Default maxScanRange = 10,000
- Each function makes 2 passes for getUserLoans (count then collect)
- No upper bound on maxScanRange setting

### DoS Vectors

1. **Natural Growth DoS**
   - As lastTokenID grows past 10,000, newer loans become invisible
   - Frontend/indexers may miss active loans beyond scan range

2. **Misconfiguration DoS**
   - Admin could accidentally set maxScanRange to millions
   - Would cause RPC timeouts and node overload

3. **Performance Degradation**
   - Even at 10,000 iterations, view calls become slow
   - getUserLoans does 20,000 iterations (2 passes)
   - Multiple users querying simultaneously stress nodes

## 📊 Impact Assessment

### Severity: MEDIUM-HIGH

**Why not Critical?**
- Doesn't affect core deposit/withdraw functionality
- No fund loss risk
- View functions only (no gas costs)

**Why Medium-High?**
- Can break frontend dashboards
- Affects monitoring and indexers
- Poor UX as protocol scales
- Could hide loans from users

### Timeline to Impact

With typical usage (10-20 batches/day creating ~500 tokens/day):
- **20 days**: Hit 10,000 token limit, newer loans become invisible
- **60 days**: 30,000 tokens, significant loans hidden
- **6 months**: 90,000 tokens, most loans invisible

## 💡 Proposed Solution

### 1. Cap maxScanRange (Quick Fix)
```solidity
function setMaxScanRange(uint256 _maxScanRange) external onlyOwner {
    require(_maxScanRange > 0 && _maxScanRange <= 50000, "range invalid");
    uint256 oldValue = maxScanRange;
    maxScanRange = _maxScanRange;
    emit MaxScanRangeUpdated(oldValue, _maxScanRange);
}
```

### 2. Add Paginated Functions (Proper Fix)
```solidity
function getUserLoansPaginated(
    address user, 
    uint256 startId, 
    uint256 limit
) external view returns (uint256[] memory tokenIds, uint256 nextStartId) {
    require(limit > 0 && limit <= 2000, "invalid limit");
    
    uint256 maxTokenId = ecoAsset.lastTokenID();
    uint256 endId = startId + limit > maxTokenId ? maxTokenId : startId + limit;
    
    // Count matching loans in range
    uint256 count = 0;
    for (uint256 i = startId; i <= endId; i++) {
        if (loans[i].active && loans[i].borrower == user) {
            count++;
        }
    }
    
    // Collect matching loans
    tokenIds = new uint256[](count);
    uint256 index = 0;
    for (uint256 i = startId; i <= endId; i++) {
        if (loans[i].active && loans[i].borrower == user) {
            tokenIds[index++] = i;
        }
    }
    
    // Return next start position for pagination
    nextStartId = endId < maxTokenId ? endId + 1 : 0;
}
```

### 3. Alternative: Linked List Approach (Most Efficient)

Instead of scanning, maintain a linked list of active loans per user:
```solidity
mapping(address => uint256[]) userActiveLoans;
```

**Pros:**
- O(1) retrieval
- No scanning needed
- Scales infinitely

**Cons:**
- Requires migration
- More complex state management
- Higher gas for deposits/withdrawals

## 🎯 Recommended Approach

### Phase 1: Immediate (1 hour)
1. Add upper bound check to setMaxScanRange (cap at 50,000)
2. Add paginated view functions
3. Keep existing functions for backward compatibility

### Phase 2: Later (Optional)
- Consider linked list approach if usage grows significantly
- Add indexing events for off-chain tracking

## 📝 Implementation Checklist

- [ ] Add MAX_SCAN_CEILING constant (50,000)
- [ ] Update setMaxScanRange with upper bound check
- [ ] Implement getUserLoansPaginated
- [ ] Implement getTotalActiveLoansPaginated
- [ ] Add tests for pagination edge cases
- [ ] Add tests for maxScanRange bounds
- [ ] Update frontend to use paginated functions
- [ ] Document migration path for integrators

## 🔄 Backward Compatibility

- Existing view functions remain unchanged
- Paginated functions are additions, not replacements
- Frontend can migrate gradually
- No breaking changes to core functionality

## ⚡ Gas Estimates

Current (10,000 iterations): ~2-3M gas simulation
Paginated (2,000 limit): ~400-600K gas simulation
Linked list approach: ~50K gas simulation

## 🚀 Next Steps

1. Implement the quick fix (maxScanRange cap) - 15 minutes
2. Add paginated functions - 45 minutes
3. Write comprehensive tests - 30 minutes
4. Update documentation - 15 minutes

Total effort: ~1.5-2 hours