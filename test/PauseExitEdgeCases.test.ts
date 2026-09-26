// Pause-exit edge cases added from the 2026-09 pre-deploy audit: who can withdraw while paused,
// the SCC supply invariant, a reentrant receiver, and misconfigured trustedVault values.
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Pause-exit edge cases", function () {
    async function setup() {
        const [owner, producer, buyer, other, eoaVault] = await ethers.getSigners();
        const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy(0);
        const av = await (await ethers.getContractFactory("AstaVerde")).deploy(owner.address, await usdc.getAddress());
        await av.setPriceFloor(ethers.parseUnits("10", 6));
        await av.setBasePrice(ethers.parseUnits("15", 6));
        const scc = await (await ethers.getContractFactory("StabilizedCarbonCoin")).deploy(ethers.ZeroAddress);
        const vault = await (
            await ethers.getContractFactory("EcoStabilizer")
        ).deploy(await av.getAddress(), await scc.getAddress());
        await scc.grantRole(await scc.MINTER_ROLE(), await vault.getAddress());
        await scc.renounceRole(await scc.DEFAULT_ADMIN_ROLE(), owner.address);
        await av.setTrustedVault(await vault.getAddress());
        await av.mintBatch(Array(6).fill(producer.address), ["a", "b", "c", "d", "e", "f"]);
        await usdc.mint(buyer.address, ethers.parseUnits("10000", 6));
        await usdc.connect(buyer).approve(await av.getAddress(), ethers.MaxUint256);
        await av.connect(buyer).buyBatch(1, ethers.parseUnits("90", 6), 6);
        await av.connect(buyer).setApprovalForAll(await vault.getAddress(), true);
        await scc.connect(buyer).approve(await vault.getAddress(), ethers.MaxUint256);
        await vault.connect(buyer).depositBatch([1, 2, 3]);
        return { owner, producer, buyer, other, eoaVault, usdc, av, scc, vault };
    }
    const invariant = async (scc: any, vault: any) =>
        expect(await scc.totalSupply()).to.equal((await vault.totalActiveLoans()) * 20n * 10n ** 18n);

    it("paused: a non-borrower holding enough SCC cannot withdraw someone else's collateral", async function () {
        const { av, scc, vault, buyer, other } = await setup();
        await scc.connect(buyer).transfer(other.address, ethers.parseEther("40"));
        await scc.connect(other).approve(await vault.getAddress(), ethers.MaxUint256);
        await av.pause();
        await vault.pause();
        await expect(vault.connect(other).withdraw(1)).to.be.revertedWith("not borrower");
        await expect(vault.connect(other).withdrawBatch([1, 2])).to.be.revertedWith("not borrower");
    });

    it("paused: withdraw keeps SCC supply == 20 x totalActiveLoans and clears loan/index state", async function () {
        const { av, scc, vault, buyer } = await setup();
        await av.pause();
        await vault.pause();
        await invariant(scc, vault);
        await vault.connect(buyer).withdraw(1);
        await invariant(scc, vault);
        await vault.connect(buyer).withdrawBatch([2, 3]);
        await invariant(scc, vault);
        expect(await vault.totalActiveLoans()).to.equal(0);
        expect((await vault.loans(1)).active).to.equal(false);
        expect(await vault.getUserLoans(buyer.address)).to.deep.equal([]);
        expect(await scc.totalSupply()).to.equal(0);
    });

    it("setTrustedVault is callable while paused (owner can repair the bypass mid-incident)", async function () {
        const { av, vault, buyer } = await setup();
        await av.setTrustedVault(ethers.ZeroAddress);
        await av.pause();
        await expect(vault.connect(buyer).withdraw(1)).to.be.revertedWithCustomError(av, "EnforcedPause");
        await av.setTrustedVault(await vault.getAddress());
        await vault.connect(buyer).withdraw(1);
        expect(await av.balanceOf(buyer.address, 1)).to.equal(1);
    });

    it("misconfig: trustedVault set to an EOA exempts that EOA (and its approved operators) from the pause", async function () {
        const { av, buyer, other } = await setup();
        await av.setTrustedVault(buyer.address);
        await av.connect(buyer).setApprovalForAll(other.address, true);
        await av.pause();
        await av.connect(buyer).safeTransferFrom(buyer.address, other.address, 4, 1, "0x");
        await av.connect(other).safeTransferFrom(buyer.address, other.address, 5, 1, "0x"); // operator acting for the exempt address
        expect(await av.balanceOf(other.address, 4)).to.equal(1);
        expect(await av.balanceOf(other.address, 5)).to.equal(1);
        // but the receiver cannot move them onward: from != trustedVault
        await expect(
            av.connect(other).safeTransferFrom(other.address, buyer.address, 4, 1, "0x"),
        ).to.be.revertedWithCustomError(av, "EnforcedPause");
    });

    it("paused: the collateral-return callback cannot re-enter the vault nor forward the NFT", async function () {
        const { av, scc, vault, buyer, other } = await setup();
        const rb = await (
            await ethers.getContractFactory("ReentrantBorrower")
        ).deploy(await av.getAddress(), await vault.getAddress(), await scc.getAddress());
        await av.connect(buyer).safeTransferFrom(buyer.address, await rb.getAddress(), 4, 1, "0x");
        await av.connect(buyer).safeTransferFrom(buyer.address, await rb.getAddress(), 5, 1, "0x");
        await rb.setup();
        await rb.depositBatch([4, 5]);
        await av.pause();
        await rb.arm(5, other.address);
        await rb.withdraw(4);
        expect(await av.balanceOf(await rb.getAddress(), 4)).to.equal(1);
        expect(await rb.reenterWithdrawOk()).to.equal(false);
        expect(await rb.reenterDepositOk()).to.equal(false);
        expect(await rb.forwardOk()).to.equal(false);
        const iface = new ethers.Interface(["error ReentrancyGuardReentrantCall()", "error EnforcedPause()"]);
        expect(iface.parseError(await rb.reenterWithdrawErr())?.name).to.equal("ReentrancyGuardReentrantCall");
        expect(iface.parseError(await rb.reenterDepositErr())?.name).to.equal("ReentrancyGuardReentrantCall");
        expect(iface.parseError(await rb.forwardErr())?.name).to.equal("EnforcedPause");
        await invariant(scc, vault);
        expect((await vault.loans(5)).active).to.equal(true);
    });

    it("paused: AstaVerde cannot be made to ship its own unsold stock (trustedVault = AstaVerde itself is inert)", async function () {
        const { av, owner, producer, other } = await setup();
        await av.mintBatch([producer.address], ["g"]); // token 7 held by AstaVerde
        await av.setTrustedVault(await av.getAddress());
        await av.pause();
        await expect(
            av.connect(owner).safeTransferFrom(await av.getAddress(), other.address, 7, 1, "0x"),
        ).to.be.revertedWithCustomError(av, "ERC1155MissingApprovalForAll");
    });
});
