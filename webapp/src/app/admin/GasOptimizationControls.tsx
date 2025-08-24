"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import { astaverdeContractConfig } from "@/lib/contracts";
import { useAppContext } from "@/contexts/AppContext";
import { customToast } from "@/utils/customToast";
import { formatUnits } from "viem";
import { ENV } from "@/config/environment";

function ControlContainer({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">{title}</h3>
      {children}
    </div>
  );
}

export function MaxPriceUpdateIterationsControl() {
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
    <ControlContainer title="Gas Optimization - Price Update Iterations">
      <div className="flex flex-col gap-4">
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
  );
}

export function RecoverSurplusUSDCControl() {
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
      customToast.success("Surplus USDC recovered successfully");
      setRecipientAddress("");
    } catch (error) {
      console.error("Error recovering surplus USDC:", error);
      customToast.error("Failed to recover surplus USDC - there may be no surplus");
    }
  };

  const formatBalance = (balance: bigint | undefined) => {
    if (balance === undefined) return "0";
    return formatUnits(balance, ENV.USDC_DECIMALS);
  };

  const accountedBalance = (platformShare as bigint || 0n) + (totalProducerBalances as bigint || 0n);

  return (
    <ControlContainer title="Recover Surplus USDC">
      <div className="flex flex-col gap-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
                    Recovers USDC sent directly to the contract (bypassing normal payment flow).
                    Only surplus above tracked balances can be recovered.
        </div>

        {/* Balance Information */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Platform Share:</span>
              <span className="font-medium">{formatBalance(platformShare as bigint | undefined)} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Producer Balances:</span>
              <span className="font-medium">{formatBalance(totalProducerBalances as bigint | undefined)} USDC</span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-gray-600 dark:text-gray-400">Total Accounted:</span>
              <span className="font-semibold">{formatBalance(accountedBalance)} USDC</span>
            </div>
          </div>
        </div>

        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="Enter recipient address (0x...)"
          className="w-full px-4 py-2 rounded-lg border border-gray-300
                             focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                             dark:border-gray-600 dark:bg-gray-700 dark:text-white
                             transition-all duration-200"
        />
        <button
          className="btn btn-warning w-full"
          disabled={!recipientAddress}
          onClick={handleRecoverSurplus}
        >
                    Recover Surplus USDC
        </button>
      </div>
    </ControlContainer>
  );
}
