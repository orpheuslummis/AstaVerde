import { IPFS_GATEWAY_URL } from "../app.config";

export class Batch {
    id: bigint;
    token_ids: bigint[];
    timestamp: bigint;
    price: bigint;
    itemsLeft: bigint;
    cid: string;
    imageUrl?: string;

    constructor(id: bigint, token_ids: bigint[], timestamp: bigint, price: bigint, itemsLeft: bigint) {
        this.id = id;
        this.token_ids = token_ids;
        this.timestamp = timestamp;
        this.price = price;
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
        return new Batch(this.id, this.token_ids, this.timestamp, this.price, newItemsLeft);
    }
}
