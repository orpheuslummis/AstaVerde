import type { Log } from "viem";

// Event type definitions matching AstaVerde v2 contract events

export interface ProducerPaymentAccruedEvent {
  producer: `0x${string}`;
  amount: bigint;
}

export interface ProducerPaymentClaimedEvent {
  producer: `0x${string}`;
  amount: bigint;
}

export interface PriceUpdateIterationLimitReachedEvent {
  batchesProcessed: bigint;
  totalBatches: bigint;
}

export interface BatchMarkedUsedInPriceDecreaseEvent {
  batchId: bigint;
  timestamp: bigint;
}

export interface SurplusUSDCRecoveredEvent {
  to: `0x${string}`;
  amount: bigint;
}

// Event names as defined in the contract
export const EVENT_NAMES = {
  ProducerPaymentAccrued: "ProducerPaymentAccrued",
  ProducerPaymentClaimed: "ProducerPaymentClaimed",
  PriceUpdateIterationLimitReached: "PriceUpdateIterationLimitReached",
  BatchMarkedUsedInPriceDecrease: "BatchMarkedUsedInPriceDecrease",
  SurplusUSDCRecovered: "SurplusUSDCRecovered",
} as const;

// Helper type for event callbacks
export type EventCallback<T> = (event: T, log: Log) => void;

// Event filter options
export interface EventFilterOptions {
  fromBlock?: bigint | "latest" | "earliest" | "pending";
  toBlock?: bigint | "latest" | "earliest" | "pending";
  address?: `0x${string}`;
}
