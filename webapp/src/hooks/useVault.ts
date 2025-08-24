import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { parseEther } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import {
  getEcoStabilizerContractConfig,
  getSccContractConfig,
  astaverdeContractConfig,
  getAstaVerdeConfigForAsset,
  getEcoStabilizerConfigForAsset,
  detectVaultVersion,
} from "../lib/contracts";
import { customToast } from "../shared/utils/customToast";
import { ENV } from "../config/environment";
import { VAULT_GAS_LIMITS } from "../config/constants";
import { parseVaultError, TxStatus, VaultErrorState } from "../utils/errors";
import { getVaultForAsset } from "../utils/vaultRouting";
import type { VaultLoan } from "../features/vault/types";

export interface VaultHook {
  // Core functionality
  deposit: (tokenId: bigint) => Promise<void>;
  withdraw: (tokenId: bigint) => Promise<void>;
  // Backward-compatible alias maintained via frontend: calls withdraw
  repayAndWithdraw: (tokenId: bigint) => Promise<void>;

  // Batch operations (V2 only)
  depositBatch: (tokenIds: bigint[]) => Promise<void>;
  withdrawBatch: (tokenIds: bigint[]) => Promise<void>;
  vaultVersion: "V1" | "V2" | null;

  // Read functions
  getUserLoans: () => Promise<bigint[]>;
  getTotalActiveLoans: () => Promise<bigint>;
  getSccBalance: () => Promise<bigint>;
  getSccAllowance: () => Promise<bigint>;
  checkLoanStatus: (tokenId: bigint) => Promise<VaultLoan | null>;
  getIsNftApproved: () => Promise<boolean>;

  // Approval functions
  approveNFT: () => Promise<void>;
  approveSCC: (amount?: bigint) => Promise<void>;

  // Status
  isVaultAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  vaultError: VaultErrorState | null;
  txStatus: TxStatus;
  txHash?: string;
  clearError: () => void;
}

const SCC_PER_ASSET = parseEther("20");

export function useVault(assetAddress?: string): VaultHook {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<VaultErrorState | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>(TxStatus.IDLE);
  const [paginatedLoans, setPaginatedLoans] = useState<bigint[]>([]);
  const [vaultVersion, setVaultVersion] = useState<"V1" | "V2" | null>(null);

  // Determine which vault configuration to use based on asset address
  const vaultConfig = useMemo(() => {
    if (assetAddress) {
      return getVaultForAsset(assetAddress);
    }
    // Default to V1 if no asset address provided
    return {
      astaVerdeAddress: ENV.ASTAVERDE_ADDRESS as `0x${string}`,
      ecoStabilizerAddress: ENV.ECOSTABILIZER_ADDRESS as `0x${string}`,
      version: "V1" as const,
    };
  }, [assetAddress]);

  const { writeContract, data: hash, isPending: isTransactionPending } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  // Check if vault contracts are available
  const isVaultAvailable = useMemo(() => {
    return !!(vaultConfig && vaultConfig.ecoStabilizerAddress && ENV.SCC_ADDRESS);
  }, [vaultConfig]);

  // Detect vault version on mount
  useEffect(() => {
    const detectVersion = async () => {
      if (publicClient && isVaultAvailable && vaultConfig?.ecoStabilizerAddress) {
        // For now, detect version on the configured vault address
        const version = await detectVaultVersion(publicClient);
        setVaultVersion(version);
      }
    };
    detectVersion();
  }, [publicClient, isVaultAvailable, vaultConfig]);

  // Get contract configs safely
  const getVaultContractConfig = useCallback(() => {
    if (!isVaultAvailable || !vaultConfig) {
      throw new Error("Vault contracts not configured");
    }
    return assetAddress ? getEcoStabilizerConfigForAsset(assetAddress) : getEcoStabilizerContractConfig();
  }, [isVaultAvailable, vaultVersion, assetAddress, vaultConfig]);

  const getAssetContractConfig = useCallback(() => {
    if (!vaultConfig) {
      return astaverdeContractConfig;
    }
    return assetAddress ? getAstaVerdeConfigForAsset(assetAddress) : astaverdeContractConfig;
  }, [assetAddress, vaultConfig]);

  const getSccConfig = useCallback(() => {
    if (!ENV.SCC_ADDRESS) {
      throw new Error("SCC contract not configured");
    }
    return getSccContractConfig();
  }, []);

  // Read user's SCC balance
  const { data: sccBalance, refetch: refetchSccBalance } = useReadContract({
    ...(isVaultAvailable ? getSccContractConfig() : { address: undefined, abi: [] }),
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isVaultAvailable },
  });

  // Read user's SCC allowance to vault
  const { data: sccAllowance, refetch: refetchSccAllowance } = useReadContract({
    ...(isVaultAvailable ? getSccContractConfig() : { address: undefined, abi: [] }),
    functionName: "allowance",
    args:
      address && isVaultAvailable && vaultConfig?.ecoStabilizerAddress
        ? [address, vaultConfig.ecoStabilizerAddress]
        : undefined,
    query: { enabled: !!address && isVaultAvailable },
  });

  // Read user's loans - disabled in favor of paginated version
  // Keeping this for backward compatibility but not using it
  const { data: userLoansData } = useReadContract({
    ...(isVaultAvailable ? getEcoStabilizerContractConfig() : { address: undefined, abi: [] }),
    functionName: "getUserLoans",
    args: address ? [address] : undefined,
    query: { enabled: false }, // Disabled - using paginated version instead
  });

  // Read total active loans
  const { data: totalActiveLoansData } = useReadContract({
    ...(isVaultAvailable ? getEcoStabilizerContractConfig() : { address: undefined, abi: [] }),
    functionName: "getTotalActiveLoans",
    query: { enabled: isVaultAvailable },
  });

  // Read NFT approval status
  const { data: isNftApproved, refetch: refetchNftApproval } = useReadContract({
    ...getAssetContractConfig(),
    functionName: "isApprovedForAll",
    args:
      address && isVaultAvailable && vaultConfig?.ecoStabilizerAddress
        ? [address, vaultConfig.ecoStabilizerAddress]
        : undefined,
    query: { enabled: !!address && isVaultAvailable },
  });

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
    setVaultError(null);
    setTxStatus(TxStatus.IDLE);
  }, []);

  // Handle transaction status changes
  useEffect(() => {
    if (isTransactionPending) {
      setTxStatus(TxStatus.SIGNING);
    } else if (isConfirming) {
      setTxStatus(TxStatus.CONFIRMING);
    }
  }, [isTransactionPending, isConfirming]);

  // Declare refreshContractData ref (will be properly assigned later)
  const refreshContractDataRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Handle transaction success/error states
  useEffect(() => {
    if (isConfirmed && hash) {
      setTxStatus(TxStatus.SUCCESS);
      customToast.success("Transaction confirmed successfully!");
      setIsLoading(false);
      setError(null);
      setVaultError(null);
      // Refresh all data after successful transaction
      refreshContractDataRef.current();
      // Reset status after delay
      setTimeout(() => setTxStatus(TxStatus.IDLE), 1500);
    }
    if (txError && hash) {
      setTxStatus(TxStatus.ERROR);
      const errorMessage = txError?.message || "Transaction failed";
      setError(errorMessage);
      const parsedError = parseVaultError(txError);
      setVaultError(parsedError);
      customToast.error(parsedError.message);
      setIsLoading(false);
    }
  }, [isConfirmed, txError, hash]);

  // Core vault functions
  const deposit = useCallback(
    async (tokenId: bigint) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.IDLE);

        const vaultContractConfig = getVaultContractConfig();

        customToast.info("Depositing NFT to vault...");
        setTxStatus(TxStatus.SIGNING);

        writeContract({
          ...vaultContractConfig,
          functionName: "deposit",
          args: [tokenId],
        });

        // Success toast will be shown in useEffect when transaction is confirmed
      } catch (err) {
        const parsedError = parseVaultError(err, {
          operation: "deposit",
          approveNFT: async () => approveNFT(),
          retry: () => deposit(tokenId),
        });
        setError((err as Error)?.message || "Failed to deposit NFT");
        setVaultError(parsedError);
        setTxStatus(TxStatus.ERROR);
        customToast.error(parsedError.message);
        setIsLoading(false);
        throw err;
      }
    },
    [address, isVaultAvailable, getVaultContractConfig, writeContract, approveNFT],
  );

  const withdraw = useCallback(
    async (tokenId: bigint) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.IDLE);

        const vaultConfig = getVaultContractConfig();

        customToast.info("Withdrawing NFT from vault...");
        setTxStatus(TxStatus.SIGNING);

        let gasLimit: bigint | undefined;
        try {
          if (publicClient && address) {
            const estimate = await publicClient.estimateContractGas({
              ...vaultConfig,
              functionName: "withdraw",
              args: [tokenId],
              account: address,
            });
            gasLimit = (estimate * 150n) / 100n; // add 50% buffer
          }
        } catch {
          gasLimit = VAULT_GAS_LIMITS.WITHDRAW;
        }

        writeContract({
          ...vaultConfig,
          functionName: "withdraw",
          args: [tokenId],
          ...(gasLimit ? { gas: gasLimit } : {}),
        });

        // Success toast will be shown in useEffect when transaction is confirmed
      } catch (err) {
        const parsedError = parseVaultError(err, {
          operation: "withdraw",
          approveSCC: async () => approveSCC(SCC_PER_ASSET),
          retry: () => withdraw(tokenId),
        });
        setError((err as Error)?.message || "Failed to withdraw NFT");
        setVaultError(parsedError);
        setTxStatus(TxStatus.ERROR);
        customToast.error(parsedError.message);
        setIsLoading(false);
        throw err;
      }
    },
    [address, isVaultAvailable, getVaultContractConfig, writeContract, approveSCC, publicClient],
  );

  // Batch deposit function (V2 only)
  const depositBatch = useCallback(
    async (tokenIds: bigint[]) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      if (vaultVersion !== "V2") {
        throw new Error("Batch operations not available - check contract deployment");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.IDLE);

        const vaultConfig = getVaultContractConfig();

        customToast.info(`Depositing ${tokenIds.length} NFTs to vault in a single transaction...`);
        setTxStatus(TxStatus.SIGNING);

        writeContract({
          ...vaultConfig,
          functionName: "depositBatch",
          args: [tokenIds],
        });

        // Success toast will be shown in useEffect when transaction is confirmed
      } catch (err) {
        const parsedError = parseVaultError(err, {
          operation: "depositBatch",
          approveNFT: async () => approveNFT(),
          retry: () => depositBatch(tokenIds),
        });
        setError((err as Error)?.message || "Failed to deposit NFTs");
        setVaultError(parsedError);
        setTxStatus(TxStatus.ERROR);
        customToast.error(parsedError.message);
        setIsLoading(false);
        throw err;
      }
    },
    [address, isVaultAvailable, vaultVersion, getVaultContractConfig, writeContract, approveNFT],
  );

  // Batch withdraw function (V2 only)
  const withdrawBatch = useCallback(
    async (tokenIds: bigint[]) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      if (vaultVersion !== "V2") {
        throw new Error("Batch operations not available - check contract deployment");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.IDLE);

        const vaultConfig = getVaultContractConfig();

        customToast.info(`Withdrawing ${tokenIds.length} NFTs from vault in a single transaction...`);
        setTxStatus(TxStatus.SIGNING);

        let gasLimit: bigint | undefined;
        try {
          if (publicClient && address) {
            const estimate = await publicClient.estimateContractGas({
              ...vaultConfig,
              functionName: "withdrawBatch",
              args: [tokenIds],
              account: address,
            });
            gasLimit = (estimate * 150n) / 100n; // add 50% buffer
          }
        } catch {
          // Estimate gas for batch (roughly 60k per token for V2)
          gasLimit = BigInt(60000 * tokenIds.length);
        }

        writeContract({
          ...vaultConfig,
          functionName: "withdrawBatch",
          args: [tokenIds],
          ...(gasLimit ? { gas: gasLimit } : {}),
        });

        // Success toast will be shown in useEffect when transaction is confirmed
      } catch (err) {
        const parsedError = parseVaultError(err, {
          operation: "withdrawBatch",
          approveSCC: async () => approveSCC(BigInt(tokenIds.length) * SCC_PER_ASSET),
          retry: () => withdrawBatch(tokenIds),
        });
        setError((err as Error)?.message || "Failed to withdraw NFTs");
        setVaultError(parsedError);
        setTxStatus(TxStatus.ERROR);
        customToast.error(parsedError.message);
        setIsLoading(false);
        throw err;
      }
    },
    [address, isVaultAvailable, vaultVersion, getVaultContractConfig, writeContract, publicClient, approveSCC],
  );

  const repayAndWithdraw = useCallback(
    async (tokenId: bigint) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.IDLE);

        const vaultConfig = getVaultContractConfig();

        customToast.info("Repaying 20 SCC and withdrawing NFT...");
        setTxStatus(TxStatus.SIGNING);

        let gasLimit: bigint | undefined;
        try {
          if (publicClient && address) {
            const estimate = await publicClient.estimateContractGas({
              ...vaultConfig,
              functionName: "withdraw",
              args: [tokenId],
              account: address,
            });
            gasLimit = (estimate * 150n) / 100n;
          }
        } catch {
          gasLimit = VAULT_GAS_LIMITS.WITHDRAW;
        }

        writeContract({
          ...vaultConfig,
          functionName: "withdraw",
          args: [tokenId],
          ...(gasLimit ? { gas: gasLimit } : {}),
        });

        // Success toast will be shown in useEffect when transaction is confirmed
      } catch (err) {
        const parsedError = parseVaultError(err, {
          operation: "withdraw",
          approveSCC: async () => approveSCC(SCC_PER_ASSET),
          retry: () => repayAndWithdraw(tokenId),
        });
        setError((err as Error)?.message || "Failed to repay and withdraw NFT");
        setVaultError(parsedError);
        setTxStatus(TxStatus.ERROR);
        customToast.error(parsedError.message);
        setIsLoading(false);
        throw err;
      }
    },
    [address, isVaultAvailable, getVaultContractConfig, writeContract, approveSCC, publicClient],
  );

  // Approval functions
  const approveNFT = useCallback(async () => {
    if (!address || !isVaultAvailable) {
      throw new Error("Wallet not connected or vault not available");
    }

    try {
      setIsLoading(true);
      setError(null);

      customToast.info("Initiating NFT approval transaction...");

      writeContract({
        ...astaverdeContractConfig,
        functionName: "setApprovalForAll",
        args: [ENV.ECOSTABILIZER_ADDRESS as `0x${string}`, true],
      });

      // Success handling moved to useEffect above
    } catch (err) {
      const errorMessage = (err as Error)?.message || "Failed to approve NFT transfers";
      setError(errorMessage);
      customToast.error(errorMessage);
      setIsLoading(false);
      throw err;
    }
  }, [address, isVaultAvailable, writeContract]);

  const approveSCC = useCallback(
    async (amount: bigint = SCC_PER_ASSET) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      try {
        setIsLoading(true);
        setError(null);

        const sccConfig = getSccConfig();

        customToast.info("Initiating SCC approval transaction...");

        writeContract({
          ...sccConfig,
          functionName: "approve",
          args: [ENV.ECOSTABILIZER_ADDRESS as `0x${string}`, amount],
        });

        // Success handling moved to useEffect above
      } catch (err) {
        const errorMessage = (err as Error)?.message || "Failed to approve SCC";
        setError(errorMessage);
        customToast.error(errorMessage);
        setIsLoading(false);
        throw err;
      }
    },
    [address, isVaultAvailable, getSccConfig, writeContract],
  );

  // Fetch paginated loans
  const fetchPaginatedLoans = useCallback(async (): Promise<bigint[]> => {
    if (!address || !isVaultAvailable || !publicClient) {
      return [];
    }

    try {
      const loans: bigint[] = [];
      let startId = 1n;
      const pageSize = 2000n; // MAX_PAGE_SIZE from contract

      while (true) {
        const result = await publicClient.readContract({
          ...getVaultContractConfig(),
          functionName: "getUserLoansPaginated",
          args: [address, startId, pageSize],
        });

        const { tokenIds, nextStartId } = result as { tokenIds: bigint[]; nextStartId: bigint };
        loans.push(...tokenIds);

        if (nextStartId === 0n) break;
        startId = nextStartId;
      }

      setPaginatedLoans(loans);
      return loans;
    } catch (err) {
      console.error("Error fetching user loans:", err);
      // Fallback to non-paginated if paginated fails (e.g., old contract)
      const fallbackLoans = (userLoansData as bigint[]) || [];
      setPaginatedLoans(fallbackLoans);
      return fallbackLoans;
    }
  }, [address, isVaultAvailable, publicClient, getVaultContractConfig, userLoansData]);

  // Refresh all contract data
  const refreshContractData = useCallback(async () => {
    if (isVaultAvailable && address) {
      await Promise.all([
        refetchSccBalance(),
        refetchSccAllowance(),
        fetchPaginatedLoans(), // Use paginated fetch instead of refetchUserLoans
        refetchNftApproval(),
      ]);
    }
  }, [isVaultAvailable, address, refetchSccBalance, refetchSccAllowance, fetchPaginatedLoans, refetchNftApproval]);

  // Assign to ref for use in effects
  refreshContractDataRef.current = refreshContractData;

  // Initialize paginated loans on mount and when address changes
  useEffect(() => {
    if (address && isVaultAvailable) {
      fetchPaginatedLoans();
    }
  }, [address, isVaultAvailable, fetchPaginatedLoans]);

  // Read functions
  const getUserLoans = useCallback(async (): Promise<bigint[]> => {
    // If we have cached paginated loans, return them
    if (paginatedLoans.length > 0) {
      return paginatedLoans;
    }
    // Otherwise fetch them
    return fetchPaginatedLoans();
  }, [paginatedLoans, fetchPaginatedLoans]);

  const getTotalActiveLoans = useCallback(async (): Promise<bigint> => {
    return (totalActiveLoansData as bigint) || 0n;
  }, [totalActiveLoansData]);

  const getSccBalance = useCallback(async (): Promise<bigint> => {
    return (sccBalance as bigint) || 0n;
  }, [sccBalance]);

  const getSccAllowance = useCallback(async (): Promise<bigint> => {
    return (sccAllowance as bigint) || 0n;
  }, [sccAllowance]);

  const getIsNftApproved = useCallback(async (): Promise<boolean> => {
    return (isNftApproved as boolean) || false;
  }, [isNftApproved]);

  const checkLoanStatus = useCallback(
    async (_tokenId: bigint): Promise<VaultLoan | null> => {
      if (!isVaultAvailable) {
        return null;
      }

      try {
        // This would need to be called separately with useReadContract
        // For now, we'll return null - the actual implementation should use
        // a separate useReadContract hook for each tokenId when needed
        return null;
      } catch (err) {
        console.error("Error checking loan status:", err);
        return null;
      }
    },
    [isVaultAvailable],
  );

  return {
    // Core functionality
    deposit,
    withdraw,
    repayAndWithdraw,

    // Batch operations (V2 only)
    depositBatch,
    withdrawBatch,
    vaultVersion,

    // Read functions
    getUserLoans,
    getTotalActiveLoans,
    getSccBalance,
    getSccAllowance,
    checkLoanStatus,
    getIsNftApproved,

    // Approval functions
    approveNFT,
    approveSCC,

    // Status
    isVaultAvailable,
    isLoading: isLoading || isTransactionPending || isConfirming,
    error,
    vaultError,
    txStatus,
    txHash: hash,
    clearError,
  };
}

// Helper hook for checking individual loan status
export function useLoanStatus(tokenId: bigint) {
  const { data: loanData } = useReadContract(
    ENV.ECOSTABILIZER_ADDRESS && tokenId !== undefined
      ? {
          ...getEcoStabilizerContractConfig(),
          functionName: "loans",
          args: [tokenId],
        }
      : {
          address: undefined as unknown as `0x${string}`,
          abi: [],
          functionName: "loans",
        },
  );

  const loan: VaultLoan | null = loanData
    ? {
        tokenId,
        borrower: (loanData as unknown[])[0] as string,
        active: (loanData as unknown[])[1] as boolean,
      }
    : null;

  return {
    loan,
    isInVault: loan?.active || false,
    borrower: loan?.borrower || null,
  };
}
