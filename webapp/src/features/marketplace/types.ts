import type { Batch } from "../../lib/batch";

export interface BatchCardProps {
    batch: Batch;
    updateCard?: () => void;
    isSoldOut: boolean;
}

export interface TokenData {
    0: bigint; // Token ID
    1: string; // Producer
    2: string; // CID
    3: boolean; // Is redeemed
}

export interface TokenMetadata {
    name: string;
    description: string;
    producer_address: string;
    image: File | null;
}

export interface BatchData {
    batchId: bigint;
    tokenIds: bigint[];
    creationTime: bigint;
    price: bigint;
    itemsLeft: bigint;
}

export interface RedeemTokensButtonProps {
    selectedTokens: bigint[];
    onRedeemComplete: () => void;
    onSelectAll: () => void;
    allTokens: bigint[];
    redeemStatus: Record<string, boolean>;
}

export interface MarketplaceOperations {
    buyBatch: (batchId: number, usdcAmount: bigint, tokenAmount: number) => Promise<string>;
    redeemToken: (tokenId: bigint) => Promise<string>;
    getCurrentBatchPrice: (batchId: number) => Promise<bigint>;
    getBatchInfo: (batchId: number) => Promise<BatchData>;
    getTokensOfOwner: (ownerAddress: string) => Promise<number[]>;
}
