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
    console.log("batchID", await this.astaVerde.lastBatchID());
    const cids = ["cid1", "cid2"];
    await this.astaVerde.mintBatch(this.signers.producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    console.log("batchID", batchID);
    const { tokenIds } = await this.astaVerde.getBatchInfo(batchID);
    expect(tokenIds.length).to.equal(2);
    // tokens are owned by contract at this point
    expect(await this.astaVerde.balanceOf(this.signers.admin.address, tokenIds[0])).to.equal(0);
  });

  it("should fail to mint a batch without producers", async function () {
    const cids: string[] = [];
    await expect(this.astaVerde.mintBatch(this.signers.producers, cids)).to.be.revertedWith("Mismatch between producers and cids lengths");
  });


  //   function testFail_MintBatchWithMismatchedProducersAndCids() public {
  //     address[] memory producers = new address[](1);
  //     producers[0] = address(this);
  //     string[] memory cids = new string[](0);
  //     bytes memory data = "";
  //     astaVerde.mintBatch(producers, cids, data);
  // }

  it("should fail to mint a batch with mismatched producers and cids", async function () {
    const cids = ["cid"];
    await expect(this.astaVerde.mintBatch(this.signers.producers, cids)).to.be.revertedWith("Mismatch between producers and cids lengths");
  });


  // function testFail_MintBatchWithBatchSizeTooLarge() public {
  //   address[] memory producers = new address[](51);
  //   string[] memory cids = new string[](51);
  //   bytes memory data = "";
  //   astaVerde.mintBatch(producers, cids, data);
  // }

  it("should fail to mint a batch with batch size too large", async function () {
    const cids = new Array(MAX_BATCH_SIZE + 1).fill("cid");
    await expect(this.astaVerde.mintBatch(this.signers.producers, cids)).to.be.revertedWith("Batch size exceeds max batch size");
  });


  //   function test_GetCurrentPrice() public {
  //     uint256 batchID = 1;
  //     uint256 expectedPrice = 230; // Assuming the starting price is 230
  //     assertEq(
  //         astaVerde.getCurrentPrice(batchID),
  //         expectedPrice,
  //         "Current price does not match expected price"
  //     );
  // }
  // it("should get current price", async function () {
  //   // const batchID = 0;
  //   // obtian latest batchId 
  //   const batchID = await this.astaVerde.lastBatchID();
  //   const expectedPrice = STARTING_PRICE;
  //   expect(await this.astaVerde.getCurrentPrice(batchID)).to.equal(expectedPrice);
  // });


  // test: mintBatch should increment
  it("should increment batchID after mintBatch", async function () {
    const cids = ["cid1", "cid2"];
    const batchIDprev = await this.astaVerde.lastBatchID();
    await this.astaVerde.mintBatch(this.signers.producers, cids);
    const batchID = await this.astaVerde.lastBatchID();
    expect(batchID).to.equal(batchIDprev + 1n);
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