import { customToast } from "./customToast";

export type VaultErrorType =
    | "network"
    | "insufficient-funds"
    | "approval"
    | "contract"
    | "user-rejected"
    | "gas"
    | "unknown";

export interface VaultErrorState {
    type: VaultErrorType;
    message: string;
    action?: {
        label: string;
        handler: () => void | Promise<void>;
    };
    details?: string;
    originalError?: any;
}

export enum TxStatus {
    IDLE = "idle",
    SIGNING = "signing",
    PENDING = "pending",
    CONFIRMING = "confirming",
    SUCCESS = "success",
    ERROR = "error",
}

export interface TransactionState {
    status: TxStatus;
    txHash?: string;
    error?: VaultErrorState;
}

/**
 * Parse vault-specific errors and provide user-friendly messages with actions
 */
export function parseVaultError(
    error: any,
    context?: {
        operation?: "deposit" | "withdraw" | "approve";
        approveSCC?: () => Promise<void>;
        approveNFT?: () => Promise<void>;
        retry?: () => void;
    },
): VaultErrorState {
    const errorMessage = error?.message || error?.reason || String(error);
    const errorString = errorMessage.toLowerCase();

    // User rejected transaction
    if (
        errorString.includes("user rejected") ||
        errorString.includes("user denied") ||
        errorString.includes("rejected the request")
    ) {
        return {
            type: "user-rejected",
            message: "Transaction Cancelled",
            details: "You rejected the transaction in your wallet.",
            originalError: error,
        };
    }

    // Insufficient SCC balance for withdrawal
    if (
        errorString.includes("burn amount exceeds balance") ||
        errorString.includes("erc20: burn amount exceeds balance")
    ) {
        return {
            type: "insufficient-funds",
            message: "Insufficient SCC Balance",
            details: "You need 20 SCC to withdraw this NFT. You can get SCC by depositing other NFTs into the vault.",
            action: context?.retry
                ? {
                      label: "Try Again",
                      handler: context.retry,
                  }
                : undefined,
            originalError: error,
        };
    }

    // Insufficient gas
    if (errorString.includes("insufficient funds for gas") || errorString.includes("insufficient balance")) {
        return {
            type: "gas",
            message: "Insufficient Gas",
            details: "You don't have enough ETH to pay for transaction fees. Please add ETH to your wallet.",
            originalError: error,
        };
    }

    // SCC approval needed
    if (errorString.includes("erc20: insufficient allowance") || errorString.includes("insufficient allowance")) {
        return {
            type: "approval",
            message: "Approval Required",
            details: "Please approve the vault to spend your SCC tokens first.",
            action: context?.approveSCC
                ? {
                      label: "Approve SCC",
                      handler: async () => {
                          try {
                              await context.approveSCC?.();
                              customToast.success("Approval initiated. Please confirm in your wallet.");
                          } catch (err) {
                              customToast.error("Failed to initiate approval");
                          }
                      },
                  }
                : undefined,
            originalError: error,
        };
    }

    // NFT approval needed
    if (
        errorString.includes("erc1155: caller is not token owner or approved") ||
        errorString.includes("not approved")
    ) {
        return {
            type: "approval",
            message: "NFT Approval Required",
            details: "Please approve the vault to transfer your NFTs first.",
            action: context?.approveNFT
                ? {
                      label: "Approve NFTs",
                      handler: async () => {
                          try {
                              await context.approveNFT?.();
                              customToast.success("Approval initiated. Please confirm in your wallet.");
                          } catch (err) {
                              customToast.error("Failed to initiate approval");
                          }
                      },
                  }
                : undefined,
            originalError: error,
        };
    }

    // Contract paused
    if (errorString.includes("pausable: paused")) {
        return {
            type: "contract",
            message: "Vault Temporarily Unavailable",
            details: "The vault is currently paused for maintenance. Please try again later.",
            originalError: error,
        };
    }

    // Loan already active
    if (errorString.includes("loan active")) {
        return {
            type: "contract",
            message: "NFT Already in Vault",
            details: "This NFT is already deposited in the vault. Each NFT can only have one active loan.",
            originalError: error,
        };
    }

    // Not the borrower
    if (errorString.includes("not borrower")) {
        return {
            type: "contract",
            message: "Not Your Loan",
            details: "Only the original depositor can withdraw this NFT from the vault.",
            originalError: error,
        };
    }

    // Redeemed asset
    if (errorString.includes("redeemed asset")) {
        return {
            type: "contract",
            message: "NFT Already Redeemed",
            details: "This NFT has been redeemed and cannot be deposited to the vault.",
            originalError: error,
        };
    }

    // Not token owner
    if (errorString.includes("not token owner")) {
        return {
            type: "contract",
            message: "Not NFT Owner",
            details: "You must own this NFT to deposit it into the vault.",
            originalError: error,
        };
    }

    // Network errors
    if (
        error.code === "NETWORK_ERROR" ||
        errorString.includes("timeout") ||
        errorString.includes("network") ||
        errorString.includes("fetch")
    ) {
        return {
            type: "network",
            message: "Network Connection Issue",
            details: "Please check your connection and try again.",
            action: context?.retry
                ? {
                      label: "Retry",
                      handler: context.retry,
                  }
                : {
                      label: "Refresh Page",
                      handler: () => window.location.reload(),
                  },
            originalError: error,
        };
    }

    // Gas estimation failed
    if (errorString.includes("cannot estimate gas") || errorString.includes("gas required exceeds")) {
        return {
            type: "gas",
            message: "Transaction May Fail",
            details: "The transaction is likely to fail. Please check your inputs and try again.",
            originalError: error,
        };
    }

    // Default unknown error
    return {
        type: "unknown",
        message: "Transaction Failed",
        details: error?.shortMessage || errorMessage || "An unexpected error occurred. Please try again.",
        action: context?.retry
            ? {
                  label: "Try Again",
                  handler: context.retry,
              }
            : undefined,
        originalError: error,
    };
}

/**
 * Format transaction status for display
 */
export function getTransactionStatusMessage(status: TxStatus): string {
    switch (status) {
        case TxStatus.SIGNING:
            return "Please sign the transaction in your wallet...";
        case TxStatus.PENDING:
            return "Transaction submitted. Waiting for confirmation...";
        case TxStatus.CONFIRMING:
            return "Transaction is being confirmed...";
        case TxStatus.SUCCESS:
            return "Transaction completed successfully!";
        case TxStatus.ERROR:
            return "Transaction failed";
        default:
            return "";
    }
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerUrl(txHash: string, chainId?: number): string {
    const baseExplorerUrl =
        chainId === 8453
            ? "https://basescan.org"
            : chainId === 84532
              ? "https://sepolia.basescan.org"
              : "https://etherscan.io";

    return `${baseExplorerUrl}/tx/${txHash}`;
}
