import { useEffect, useRef, useCallback } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { decodeEventLog, type AbiEvent, type Abi, type Log } from "viem";
import { getAstaVerdeContract } from "@/config/contracts";
import type { EventCallback, EventFilterOptions } from "@/features/events/eventTypes";

interface UseContractEventsConfig<T> {
  eventName: string;
  onEvent?: EventCallback<T>;
  enabled?: boolean;
  filterOptions?: EventFilterOptions;
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
}: UseContractEventsConfig<T>) {
  const publicClient = usePublicClient();
  const contract = getAstaVerdeContract();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Parse event data from logs
  const parseEventData = useCallback((log: Log): T | null => {
    try {
      const contractAbi = contract.abi;
      const eventAbi = contractAbi.find(
        (item) => item.type === "event" && item.name === eventName,
      );

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
  }, [eventName, contract.abi, publicClient]);

  // Use wagmi's built-in event watcher
  useWatchContractEvent({
    address: contract.address as `0x${string}`,
    abi: contract.abi,
    eventName,
    enabled,
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
  });

  // Manual subscription for historical events
  const fetchHistoricalEvents = useCallback(
    async (fromBlock?: bigint, toBlock?: bigint) => {
      if (!publicClient || !enabled) return [];

      try {
        const eventAbi = contract.abi.find(
          (item) => item.type === "event" && item.name === eventName,
        ) as AbiEvent | undefined;

        if (!eventAbi) {
          console.error(`Event ${eventName} not found in ABI`);
          return [];
        }

        // Resolve numeric block bounds
        const latest = await publicClient.getBlockNumber();
        const start = (() => {
          if (typeof fromBlock === "bigint") return fromBlock < 0n ? 0n : fromBlock;
          return latest >= 499n ? latest - 499n : 0n;
        })();
        const end = toBlock ?? latest;

        // Alchemy and some providers restrict eth_getLogs window to ~500 blocks.
        // Chunk the range into windows of 500 blocks (inclusive) to stay under limits.
        const CHUNK_LEN = 500n; // inclusive block count
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
        }

        return results.filter((item) => item.data !== null);
      } catch (error) {
        console.error(`Error fetching historical ${eventName} events:`, error);
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
