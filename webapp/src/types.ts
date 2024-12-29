import type { Abi } from "abitype";
import type { Batch } from "./lib/batch";
import type {
  astaverdeContractConfig,
  getUsdcContractConfig,
} from "./lib/contracts";

export type BatchData = [
  bigint, // batchId
  bigint[], // tokenIds
  bigint, // creationTime
  bigint, // price
  bigint, // itemsLeft (or remainingTokens)
];

export interface BatchParams {
  id: string;
}

export interface TokenMetadata {
  name: string;
  description: string;
  producer_address: string;
  image: File | null;
}

export interface AppContextType {
  batches: Batch[];
  astaverdeContractConfig: typeof astaverdeContractConfig;
  getUsdcContractConfig: typeof getUsdcContractConfig;
  usdcContractConfig: ReturnType<typeof getUsdcContractConfig>;
  refetchBatches: () => void;
  updateBatch: (updatedBatch: Batch) => void;
  updateBatchItemsLeft: (batchId: bigint, newItemsLeft: bigint) => void;
  adminControls: AdminControls;
  getCurrentBatchPrice: (batchId: number) => Promise<bigint>;
  buyBatch: (
    batchId: number,
    usdcAmount: bigint,
    tokenAmount: number,
  ) => Promise<string>;
  redeemToken: (tokenId: bigint) => Promise<string>;
  updateBasePrice: () => Promise<string>;
  getBatchInfo: (batchId: number) => Promise<BatchInfoProps["batchData"]>;
  isAdmin: boolean;
}

export interface WalletContextType {
  isConnected: boolean;
  address: string | undefined;
  connect: () => void;
  disconnect: () => void;
  chainId: number | undefined;
  chainName: string | undefined;
}

export interface TokenData {
  0: bigint; // Token ID
  1: string; // Producer
  2: string; // CID
  3: boolean; // Is redeemed
}

export interface BatchInfoProps {
  batchData: BatchData;
}

export interface ContractConfig {
  address: `0x${string}`;
  abi: Abi;
}

export interface BatchCardProps {
  batch: Batch;
  updateCard?: () => void;
  isSoldOut: boolean;
}

export interface RedeemTokensButtonProps {
  selectedTokens: bigint[];
  onRedeemComplete: () => void;
  onSelectAll: () => void;
  allTokens: bigint[];
  redeemStatus: Record<string, boolean>;
}

export type ExecuteFunction = (...args: unknown[]) => Promise<unknown>;

export type ContractError = Error | null;

export interface AdminControls {
  setPriceDelta: (amount: bigint) => Promise<string>;
  setDailyPriceDecay: (amount: bigint) => Promise<string>;
  pauseContract: () => Promise<string>;
  unpauseContract: () => Promise<string>;
  claimPlatformFunds: (recipient: string) => Promise<string>;
  setPriceFloor: (amount: string) => Promise<void>;
  setBasePrice: (amount: bigint) => Promise<void>;
  setMaxBatchSize: (size: bigint) => Promise<void>;
  setAuctionDayThresholds: (
    increase: string,
    decrease: string,
  ) => Promise<void>;
  setPlatformSharePercentage: (percentage: string) => Promise<void>;
  setURI: (uri: string) => Promise<void>;
  updateBasePrice: () => Promise<string>;
  mintBatch: (producers: string[], cids: string[]) => Promise<string>;
}
