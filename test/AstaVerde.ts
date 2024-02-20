import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";

import { shouldBehaveLikeAstaVerde } from "./AstaVerde.behavior";
import { deployAstaVerdeFixture } from "./AstaVerde.fixture";
import type { Signers } from "./types";

/*
Overall flow: each 'test function' is used to group tests sharing the same fixture.
*/

describe("Asta Verde tests", () => {
  before(async function () {
    const signers = await ethers.getSigners();
    this.signers = {
      admin: signers[0],
      // using last 10 as other usable accounts for test purposes
      others: signers.slice(-10),
    } as Signers;

    this.loadFixture = loadFixture;
  });

  describe("AstaVerde", () => {
    beforeEach(async function () {
      const { astaVerde, mockUSDC } = await this.loadFixture(deployAstaVerdeFixture);
      this.mockUSDC = mockUSDC;
      this.astaVerde = astaVerde;
    });

    shouldBehaveLikeAstaVerde();
  });
});
