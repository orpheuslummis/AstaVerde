import { expect } from "chai";

// constants
const MAX_BATCH_SIZE = 50;
const PLATFORM_SHARE_PERCENTAGE = 30;
const PRICE_DECREASE_RATE = 1;
const PRICE_FLOOR = 40;
const STARTING_PRICE = 230;

export function shouldBehaveLikeAstaVerde(): void {
  it("should reach basic deployment with default params", async function () {
    expect(await this.astaVerde.startingPrice()).to.equal(STARTING_PRICE);
    expect(await this.astaVerde.priceFloor()).to.equal(PRICE_FLOOR);
    expect(await this.astaVerde.priceDecreaseRate()).to.equal(PRICE_DECREASE_RATE);
    expect(await this.astaVerde.maxBatchSize()).to.equal(MAX_BATCH_SIZE);
    expect(await this.astaVerde.platformSharePercentage()).to.equal(PLATFORM_SHARE_PERCENTAGE);
  });

  it("should mint a batch and check token balance", async function () {
    const cids = ["cid1", "cid2"];
    await this.astaVerde.mintBatch(this.signers.producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    const { tokenIds } = await this.astaVerde.getBatchInfo(batchID);
    expect(tokenIds.length).to.equal(2);
    // tokens are owned by contract at this point
    expect(await this.astaVerde.balanceOf(this.signers.admin.address, tokenIds[0])).to.equal(0);
  });

  it("should fail to mint a batch without producers", async function () {
    const cids: string[] = [];
    await expect(this.astaVerde.mintBatch(this.signers.producers, cids)).to.be.revertedWith(
      "Mismatch between producers and cids lengths",
    );
  });

  it("should fail to mint a batch with mismatched producers and cids", async function () {
    const cids = ["cid"];
    await expect(this.astaVerde.mintBatch(this.signers.producers, cids)).to.be.revertedWith(
      "Mismatch between producers and cids lengths",
    );
  });

  it("should fail to mint a batch with batch size too large", async function () {
    const cids = new Array(MAX_BATCH_SIZE + 1).fill("cid");
    await expect(this.astaVerde.mintBatch(this.signers.producers, cids)).to.be.revertedWith(
      "Batch size exceeds max batch size",
    );
  });

  it("should get current price", async function () {
    const cids = ["cid1", "cid2"];
    await this.astaVerde.mintBatch(this.signers.producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    expect(await this.astaVerde.getCurrentPrice(batchID)).to.equal(STARTING_PRICE);
  });

  it("should increment batchID after mintBatch", async function () {
    const cids = ["cid1", "cid2"];
    await this.astaVerde.mintBatch(this.signers.producers, cids);
    const batchIDZero = await this.astaVerde.lastBatchID();
    await this.astaVerde.mintBatch(this.signers.producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    expect(batchID).to.equal(batchIDZero + 1n);
  });
}

// paying with a non-USDC token should fail

// paying with a USCD token should succeed

// TBD onlyOwner works

// mintBatch: should fail if not enough USDC

/*
it("should fail to mint a batch without producers", async function () {
const producers = [];
const cids = [];
const data = "";
await expect(this.astaVerde.mintBatch(producers, cids, data)).to.be.revertedWith("AstaVerde: producers and cids length mismatch");
});

it("should fail to mint a batch with mismatched producers and cids", async function () {
const producers = [this.signers.admin.address];
const cids = [];
const data = "";
await expect(this.astaVerde.mintBatch(producers, cids, data)).to.be.revertedWith("AstaVerde: producers and cids length mismatch");
});

it("should fail to mint a batch with batch size too large", async function () {
const producers = new Array(51).fill(this.signers.admin.address);
const cids = new Array(51).fill("cid");
const data = "";
await expect(this.astaVerde.mintBatch(producers, cids, data)).to.be.revertedWith("AstaVerde: batch size exceeds max batch size");
});

it("should fail to mint a batch with invalid producer address", async function () {
const producers = [ethers.constants.AddressZero];
const cids = ["cid"];
const data = "";
await expect(this.astaVerde.mintBatch(producers, cids, data)).to.be.revertedWith("AstaVerde: invalid producer address");
});
*/

// Helpers

// TBD
