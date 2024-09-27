import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { AstaVerde, MockUSDC } from "../types";
import { USDC_PRECISION } from "./lib";

export async function deployAstaVerdeFixture(): Promise<{
    astaVerde: AstaVerde;
    mockUSDC: MockUSDC;
    admin: HardhatEthersSigner;
    user1: HardhatEthersSigner;
    user2: HardhatEthersSigner;
}> {
    const [admin, user1, user2] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy(1000000000n * USDC_PRECISION);
    await mockUSDC.waitForDeployment();

    await mockUSDC.mint(admin.address, 10000000n * USDC_PRECISION);
    await mockUSDC.mint(user1.address, 1000000n * USDC_PRECISION);
    await mockUSDC.mint(user2.address, 1000000n * USDC_PRECISION);

    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    const astaVerde = await AstaVerde.deploy(await mockUSDC.getAddress(), admin.address);
    await astaVerde.waitForDeployment();

    // Ensure all users have MaxUint256 allowance
    await mockUSDC.connect(admin).approve(await astaVerde.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(user1).approve(await astaVerde.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(user2).approve(await astaVerde.getAddress(), ethers.MaxUint256);

    return { astaVerde, mockUSDC, admin, user1, user2 };
}
