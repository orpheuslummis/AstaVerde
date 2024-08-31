import { IPFS_GATEWAY_URL } from "../app.config";

export class Batch {
    id: number;
    token_ids: bigint[];
    timestamp: bigint;
    price: bigint;
    itemsLeft: number;
    cid: string;
    imageUrl?: string;

    constructor(
        id: number | bigint,
        token_ids: (number | bigint)[],
        timestamp: number | bigint,
        price: number | bigint,
        itemsLeft: number | bigint,
    ) {
        this.id = Number(id);
        this.token_ids = token_ids.map(BigInt);
        this.timestamp = BigInt(timestamp);
        this.price = BigInt(price);
        this.itemsLeft = Number(itemsLeft);
        this.cid = "";
    }

    setBatchImageCID(cid: string) {
        this.cid = cid;
    }

    getBatchImageURL() {
        return IPFS_GATEWAY_URL + this.cid;
    }

    updateItemsLeft(newItemsLeft: number): Batch {
        return new Batch(this.id, this.token_ids, this.timestamp, this.price, newItemsLeft);
    }
}
