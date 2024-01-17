import { IPFS_GATEWAY_URL } from "../app.config";

export class Batch {
  id: number;
  token_ids: number[];
  timestamp: number;
  price: number;
  itemsLeft: number;
  cid: string;

  constructor(id: number, token_ids: number[], timestamp: number, price: number, itemsLeft: number) {
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
}
