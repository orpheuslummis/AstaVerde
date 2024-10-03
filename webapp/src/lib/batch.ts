import { IPFS_GATEWAY_URL } from "../app.config";

export class Batch {
    id: bigint;
    batchId: bigint;
    tokenIds: bigint[];
    creationTime: bigint;
    price: bigint;
    itemsLeft: bigint;
    cid: string;
    imageUrl?: string;

    constructor(batchId?: bigint, tokenIds?: bigint[], creationTime?: bigint, price?: bigint, itemsLeft = 0n) {
        this.id = batchId ?? 0n; 
        this.batchId = batchId ?? 0n;
        this.tokenIds = tokenIds ?? [];
        this.creationTime = creationTime ?? 0n;
        this.price = price ?? 0n;
        this.itemsLeft = itemsLeft;
        this.cid = "";
    }

    setBatchImageCID(cid: string) {
        this.cid = cid;
    }

    getBatchImageURL() {
        return IPFS_GATEWAY_URL + this.cid;
    }

    updateItemsLeft(newItemsLeft: bigint): Batch {
        return new Batch(
            this.batchId,
            this.tokenIds,
            this.creationTime,
            this.price,
            newItemsLeft
        );
    }
}
