import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { deployAstaVerdeFixture } from "./AstaVerde.fixture";
import { mintUSDC } from "./helpers";
import type { Signers } from "./types";

function shouldHelpersBeGood() {
  it("should mint a user one million USDC and assert its correctness", async function () {
    const user = this.signers.others[0];
    await mintUSDC(user, this.mockUSDC, 1000000n);
    const userBalance = await this.mockUSDC.balanceOf(user.address);
    expect(userBalance).to.equal(1000000n);
  });
}

describe("Helper tests", function () {
  before(async function () {
    const signers = await ethers.getSigners();
    this.signers = {
      admin: signers[0],
      // using last 10 as other usable accounts for test purposes
      others: signers.slice(-10),
    } as Signers;

    this.loadFixture = loadFixture;
  });

  describe("Helper", function () {
    beforeEach(async function () {
      const { astaVerde, mockUSDC } = await this.loadFixture(deployAstaVerdeFixture);
      this.mockUSDC = mockUSDC;
      this.astaVerde = astaVerde;
    });

    shouldHelpersBeGood();
  });
});
