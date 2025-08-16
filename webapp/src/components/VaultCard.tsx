"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { readContract } from "wagmi/actions";
import { ENV } from "../config/environment";
import { wagmiConfig } from "../config/wagmi";
import { dispatchRefetch } from "../hooks/useGlobalEvent";
import { useVault } from "../hooks/useVault";
import { getEcoStabilizerContractConfig } from "../lib/contracts";
import { customToast } from "../shared/utils/customToast";
import { getTransactionStatusMessage, TxStatus } from "../utils/errors";
import { CompactErrorDisplay, VaultErrorDisplay } from "./VaultErrorDisplay";

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
    clearError,
  } = useVault();

  const [isDepositLoading, setIsDepositLoading] = useState(false);
  const [isWithdrawLoading, setIsWithdrawLoading] = useState(false);
  const [sccBalance, setSccBalance] = useState<bigint>(0n);
  const [sccAllowance, setSccAllowance] = useState<bigint>(0n);
  const [isApproved, setIsApproved] = useState(false);
  const [isNftApproved, setIsNftApproved] = useState(false);
  const [transactionStep, setTransactionStep] = useState<string>("");

  const tokenIdStr = tokenId.toString();

  const [loanData, setLoanData] = useState<[string, boolean] | undefined>(undefined);
  const [isLoadingLoan, setIsLoadingLoan] = useState(false);

  useEffect(() => {
    if (!isVaultAvailable || !tokenIdStr) return;

    const fetchLoanData = async () => {
      setIsLoadingLoan(true);
      try {
        const contractConfig = getEcoStabilizerContractConfig();

        const data = await readContract(wagmiConfig, {
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
  const isCurrentUserBorrower = borrower && address && borrower.toLowerCase() === address.toLowerCase();

  useEffect(() => {
    const fetchBalances = async () => {
      if (!address || !isVaultAvailable) return;

      try {
        const balance = await getSccBalance();
        setSccBalance(balance);

        const allowance = await getSccAllowance();
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
        const approved = await getIsNftApproved();
        setIsNftApproved(approved);
      } catch (error) {
        console.error("Error checking NFT approval:", error);
      }
    };

    checkNftApproval();
  }, [address, isVaultAvailable, tokenId, getIsNftApproved]);

  // Trigger parent refresh when a transaction succeeds and broadcast a global hint
  useEffect(() => {
    if (txStatus === TxStatus.SUCCESS) {
      if (onActionComplete) onActionComplete();
      dispatchRefetch();
    }
  }, [txStatus, onActionComplete]);

  const handleDeposit = useCallback(async () => {
    if (!tokenId || isRedeemed) {
      customToast.error(isRedeemed ? "Cannot deposit redeemed tokens" : "Invalid token");
      return;
    }

    clearError();
    setIsDepositLoading(true);
    try {
      if (!isNftApproved) {
        setTransactionStep("Approving NFT...");
        customToast.info("Step 1/2: Approving NFT for vault. Please confirm the approval transaction.", 8000);
        await approveNFT();
        setIsNftApproved(true);
        customToast.success("NFT approved! Now processing deposit...", 6000);
      }

      setTransactionStep("Depositing...");
      customToast.info("Step 2/2: Depositing NFT to vault. Please confirm the deposit transaction.", 8000);
      await deposit(tokenId);
      customToast.success("NFT deposited! You received 20 SCC tokens.", 6000);

      if (address) {
        const newBalance = await getSccBalance();
        setSccBalance(newBalance);
      }
    } catch (error: any) {
      console.error("Deposit error:", error);
      // Check if user cancelled the transaction
      if (error?.message?.includes("User rejected") || error?.message?.includes("User denied")) {
        customToast.info("Transaction cancelled");
      } else {
        customToast.error("Deposit failed. Please try again.");
      }
    } finally {
      setIsDepositLoading(false);
      setTransactionStep("");
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
        setTransactionStep("Approving SCC...");
        customToast.info("Step 1/2: Approving SCC for repayment. Please confirm the approval transaction.", 8000);
        await approveSCC(requiredScc);

        // Wait a moment for the approval to be processed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Re-fetch allowance to confirm approval went through
        const newAllowance = await getSccAllowance();
        setSccAllowance(newAllowance);
        setIsApproved(newAllowance >= requiredScc);
        customToast.success("SCC approved! Now processing withdrawal...", 6000);

        // Small delay to ensure state is updated
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Backward-compatible alias calls withdraw under the hood
      setTransactionStep("Withdrawing...");
      customToast.info("Step 2/2: Withdrawing NFT from vault. Please confirm the withdrawal transaction.", 8000);
      await withdraw(tokenId);
      customToast.success("NFT successfully withdrawn from vault!", 6000);

      if (address) {
        const newBalance = await getSccBalance();
        setSccBalance(newBalance);
      }
    } catch (error: any) {
      console.error("Withdraw error:", error);
      // Check if user cancelled the transaction
      if (error?.message?.includes("User rejected") || error?.message?.includes("User denied")) {
        customToast.info("Transaction cancelled");
      } else {
        customToast.error("Withdrawal failed. Please try again.");
      }
    } finally {
      setIsWithdrawLoading(false);
      setTransactionStep("");
    }
  }, [
    tokenId,
    isInVault,
    isCurrentUserBorrower,
    sccBalance,
    isApproved,
    sccAllowance,
    approveSCC,
    withdraw,
    address,
    getSccBalance,
    getSccAllowance,
    onActionComplete,
    clearError,
  ]);

  if (!isVaultAvailable) {
    return null;
  }

  if (vaultLoading || isLoadingLoan) {
    return <div className="animate-pulse h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>;
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
                   text-white text-xs rounded-md transition-colors min-w-[100px]"
          title={
            sccBalance < parseEther("20") ? "You need 20 SCC to withdraw" : "Withdraw NFT from vault (requires 20 SCC)"
          }
        >
          {isWithdrawLoading
            ? transactionStep || "Processing..."
            : vaultLoading
              ? "..."
              : sccBalance < parseEther("20")
                ? "Need 20 SCC"
                : "Withdraw"}
        </button>
      );
    }

    return (
      <button
        onClick={handleDeposit}
        disabled={isDepositLoading || vaultLoading}
        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 
                 text-white text-xs rounded-md transition-colors min-w-[100px]"
        title="Deposit NFT to vault to earn 20 SCC"
      >
        {isDepositLoading ? transactionStep || "Processing..." : vaultLoading ? "..." : "Deposit"}
      </button>
    );
  }

  // Full card mode (existing implementation)
  return (
    <div data-testid="vault-card" className="flex flex-col gap-3 p-4 border rounded-lg bg-white dark:bg-gray-800">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 dark:text-white">Vault Operations</h3>
        {isInVault && (
          <span
            className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 
                         dark:bg-emerald-900 dark:text-emerald-200 rounded-full"
          >
            In Vault
          </span>
        )}
      </div>

      {/* Error Display */}
      {vaultError && <VaultErrorDisplay error={vaultError} onDismiss={() => clearError()} />}

      {/* Transaction Status */}
      {showTxStatus && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
          <p className="text-sm text-blue-800 dark:text-blue-200">{txStatusMessage}</p>
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
          <p className="text-sm text-gray-600 dark:text-gray-300">Redeemed tokens cannot be deposited to the vault</p>
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
              {isWithdrawLoading || vaultLoading || showTxStatus
                ? "Processing..."
                : sccBalance < parseEther("20")
                  ? "Insufficient SCC"
                  : "Repay 20 SCC & Withdraw"}
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
            <p className="text-sm text-emerald-800 dark:text-emerald-200">Deposit this NFT to receive 20 SCC tokens</p>
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
