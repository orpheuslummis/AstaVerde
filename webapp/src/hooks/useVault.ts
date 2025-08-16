import { useCallback, useMemo, useState, useEffect } from "react";
import { parseEther, formatEther } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { getEcoStabilizerContractConfig, getSccContractConfig, astaverdeContractConfig } from "../lib/contracts";
import { customToast } from "../shared/utils/customToast";
import { ENV } from "../config/environment";
import { VAULT_GAS_LIMITS } from "../config/constants";
import { parseVaultError, TxStatus, VaultErrorState, getTransactionStatusMessage } from "../utils/errors";
import type { VaultLoan } from "../features/vault/types";

export interface VaultHook {
    // Core functionality
    deposit: (tokenId: bigint) => Promise<void>;
    withdraw: (tokenId: bigint) => Promise<void>;
    // Backward-compatible alias maintained via frontend: calls withdraw
    repayAndWithdraw: (tokenId: bigint) => Promise<void>;

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
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [vaultError, setVaultError] = useState<VaultErrorState | null>(null);
    const [txStatus, setTxStatus] = useState<TxStatus>(TxStatus.IDLE);

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
        return !!(ENV.ECOSTABILIZER_ADDRESS && ENV.SCC_ADDRESS);
    }, []);

    // Get contract configs safely
    const getVaultConfig = useCallback(() => {
        if (!isVaultAvailable) {
            throw new Error("Vault contracts not configured");
        }
        return getEcoStabilizerContractConfig();
    }, [isVaultAvailable]);

    const getSccConfig = useCallback(() => {
        if (!isVaultAvailable) {
            throw new Error("SCC contract not configured");
        }
        return getSccContractConfig();
    }, [isVaultAvailable]);

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
        args: address && isVaultAvailable ? [address, ENV.ECOSTABILIZER_ADDRESS] : undefined,
        query: { enabled: !!address && isVaultAvailable },
    });

    // Read user's loans
    const { data: userLoansData, refetch: refetchUserLoans } = useReadContract({
        ...(isVaultAvailable ? getEcoStabilizerContractConfig() : { address: undefined, abi: [] }),
        functionName: "getUserLoans",
        args: address ? [address] : undefined,
        query: { enabled: !!address && isVaultAvailable },
    });

    // Read total active loans
    const { data: totalActiveLoansData } = useReadContract({
        ...(isVaultAvailable ? getEcoStabilizerContractConfig() : { address: undefined, abi: [] }),
        functionName: "getTotalActiveLoans",
        query: { enabled: isVaultAvailable },
    });

    // Read NFT approval status
    const { data: isNftApproved, refetch: refetchNftApproval } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "isApprovedForAll",
        args: address && isVaultAvailable && ENV.ECOSTABILIZER_ADDRESS ? [address, ENV.ECOSTABILIZER_ADDRESS] : undefined,
        query: { enabled: !!address && isVaultAvailable },
    });

    // Refresh all contract data
    const refreshContractData = useCallback(async () => {
        if (isVaultAvailable && address) {
            await Promise.all([refetchSccBalance(), refetchSccAllowance(), refetchUserLoans(), refetchNftApproval()]);
        }
    }, [isVaultAvailable, address, refetchSccBalance, refetchSccAllowance, refetchUserLoans, refetchNftApproval]);

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

    // Handle transaction success/error states
    useEffect(() => {
        if (isConfirmed && hash) {
            setTxStatus(TxStatus.SUCCESS);
            customToast.success("Transaction confirmed successfully!");
            setIsLoading(false);
            setError(null);
            setVaultError(null);
            // Refresh all data after successful transaction
            refreshContractData();
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
    }, [isConfirmed, txError, hash, refreshContractData]);

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

                const vaultConfig = getVaultConfig();

                customToast.info("Depositing NFT to vault...");
                setTxStatus(TxStatus.SIGNING);

                writeContract({
                    ...vaultConfig,
                    functionName: "deposit",
                    args: [tokenId],
                });

                // Success toast will be shown in useEffect when transaction is confirmed
            } catch (err: any) {
                const parsedError = parseVaultError(err, {
                    operation: "deposit",
                    approveNFT: async () => approveNFT(),
                    retry: () => deposit(tokenId),
                });
                setError(err?.message || "Failed to deposit NFT");
                setVaultError(parsedError);
                setTxStatus(TxStatus.ERROR);
                customToast.error(parsedError.message);
                setIsLoading(false);
                throw err;
            }
        },
        [address, isVaultAvailable, getVaultConfig, writeContract],
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

                const vaultConfig = getVaultConfig();

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
            } catch (err: any) {
                const parsedError = parseVaultError(err, {
                    operation: "withdraw",
                    approveSCC: async () => approveSCC(SCC_PER_ASSET),
                    retry: () => withdraw(tokenId),
                });
                setError(err?.message || "Failed to withdraw NFT");
                setVaultError(parsedError);
                setTxStatus(TxStatus.ERROR);
                customToast.error(parsedError.message);
                setIsLoading(false);
                throw err;
            }
        },
        [address, isVaultAvailable, getVaultConfig, writeContract],
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

                const vaultConfig = getVaultConfig();

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
            } catch (err: any) {
                const parsedError = parseVaultError(err, {
                    operation: "withdraw",
                    approveSCC: async () => approveSCC(SCC_PER_ASSET),
                    retry: () => repayAndWithdraw(tokenId),
                });
                setError(err?.message || "Failed to repay and withdraw NFT");
                setVaultError(parsedError);
                setTxStatus(TxStatus.ERROR);
                customToast.error(parsedError.message);
                setIsLoading(false);
                throw err;
            }
        },
        [address, isVaultAvailable, getVaultConfig, writeContract],
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
        } catch (err: any) {
            const errorMessage = err?.message || "Failed to approve NFT transfers";
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

                customToast.info(`Initiating SCC approval transaction...`);

                writeContract({
                    ...sccConfig,
                    functionName: "approve",
                    args: [ENV.ECOSTABILIZER_ADDRESS as `0x${string}`, amount],
                });

                // Success handling moved to useEffect above
            } catch (err: any) {
                const errorMessage = err?.message || "Failed to approve SCC";
                setError(errorMessage);
                customToast.error(errorMessage);
                setIsLoading(false);
                throw err;
            }
        },
        [address, isVaultAvailable, getSccConfig, writeContract],
    );

    // Read functions
    const getUserLoans = useCallback(async (): Promise<bigint[]> => {
        return (userLoansData as bigint[]) || [];
    }, [userLoansData]);

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
        async (tokenId: bigint): Promise<VaultLoan | null> => {
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
                  address: undefined as any,
                  abi: [],
                  functionName: "loans",
              },
    );

    const loan: VaultLoan | null = loanData
        ? {
              tokenId,
              borrower: (loanData as any[])[0] as string,
              active: (loanData as any[])[1] as boolean,
          }
        : null;

    return {
        loan,
        isInVault: loan?.active || false,
        borrower: loan?.borrower || null,
    };
}
