import { useCallback, useMemo, useState, useEffect } from "react";
import { parseEther, formatEther } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { getEcoStabilizerContractConfig, getSccContractConfig, astaverdeContractConfig } from "../lib/contracts";
import { customToast } from "../utils/customToast";
import { ECOSTABILIZER_CONTRACT_ADDRESS, SCC_CONTRACT_ADDRESS } from "../app.config";

export interface VaultLoan {
    tokenId: bigint;
    borrower: string;
    active: boolean;
}

export interface VaultHook {
    // Core functionality
    deposit: (tokenId: bigint) => Promise<void>;
    withdraw: (tokenId: bigint) => Promise<void>;
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
}

const SCC_PER_ASSET = parseEther("20");

export function useVault(): VaultHook {
    const { address } = useAccount();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { writeContract, data: hash, isPending: isTransactionPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed, error: txError } = useWaitForTransactionReceipt({ 
        hash,
        query: { enabled: !!hash }
    });

    // Check if vault contracts are available
    const isVaultAvailable = useMemo(() => {
        return !!(ECOSTABILIZER_CONTRACT_ADDRESS && SCC_CONTRACT_ADDRESS);
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
        args: address && isVaultAvailable ? [address, ECOSTABILIZER_CONTRACT_ADDRESS] : undefined,
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
        args: address && isVaultAvailable ? [address, ECOSTABILIZER_CONTRACT_ADDRESS] : undefined,
        query: { enabled: !!address && isVaultAvailable },
    });

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

    // Handle transaction success/error states
    useEffect(() => {
        if (isConfirmed && hash) {
            customToast.success("Transaction confirmed successfully!");
            setIsLoading(false);
            setError(null);
            // Refresh all data after successful transaction
            refreshContractData();
        }
        if (txError && hash) {
            const errorMessage = txError?.message || "Transaction failed";
            setError(errorMessage);
            customToast.error(errorMessage);
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

                const vaultConfig = getVaultConfig();

                customToast.info("Depositing NFT to vault...");

                writeContract({
                    ...vaultConfig,
                    functionName: "deposit",
                    args: [tokenId],
                });

                customToast.success(`Successfully deposited NFT #${tokenId} and received 20 SCC!`);
            } catch (err: any) {
                const errorMessage = err?.message || "Failed to deposit NFT";
                setError(errorMessage);
                customToast.error(errorMessage);
                throw err;
            } finally {
                setIsLoading(false);
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

                const vaultConfig = getVaultConfig();

                customToast.info("Withdrawing NFT from vault...");

                writeContract({
                    ...vaultConfig,
                    functionName: "withdraw",
                    args: [tokenId],
                });

                customToast.success(`Successfully withdrew NFT #${tokenId}!`);
            } catch (err: any) {
                const errorMessage = err?.message || "Failed to withdraw NFT";
                setError(errorMessage);
                customToast.error(errorMessage);
                throw err;
            } finally {
                setIsLoading(false);
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

                const vaultConfig = getVaultConfig();

                customToast.info("Repaying loan and withdrawing NFT...");

                writeContract({
                    ...vaultConfig,
                    functionName: "repayAndWithdraw",
                    args: [tokenId],
                });

                customToast.success(`Successfully repaid loan and withdrew NFT #${tokenId}!`);
            } catch (err: any) {
                const errorMessage = err?.message || "Failed to repay and withdraw NFT";
                setError(errorMessage);
                customToast.error(errorMessage);
                throw err;
            } finally {
                setIsLoading(false);
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
                args: [ECOSTABILIZER_CONTRACT_ADDRESS, true],
            });

            // Success handling moved to useEffect above
        } catch (err: any) {
            const errorMessage = err?.message || "Failed to approve NFT transfers";
            setError(errorMessage);
            customToast.error(errorMessage);
            throw err;
        } finally {
            setIsLoading(false);
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
                    args: [ECOSTABILIZER_CONTRACT_ADDRESS, amount],
                });

                // Success handling moved to useEffect above
            } catch (err: any) {
                const errorMessage = err?.message || "Failed to approve SCC";
                setError(errorMessage);
                customToast.error(errorMessage);
                throw err;
            } finally {
                setIsLoading(false);
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
    };
}

// Helper hook for checking individual loan status
export function useLoanStatus(tokenId: bigint) {
    const { data: loanData } = useReadContract({
        ...(ECOSTABILIZER_CONTRACT_ADDRESS ? getEcoStabilizerContractConfig() : { address: undefined, abi: [] }),
        functionName: "loans",
        args: [tokenId],
        query: { enabled: !!ECOSTABILIZER_CONTRACT_ADDRESS && !!tokenId },
    });

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
