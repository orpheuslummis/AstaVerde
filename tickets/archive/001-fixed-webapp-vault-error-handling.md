# Webapp Vault Error Handling

**Priority**: HIGH  
**Type**: Enhancement  
**Component**: Webapp Frontend  
**Status**: Open

---

## Problem Statement

The VaultCard component lacks comprehensive error handling, leading to poor user experience when operations fail. Users don't receive clear feedback about what went wrong or how to resolve issues.

## Current Issues

### 1. Missing Error States

The component only shows generic error messages via toast:

```typescript
// webapp/src/components/VaultCard.tsx:141
customToast.error(error?.message || "Failed to deposit NFT");
```

### 2. Unhandled Scenarios

- Network disconnection during operation
- Insufficient gas errors
- Contract paused state
- Transaction rejection by wallet
- RPC timeout/rate limiting
- Invalid token state changes

### 3. Current Implementation Gaps

```typescript
// No retry mechanism
// No detailed error parsing
// No user guidance on resolution
// No loading states for specific operations
```

## User Impact

1. **Confusion:** Users don't understand why transactions fail
2. **Abandonment:** Users leave without completing vault operations
3. **Support Burden:** Increased support tickets for common issues
4. **Trust:** Reduced confidence in platform reliability

## Proposed Solution

### 1. Enhanced Error State Component

```typescript
interface VaultErrorState {
  type: 'network' | 'insufficient-funds' | 'approval' | 'contract' | 'unknown';
  message: string;
  action?: {
    label: string;
    handler: () => void;
  };
  details?: string;
}

function VaultErrorDisplay({ error }: { error: VaultErrorState }) {
  return (
    <div className="p-4 border border-red-500 rounded-lg bg-red-50">
      <h4 className="font-semibold text-red-800">{error.message}</h4>
      {error.details && (
        <p className="text-sm text-red-600 mt-2">{error.details}</p>
      )}
      {error.action && (
        <button
          onClick={error.action.handler}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded"
        >
          {error.action.label}
        </button>
      )}
    </div>
  );
}
```

### 2. Error Classification & Handling

```typescript
function parseVaultError(error: any): VaultErrorState {
    // Insufficient SCC balance
    if (error.message?.includes("burn amount exceeds balance")) {
        return {
            type: "insufficient-funds",
            message: "Insufficient SCC Balance",
            details: "You need 20 SCC to withdraw this NFT. You can get SCC by depositing other NFTs.",
            action: {
                label: "View Other NFTs",
                handler: () => router.push("/mytokens"),
            },
        };
    }

    // Not approved
    if (error.message?.includes("ERC20: insufficient allowance")) {
        return {
            type: "approval",
            message: "Approval Required",
            details: "Please approve the vault to spend your SCC tokens.",
            action: {
                label: "Approve SCC",
                handler: async () => await approveSCC(),
            },
        };
    }

    // Contract paused
    if (error.message?.includes("Pausable: paused")) {
        return {
            type: "contract",
            message: "Vault Temporarily Unavailable",
            details: "The vault is currently paused for maintenance. Please try again later.",
        };
    }

    // Network issues
    if (error.code === "NETWORK_ERROR" || error.message?.includes("timeout")) {
        return {
            type: "network",
            message: "Network Connection Issue",
            details: "Please check your connection and try again.",
            action: {
                label: "Retry",
                handler: () => window.location.reload(),
            },
        };
    }

    // Default
    return {
        type: "unknown",
        message: "Transaction Failed",
        details: error.message || "An unexpected error occurred. Please try again.",
    };
}
```

### 3. Loading States Enhancement

```typescript
interface VaultLoadingState {
  isApproving: boolean;
  isDepositing: boolean;
  isWithdrawing: boolean;
  isFetchingLoan: boolean;
  isFetchingBalance: boolean;
}

// Granular loading indicators
{isApproving && <LoadingSpinner text="Approving SCC..." />}
{isDepositing && <LoadingSpinner text="Depositing NFT to vault..." />}
{isWithdrawing && <LoadingSpinner text="Withdrawing NFT from vault..." />}
```

### 4. Transaction Status Tracking

```typescript
enum TxStatus {
    IDLE = "idle",
    SIGNING = "signing",
    PENDING = "pending",
    CONFIRMING = "confirming",
    SUCCESS = "success",
    ERROR = "error",
}

function useTransactionStatus() {
    const [status, setStatus] = useState<TxStatus>(TxStatus.IDLE);
    const [txHash, setTxHash] = useState<string>();

    return {
        status,
        txHash,
        explorerUrl: txHash ? `${EXPLORER_URL}/tx/${txHash}` : undefined,
        isProcessing: [TxStatus.SIGNING, TxStatus.PENDING, TxStatus.CONFIRMING].includes(status),
    };
}
```

## Implementation Checklist

- [ ] Add VaultErrorDisplay component
- [ ] Implement parseVaultError function
- [ ] Add granular loading states
- [ ] Implement transaction status tracking
- [ ] Add retry mechanisms for recoverable errors
- [ ] Add user guidance tooltips
- [ ] Test all error scenarios
- [ ] Add error boundary for component crashes
- [ ] Log errors to monitoring service

## Testing Scenarios

1. **Insufficient SCC:** Try to withdraw without 20 SCC
2. **No Approval:** Try operations without token approvals
3. **Network Issues:** Disconnect network during operation
4. **Gas Issues:** Set very low gas limit
5. **Contract Paused:** Test with paused contract
6. **Concurrent Operations:** Multiple tabs/operations
7. **Token State Change:** Token gets redeemed during operation

## Success Metrics

- Error message clarity score > 90%
- Support ticket reduction by 50%
- Transaction success rate > 95%
- User retry success rate > 80%

## Files to Modify

- webapp/src/components/VaultCard.tsx
- webapp/src/hooks/useVault.ts
- webapp/src/utils/errors.ts (new)
- webapp/src/components/ErrorDisplay.tsx (new)

## References

- Current implementation: webapp/src/components/VaultCard.tsx
- Hook implementation: webapp/src/hooks/useVault.ts
- Toast utility: webapp/src/utils/customToast.ts

## Notes

This is a high-priority UX issue that significantly impacts user adoption of Phase 2 vault features. Should be addressed before production launch to ensure smooth user experience.
