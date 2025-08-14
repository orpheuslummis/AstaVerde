"use client";

import { useState, useCallback, useEffect } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ECOSTABILIZER_CONTRACT_ADDRESS, SCC_CONTRACT_ADDRESS } from "../app.config";
import { useVault } from "../hooks/useVault";
import { getEcoStabilizerContractConfig } from "../lib/contracts";
import { customToast } from "../utils/customToast";
import { VaultErrorDisplay, CompactErrorDisplay } from "./VaultErrorDisplay";
import { TxStatus, getTransactionStatusMessage } from "../utils/errors";

interface VaultCardProps {
  tokenId: bigint;
  isRedeemed: boolean;
  onActionComplete?: () => void;
  isCompact?: boolean;
}

export default function VaultCard({ tokenId, isRedeemed, onActionComplete, isCompact = true }: VaultCardProps) {
  const { address } = useAccount();
  const {
    deposit,
    withdraw,
    repayAndWithdraw,
    approveNFT,
    approveSCC,
    getSccBalance,
    getSccAllowance,
    getIsNftApproved,
    isVaultAvailable,
    isLoading: vaultLoading,
    vaultError,
    txStatus,
    txHash,
    clearError
  } = useVault();

  const [isDepositLoading, setIsDepositLoading] = useState(false);
  const [isWithdrawLoading, setIsWithdrawLoading] = useState(false);
  const [sccBalance, setSccBalance] = useState<bigint>(0n);
  const [sccAllowance, setSccAllowance] = useState<bigint>(0n);
  const [isApproved, setIsApproved] = useState(false);
  const [isNftApproved, setIsNftApproved] = useState(false);
  
  const tokenIdStr = tokenId.toString();
  
  const [loanData, setLoanData] = useState<[string, boolean] | undefined>(undefined);
  const [isLoadingLoan, setIsLoadingLoan] = useState(false);
  
  useEffect(() => {
    if (!isVaultAvailable || !tokenIdStr) return;
    
    const fetchLoanData = async () => {
      setIsLoadingLoan(true);
      try {
        const { readContract } = await import('wagmi/actions');
        const { config } = await import('../wagmi');
        const contractConfig = getEcoStabilizerContractConfig();
        
        const data = await readContract(config, {
          ...contractConfig,
          functionName: "loans",
          args: [BigInt(tokenIdStr)],
        });
        
        setLoanData(data as [string, boolean]);
      } catch (error) {
        console.error("Error fetching loan data:", error);
      } finally {
        setIsLoadingLoan(false);
      }
    };
    
    fetchLoanData();
  }, [tokenIdStr, isVaultAvailable]);

  const loanInfo = loanData;
  const isInVault = loanInfo ? loanInfo[1] : false;
  const borrower = loanInfo ? loanInfo[0] : null;
  const isCurrentUserBorrower = borrower && address && 
    borrower.toLowerCase() === address.toLowerCase();

  useEffect(() => {
    const fetchBalances = async () => {
      if (!address || !isVaultAvailable) return;
      
      try {
        const balance = await getSccBalance(address);
        setSccBalance(balance);
        
        const allowance = await getSccAllowance(address);
        setSccAllowance(allowance);
        setIsApproved(allowance >= parseEther("20"));
      } catch (error) {
        console.error("Error fetching SCC balance/allowance:", error);
      }
    };
    
    fetchBalances();
  }, [address, isVaultAvailable, getSccBalance, getSccAllowance, isInVault]);

  useEffect(() => {
    const checkNftApproval = async () => {
      if (!address || !isVaultAvailable || !tokenId) return;
      
      try {
        const approved = await getIsNftApproved(address);
        setIsNftApproved(approved);
      } catch (error) {
        console.error("Error checking NFT approval:", error);
      }
    };
    
    checkNftApproval();
  }, [address, isVaultAvailable, tokenId, getIsNftApproved]);

  const handleDeposit = useCallback(async () => {
    if (!tokenId || isRedeemed) {
      customToast.error(isRedeemed ? "Cannot deposit redeemed tokens" : "Invalid token");
      return;
    }
    
    clearError();
    setIsDepositLoading(true);
    try {
      if (!isNftApproved) {
        customToast.info("Approving NFT for vault...");
        await approveNFT();
        setIsNftApproved(true);
      }
      
      await deposit(tokenId);
      
      if (address) {
        const newBalance = await getSccBalance(address);
        setSccBalance(newBalance);
      }
      
      if (onActionComplete) {
        onActionComplete();
      }
    } catch (error: any) {
      console.error("Deposit error:", error);
      // Error handling is now done in the hook
    } finally {
      setIsDepositLoading(false);
    }
  }, [tokenId, isRedeemed, isNftApproved, approveNFT, deposit, address, getSccBalance, onActionComplete, clearError]);

  const handleWithdraw = useCallback(async () => {
    if (!tokenId || !isInVault || !isCurrentUserBorrower) {
      customToast.error("Cannot withdraw this token");
      return;
    }
    
    clearError();
    setIsWithdrawLoading(true);
    try {
      const requiredScc = parseEther("20");
      
      if (sccBalance < requiredScc) {
        customToast.error("Insufficient SCC balance. You need 20 SCC to withdraw.");
        return;
      }
      
      if (!isApproved || sccAllowance < requiredScc) {
        customToast.info("Approving SCC for repayment...");
        await approveSCC(requiredScc);
        setIsApproved(true);
        setSccAllowance(requiredScc);
      }
      
      await repayAndWithdraw(tokenId);
      
      if (address) {
        const newBalance = await getSccBalance(address);
        setSccBalance(newBalance);
      }
      
      if (onActionComplete) {
        onActionComplete();
      }
    } catch (error: any) {
      console.error("Withdraw error:", error);
      // Error handling is now done in the hook
    } finally {
      setIsWithdrawLoading(false);
    }
  }, [tokenId, isInVault, isCurrentUserBorrower, sccBalance, isApproved, sccAllowance, 
      approveSCC, repayAndWithdraw, address, getSccBalance, onActionComplete, clearError]);

  if (!isVaultAvailable) {
    return null;
  }

  if (vaultLoading || isLoadingLoan) {
    return (
      <div className="animate-pulse h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
    );
  }

  // Show transaction status
  const showTxStatus = txStatus !== TxStatus.IDLE && txStatus !== TxStatus.ERROR;
  const txStatusMessage = getTransactionStatusMessage(txStatus);

  // Compact mode for list view
  if (isCompact) {
    if (vaultError) {
      return <CompactErrorDisplay error={vaultError} />;
    }

    if (showTxStatus) {
      return <span className="text-xs text-blue-600">{txStatusMessage}</span>;
    }

    if (isRedeemed) {
      return <span className="text-xs text-gray-500">Redeemed</span>;
    }

    if (isInVault) {
      if (!isCurrentUserBorrower) {
        return <span className="text-xs text-gray-500">In Vault (not yours)</span>;
      }
      
      return (
        <button
          onClick={handleWithdraw}
          disabled={isWithdrawLoading || vaultLoading || sccBalance < parseEther("20")}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 
                   text-white text-xs rounded-md transition-colors"
        >
          {isWithdrawLoading || vaultLoading ? "..." : sccBalance < parseEther("20") ? "Need 20 SCC" : "Withdraw"}
        </button>
      );
    }

    return (
      <button
        onClick={handleDeposit}
        disabled={isDepositLoading || vaultLoading}
        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 
                 text-white text-xs rounded-md transition-colors"
      >
        {isDepositLoading || vaultLoading ? "..." : "Deposit"}
      </button>
    );
  }

  // Full card mode (existing implementation)
  return (
    <div data-testid="vault-card" className="flex flex-col gap-3 p-4 border rounded-lg bg-white dark:bg-gray-800">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Vault Operations
        </h3>
        {isInVault && (
          <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 
                         dark:bg-emerald-900 dark:text-emerald-200 rounded-full">
            In Vault
          </span>
        )}
      </div>

      {/* Error Display */}
      {vaultError && (
        <VaultErrorDisplay 
          error={vaultError} 
          onDismiss={() => clearError()}
        />
      )}

      {/* Transaction Status */}
      {showTxStatus && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {txStatusMessage}
          </p>
          {txHash && txStatus === TxStatus.CONFIRMING && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
            >
              View on Explorer →
            </a>
          )}
        </div>
      )}

      {isRedeemed ? (
        <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Redeemed tokens cannot be deposited to the vault
          </p>
        </div>
      ) : isInVault ? (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              This NFT is deposited in the vault. You need 20 SCC to withdraw it.
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              Your SCC Balance: {formatEther(sccBalance)} SCC
            </p>
          </div>
          
          {isCurrentUserBorrower ? (
            <button
              data-testid="withdraw-button"
              onClick={handleWithdraw}
              disabled={isWithdrawLoading || vaultLoading || showTxStatus || sccBalance < parseEther("20")}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg 
                       hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                       transition-colors duration-200"
            >
              {isWithdrawLoading || vaultLoading || showTxStatus ? "Processing..." : 
               sccBalance < parseEther("20") ? "Insufficient SCC" : 
               "Repay 20 SCC & Withdraw"}
            </button>
          ) : (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Only the original depositor can withdraw this NFT
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded">
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              Deposit this NFT to receive 20 SCC tokens
            </p>
          </div>
          
          <button
            data-testid="deposit-button"
            onClick={handleDeposit}
            disabled={isDepositLoading || vaultLoading || showTxStatus}
            className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg 
                     hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                     transition-colors duration-200"
          >
            {isDepositLoading || vaultLoading || showTxStatus ? "Processing..." : "Deposit to Vault"}
          </button>
        </div>
      )}
    </div>
  );
}