import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseEther } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { getEcoStabilizerContract, getSccContract, getAstaVerdeContract, detectVaultVersion } from "../config/contracts";
import { customToast } from "../shared/utils/customToast";
import { ENV } from "../config/environment";
import { VAULT_GAS_LIMITS } from "../config/constants";
import { parseVaultError, TxStatus, VaultErrorState } from "../utils/errors";
import { dispatchRefetch } from "./useGlobalEvent";
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

export function useVault(): VaultHook {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  // State
  const [vaultVersion, setVaultVersion] = useState<"V1" | "V2" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<VaultErrorState | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>(TxStatus.IDLE);
  const [paginatedLoans, setPaginatedLoans] = useState<bigint[]>([]);

  const vaultAddress = ENV.ECOSTABILIZER_ADDRESS;

  // Transaction management
  const { writeContractAsync } = useWriteContract();
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  });

  // Check if vault contracts are available
  const isVaultAvailable = useMemo(() => {
    return !!(vaultAddress && ENV.SCC_ADDRESS);
  }, [vaultAddress]);

  // Detect vault version on mount
  useEffect(() => {
    const detectVersion = async () => {
      if (publicClient && isVaultAvailable && vaultAddress) {
        const version = await detectVaultVersion(publicClient);
        setVaultVersion(version);
      }
    };
    detectVersion();
  }, [publicClient, isVaultAvailable, vaultAddress]);

  // Get contract configs safely
  const getVaultContractConfig = useCallback(() => {
    if (!isVaultAvailable || !vaultAddress) {
      throw new Error("Vault contracts not configured");
    }
    return getEcoStabilizerContract();
  }, [isVaultAvailable, vaultAddress]);

  const getAssetContractConfig = useCallback(() => {
    return getAstaVerdeContract();
  }, []);

  const getSccConfig = useCallback(() => {
    if (!ENV.SCC_ADDRESS) {
      throw new Error("SCC contract not configured");
    }
    return getSccContract();
  }, []);

  // Read user's SCC balance
  const { data: sccBalance, refetch: refetchSccBalance } = useReadContract({
    ...(isVaultAvailable ? getSccContract() : { address: undefined, abi: [] }),
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isVaultAvailable && !!address },
  });

  // Read SCC allowance for vault
  const { data: sccAllowance, refetch: refetchSccAllowance } = useReadContract({
    ...(isVaultAvailable ? getSccContract() : { address: undefined, abi: [] }),
    functionName: "allowance",
    args: address && vaultAddress ? [address, vaultAddress] : undefined,
    query: { enabled: isVaultAvailable && !!address && !!vaultAddress },
  });

  // Read user's loans directly (non-paginated version)
  const { data: userLoansData, refetch: refetchUserLoans } = useReadContract({
    ...(isVaultAvailable ? getEcoStabilizerContract() : { address: undefined, abi: [] }),
    functionName: "getUserLoans",
    args: address ? [address] : undefined,
    query: { enabled: isVaultAvailable && !!address },
  });

  // Read total active loans
  const { data: totalActiveLoansData } = useReadContract({
    ...(isVaultAvailable ? getEcoStabilizerContract() : { address: undefined, abi: [] }),
    functionName: "getTotalActiveLoans",
    query: { enabled: isVaultAvailable },
  });

  // Read NFT approval status
  const { data: isNftApproved, refetch: refetchNftApproval } = useReadContract({
    ...getAssetContractConfig(),
    functionName: "isApprovedForAll",
    args:
      address && isVaultAvailable && vaultAddress
        ? [address, vaultAddress]
        : undefined,
    query: { enabled: !!address && isVaultAvailable && !!vaultAddress },
  });

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
    setVaultError(null);
  }, []);

  // Refresh all contract data
  const refreshContractData = useCallback(async () => {
    if (isVaultAvailable && address) {
      await Promise.all([
        refetchSccBalance(),
        refetchSccAllowance(),
        refetchUserLoans(),
        refetchNftApproval(),
      ]);
    }
  }, [isVaultAvailable, address, refetchSccBalance, refetchSccAllowance, refetchUserLoans, refetchNftApproval]);

  // Core vault functions with proper async handling
  const deposit = useCallback(
    async (tokenId: bigint) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.SIGNING);

        const vaultContractConfig = getVaultContractConfig();

        customToast.info("Depositing NFT to vault...");

        const hash = await writeContractAsync({
          ...vaultContractConfig,
          functionName: "deposit",
          args: [tokenId],
        });

        setCurrentTxHash(hash);
        setTxStatus(TxStatus.CONFIRMING);

        // Wait for transaction receipt
        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          setTxStatus(TxStatus.SUCCESS);
          customToast.success("NFT successfully deposited!");
          await refreshContractData();
          dispatchRefetch();
        } else {
          throw new Error("Transaction failed");
        }
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
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentTxHash(undefined);
      }
    },
    [address, isVaultAvailable, getVaultContractConfig, writeContractAsync, publicClient, refreshContractData],
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
        setTxStatus(TxStatus.SIGNING);

        const vaultConfig = getVaultContractConfig();

        customToast.info("Withdrawing NFT from vault...");

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

        const hash = await writeContractAsync({
          ...vaultConfig,
          functionName: "withdraw",
          args: [tokenId],
          ...(gasLimit ? { gas: gasLimit } : {}),
        });

        setCurrentTxHash(hash);
        setTxStatus(TxStatus.CONFIRMING);

        // Wait for transaction receipt
        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          setTxStatus(TxStatus.SUCCESS);
          customToast.success("NFT successfully withdrawn!");
          await refreshContractData();
          dispatchRefetch();
        } else {
          throw new Error("Transaction failed");
        }
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
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentTxHash(undefined);
      }
    },
    [address, isVaultAvailable, getVaultContractConfig, writeContractAsync, publicClient, refreshContractData],
  );

  // Batch operations
  const depositBatch = useCallback(
    async (tokenIds: bigint[]) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      if (vaultVersion !== "V2") {
        throw new Error("Batch operations only available in V2");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.SIGNING);

        const vaultConfig = getVaultContractConfig();

        customToast.info(`Depositing ${tokenIds.length} NFTs to vault...`);

        const hash = await writeContractAsync({
          ...vaultConfig,
          functionName: "depositBatch",
          args: [tokenIds],
        });

        setCurrentTxHash(hash);
        setTxStatus(TxStatus.CONFIRMING);

        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          setTxStatus(TxStatus.SUCCESS);
          customToast.success(`Successfully deposited ${tokenIds.length} NFTs!`);
          await refreshContractData();
          dispatchRefetch();
        } else {
          throw new Error("Transaction failed");
        }
      } catch (err) {
        setError((err as Error)?.message || "Failed to deposit batch");
        setTxStatus(TxStatus.ERROR);
        customToast.error("Batch deposit failed");
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentTxHash(undefined);
      }
    },
    [address, isVaultAvailable, vaultVersion, getVaultContractConfig, writeContractAsync, publicClient, refreshContractData],
  );

  const withdrawBatch = useCallback(
    async (tokenIds: bigint[]) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      if (vaultVersion !== "V2") {
        throw new Error("Batch operations only available in V2");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.SIGNING);

        const vaultConfig = getVaultContractConfig();

        customToast.info(`Withdrawing ${tokenIds.length} NFTs from vault...`);

        const hash = await writeContractAsync({
          ...vaultConfig,
          functionName: "withdrawBatch",
          args: [tokenIds],
        });

        setCurrentTxHash(hash);
        setTxStatus(TxStatus.CONFIRMING);

        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          setTxStatus(TxStatus.SUCCESS);
          customToast.success(`Successfully withdrew ${tokenIds.length} NFTs!`);
          await refreshContractData();
          dispatchRefetch();
        } else {
          throw new Error("Transaction failed");
        }
      } catch (err) {
        setError((err as Error)?.message || "Failed to withdraw batch");
        setTxStatus(TxStatus.ERROR);
        customToast.error("Batch withdrawal failed");
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentTxHash(undefined);
      }
    },
    [address, isVaultAvailable, vaultVersion, getVaultContractConfig, writeContractAsync, publicClient, refreshContractData],
  );

  // Backward-compatible alias for repayAndWithdraw
  const repayAndWithdraw = useCallback(
    async (tokenId: bigint) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.SIGNING);

        const vaultConfig = getVaultContractConfig();

        customToast.info("Repaying 20 SCC and withdrawing NFT...");

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

        const hash = await writeContractAsync({
          ...vaultConfig,
          functionName: "withdraw",
          args: [tokenId],
          ...(gasLimit ? { gas: gasLimit } : {}),
        });

        setCurrentTxHash(hash);
        setTxStatus(TxStatus.CONFIRMING);

        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          setTxStatus(TxStatus.SUCCESS);
          customToast.success("NFT successfully withdrawn!");
          await refreshContractData();
          dispatchRefetch();
        } else {
          throw new Error("Transaction failed");
        }
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
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentTxHash(undefined);
      }
    },
    [address, isVaultAvailable, getVaultContractConfig, writeContractAsync, publicClient, refreshContractData],
  );

  // Approval functions
  const approveNFT = useCallback(async () => {
    if (!address || !isVaultAvailable) {
      throw new Error("Wallet not connected or vault not available");
    }

    try {
      setIsLoading(true);
      setError(null);

      customToast.info("Approving NFT transfers...");

      // Resolve operator from current vault config to avoid ENV drift
      const vaultConfig = getVaultContractConfig();
      const operator = vaultConfig.address as `0x${string}`;

      // Prevent accidental self-approval (will revert onchain)
      if (operator.toLowerCase() === address.toLowerCase()) {
        throw new Error("Invalid operator: cannot approve your own address");
      }

      const hash = await writeContractAsync({
        ...astaverdeContractConfig,
        functionName: "setApprovalForAll",
        args: [operator, true],
        account: address,
      });

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });

      if (receipt?.status === "success") {
        await refetchNftApproval();
        customToast.success("NFT approval granted!");
      } else {
        throw new Error("Approval failed");
      }
    } catch (err) {
      const errorMessage = (err as Error)?.message || "Failed to approve NFT transfers";
      setError(errorMessage);
      customToast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, isVaultAvailable, writeContractAsync, publicClient, refetchNftApproval, getVaultContractConfig]);

  const approveSCC = useCallback(
    async (amount: bigint = SCC_PER_ASSET) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      try {
        setIsLoading(true);
        setError(null);

        const sccConfig = getSccConfig();

        customToast.info("Approving SCC transfers...");

        const hash = await writeContractAsync({
          ...sccConfig,
          functionName: "approve",
          args: [ENV.ECOSTABILIZER_ADDRESS as `0x${string}`, amount],
        });

        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          await refetchSccAllowance();
          customToast.success("SCC approval granted!");
        } else {
          throw new Error("Approval failed");
        }
      } catch (err) {
        const errorMessage = (err as Error)?.message || "Failed to approve SCC";
        setError(errorMessage);
        customToast.error(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [address, isVaultAvailable, getSccConfig, writeContractAsync, publicClient, refetchSccAllowance],
  );

  // Read functions
  const getUserLoans = useCallback(async (): Promise<bigint[]> => {
    // Prefer a fresh on-demand read to avoid cross-hook staleness during batch flows
    try {
      if (publicClient && address && isVaultAvailable) {
        const loans = await publicClient.readContract({
          ...getVaultContractConfig(),
          functionName: "getUserLoans",
          args: [address],
        });
        return loans as bigint[];
      }
    } catch {
      // fall back to cached data below
    }
    return (userLoansData as bigint[]) || [];
  }, [publicClient, address, isVaultAvailable, getVaultContractConfig, userLoansData]);

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
      // Would need implementation
      return null;
    },
    [],
  );

  return {
    // Core functions
    deposit,
    withdraw,
    repayAndWithdraw,
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
    isLoading: isLoading || isConfirming,
    error,
    vaultError,
    txStatus,
    txHash: currentTxHash,
    clearError,
  };
}
