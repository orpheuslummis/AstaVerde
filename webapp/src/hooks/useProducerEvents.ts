import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useContractEvents } from "./useContractEvents";
import { useRateLimitedPublicClient } from "./useRateLimitedPublicClient";
import { customToast } from "@/utils/customToast";
import { ENV } from "@/config/environment";
import type {
  ProducerPaymentAccruedEvent,
  ProducerPaymentClaimedEvent,
} from "@/features/events/eventTypes";
import { EVENT_NAMES } from "@/features/events/eventTypes";

interface ProducerEventsConfig {
  onBalanceUpdate?: () => void;
  showToasts?: boolean;
  enabled?: boolean;
}

/**
 * Hook for monitoring producer payment events
 * Listens for ProducerPaymentAccrued and ProducerPaymentClaimed events
 * @param config Configuration options
 */
export function useProducerEvents({
  onBalanceUpdate,
  showToasts = true,
  enabled = true,
}: ProducerEventsConfig = {}) {
  const { address } = useAccount();
  const publicClient = useRateLimitedPublicClient();
  const [recentAccruals, setRecentAccruals] = useState<ProducerPaymentAccruedEvent[]>([]);
  const [recentClaims, setRecentClaims] = useState<ProducerPaymentClaimedEvent[]>([]);
  const [totalAccrued, setTotalAccrued] = useState<bigint>(0n);
  const [totalClaimed, setTotalClaimed] = useState<bigint>(0n);
  const lastPolledBlockRef = useRef<bigint | null>(null);

  // Handle ProducerPaymentAccrued events
  const handlePaymentAccrued = useCallback(
    (event: ProducerPaymentAccruedEvent) => {
      // Only process events for the current user
      if (address && event.producer.toLowerCase() === address.toLowerCase()) {
        setRecentAccruals((prev) => [...prev.slice(-9), event]); // Keep last 10
        setTotalAccrued((prev) => prev + event.amount);

        if (showToasts) {
          const formattedAmount = formatUnits(event.amount, ENV.USDC_DECIMALS);
          customToast.success(`Payment accrued: +${formattedAmount} USDC`, {
            duration: 4000,
          });
        }

        // Trigger balance update callback
        onBalanceUpdate?.();
      }
    },
    [address, showToasts, onBalanceUpdate],
  );

  // Handle ProducerPaymentClaimed events
  const handlePaymentClaimed = useCallback(
    (event: ProducerPaymentClaimedEvent) => {
      // Only process events for the current user
      if (address && event.producer.toLowerCase() === address.toLowerCase()) {
        setRecentClaims((prev) => [...prev.slice(-9), event]); // Keep last 10
        setTotalClaimed((prev) => prev + event.amount);

        if (showToasts) {
          const formattedAmount = formatUnits(event.amount, ENV.USDC_DECIMALS);
          customToast.success(
            `Successfully claimed ${formattedAmount} USDC`,
            {
              duration: 5000,
              icon: "💰",
            },
          );
        }

        // Reset accruals since they've been claimed
        setRecentAccruals([]);
        setTotalAccrued(0n);

        // Trigger balance update callback
        onBalanceUpdate?.();
      }
    },
    [address, showToasts, onBalanceUpdate],
  );

  // Watch for ProducerPaymentAccrued events
  const { fetchHistoricalEvents: fetchAccruedHistory } = useContractEvents<ProducerPaymentAccruedEvent>({
    eventName: EVENT_NAMES.ProducerPaymentAccrued,
    onEvent: handlePaymentAccrued,
    enabled: enabled && !!address,
    watchEnabled: false,
  });

  // Watch for ProducerPaymentClaimed events
  const { fetchHistoricalEvents: fetchClaimedHistory } = useContractEvents<ProducerPaymentClaimedEvent>({
    eventName: EVENT_NAMES.ProducerPaymentClaimed,
    onEvent: handlePaymentClaimed,
    enabled: enabled && !!address,
    watchEnabled: false,
  });

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Lightweight polling to keep producer balances current without hammering RPC
  useEffect(() => {
    if (!enabled || !address || !publicClient) return;

    const logQueryGapMs = publicClient.chain?.id === 31337 ? 120 : 1_100;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let isFetching = false;

    const loadRecentEvents = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        const latest = await publicClient.getBlockNumber();
        const fromBlock =
          lastPolledBlockRef.current !== null
            ? lastPolledBlockRef.current + 1n
            : latest > 12n
              ? latest - 12n
              : 0n;
        const toBlock = latest;

        const accruals = await fetchAccruedHistory(fromBlock, toBlock);
        await delay(logQueryGapMs);
        const claims = await fetchClaimedHistory(fromBlock, toBlock);

        if (cancelled) return;

        accruals.forEach(({ data }) => {
          if (data && data.producer.toLowerCase() === address.toLowerCase()) {
            handlePaymentAccrued(data);
          }
        });

        claims.forEach(({ data }) => {
          if (data && data.producer.toLowerCase() === address.toLowerCase()) {
            handlePaymentClaimed(data);
          }
        });

        lastPolledBlockRef.current = toBlock;
      } catch (error) {
        console.error("Error loading historical producer events:", error);
      } finally {
        isFetching = false;
      }
    };

    void loadRecentEvents();
    pollTimer = setInterval(() => {
      void loadRecentEvents();
    }, 45000);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [enabled, address, publicClient, fetchAccruedHistory, fetchClaimedHistory, handlePaymentAccrued, handlePaymentClaimed]);

  // Clear state when account changes
  useEffect(() => {
    lastPolledBlockRef.current = null;
    setRecentAccruals([]);
    setRecentClaims([]);
    setTotalAccrued(0n);
    setTotalClaimed(0n);
  }, [address]);

  return {
    recentAccruals,
    recentClaims,
    totalAccrued,
    totalClaimed,
    hasUnclaimedPayments: totalAccrued > 0n,
  };
}

/**
 * Hook specifically for the producer dashboard
 * Provides simplified interface for producer payment tracking
 */
export function useProducerDashboardEvents() {
  const [shouldRefetch, setShouldRefetch] = useState(0);

  const handleBalanceUpdate = useCallback(() => {
    // Trigger a refetch of producer balance
    setShouldRefetch((prev) => prev + 1);
  }, []);

  const events = useProducerEvents({
    onBalanceUpdate: handleBalanceUpdate,
    showToasts: true,
  });

  return {
    ...events,
    triggerRefetch: shouldRefetch,
  };
}
