import { useEffect, useRef, useCallback } from "react";
import { useWatchContractEvent } from "wagmi";
import { decodeEventLog, type AbiEvent, type Abi, type Log } from "viem";
import { getAstaVerdeContract } from "@/config/contracts";
import type { EventCallback, EventFilterOptions } from "@/features/events/eventTypes";
import { useRateLimitedPublicClient } from "./useRateLimitedPublicClient";

interface UseContractEventsConfig<T> {
  eventName: string;
  onEvent?: EventCallback<T>;
  enabled?: boolean;
  filterOptions?: EventFilterOptions;
  pollingIntervalMs?: number;
  watchEnabled?: boolean;
}

/**
 * Core hook for watching contract events with automatic cleanup and error handling
 * @param config Configuration for the event watcher
 * @returns Object with methods to control the event watcher
 */
export function useContractEvents<T>({
  eventName,
  onEvent,
  enabled = true,
  filterOptions,
  pollingIntervalMs = 5000,
  watchEnabled = true,
}: UseContractEventsConfig<T>) {
  const publicClient = useRateLimitedPublicClient();
  const contract = getAstaVerdeContract();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const cooldownUntilRef = useRef<number | null>(null);

  // Parse event data from logs
  const parseEventData = useCallback(
    (log: Log): T | null => {
      try {
        const contractAbi = contract.abi;
        const eventAbi = contractAbi.find((item) => item.type === "event" && item.name === eventName);

        if (!eventAbi || eventAbi.type !== "event") {
          console.error(`Event ${eventName} not found in ABI`);
          return null;
        }

        // Decode the log using viem's decodeEventLog
        const decoded = decodeEventLog({
          abi: [eventAbi],
          data: log.data,
          topics: log.topics,
        });

        return decoded?.args as T;
      } catch (error) {
        console.error(`Error parsing event ${eventName}:`, error);
        return null;
      }
    },
    [eventName, contract.abi],
  );

  // Use wagmi's built-in event watcher
  useWatchContractEvent({
    address: contract.address as `0x${string}`,
    abi: contract.abi,
    eventName,
    enabled: enabled && watchEnabled,
    onLogs: (logs) => {
      if (!onEvent) return;

      logs.forEach((log) => {
        const eventData = parseEventData(log);
        if (eventData) {
          onEvent(eventData, log);
        }
      });
    },
    // Additional options can be passed here
    ...(filterOptions?.fromBlock && { fromBlock: filterOptions.fromBlock }),
    pollingInterval: pollingIntervalMs,
  });

  // Manual subscription for historical events
  const fetchHistoricalEvents = useCallback(
    async (fromBlock?: bigint, toBlock?: bigint) => {
      if (!publicClient || !enabled) return [];

      const isRateLimitError = (err: unknown) => {
        const anyErr = err as any;
        const status = anyErr?.status ?? anyErr?.response?.status;
        const message = String(anyErr?.message || "");
        return status === 429 || message.includes("429") || message.toLowerCase().includes("too many");
      };

      // If we recently hit a rate limit, pause further reads until cooldown expires
      if (cooldownUntilRef.current && Date.now() < cooldownUntilRef.current) {
        return [];
      }

      try {
        const eventAbi = contract.abi.find((item) => item.type === "event" && item.name === eventName) as
          | AbiEvent
          | undefined;

        if (!eventAbi) {
          console.error(`Event ${eventName} not found in ABI`);
          return [];
        }

        // Resolve numeric block bounds. When explicit bounds are provided, avoid
        // extra RPC calls; otherwise fetch a latest block for a safe default window.
        let latest: bigint | null = null;
        if (typeof fromBlock !== "bigint" || typeof toBlock !== "bigint") {
          try {
            latest = await publicClient.getBlockNumber();
          } catch (err) {
            if (isRateLimitError(err)) {
              cooldownUntilRef.current = Date.now() + 5 * 60 * 1000;
            }
            throw err;
          }
        }
        const start = (() => {
          if (typeof fromBlock === "bigint") return fromBlock < 0n ? 0n : fromBlock;
          if (latest === null) return 0n;
          return latest >= 499n ? latest - 499n : 0n;
        })();
        const end = toBlock ?? latest ?? start;

        // Fetch logs in reasonably sized chunks to keep RPC count low without
        // requesting overly large block ranges (some providers cap `eth_getLogs`).
        const CHUNK_LEN = 120n; // inclusive block count
        const results: { data: T | null; log: Log }[] = [];

        let chunkStart = start;
        while (chunkStart <= end) {
          const chunkEnd = (() => {
            const candidate = chunkStart + (CHUNK_LEN - 1n);
            return candidate > end ? end : candidate;
          })();

          const chunkLogs = await publicClient.getContractEvents({
            address: (filterOptions?.address || contract.address) as `0x${string}`,
            abi: contract.abi as unknown as Abi,
            eventName: eventName as any,
            fromBlock: chunkStart,
            toBlock: chunkEnd,
          });

          for (const log of chunkLogs) {
            results.push({ data: parseEventData(log), log });
          }

          if (chunkEnd === end) break;
          chunkStart = chunkEnd + 1n;
          // Small pause to avoid bursting provider rate limits
          await new Promise((resolve) => setTimeout(resolve, 150));
        }

        return results.filter((item) => item.data !== null);
      } catch (error) {
        console.error(`Error fetching historical ${eventName} events:`, error);
        // Back off for 2 minutes on rate limit errors (HTTP 429)
        if (isRateLimitError(error)) {
          cooldownUntilRef.current = Date.now() + 2 * 60 * 1000;
        }
        return [];
      }
    },
    [publicClient, enabled, contract.address, eventName, filterOptions?.address, parseEventData],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  return {
    fetchHistoricalEvents,
  };
}

/**
 * Hook for watching multiple contract events
 * @param configs Array of event configurations
 */
// Note: A previous implementation attempted to call hooks inside a dynamic
// array `.map`, which violates React's rules-of-hooks and failed linting.
// If multiple event subscriptions are needed, create a dedicated hook that
// calls `useContractEvents` a fixed number of times, or compose watchers in a
// component with static call order.
