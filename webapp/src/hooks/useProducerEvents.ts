import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useContractEvents } from "./useContractEvents";
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
  const [recentAccruals, setRecentAccruals] = useState<ProducerPaymentAccruedEvent[]>([]);
  const [recentClaims, setRecentClaims] = useState<ProducerPaymentClaimedEvent[]>([]);
  const [totalAccrued, setTotalAccrued] = useState<bigint>(0n);
  const [totalClaimed, setTotalClaimed] = useState<bigint>(0n);

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
  });

  // Watch for ProducerPaymentClaimed events
  const { fetchHistoricalEvents: fetchClaimedHistory } = useContractEvents<ProducerPaymentClaimedEvent>({
    eventName: EVENT_NAMES.ProducerPaymentClaimed,
    onEvent: handlePaymentClaimed,
    enabled: enabled && !!address,
  });

  // Load historical events on mount (last 100 blocks)
  useEffect(() => {
    if (!enabled || !address) return;

    const loadHistoricalEvents = async () => {
      try {
        // Fetch recent historical events (approximately last hour)
        const currentBlock = await window.ethereum?.request({
          method: "eth_blockNumber",
        });

        if (currentBlock) {
          const fromBlock = BigInt(currentBlock) - 100n; // Last ~100 blocks

          const accruals = await fetchAccruedHistory(fromBlock);
          const claims = await fetchClaimedHistory(fromBlock);

          // Process historical events
          accruals.forEach(({ data }) => {
            if (data && data.producer.toLowerCase() === address.toLowerCase()) {
              setRecentAccruals((prev) => [...prev, data]);
              setTotalAccrued((prev) => prev + data.amount);
            }
          });

          claims.forEach(({ data }) => {
            if (data && data.producer.toLowerCase() === address.toLowerCase()) {
              setRecentClaims((prev) => [...prev, data]);
              setTotalClaimed((prev) => prev + data.amount);
            }
          });
        }
      } catch (error) {
        console.error("Error loading historical producer events:", error);
      }
    };

    loadHistoricalEvents();
  }, [enabled, address, fetchAccruedHistory, fetchClaimedHistory]);

  // Clear state when account changes
  useEffect(() => {
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
