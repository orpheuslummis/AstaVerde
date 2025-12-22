import { customToast } from "./customToast";
import { decodeErrorResult } from "viem";
import type { Abi } from "abitype";

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
  originalError?: unknown;
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

const OZ_CUSTOM_ERRORS_ABI = [
  // OpenZeppelin v5 AccessControl
  {
    type: "error",
    name: "AccessControlUnauthorizedAccount",
    inputs: [
      { name: "account", type: "address" },
      { name: "neededRole", type: "bytes32" },
    ],
  },
  // OpenZeppelin v5 Pausable
  {
    type: "error",
    name: "EnforcedPause",
    inputs: [],
  },
  {
    type: "error",
    name: "ExpectedPause",
    inputs: [],
  },
  // OpenZeppelin v5 ERC1155
  {
    type: "error",
    name: "ERC1155MissingApprovalForAll",
    inputs: [
      { name: "operator", type: "address" },
      { name: "owner", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC1155InsufficientBalance",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
      { name: "tokenId", type: "uint256" },
    ],
  },
  // OpenZeppelin v5 ERC20
  {
    type: "error",
    name: "ERC20InsufficientAllowance",
    inputs: [
      { name: "spender", type: "address" },
      { name: "allowance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC20InsufficientBalance",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
] as const satisfies Abi;

function getHexData(value: unknown): `0x${string}` | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("0x")) return null;
  // Needs at least 4-byte selector (8 hex chars) + 0x prefix.
  if (value.length < 10) return null;
  return value as `0x${string}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function extractErrorData(error: unknown, visited = new Set<unknown>(), depth = 0): `0x${string}` | null {
  if (!error || typeof error !== "object") return null;
  if (visited.has(error)) return null;
  visited.add(error);
  if (depth > 6) return null;

  const anyErr = error as Record<string, unknown> & { cause?: unknown };

  // Common viem fields: `data` or `cause.data`.
  const direct = getHexData(anyErr?.data);
  if (direct) return direct;

  const nested = getHexData(asRecord(anyErr?.data)?.data);
  if (nested) return nested;

  const cause = anyErr?.cause;
  if (cause) {
    const fromCause = extractErrorData(cause, visited, depth + 1);
    if (fromCause) return fromCause;
  }

  return null;
}

function collectErrorMessages(error: unknown, out: string[] = [], visited = new Set<unknown>(), depth = 0): string[] {
  if (depth > 6) return out;

  if (typeof error === "string") {
    out.push(error);
    return out;
  }

  if (!error || typeof error !== "object") {
    out.push(String(error));
    return out;
  }

  if (visited.has(error)) return out;
  visited.add(error);

  const anyErr = error as Record<string, unknown> & { cause?: unknown };
  const candidates = [anyErr?.shortMessage, anyErr?.message, anyErr?.reason, anyErr?.details, anyErr?.name];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) out.push(c);
  }

  if (anyErr?.cause) {
    collectErrorMessages(anyErr.cause, out, visited, depth + 1);
  }

  return out;
}

function decodeKnownCustomError(error: unknown): { name: string; args: unknown } | null {
  const data = extractErrorData(error);
  if (!data) return null;
  try {
    const decoded = decodeErrorResult({
      abi: OZ_CUSTOM_ERRORS_ABI,
      data,
    });
    return { name: decoded.errorName, args: decoded.args };
  } catch {
    return null;
  }
}

/**
 * Parse vault-specific errors and provide user-friendly messages with actions
 */
export function parseVaultError(
  error: unknown,
  context?: {
    operation?: "deposit" | "withdraw" | "approve" | "depositBatch" | "withdrawBatch";
    approveSCC?: () => Promise<void>;
    approveNFT?: () => Promise<void>;
    retry?: () => void;
  },
): VaultErrorState {
  const anyError = asRecord(error);
  const messages = collectErrorMessages(error);
  const errorMessage = messages[0] || String(error);
  const errorString = messages.join("\n").toLowerCase();

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

  // OpenZeppelin custom errors (common in v5+). These often bubble up through EcoStabilizer
  // as opaque "Error processing the transaction" unless decoded from revert data.
  const decoded = decodeKnownCustomError(error);
  if (decoded) {
    if (decoded.name === "EnforcedPause") {
      return {
        type: "contract",
        message: "Contract Temporarily Unavailable",
        details: "One of the involved contracts is paused. Please try again later or contact the admin.",
        originalError: error,
      };
    }

    if (decoded.name === "ERC1155MissingApprovalForAll") {
      const approveNFT = context?.approveNFT;
      let action: VaultErrorState["action"] | undefined;
      if (approveNFT) {
        action = {
          label: "Approve NFTs",
          handler: async () => {
            try {
              await approveNFT();
              customToast.success("Approval initiated. Please confirm in your wallet.");
            } catch {
              customToast.error("Failed to initiate approval");
            }
          },
        };
      }

      return {
        type: "approval",
        message: "NFT Approval Required",
        details: "Please approve the vault to transfer your NFTs first.",
        action,
        originalError: error,
      };
    }

    if (decoded.name === "ERC1155InsufficientBalance") {
      return {
        type: "contract",
        message: "Not NFT Owner",
        details: "You must own this NFT to deposit it into the vault.",
        originalError: error,
      };
    }

    if (decoded.name === "ERC20InsufficientAllowance") {
      const approveSCC = context?.approveSCC;
      let action: VaultErrorState["action"] | undefined;
      if (approveSCC) {
        action = {
          label: "Approve SCC",
          handler: async () => {
            try {
              await approveSCC();
              customToast.success("Approval initiated. Please confirm in your wallet.");
            } catch {
              customToast.error("Failed to initiate approval");
            }
          },
        };
      }

      return {
        type: "approval",
        message: "Approval Required",
        details: "Please approve the vault to spend your SCC tokens first.",
        action,
        originalError: error,
      };
    }

    if (decoded.name === "ERC20InsufficientBalance") {
      const retry = context?.retry;
      let action: VaultErrorState["action"] | undefined;
      if (retry) {
        action = {
          label: "Try Again",
          handler: retry,
        };
      }

      return {
        type: "insufficient-funds",
        message: "Insufficient SCC Balance",
        details: "You need 20 SCC to withdraw this NFT. You can get SCC by depositing other NFTs into the vault.",
        action,
        originalError: error,
      };
    }

    if (decoded.name === "AccessControlUnauthorizedAccount") {
      return {
        type: "contract",
        message: "Vault Misconfigured",
        details:
          context?.operation === "deposit" || context?.operation === "depositBatch"
            ? "The vault is not authorized to mint SCC (missing MINTER_ROLE). Redeploy or grant MINTER_ROLE to the vault address."
            : "The caller is missing a required role for this operation. Check contract roles and configuration.",
        originalError: error,
      };
    }
  }

  // Insufficient SCC balance for withdrawal
  if (
    errorString.includes("burn amount exceeds balance") ||
    errorString.includes("erc20: burn amount exceeds balance")
  ) {
    const retry = context?.retry;
    let action: VaultErrorState["action"] | undefined;
    if (retry) {
      action = {
        label: "Try Again",
        handler: retry,
      };
    }

    return {
      type: "insufficient-funds",
      message: "Insufficient SCC Balance",
      details: "You need 20 SCC to withdraw this NFT. You can get SCC by depositing other NFTs into the vault.",
      action,
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
    const approveSCC = context?.approveSCC;
    let action: VaultErrorState["action"] | undefined;
    if (approveSCC) {
      action = {
        label: "Approve SCC",
        handler: async () => {
          try {
            await approveSCC();
            customToast.success("Approval initiated. Please confirm in your wallet.");
          } catch {
            customToast.error("Failed to initiate approval");
          }
        },
      };
    }

    return {
      type: "approval",
      message: "Approval Required",
      details: "Please approve the vault to spend your SCC tokens first.",
      action,
      originalError: error,
    };
  }

  // NFT approval needed
  if (errorString.includes("erc1155: caller is not token owner or approved") || errorString.includes("not approved")) {
    const approveNFT = context?.approveNFT;
    let action: VaultErrorState["action"] | undefined;
    if (approveNFT) {
      action = {
        label: "Approve NFTs",
        handler: async () => {
          try {
            await approveNFT();
            customToast.success("Approval initiated. Please confirm in your wallet.");
          } catch {
            customToast.error("Failed to initiate approval");
          }
        },
      };
    }

    return {
      type: "approval",
      message: "NFT Approval Required",
      details: "Please approve the vault to transfer your NFTs first.",
      action,
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
    anyError?.code === "NETWORK_ERROR" ||
    errorString.includes("timeout") ||
    errorString.includes("network") ||
    errorString.includes("fetch")
  ) {
    const retry = context?.retry;
    let action: VaultErrorState["action"];
    if (retry) {
      action = {
        label: "Retry",
        handler: retry,
      };
    } else {
      action = {
        label: "Refresh Page",
        handler: () => window.location.reload(),
      };
    }

    return {
      type: "network",
      message: "Network Connection Issue",
      details: "Please check your connection and try again.",
      action,
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
    details:
      (typeof anyError?.shortMessage === "string" ? anyError.shortMessage : null) ||
      errorMessage ||
      "An unexpected error occurred. Please try again.",
    action: context?.retry ? { label: "Try Again", handler: context.retry } : undefined,
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
  let baseExplorerUrl: string;

  switch (chainId) {
    // Arbitrum
    case 42161:
      baseExplorerUrl = "https://arbiscan.io";
      break;
    case 421614:
      baseExplorerUrl = "https://sepolia.arbiscan.io";
      break;
    // Base
    case 8453:
      baseExplorerUrl = "https://basescan.org";
      break;
    case 84532:
      baseExplorerUrl = "https://sepolia.basescan.org";
      break;
    // Local development
    case 31337:
      baseExplorerUrl = ""; // No explorer for local
      break;
    // Default to Etherscan
    default:
      baseExplorerUrl = "https://etherscan.io";
  }

  return baseExplorerUrl ? `${baseExplorerUrl}/tx/${txHash}` : "";
}
