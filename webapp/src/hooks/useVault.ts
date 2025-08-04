import { useCallback, useMemo, useState } from "react";
import { parseEther, formatEther } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { 
  getEcoStabilizerContractConfig, 
  getSccContractConfig,
  astaverdeContractConfig 
} from "../lib/contracts";
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
  
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

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
  const { data: sccBalance } = useReadContract({
    ...(isVaultAvailable ? getSccContractConfig() : { address: undefined, abi: [] }),
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isVaultAvailable }
  });

  // Read user's SCC allowance to vault
  const { data: sccAllowance } = useReadContract({
    ...(isVaultAvailable ? getSccContractConfig() : { address: undefined, abi: [] }),
    functionName: "allowance",
    args: address && isVaultAvailable ? [address, ECOSTABILIZER_CONTRACT_ADDRESS] : undefined,
    query: { enabled: !!address && isVaultAvailable }
  });

  // Read user's loans
  const { data: userLoansData } = useReadContract({
    ...(isVaultAvailable ? getEcoStabilizerContractConfig() : { address: undefined, abi: [] }),
    functionName: "getUserLoans",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isVaultAvailable }
  });

  // Read total active loans
  const { data: totalActiveLoansData } = useReadContract({
    ...(isVaultAvailable ? getEcoStabilizerContractConfig() : { address: undefined, abi: [] }),
    functionName: "getTotalActiveLoans",
    query: { enabled: isVaultAvailable }
  });

  // Core vault functions
  const deposit = useCallback(async (tokenId: bigint) => {
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
  }, [address, isVaultAvailable, getVaultConfig, writeContract]);

  const withdraw = useCallback(async (tokenId: bigint) => {
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
  }, [address, isVaultAvailable, getVaultConfig, writeContract]);

  const repayAndWithdraw = useCallback(async (tokenId: bigint) => {
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
  }, [address, isVaultAvailable, getVaultConfig, writeContract]);

  // Approval functions
  const approveNFT = useCallback(async () => {
    if (!address || !isVaultAvailable) {
      throw new Error("Wallet not connected or vault not available");
    }

    try {
      setIsLoading(true);
      setError(null);

      customToast.info("Approving vault to transfer your NFTs...");
      
      writeContract({
        ...astaverdeContractConfig,
        functionName: "setApprovalForAll",
        args: [ECOSTABILIZER_CONTRACT_ADDRESS, true],
      });
      
      customToast.success("Successfully approved vault for NFT transfers!");
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to approve NFT transfers";
      setError(errorMessage);
      customToast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, isVaultAvailable, writeContract]);

  const approveSCC = useCallback(async (amount: bigint = SCC_PER_ASSET) => {
    if (!address || !isVaultAvailable) {
      throw new Error("Wallet not connected or vault not available");
    }

    try {
      setIsLoading(true);
      setError(null);

      const sccConfig = getSccConfig();
      
      customToast.info(`Approving ${formatEther(amount)} SCC for vault...`);
      
      writeContract({
        ...sccConfig,
        functionName: "approve",
        args: [ECOSTABILIZER_CONTRACT_ADDRESS, amount],
      });
      
      customToast.success(`Successfully approved ${formatEther(amount)} SCC!`);
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to approve SCC";
      setError(errorMessage);
      customToast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, isVaultAvailable, getSccConfig, writeContract]);

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

  const checkLoanStatus = useCallback(async (tokenId: bigint): Promise<VaultLoan | null> => {
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
  }, [isVaultAvailable]);

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
    
    // Approval functions
    approveNFT,
    approveSCC,
    
    // Status
    isVaultAvailable,
    isLoading: isLoading || isConfirming,
    error,
  };
}

// Helper hook for checking individual loan status
export function useLoanStatus(tokenId: bigint) {
  const { data: loanData } = useReadContract({
    ...(ECOSTABILIZER_CONTRACT_ADDRESS ? getEcoStabilizerContractConfig() : { address: undefined, abi: [] }),
    functionName: "loans",
    args: [tokenId],
    query: { enabled: !!ECOSTABILIZER_CONTRACT_ADDRESS && !!tokenId }
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