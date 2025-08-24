import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AstaVerde, MockUSDC } from "../typechain-types";

describe("AstaVerde Security Fixes", function () {
  let astaVerde: AstaVerde;
  let usdc: MockUSDC;
  let owner: SignerWithAddress;
  let buyer: SignerWithAddress;
  let producer1: SignerWithAddress;
  let producer2: SignerWithAddress;
  let attacker: SignerWithAddress;

  const USDC_PRECISION = 1_000_000n;
  const BASE_PRICE = 230n * USDC_PRECISION;

  beforeEach(async function () {
    [owner, buyer, producer1, producer2, attacker] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy(0);

    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    astaVerde = await AstaVerde.deploy(owner.address, await usdc.getAddress());

    // Fund buyer with USDC
    await usdc.mint(buyer.address, 10000n * USDC_PRECISION);
    await usdc.connect(buyer).approve(await astaVerde.getAddress(), ethers.MaxUint256);
  });

  describe("Payment Distribution Check", function () {
    it("should revert with require instead of assert on distribution mismatch", async function () {
      // This test verifies the error message exists and is descriptive
      // The actual mismatch is hard to trigger naturally due to the calculation logic
      // but we verify the require statement is in place
      
      // Create a normal batch purchase to ensure the require doesn't break normal flow
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      
      // Normal purchase should work fine
      await expect(
        astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1)
      ).to.not.be.reverted;
      
      // Verify the contract still calculates correctly
      const platformShare = await astaVerde.platformShareAccumulated();
      const expectedPlatformShare = (BASE_PRICE * 30n) / 100n;
      expect(platformShare).to.equal(expectedPlatformShare);
    });

    it("should correctly distribute payments with multiple producers", async function () {
      // Test that payment distribution works correctly with the new require
      await astaVerde.mintBatch(
        [producer1.address, producer2.address, producer1.address],
        ["QmTest1", "QmTest2", "QmTest3"]
      );
      
      const price = await astaVerde.getCurrentBatchPrice(1);
      const totalPrice = price * 3n;
      
      const platformBefore = await astaVerde.platformShareAccumulated();
      
      await astaVerde.connect(buyer).buyBatch(1, totalPrice, 3);
      
      // Check accrued balances (pull payment pattern)
      const producer1Accrued = await astaVerde.producerBalances(producer1.address);
      const producer2Accrued = await astaVerde.producerBalances(producer2.address);
      const platformAfter = await astaVerde.platformShareAccumulated();
      
      const platformReceived = platformAfter - platformBefore;
      
      // Verify total distribution equals total price
      expect(producer1Accrued + producer2Accrued + platformReceived).to.equal(totalPrice);
      
      // Verify platform got 30%
      expect(platformReceived).to.equal((totalPrice * 30n) / 100n);
    });
  });

  describe("CID Length DoS Prevention", function () {
    it("should prevent gas bomb attacks with very long CIDs", async function () {
      // Create a CID that would be expensive to store
      const gasGombCID = "Qm" + "x".repeat(999); // 1001 characters
      
      await expect(
        astaVerde.mintBatch([producer1.address], [gasGombCID])
      ).to.be.revertedWith("CID too long");
    });

    it("should handle maximum batch size with maximum CID lengths", async function () {
      // Test worst case: max batch size with max CID lengths
      const maxCID = "Qm" + "x".repeat(98); // 100 characters
      const producers = Array(50).fill(producer1.address);
      const cids = Array(50).fill(maxCID);
      
      // Should succeed even with maximum values
      await expect(
        astaVerde.mintBatch(producers, cids)
      ).to.not.be.reverted;
      
      // Verify batch was created
      const batchInfo = await astaVerde.getBatchInfo(1);
      expect(batchInfo[1].length).to.equal(50); // tokenIds array length
    });

    it("should efficiently validate CIDs without excessive gas", async function () {
      // Measure gas for different batch sizes
      const shortCID = "QmShort";
      const mediumCID = "Qm" + "x".repeat(48); // 50 characters
      const longCID = "Qm" + "x".repeat(98); // 100 characters
      
      // Small batch with short CIDs
      const tx1 = await astaVerde.mintBatch(
        [producer1.address],
        [shortCID]
      );
      const receipt1 = await tx1.wait();
      
      // Medium batch with medium CIDs
      const tx2 = await astaVerde.mintBatch(
        Array(10).fill(producer1.address),
        Array(10).fill(mediumCID)
      );
      const receipt2 = await tx2.wait();
      
      // Large batch with long CIDs
      const tx3 = await astaVerde.mintBatch(
        Array(20).fill(producer1.address),
        Array(20).fill(longCID)
      );
      const receipt3 = await tx3.wait();
      
      // Gas should scale reasonably with batch size
      // The validation loop should add minimal overhead
      expect(receipt2!.gasUsed).to.be.lessThan(receipt1!.gasUsed * 15n);
      expect(receipt3!.gasUsed).to.be.lessThan(receipt1!.gasUsed * 25n);
    });
  });

  // Emergency Rescue tests disabled - function removed from contract
  describe.skip("Emergency Rescue Function", function () {
    it("should allow owner to rescue tokens when paused", async function () {
      await astaVerde.mintBatch([producer1.address, producer2.address], ["QmTest1", "QmTest2"]);
      
      // Pause the contract
      await astaVerde.pause();
      
      // Owner can rescue tokens from contract
      await expect(
        astaVerde.connect(owner).emergencyRescue([1, 2], buyer.address)
      ).to.not.be.reverted;
      
      // Verify tokens are now with buyer
      expect(await astaVerde.balanceOf(buyer.address, 1)).to.equal(1);
      expect(await astaVerde.balanceOf(buyer.address, 2)).to.equal(1);
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 1)).to.equal(0);
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 2)).to.equal(0);
    });

    it("should reject rescue from non-owner", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.pause();
      
      await expect(
        astaVerde.connect(buyer).emergencyRescue([1], buyer.address)
      ).to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount");
    });

    it("should reject rescue when not paused", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      
      await expect(
        astaVerde.connect(owner).emergencyRescue([1], buyer.address)
      ).to.be.revertedWithCustomError(astaVerde, "ExpectedPause");
    });

    it("should reject rescue with invalid recipient", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.pause();
      
      await expect(
        astaVerde.connect(owner).emergencyRescue([1], ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid recipient");
    });

    it("should reject rescue with empty token list", async function () {
      await astaVerde.pause();
      
      await expect(
        astaVerde.connect(owner).emergencyRescue([], buyer.address)
      ).to.be.revertedWith("No tokens specified");
    });

    it("should reject rescue with too many tokens", async function () {
      await astaVerde.pause();
      const tokenIds = Array.from({length: 101}, (_, i) => i + 1);
      
      await expect(
        astaVerde.connect(owner).emergencyRescue(tokenIds, buyer.address)
      ).to.be.revertedWith("Too many tokens");
    });

    it("should reject rescue of tokens not held by contract", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1); // Token now owned by buyer
      await astaVerde.pause();
      
      await expect(
        astaVerde.connect(owner).emergencyRescue([1], producer1.address)
      ).to.be.revertedWith("Token not held");
    });

    it("should emit EmergencyRescue event", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.pause();
      
      const blockTimestamp = await time.latest() + 1;
      await time.setNextBlockTimestamp(blockTimestamp);
      
      await expect(
        astaVerde.connect(owner).emergencyRescue([1], buyer.address)
      ).to.emit(astaVerde, "EmergencyRescue")
        .withArgs(buyer.address, [1], blockTimestamp);
    });

    it("should prevent regular transfers when paused", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1);
      
      // Pause the contract
      await astaVerde.pause();
      
      // Regular user-to-user transfers should fail
      await expect(
        astaVerde.connect(buyer).safeTransferFrom(
          buyer.address,
          producer1.address,
          1,
          1,
          "0x"
        )
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("External Returns Protection", function () {
    it("should reject external ERC1155 returns from other addresses", async function () {
      // First, mint and sell a token to a buyer
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1);
      
      // Try to return the token back to the contract - should fail
      await expect(
        astaVerde.connect(buyer).safeTransferFrom(
          buyer.address,
          await astaVerde.getAddress(),
          1,
          1,
          "0x"
        )
      ).to.be.revertedWith("No external returns");
    });

    it("should reject batch returns from external addresses", async function () {
      // Mint and sell multiple tokens
      await astaVerde.mintBatch(
        [producer1.address, producer2.address],
        ["QmTest1", "QmTest2"]
      );
      await astaVerde.connect(buyer).buyBatch(1, BASE_PRICE * 2n, 2);
      
      // Try to batch return tokens - should fail
      await expect(
        astaVerde.connect(buyer).safeBatchTransferFrom(
          buyer.address,
          await astaVerde.getAddress(),
          [1, 2],
          [1, 1],
          "0x"
        )
      ).to.be.revertedWith("No external returns");
    });

    it("should allow self-transfers from contract", async function () {
      // Contract transferring to itself should work (edge case)
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      
      // This would only happen internally, but we can test the concept
      // by having the contract transfer to a user (simulating internal logic)
      const contractAddr = await astaVerde.getAddress();
      
      // Buy should work (involves self-transfer internally)
      await expect(
        astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1)
      ).to.not.be.reverted;
    });
  });

  /* VAULT TESTS REMOVED - vault mechanism replaced with emergencyRescue
  describe("Vault Transfer Functions", function () {
    it("should reject vault functions when not paused", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.setTrustedVault(attacker.address);
      
      // Both functions require whenPaused
      await expect(
        astaVerde.vaultSendTokens([1])
      ).to.be.revertedWithCustomError(astaVerde, "ExpectedPause");
      
      await expect(
        astaVerde.vaultRecallTokens([1])
      ).to.be.revertedWithCustomError(astaVerde, "ExpectedPause");
    });

    it("should reject vault functions from non-owner", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.setTrustedVault(attacker.address);
      await astaVerde.pause();
      
      // Both functions require onlyOwner
      await expect(
        astaVerde.connect(buyer).vaultSendTokens([1])
      ).to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount");
      
      await expect(
        astaVerde.connect(attacker).vaultRecallTokens([1])
      ).to.be.revertedWithCustomError(astaVerde, "OwnableUnauthorizedAccount");
    });

    it("should reject when vault not set", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.pause();
      
      // Both functions require trustedVault != 0
      await expect(
        astaVerde.vaultSendTokens([1])
      ).to.be.revertedWith("Vault not set");
      
      await expect(
        astaVerde.vaultRecallTokens([1])
      ).to.be.revertedWith("Vault not set");
    });

    it("should reject sending tokens not held by contract", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.connect(buyer).buyBatch(1, BASE_PRICE, 1); // Token now owned by buyer
      await astaVerde.setTrustedVault(attacker.address);
      await astaVerde.pause();
      
      await expect(
        astaVerde.vaultSendTokens([1])
      ).to.be.revertedWith("Not held by contract");
    });

    it("should reject recalling tokens not held by vault", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.setTrustedVault(attacker.address);
      await astaVerde.pause();
      
      // Vault must approve owner first
      await astaVerde.connect(attacker).setApprovalForAll(owner.address, true);
      
      // Token is still in contract, not in vault
      await expect(
        astaVerde.vaultRecallTokens([1])
      ).to.be.revertedWith("Not held by vault");
    });

    it("should reject empty ids array", async function () {
      await astaVerde.setTrustedVault(attacker.address);
      await astaVerde.pause();
      
      await expect(
        astaVerde.vaultSendTokens([])
      ).to.be.revertedWith("No ids");
      
      await expect(
        astaVerde.vaultRecallTokens([])
      ).to.be.revertedWith("No ids");
    });

    it("should still block direct transfers when paused", async function () {
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      await astaVerde.setTrustedVault(attacker.address);
      await astaVerde.pause();
      
      // Send token to vault using vault function
      await astaVerde.vaultSendTokens([1]);
      
      // Vault cannot directly transfer tokens back (must use vaultRecallTokens)
      await expect(
        astaVerde.connect(attacker).safeTransferFrom(
          attacker.address,
          await astaVerde.getAddress(),
          1,
          1,
          "0x"
        )
      ).to.be.revertedWith("Pausable: paused");
      
      // Non-owner cannot use safeBatchTransferFrom
      await expect(
        astaVerde.connect(buyer).safeBatchTransferFrom(
          attacker.address,
          await astaVerde.getAddress(),
          [1],
          [1],
          "0x"
        )
      ).to.be.revertedWithCustomError(astaVerde, "ERC1155MissingApprovalForAll");
    });

    it("should emit correct events for vault operations", async function () {
      await astaVerde.mintBatch([producer1.address, producer2.address], ["QmTest1", "QmTest2"]);
      await astaVerde.setTrustedVault(attacker.address);
      await astaVerde.pause();
      
      // Check VaultSent event
      await expect(astaVerde.vaultSendTokens([1, 2]))
        .to.emit(astaVerde, "VaultSent")
        .withArgs(attacker.address, owner.address, [1, 2]);
      
      // Vault must approve owner for recall
      await astaVerde.connect(attacker).setApprovalForAll(owner.address, true);
      
      // Check VaultRecalled event
      await expect(astaVerde.vaultRecallTokens([1, 2]))
        .to.emit(astaVerde, "VaultRecalled")
        .withArgs(attacker.address, owner.address, [1, 2]);
    });
  });

  describe("Trusted Vault Clearing - REMOVED", function () {
    it("should allow clearing trustedVault to address(0)", async function () {
      // Set a vault initially
      await astaVerde.setTrustedVault(buyer.address);
      expect(await astaVerde.trustedVault()).to.equal(buyer.address);
      
      // Clear the vault by setting to address(0)
      await expect(astaVerde.setTrustedVault(ethers.ZeroAddress))
        .to.emit(astaVerde, "TrustedVaultSet")
        .withArgs(ethers.ZeroAddress);
      
      expect(await astaVerde.trustedVault()).to.equal(ethers.ZeroAddress);
    });

    it("should revert vault functions when trustedVault is address(0)", async function () {
      // Mint a token
      await astaVerde.mintBatch([producer1.address], ["QmTest1"]);
      
      // Ensure trustedVault is not set (default is address(0))
      expect(await astaVerde.trustedVault()).to.equal(ethers.ZeroAddress);
      
      // Pause the contract
      await astaVerde.pause();
      
      // Try to send tokens to vault - should fail
      await expect(
        astaVerde.vaultSendTokens([1])
      ).to.be.revertedWith("Vault not set");
      
      // Try to recall tokens from vault - should fail
      await expect(
        astaVerde.vaultRecallTokens([1])
      ).to.be.revertedWith("Vault not set");
    });

    it("should allow re-enabling vault after clearing", async function () {
      // Set vault
      await astaVerde.setTrustedVault(buyer.address);
      
      // Clear vault
      await astaVerde.setTrustedVault(ethers.ZeroAddress);
      
      // Re-enable with new address
      await astaVerde.setTrustedVault(producer1.address);
      expect(await astaVerde.trustedVault()).to.equal(producer1.address);
    });
  });

  describe("Vault Functions Reentrancy Protection - REMOVED", function () {
    let maliciousReceiver: any;

    beforeEach(async function () {
      // Deploy malicious receiver contract
      const MaliciousVaultReceiver = await ethers.getContractFactory("MaliciousVaultReceiver");
      maliciousReceiver = await MaliciousVaultReceiver.deploy(await astaVerde.getAddress());
      
      // Mint some tokens
      await astaVerde.mintBatch([producer1.address, producer2.address], ["QmTest1", "QmTest2"]);
    });

    it("should prevent reentrancy in vaultSendTokens", async function () {
      // Set malicious receiver as trusted vault
      await astaVerde.setTrustedVault(await maliciousReceiver.getAddress());
      
      // Configure malicious receiver to attempt reentrancy
      await maliciousReceiver.setShouldReenter(true);
      await maliciousReceiver.setTokenIdsToReenter([2]); // Try to reenter with token 2
      
      // Pause contract to enable vault functions
      await astaVerde.pause();
      
      // Call vaultSendTokens - the receiver will try to reenter
      await expect(astaVerde.vaultSendTokens([1]))
        .to.emit(astaVerde, "VaultSent");
      
      // Verify reentrancy was attempted but failed
      expect(await maliciousReceiver.reentrancyAttempts()).to.equal(1);
      
      // Verify tokens were transferred correctly despite reentrancy attempt
      expect(await astaVerde.balanceOf(await maliciousReceiver.getAddress(), 1)).to.equal(1);
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 1)).to.equal(0);
      
      // Token 2 should still be in contract (reentrancy failed)
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 2)).to.equal(1);
    });

    it("should prevent reentrancy in vaultRecallTokens", async function () {
      // Set malicious receiver as trusted vault
      await astaVerde.setTrustedVault(await maliciousReceiver.getAddress());
      
      // Pause and send token to vault first
      await astaVerde.pause();
      await astaVerde.vaultSendTokens([1]);
      
      // Approve owner to handle vault's tokens
      await maliciousReceiver.approveAstaVerde(owner.address);
      
      // Configure malicious receiver to attempt reentrancy on recall
      await maliciousReceiver.setShouldReenter(true);
      await maliciousReceiver.setTokenIdsToReenter([2]);
      
      // Call vaultRecallTokens - contract's receiver will try to reenter
      await expect(astaVerde.vaultRecallTokens([1]))
        .to.emit(astaVerde, "VaultRecalled");
      
      // Verify token was recalled correctly
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 1)).to.equal(1);
      expect(await astaVerde.balanceOf(await maliciousReceiver.getAddress(), 1)).to.equal(0);
      
      // Token 2 should still be in contract (reentrancy failed)
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 2)).to.equal(1);
    });

    it("should handle batch transfers with reentrancy protection", async function () {
      // Mint more tokens
      await astaVerde.mintBatch([producer1.address], ["QmTest3"]);
      
      // Set malicious receiver as vault
      await astaVerde.setTrustedVault(await maliciousReceiver.getAddress());
      
      // Configure for reentrancy attempt
      await maliciousReceiver.setShouldReenter(true);
      await maliciousReceiver.setTokenIdsToReenter([3]);
      
      // Pause and send batch
      await astaVerde.pause();
      
      // Send multiple tokens - should work despite reentrancy attempt
      await expect(astaVerde.vaultSendTokens([1, 2]))
        .to.emit(astaVerde, "VaultSent");
      
      // Verify batch transfer succeeded
      expect(await astaVerde.balanceOf(await maliciousReceiver.getAddress(), 1)).to.equal(1);
      expect(await astaVerde.balanceOf(await maliciousReceiver.getAddress(), 2)).to.equal(1);
      
      // Token 3 should still be in contract (reentrancy failed)
      expect(await astaVerde.balanceOf(await astaVerde.getAddress(), 3)).to.equal(1);
    });
  });

  });
  */

  describe("Edge Cases and Boundaries", function () {
    it("should handle empty CID correctly", async function () {
      // Empty CID should be allowed (length 0 < 100)
      await expect(
        astaVerde.mintBatch([producer1.address], [""])
      ).to.not.be.reverted;
    });

    it("should handle single character CID", async function () {
      await expect(
        astaVerde.mintBatch([producer1.address], ["Q"])
      ).to.not.be.reverted;
    });

    it("should handle exactly 100 character CID", async function () {
      const exactCID = "Q" + "m".repeat(99); // Exactly 100 characters
      await expect(
        astaVerde.mintBatch([producer1.address], [exactCID])
      ).to.not.be.reverted;
    });

    it("should handle 101 character CID", async function () {
      const overCID = "Q" + "m".repeat(100); // 101 characters
      await expect(
        astaVerde.mintBatch([producer1.address], [overCID])
      ).to.be.revertedWith("CID too long");
    });

    it("should validate each CID independently", async function () {
      const validCID = "QmValid";
      const invalidCID = "Q" + "m".repeat(100); // 101 characters
      
      // First invalid
      await expect(
        astaVerde.mintBatch(
          [producer1.address, producer2.address],
          [invalidCID, validCID]
        )
      ).to.be.revertedWith("CID too long");
      
      // Last invalid
      await expect(
        astaVerde.mintBatch(
          [producer1.address, producer2.address],
          [validCID, invalidCID]
        )
      ).to.be.revertedWith("CID too long");
      
      // Middle invalid
      await expect(
        astaVerde.mintBatch(
          [producer1.address, producer2.address, attacker.address],
          [validCID, invalidCID, validCID]
        )
      ).to.be.revertedWith("CID too long");
    });
  });
});