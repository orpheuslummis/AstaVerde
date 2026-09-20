import { expect } from "chai";
import { ethers } from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { AstaVerde, EcoStabilizer, MockUSDC, StabilizedCarbonCoin } from "../types";

/**
 * Pause blocks entry, never exit.
 * - EcoStabilizer pause: deposits revert, withdrawals succeed.
 * - AstaVerde pause: all transfers revert EXCEPT the vault returning collateral (from == trustedVault).
 * - Deposits into the vault while AstaVerde is paused still revert (transfer TO the vault is not exempt).
 */
describe("Pause exit paths (trustedVault bypass)", function () {
    let astaVerde: AstaVerde;
    let vault: EcoStabilizer;
    let scc: StabilizedCarbonCoin;
    let usdc: MockUSDC;
    let owner: SignerWithAddress;
    let producer: SignerWithAddress;
    let buyer: SignerWithAddress;
    let other: SignerWithAddress;
    const U = 6;

    beforeEach(async function () {
        [owner, producer, buyer, other] = await ethers.getSigners();
        usdc = await (await ethers.getContractFactory("MockUSDC")).deploy(0);
        astaVerde = await (await ethers.getContractFactory("AstaVerde")).deploy(owner.address, await usdc.getAddress());
        await astaVerde.setPriceFloor(ethers.parseUnits("10", U));
        await astaVerde.setBasePrice(ethers.parseUnits("15", U));
        scc = await (await ethers.getContractFactory("StabilizedCarbonCoin")).deploy(owner.address);
        vault = await (
            await ethers.getContractFactory("EcoStabilizer")
        ).deploy(await astaVerde.getAddress(), await scc.getAddress());
        await scc.grantRole(await scc.MINTER_ROLE(), await vault.getAddress());
        await astaVerde.setTrustedVault(await vault.getAddress());

        await astaVerde.mintBatch([producer.address, producer.address, producer.address], ["c1", "c2", "c3"]);
        await usdc.mint(buyer.address, ethers.parseUnits("10000", U));
        await usdc.connect(buyer).approve(await astaVerde.getAddress(), ethers.MaxUint256);
        await astaVerde.connect(buyer).buyBatch(1, ethers.parseUnits("45", U), 3);
        await astaVerde.connect(buyer).setApprovalForAll(await vault.getAddress(), true);
        await scc.connect(buyer).approve(await vault.getAddress(), ethers.MaxUint256);
        // tokens 1 and 2 in the vault, token 3 in the buyer's wallet
        await vault.connect(buyer).depositBatch([1, 2]);
    });

    it("setTrustedVault: owner-only, emits, readable", async function () {
        expect(await astaVerde.trustedVault()).to.equal(await vault.getAddress());
        await expect(astaVerde.connect(other).setTrustedVault(other.address)).to.be.revertedWithCustomError(
            astaVerde,
            "OwnableUnauthorizedAccount",
        );
        await expect(astaVerde.setTrustedVault(ethers.ZeroAddress))
            .to.emit(astaVerde, "TrustedVaultSet")
            .withArgs(ethers.ZeroAddress);
    });

    it("AstaVerde paused: withdraw and withdrawBatch return collateral to the user", async function () {
        await astaVerde.pause();
        await vault.connect(buyer).withdraw(1);
        expect(await astaVerde.balanceOf(buyer.address, 1)).to.equal(1);
        await vault.connect(buyer).withdrawBatch([2]);
        expect(await astaVerde.balanceOf(buyer.address, 2)).to.equal(1);
        expect(await astaVerde.balanceOf(await vault.getAddress(), 1)).to.equal(0);
        expect(await scc.balanceOf(buyer.address)).to.equal(0);
    });

    it("AstaVerde paused: deposits still revert (transfers TO the vault are not exempt)", async function () {
        await astaVerde.pause();
        await expect(vault.connect(buyer).deposit(3)).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
    });

    it("AstaVerde paused: a wallet-to-wallet transfer still reverts even with trustedVault set", async function () {
        await astaVerde.pause();
        await expect(
            astaVerde.connect(buyer).safeTransferFrom(buyer.address, other.address, 3, 1, "0x"),
        ).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
    });

    it("both contracts paused: withdraw still succeeds", async function () {
        await astaVerde.pause();
        await vault.pause();
        await vault.connect(buyer).withdraw(1);
        expect(await astaVerde.balanceOf(buyer.address, 1)).to.equal(1);
    });

    it("vault paused, marketplace live: deposit reverts, withdraw succeeds", async function () {
        await vault.pause();
        await expect(vault.connect(buyer).deposit(3)).to.be.revertedWithCustomError(vault, "EnforcedPause");
        await vault.connect(buyer).withdraw(2);
        expect(await astaVerde.balanceOf(buyer.address, 2)).to.equal(1);
    });

    it("AstaVerde paused: adminSweepNFT from the vault works", async function () {
        // an NFT sent to the vault without a deposit (token 3)
        await astaVerde.connect(buyer).safeTransferFrom(buyer.address, await vault.getAddress(), 3, 1, "0x");
        await astaVerde.pause();
        await vault.adminSweepNFT(3, other.address);
        expect(await astaVerde.balanceOf(other.address, 3)).to.equal(1);
    });

    it("trustedVault cleared: AstaVerde pause locks vault exits again (documents the dependency)", async function () {
        await astaVerde.setTrustedVault(ethers.ZeroAddress);
        await astaVerde.pause();
        await expect(vault.connect(buyer).withdraw(1)).to.be.revertedWithCustomError(astaVerde, "EnforcedPause");
    });
});
