import { useCallback, useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useContractEvents } from "./useContractEvents";
import { customToast } from "@/utils/customToast";
import { ENV } from "@/config/environment";
import type {
  PriceUpdateIterationLimitReachedEvent,
  BatchMarkedUsedInPriceDecreaseEvent,
  SurplusUSDCRecoveredEvent,
} from "@/features/events/eventTypes";
import { EVENT_NAMES } from "@/features/events/eventTypes";

interface AdminEventsConfig {
  onIterationLimitReached?: (event: PriceUpdateIterationLimitReachedEvent) => void;
  onBatchMarkedUsed?: (event: BatchMarkedUsedInPriceDecreaseEvent) => void;
  onSurplusRecovered?: (event: SurplusUSDCRecoveredEvent) => void;
  showToasts?: boolean;
  enabled?: boolean;
}

interface BatchUsageRecord {
  batchId: bigint;
  timestamp: number;
}

/**
 * Hook for monitoring admin-related contract events
 * Listens for price update limits, batch usage, and surplus recovery events
 * @param config Configuration options
 */
export function useAdminEvents({
  onIterationLimitReached,
  onBatchMarkedUsed,
  onSurplusRecovered,
  showToasts = true,
  enabled = true,
}: AdminEventsConfig = {}) {
  const [iterationLimitEvents, setIterationLimitEvents] = useState<PriceUpdateIterationLimitReachedEvent[]>([]);
  const [batchUsageHistory, setBatchUsageHistory] = useState<BatchUsageRecord[]>([]);
  const [surplusRecoveryHistory, setSurplusRecoveryHistory] = useState<SurplusUSDCRecoveredEvent[]>([]);
  const [lastIterationWarning, setLastIterationWarning] = useState<PriceUpdateIterationLimitReachedEvent | null>(null);

  // Handle PriceUpdateIterationLimitReached events
  const handleIterationLimitReached = useCallback(
    (event: PriceUpdateIterationLimitReachedEvent) => {
      setIterationLimitEvents((prev) => [...prev.slice(-9), event]); // Keep last 10
      setLastIterationWarning(event);

      if (showToasts) {
        const iterationsCompleted = Number(event.batchesProcessed);
        const batchesRemaining = Number(event.totalBatches - event.batchesProcessed);
        customToast.warning(
          `⚠️ Price update incomplete: ${iterationsCompleted} iterations completed, ${batchesRemaining} batches remaining`,
          { duration: 6000 },
        );
      }

      onIterationLimitReached?.(event);
    },
    [showToasts, onIterationLimitReached],
  );

  // Handle BatchMarkedUsedInPriceDecrease events
  const handleBatchMarkedUsed = useCallback(
    (event: BatchMarkedUsedInPriceDecreaseEvent) => {
      const record: BatchUsageRecord = {
        batchId: event.batchId,
        // on-chain timestamp is seconds; convert to ms for UI
        timestamp: Number(event.timestamp) * 1000,
      };

      setBatchUsageHistory((prev) => [...prev.slice(-49), record]); // Keep last 50

      if (showToasts) {
        customToast.info(`Batch #${event.batchId} used in price decrease.`, {
          duration: 4000,
        });
      }

      onBatchMarkedUsed?.(event);
    },
    [showToasts, onBatchMarkedUsed],
  );

  // Handle SurplusUSDCRecovered events
  const handleSurplusRecovered = useCallback(
    (event: SurplusUSDCRecoveredEvent) => {
      setSurplusRecoveryHistory((prev) => [...prev.slice(-9), event]); // Keep last 10

      if (showToasts) {
        const formattedAmount = formatUnits(event.amount, ENV.USDC_DECIMALS);
        const shortAddress = `${event.to.slice(0, 6)}...${event.to.slice(-4)}`;
        customToast.success(
          `✅ Surplus USDC recovered: ${formattedAmount} USDC sent to ${shortAddress}`,
          {
            duration: 5000,
          },
        );
      }

      onSurplusRecovered?.(event);
    },
    [showToasts, onSurplusRecovered],
  );

  // Watch for PriceUpdateIterationLimitReached events
  const { fetchHistoricalEvents: fetchIterationHistory } = useContractEvents<PriceUpdateIterationLimitReachedEvent>({
    eventName: EVENT_NAMES.PriceUpdateIterationLimitReached,
    onEvent: handleIterationLimitReached,
    enabled,
  });

  // Watch for BatchMarkedUsedInPriceDecrease events
  const { fetchHistoricalEvents: fetchBatchHistory } = useContractEvents<BatchMarkedUsedInPriceDecreaseEvent>({
    eventName: EVENT_NAMES.BatchMarkedUsedInPriceDecrease,
    onEvent: handleBatchMarkedUsed,
    enabled,
  });

  // Watch for SurplusUSDCRecovered events
  const { fetchHistoricalEvents: fetchSurplusHistory } = useContractEvents<SurplusUSDCRecoveredEvent>({
    eventName: EVENT_NAMES.SurplusUSDCRecovered,
    onEvent: handleSurplusRecovered,
    enabled,
  });

  // Load recent historical events on mount
  useEffect(() => {
    if (!enabled) return;

    const loadHistoricalEvents = async () => {
      try {
        // Fetch recent historical events with a small lookback that's
        // compatible with providers that limit eth_getLogs ranges.
        const currentBlock = await window.ethereum?.request({
          method: "eth_blockNumber",
        });

        if (currentBlock) {
          // Use a 50-block lookback (pairs with CHUNK_LEN=10 in useContractEvents)
          const fromBlock = BigInt(currentBlock) - 50n;

          const iterations = await fetchIterationHistory(fromBlock);
          const batches = await fetchBatchHistory(fromBlock);
          const surplus = await fetchSurplusHistory(fromBlock);

          // Process historical events
          iterations.forEach(({ data }) => {
            if (data) {
              setIterationLimitEvents((prev) => [...prev, data]);
              if (!lastIterationWarning) {
                setLastIterationWarning(data);
              }
            }
          });

          batches.forEach(({ data }) => {
            if (data) {
              setBatchUsageHistory((prev) => [
                ...prev,
                {
                  batchId: data.batchId,
                  timestamp: Number(data.timestamp) * 1000,
                },
              ]);
            }
          });

          surplus.forEach(({ data }) => {
            if (data) {
              setSurplusRecoveryHistory((prev) => [...prev, data]);
            }
          });
        }
      } catch (error) {
        console.error("Error loading historical admin events:", error);
      }
    };

    loadHistoricalEvents();
  }, [enabled, fetchIterationHistory, fetchBatchHistory, fetchSurplusHistory, lastIterationWarning]);

  // Calculate statistics
  const stats = {
    totalIterationWarnings: iterationLimitEvents.length,
    totalBatchesMarkedUsed: batchUsageHistory.length,
    totalSurplusRecoveries: surplusRecoveryHistory.length,
    totalSurplusRecovered: surplusRecoveryHistory.reduce(
      (sum, event) => sum + event.amount,
      0n,
    ),
  };

  return {
    iterationLimitEvents,
    batchUsageHistory,
    surplusRecoveryHistory,
    lastIterationWarning,
    stats,
    // Helper methods
    isBatchUsedInPriceDecrease: (batchId: bigint) => {
      return batchUsageHistory.some((record) => record.batchId === batchId);
    },
  };
}

/**
 * Hook specifically for the admin dashboard
 * Provides comprehensive admin event monitoring
 */
export function useAdminDashboardEvents() {
  const [highlightGasControl, setHighlightGasControl] = useState(false);

  const handleIterationLimit = useCallback(() => {
    // Highlight the gas optimization control for 5 seconds
    setHighlightGasControl(true);
    setTimeout(() => setHighlightGasControl(false), 5000);
  }, []);

  const events = useAdminEvents({
    onIterationLimitReached: handleIterationLimit,
    showToasts: true,
  });

  return {
    ...events,
    highlightGasControl,
  };
}
