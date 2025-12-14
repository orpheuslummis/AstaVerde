"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { getAstaVerdeContract, getUsdcContract } from "@/config/contracts";
import { useAppContext } from "@/contexts/AppContext";
import { dispatchBalancesRefetch } from "@/hooks/useGlobalEvent";
import { customToast } from "@/utils/customToast";
import { formatUSDCWithUnit } from "@/shared/utils/format";
import type { PriceUpdateIterationLimitReachedEvent, SurplusUSDCRecoveredEvent } from "@/features/events/eventTypes";

function ControlContainer({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">{title}</h3>
      {children}
    </div>
  );
}

export function MaxPriceUpdateIterationsControl({
  highlightGasControl,
  lastIterationWarning,
}: {
  highlightGasControl: boolean;
  lastIterationWarning: PriceUpdateIterationLimitReachedEvent | null;
}) {
  const astaverdeContractConfig = getAstaVerdeContract();
  const { adminControls } = useAppContext();
  const [iterations, setIterations] = useState("");
  const { data: currentIterations, refetch: refetchIterations } = useReadContract({
    ...astaverdeContractConfig,
    functionName: "maxPriceUpdateIterations",
  });

  const handleSetIterations = async () => {
    if (iterations) {
      const iterationCount = Number(iterations);
      if (iterationCount < 1 || iterationCount > 1000) {
        customToast.error("Iterations must be between 1 and 1000");
        return;
      }
      try {
        await adminControls.setMaxPriceUpdateIterations(BigInt(iterationCount));
        customToast.success("Max price update iterations updated successfully");
        refetchIterations();
        setIterations("");
      } catch (error) {
        console.error("Error setting max price update iterations:", error);
        customToast.error("Failed to update max price update iterations");
      }
    }
  };

  return (
    <div className={`transition-all duration-500 ${highlightGasControl ? "ring-2 ring-yellow-500 ring-offset-2" : ""}`}>
      <ControlContainer title="Gas Optimization - Price Update Iterations">
        <div className="flex flex-col gap-4">
          {lastIterationWarning && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 text-sm">
              <p className="text-yellow-800 dark:text-yellow-200">
                {(() => {
                  const iterationsCompleted = Number(lastIterationWarning.batchesProcessed);
                  const batchesRemaining = Number(lastIterationWarning.totalBatches - lastIterationWarning.batchesProcessed);
                  return `⚠️ Recent iteration limit reached: ${iterationsCompleted} iterations completed, ${batchesRemaining} batches remaining`;
                })()}
              </p>
            </div>
          )}
          <div className="text-sm text-gray-600 dark:text-gray-400">
                      Controls the maximum iterations for price updates to prevent DoS attacks.
                      Lower values reduce gas costs but may delay price adjustments.
          </div>
          <input
            type="number"
            value={iterations}
            onChange={(e) => setIterations(e.target.value)}
            placeholder="Enter iterations (1-1000, default: 100)"
            className="w-full px-4 py-2 rounded-lg border border-gray-300
                             focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                             dark:border-gray-600 dark:bg-gray-700 dark:text-white
                             transition-all duration-200"
          />
          <button
            className="btn btn-primary w-full"
            disabled={!iterations}
            onClick={handleSetIterations}
          >
                    Set Max Iterations
          </button>
        </div>
        {currentIterations !== undefined && currentIterations !== null && (
          <div className="text-gray-600 dark:text-gray-300 mt-4">
                    Current Max Iterations: {currentIterations.toString()}
          </div>
        )}
      </ControlContainer>
    </div>
  );
}

export function RecoverSurplusUSDCControl({
  surplusRecoveryHistory = [],
}: {
  surplusRecoveryHistory?: SurplusUSDCRecoveredEvent[];
}) {
  const { address } = useAccount();
  const astaverdeContractConfig = getAstaVerdeContract();
  const usdcContractConfig = getUsdcContract();
  const { adminControls } = useAppContext();
  const [recipientAddress, setRecipientAddress] = useState("");

  // Get current balances for display
  const { data: platformShare } = useReadContract({
    ...astaverdeContractConfig,
    functionName: "platformShareAccumulated",
  });

  const { data: totalProducerBalances } = useReadContract({
    ...astaverdeContractConfig,
    functionName: "totalProducerBalances",
  });

  // Current USDC held by the marketplace contract
  const { data: contractBalance } = useReadContract({
    ...usdcContractConfig,
    functionName: "balanceOf",
    args: [astaverdeContractConfig.address],
  });

  const handleRecoverSurplus = async () => {
    if (!recipientAddress) {
      customToast.error("Please enter a recipient address");
      return;
    }

    // Basic address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      customToast.error("Invalid Ethereum address");
      return;
    }

    try {
      await adminControls.recoverSurplusUSDC(recipientAddress);
      if (address && recipientAddress.toLowerCase() === address.toLowerCase()) {
        dispatchBalancesRefetch();
      }
      customToast.success("Surplus USDC recovered successfully");
      setRecipientAddress("");
    } catch (error) {
      console.error("Error recovering surplus USDC:", error);
      customToast.error("Failed to recover surplus USDC - there may be no surplus");
    }
  };

  const accountedBalance = (platformShare as bigint || 0n) + (totalProducerBalances as bigint || 0n);
  const rawContractBal = (contractBalance as bigint) ?? 0n;
  const estimatedSurplus = rawContractBal > accountedBalance ? rawContractBal - accountedBalance : 0n;

  return (
    <ControlContainer title="Recover Surplus USDC">
      <div className="flex flex-col gap-4">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Owner-only sweep for unaccounted USDC held by the marketplace.
          Sends only the amount above what is already owed to the platform
          and producers (platformShareAccumulated + totalProducerBalances).
          Use this to recover accidental direct transfers to the contract
          address. Reverts if there is no surplus. Safe to use while paused.
        </div>

        {/* Balance Information */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Contract Balance:</span>
              <span className="font-medium">{formatUSDCWithUnit(contractBalance as bigint | undefined)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Platform Share:</span>
              <span className="font-medium">{formatUSDCWithUnit(platformShare as bigint | undefined)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Producer Balances:</span>
              <span className="font-medium">{formatUSDCWithUnit(totalProducerBalances as bigint | undefined)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-gray-600 dark:text-gray-400">Total Accounted:</span>
              <span className="font-semibold">{formatUSDCWithUnit(accountedBalance)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-gray-600 dark:text-gray-400">Estimated Recoverable:</span>
              <span className="font-semibold">{formatUSDCWithUnit(estimatedSurplus)}</span>
            </div>
          </div>
        </div>

        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="Recipient address (treasury multisig or refund 0x…)"
          className="w-full px-4 py-2 rounded-lg border border-gray-300
                             focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                             dark:border-gray-600 dark:bg-gray-700 dark:text-white
                             transition-all duration-200"
        />
        <button
          className="btn btn-warning w-full"
          disabled={!recipientAddress || estimatedSurplus === 0n}
          onClick={handleRecoverSurplus}
        >
                    Recover Surplus USDC
        </button>

        <div className="text-xs text-gray-600 dark:text-gray-400">
          Notes:
          - This does not withdraw platform fees or producer funds; it never reduces tracked balances.
          Use &quot;Claim Platform Funds&quot; for platform fees. Producers claim via their own flow.
          Avoid sending USDC directly to the contract; use the normal purchase flow instead.
        </div>
      </div>

      {/* Recent Recovery History */}
      {surplusRecoveryHistory.length > 0 && (
        <div className="mt-4 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Recent Recoveries:</p>
          <div className="space-y-1">
            {surplusRecoveryHistory.slice(-3).map((event, index) => (
              <div key={index} className="text-xs text-gray-500 dark:text-gray-500">
                {formatUSDCWithUnit(event.amount)} → {event.to.slice(0, 6)}...{event.to.slice(-4)}
              </div>
            ))}
          </div>
        </div>
      )}
    </ControlContainer>
  );
}
