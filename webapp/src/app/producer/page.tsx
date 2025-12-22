"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { getAstaVerdeContract } from "@/config/contracts";
import { formatUnits } from "viem";
import { useState, useEffect } from "react";
import { customToast } from "@/utils/customToast";
import { useRouter } from "next/navigation";
import { useIsProducer } from "@/hooks/useIsProducer";
import { useProducerDashboardEvents } from "@/hooks/useProducerEvents";
import { dispatchBalancesRefetch } from "@/hooks/useGlobalEvent";
import Loader from "@/components/Loader";
import { ENV } from "@/config/environment";

export default function ProducerDashboard() {
  const astaverdeContractConfig = getAstaVerdeContract();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { isProducer, producerBalance, isLoading: isCheckingProducer, refetch: refetchProducerStatus } = useIsProducer();
  const [isClaiming, setIsClaiming] = useState(false);

  // Hook for producer events monitoring
  const { recentAccruals, recentClaims, totalAccrued, hasUnclaimedPayments, triggerRefetch } = useProducerDashboardEvents();

  // Get total producer balances for context
  const { data: totalProducerBalances } = useReadContract({
    ...astaverdeContractConfig,
    functionName: "totalProducerBalances",
  });

  // Get platform share accumulated for comparison
  const { data: platformShareAccumulated } = useReadContract({
    ...astaverdeContractConfig,
    functionName: "platformShareAccumulated",
  });

  // Write contract for claiming funds
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Redirect non-producers
  useEffect(() => {
    if (!isCheckingProducer && isConnected && !isProducer) {
      customToast.error("This page is only accessible to producers");
      router.push("/");
    }
  }, [isCheckingProducer, isConnected, isProducer, router]);

  // Handle successful claim
  useEffect(() => {
    if (isSuccess && isClaiming) {
      customToast.success("Funds claimed successfully!");
      setIsClaiming(false);
      refetchProducerStatus();
      dispatchBalancesRefetch();
    }
  }, [isSuccess, isClaiming, refetchProducerStatus]);

  // Refetch balance when events trigger
  useEffect(() => {
    if (triggerRefetch > 0) {
      refetchProducerStatus();
    }
  }, [triggerRefetch, refetchProducerStatus]);

  // Handle claim errors
  useEffect(() => {
    if (error) {
      customToast.error(error.message || "Failed to claim funds");
      setIsClaiming(false);
    }
  }, [error]);

  const handleClaimFunds = async () => {
    if (!producerBalance || producerBalance === 0n) {
      customToast.error("No funds to claim");
      return;
    }

    try {
      setIsClaiming(true);
      writeContract({
        ...astaverdeContractConfig,
        functionName: "claimProducerFunds",
        args: [],
      });
    } catch (err) {
      console.error("Error claiming funds:", err);
      customToast.error("Failed to initiate claim");
      setIsClaiming(false);
    }
  };

  // Loading state
  if (isCheckingProducer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Producer Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Please connect your wallet to access the producer dashboard</p>
        </div>
      </div>
    );
  }

  // Not a producer (shouldn't reach here due to redirect, but just in case)
  if (!isProducer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400">This dashboard is only accessible to producers</p>
        </div>
      </div>
    );
  }

  const formattedBalance = producerBalance ? formatUnits(producerBalance as bigint, ENV.USDC_DECIMALS) : "0";
  const formattedTotalProducer = totalProducerBalances ? formatUnits(totalProducerBalances as bigint, ENV.USDC_DECIMALS) : "0";
  const formattedPlatform = platformShareAccumulated ? formatUnits(platformShareAccumulated as bigint, ENV.USDC_DECIMALS) : "0";

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Producer Dashboard</h1>

        {/* Main Balance Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200">
            Your Claimable Balance
          </h2>

          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-5xl font-bold text-emerald-600 dark:text-emerald-400">
                {formattedBalance} USDC
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Available for withdrawal
              </p>
            </div>

            <button
              onClick={handleClaimFunds}
              disabled={!producerBalance || (producerBalance as bigint) === 0n || isPending || isConfirming}
              className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200
                ${producerBalance && (producerBalance as bigint) > 0n && !isPending && !isConfirming
      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
      : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
    }`}
            >
              {isPending || isConfirming ? (
                <span className="flex items-center gap-2">
                  <Loader />
                  {isConfirming ? "Confirming..." : "Processing..."}
                </span>
              ) : (
                "Claim Funds"
              )}
            </button>
          </div>

          {/* Progress Bar */}
          {producerBalance && totalProducerBalances && (totalProducerBalances as bigint) > 0n && (
            <div className="mt-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Your share of total producer balances
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-emerald-600 dark:bg-emerald-400 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (Number(producerBalance) / Number(totalProducerBalances)) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {((Number(producerBalance) / Number(totalProducerBalances)) * 100).toFixed(2)}% of total
              </p>
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Your Balance Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Your Balance
            </h3>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {formattedBalance} USDC
            </p>
            {hasUnclaimedPayments && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                + {formatUnits(totalAccrued, ENV.USDC_DECIMALS)} USDC pending
              </p>
            )}
          </div>

          {/* Total Producer Pool */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Total Producer Pool
            </h3>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {formattedTotalProducer} USDC
            </p>
          </div>

          {/* Platform Fees (for context) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Platform Fees Collected
            </h3>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {formattedPlatform} USDC
            </p>
          </div>
        </div>

        {/* Recent Activity Section */}
        {(recentAccruals.length > 0 || recentClaims.length > 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
              Recent Activity
            </h3>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {recentAccruals.map((event, index) => (
                <div key={`accrual-${index}`} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Payment accrued
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    +{formatUnits(event.amount, ENV.USDC_DECIMALS)} USDC
                  </span>
                </div>
              ))}
              {recentClaims.map((event, index) => (
                <div key={`claim-${index}`} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Funds claimed
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    {formatUnits(event.amount, ENV.USDC_DECIMALS)} USDC
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Information Section */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold mb-3 text-blue-900 dark:text-blue-100">
            How Producer Payments Work
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>Payments are accumulated from sales of your carbon offset NFTs</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>You receive 70% of the sale price (platform takes 30% fee)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>Funds are held securely in the smart contract until you claim them</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>You can claim your balance at any time with no minimum threshold</span>
            </li>
          </ul>
        </div>

        {/* Connected Wallet Info */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Connected as: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
        </div>
      </div>
    </div>
  );
}
