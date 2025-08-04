"use client";

import { useState, useCallback, useEffect } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ECOSTABILIZER_CONTRACT_ADDRESS, SCC_CONTRACT_ADDRESS } from "../app.config";
import { useVault } from "../hooks/useVault";
import { getEcoStabilizerContractConfig } from "../lib/contracts";
import { customToast } from "../utils/customToast";

interface VaultCardProps {
  tokenId: bigint;
  isRedeemed: boolean;
  onActionComplete?: () => void;
}

export default function VaultCard({ tokenId, isRedeemed, onActionComplete }: VaultCardProps) {
  const { address } = useAccount();
  const {
    deposit,
    withdraw,
    repayAndWithdraw,
    approveNFT,
    approveSCC,
    getSccBalance,
    getSccAllowance,
    isVaultAvailable,
    isLoading: vaultLoading,
    error: vaultError
  } = useVault();

  const [sccBalance, setSccBalance] = useState<bigint>(0n);
  const [sccAllowance, setSccAllowance] = useState<bigint>(0n);
  const [isApproved, setIsApproved] = useState(false);
  
  // Check loan status for this specific token
  const { data: loanData } = useReadContract({
    ...(isVaultAvailable ? getEcoStabilizerContractConfig() : { address: undefined, abi: [] }),
    functionName: "loans",
    args: [tokenId],
    query: { enabled: isVaultAvailable && !!tokenId }
  });

  const isInVault = loanData ? (loanData as any[])[1] : false; // active boolean is at index 1
  const borrower = loanData ? (loanData as any[])[0] : null; // borrower address is at index 0

  // Check if current user is the borrower (for security)
  const isCurrentUserBorrower = borrower === address;

  // Load balances and allowances
  useEffect(() => {
    const loadData = async () => {
      try {
        const balance = await getSccBalance();
        const allowance = await getSccAllowance();
        setSccBalance(balance);
        setSccAllowance(allowance);
        setIsApproved(allowance >= parseEther("20"));
      } catch (error) {
        console.error("Error loading vault data:", error);
      }
    };

    if (address && isVaultAvailable) {
      loadData();
    }
  }, [address, isVaultAvailable, getSccBalance, getSccAllowance]);

  const handleDeposit = useCallback(async () => {
    try {
      // First check if NFT needs approval
      // This would require checking isApprovedForAll - for now we'll just try to approve
      await approveNFT();
      await deposit(tokenId);
      onActionComplete?.();
    } catch (err) {
      console.error("Deposit failed:", err);
      // Error is already handled in useVault hook
    }
  }, [tokenId, deposit, approveNFT, onActionComplete]);

  const handleWithdraw = useCallback(async () => {
    try {
      // Check if SCC allowance is sufficient
      if (sccAllowance < parseEther("20")) {
        await approveSCC();
      }
      await withdraw(tokenId);
      onActionComplete?.();
    } catch (err) {
      console.error("Withdraw failed:", err);
      // Error is already handled in useVault hook
    }
  }, [tokenId, withdraw, approveSCC, sccAllowance, onActionComplete]);

  const handleRepayAndWithdraw = useCallback(async () => {
    try {
      // Check if SCC allowance is sufficient
      if (sccAllowance < parseEther("20")) {
        await approveSCC();
      }
      await repayAndWithdraw(tokenId);
      onActionComplete?.();
    } catch (err) {
      console.error("Repay and withdraw failed:", err);
      // Error is already handled in useVault hook
    }
  }, [tokenId, repayAndWithdraw, approveSCC, sccAllowance, onActionComplete]);

  // Don't show vault options for redeemed tokens
  if (isRedeemed) {
    return (
      <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          ⚠️ Redeemed tokens cannot be used as collateral
        </p>
      </div>
    );
  }

  // Don't show if vault is not available
  if (!isVaultAvailable) {
    return (
      <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          💡 Vault functionality coming soon! Configure ECOSTABILIZER_ADDRESS and SCC_ADDRESS environment variables.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
          🏦 Vault Options
        </h3>
        <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
          SCC: {formatEther(sccBalance)}
        </span>
      </div>

      {vaultError && (
        <div className="mb-3 p-2 bg-red-100 dark:bg-red-900 rounded text-red-800 dark:text-red-200 text-sm">
          {vaultError}
        </div>
      )}

      {!isInVault ? (
        <div className="space-y-3">
          <div className="text-sm text-emerald-700 dark:text-emerald-300">
            💰 Get instant liquidity! Deposit this NFT to receive <strong>20 SCC</strong> tokens.
          </div>
          
          <button
            onClick={handleDeposit}
            disabled={vaultLoading}
            className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {vaultLoading ? "Processing..." : "🏦 Deposit & Get 20 SCC"}
          </button>
          
          <div className="text-xs text-emerald-600 dark:text-emerald-400">
            ✓ No liquidation risk • ✓ Get your exact NFT back • ✓ Fixed 20 SCC loan
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {isCurrentUserBorrower ? (
            <>
              <div className="text-sm text-emerald-700 dark:text-emerald-300">
                🔒 This NFT is deposited in the vault. You have a 20 SCC loan against it.
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={handleWithdraw}
                  disabled={vaultLoading || sccBalance < parseEther("20")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  {vaultLoading ? "Processing..." : "💰 Withdraw NFT (Burn 20 SCC)"}
                </button>
                
                <button
                  onClick={handleRepayAndWithdraw}
                  disabled={vaultLoading || sccBalance < parseEther("20")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  {vaultLoading ? "Processing..." : "🔄 Repay & Withdraw"}
                </button>
              </div>
              
              {sccBalance < parseEther("20") && (
                <div className="text-xs text-red-600 dark:text-red-400">
                  ⚠️ You need 20 SCC to withdraw your NFT
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-amber-700 dark:text-amber-300">
              🔒 This NFT is deposited in the vault by another user.
            </div>
          )}
        </div>
      )}
      
      <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
        <div className="text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
          <div>• Your NFT is safe - only you can withdraw it</div>
          <div>• No interest or fees on the loan</div>
          <div>• Trade SCC on DEXs for other tokens</div>
        </div>
      </div>
    </div>
  );
} 