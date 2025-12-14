import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { useContractEvents } from "./useContractEvents";
import { customToast } from "@/utils/customToast";
import { ENV } from "@/config/environment";
import { useRateLimitedPublicClient } from "./useRateLimitedPublicClient";
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const LOG_QUERY_GAP_MS = 1_100;

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
  enabled = false,
}: AdminEventsConfig = {}) {
  const publicClient = useRateLimitedPublicClient();
  const [iterationLimitEvents, setIterationLimitEvents] = useState<PriceUpdateIterationLimitReachedEvent[]>([]);
  const [batchUsageHistory, setBatchUsageHistory] = useState<BatchUsageRecord[]>([]);
  const [surplusRecoveryHistory, setSurplusRecoveryHistory] = useState<SurplusUSDCRecoveredEvent[]>([]);
  const [lastIterationWarning, setLastIterationWarning] = useState<PriceUpdateIterationLimitReachedEvent | null>(null);
  const [, setHistoryLoaded] = useState(false);

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
    watchEnabled: false,
    pollingIntervalMs: 30000,
  });

  // Watch for BatchMarkedUsedInPriceDecrease events
  const { fetchHistoricalEvents: fetchBatchHistory } = useContractEvents<BatchMarkedUsedInPriceDecreaseEvent>({
    eventName: EVENT_NAMES.BatchMarkedUsedInPriceDecrease,
    onEvent: handleBatchMarkedUsed,
    enabled,
    watchEnabled: false,
    pollingIntervalMs: 30000,
  });

  // Watch for SurplusUSDCRecovered events
  const { fetchHistoricalEvents: fetchSurplusHistory } = useContractEvents<SurplusUSDCRecoveredEvent>({
    eventName: EVENT_NAMES.SurplusUSDCRecovered,
    onEvent: handleSurplusRecovered,
    enabled,
    watchEnabled: false,
    pollingIntervalMs: 30000,
  });

  const lastPolledBlockRef = useRef<bigint | null>(null);
  const hasInitializedRef = useRef(false);

  // Lightweight polling of recent events to avoid RPC bursts
  useEffect(() => {
    if (!enabled || !publicClient) return;
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let isFetching = false;

    const loadHistoricalEvents = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        const latest = await publicClient.getBlockNumber();
        const fromBlock =
          lastPolledBlockRef.current !== null
            ? lastPolledBlockRef.current + 1n
            : latest > 6n
              ? latest - 6n
              : 0n;
        const toBlock = latest;

        const iterations = await fetchIterationHistory(fromBlock, toBlock);
        await delay(publicClient.chain?.id === 31337 ? 250 : LOG_QUERY_GAP_MS);
        const batches = await fetchBatchHistory(fromBlock, toBlock);
        await delay(publicClient.chain?.id === 31337 ? 250 : LOG_QUERY_GAP_MS);
        const surplus = await fetchSurplusHistory(fromBlock, toBlock);

        if (cancelled) return;

        // Process historical events
        iterations.forEach(({ data }) => {
          if (data) {
            handleIterationLimitReached(data);
          }
        });

        batches.forEach(({ data }) => {
          if (data) {
            handleBatchMarkedUsed(data);
          }
        });

        surplus.forEach(({ data }) => {
          if (data) {
            handleSurplusRecovered(data);
          }
        });

        setHistoryLoaded(true);
        lastPolledBlockRef.current = toBlock;
      } catch (error) {
        console.error("Error loading historical admin events:", error);
      } finally {
        isFetching = false;
      }
    };

    void loadHistoricalEvents();
    pollTimer = setInterval(() => {
      void loadHistoricalEvents();
    }, 180000);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [
    enabled,
    publicClient,
    fetchIterationHistory,
    fetchBatchHistory,
    fetchSurplusHistory,
    handleIterationLimitReached,
    handleBatchMarkedUsed,
    handleSurplusRecovered,
  ]);

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
export function useAdminDashboardEvents(enabled = true) {
  const [highlightGasControl, setHighlightGasControl] = useState(false);

  const handleIterationLimit = useCallback(() => {
    // Highlight the gas optimization control for 5 seconds
    setHighlightGasControl(true);
    setTimeout(() => setHighlightGasControl(false), 5000);
  }, []);

  const events = useAdminEvents({
    onIterationLimitReached: handleIterationLimit,
    showToasts: true,
    enabled,
  });

  return {
    ...events,
    highlightGasControl,
  };
}
