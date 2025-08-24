# Ticket #105: MEDIUM - Inefficient Loan Query Pattern Will Hit Gas Limits

## Priority: MEDIUM

## Component: EcoStabilizer.sol

## Issue Type: Scalability / Gas Optimization

## Description

The vault's view functions (`getUserLoans`, `getTotalActiveLoans`, `getUserLoanCount`) iterate through all token IDs to find active loans. This O(n) approach becomes increasingly expensive and will eventually hit block gas limits as more NFTs are minted.

## Location

- File: `contracts/EcoStabilizer.sol`
- Functions: `getUserLoans()` (lines 251-273), `getTotalActiveLoans()` (lines 277-287), `getUserLoanCount()` (lines 291-301)
- Related: Paginated functions (lines 391-497) have same issue

## Current Implementation

```solidity
function getUserLoans(address user) external view returns (uint256[] memory) {
    uint256 maxTokenId = ecoAsset.lastTokenID();
    uint256 scanLimit = maxTokenId > maxScanRange ? maxScanRange : maxTokenId;

    // First pass: count active loans
    uint256 count = 0;
    for (uint256 i = 1; i <= scanLimit; i++) {
        if (loans[i].active && loans[i].borrower == user) {
            count++;
        }
    }

    // Second pass: collect loan token IDs
    uint256[] memory userLoans = new uint256[](count);
    uint256 index = 0;
    for (uint256 i = 1; i <= scanLimit; i++) {
        if (loans[i].active && loans[i].borrower == user) {
            userLoans[index] = i;
            index++;
        }
    }
    return userLoans;
}
```

## Problems

### 1. Gas Cost Growth

```
Token Count | Gas Cost (estimated) | Status
1,000       | ~500k               | OK
10,000      | ~5M                 | Warning
50,000      | ~25M                | Over block limit
100,000     | ~50M                | Impossible
```

### 2. Incomplete Results

- `maxScanRange` limits iterations but may miss loans
- Users with loans beyond `maxScanRange` won't see them
- No indication that results are incomplete

### 3. Two-Pass Inefficiency

- Each function iterates twice through same data
- Doubles the gas cost unnecessarily
- Memory allocation based on first pass

### 4. Frontend Impact

- Dapps calling these functions will fail as data grows
- Pagination doesn't solve the core issue
- Users can't reliably query their positions

## Impact

- **Immediate**: High gas costs for view functions
- **Near-term**: Functions become unusable around 10k tokens
- **Long-term**: Complete failure of loan discovery
- **UX**: Users can't see their loans, breaking frontend

## Root Cause

Using token ID iteration instead of maintaining indexed data structures for active loans.

## Recommended Fixes

### Option 1: Maintain Active Loan Indices (Best)

```solidity
// Add to state variables
mapping(address => uint256[]) private userLoanIds;
mapping(address => mapping(uint256 => uint256)) private userLoanIndex;
uint256[] private allActiveLoanIds;
mapping(uint256 => uint256) private activeLoanIndex;

function deposit(uint256 tokenId) external nonReentrant whenNotPaused {
    // ... existing checks ...

    // Update indices
    userLoanIds[msg.sender].push(tokenId);
    userLoanIndex[msg.sender][tokenId] = userLoanIds[msg.sender].length - 1;

    allActiveLoanIds.push(tokenId);
    activeLoanIndex[tokenId] = allActiveLoanIds.length - 1;

    // ... rest of function
}

function getUserLoans(address user) external view returns (uint256[] memory) {
    return userLoanIds[user]; // O(1) operation!
}
```

### Option 2: EnumerableSet from OpenZeppelin

```solidity
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

using EnumerableSet for EnumerableSet.UintSet;

mapping(address => EnumerableSet.UintSet) private userLoanSets;
EnumerableSet.UintSet private allActiveLoans;

function getUserLoans(address user) external view returns (uint256[] memory) {
    return userLoanSets[user].values();
}
```

### Option 3: Event-Based Indexing (Off-chain)

```solidity
// Emit comprehensive events
event LoanCreated(address indexed user, uint256 indexed tokenId, uint256 timestamp);
event LoanClosed(address indexed user, uint256 indexed tokenId, uint256 timestamp);

// Remove view functions, rely on event logs
// Frontend uses events + graph protocol for indexing
```

### Option 4: Linked List Pattern

```solidity
struct Loan {
    address borrower;
    bool active;
    uint256 nextUserLoan;  // Next loan ID for this user
    uint256 prevUserLoan;  // Previous loan ID for this user
}

mapping(address => uint256) private userFirstLoan;
mapping(address => uint256) private userLastLoan;
mapping(address => uint256) private userLoanCounts;
```

## Migration Considerations

- Existing loans need migration if using Option 1 or 2
- Gas cost for migration could be significant
- Consider deploying new vault version

## Testing Required

- Gas profiling at different token scales
- Accuracy of indexed data structures
- Edge cases: deposit/withdraw/re-deposit same token
- Concurrent operations on same user

## Severity Justification

MEDIUM because:

1. Will definitely fail at scale
2. Breaks core functionality (loan discovery)
3. No immediate impact but inevitable problem
4. Affects user experience significantly

## References

- Current `maxScanRange`: 10,000 (line 89)
- Similar issue in many NFT contracts
- OpenZeppelin EnumerableSet as proven solution
