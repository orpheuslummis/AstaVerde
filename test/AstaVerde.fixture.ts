import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import type { AstaVerde, MockUSDC } from "../types";
import { USDC_PRECISION } from "./lib";

async function deployMockUSDC(admin: HardhatEthersSigner, users: HardhatEthersSigner[]): Promise<MockUSDC> {
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy(0);
    await mockUSDC.waitForDeployment();

    await mockUSDC.mint(admin.address, 10000000n * USDC_PRECISION);
    for (const user of users) {
        await mockUSDC.mint(user.address, 1000000n * USDC_PRECISION);
    }

    return mockUSDC;
}

async function deployAstaVerde(admin: HardhatEthersSigner, mockUSDCAddress: string): Promise<AstaVerde> {
    const AstaVerde = await ethers.getContractFactory("AstaVerde");
    const astaVerde = await AstaVerde.deploy(admin.address, mockUSDCAddress);
    await astaVerde.waitForDeployment();
    return astaVerde;
}

async function approveAstaVerde(mockUSDC: MockUSDC, astaVerdeAddress: string, signers: HardhatEthersSigner[]): Promise<void> {
    for (const signer of signers) {
        await mockUSDC.connect(signer).approve(astaVerdeAddress, ethers.MaxUint256);
    }
}

export async function deployAstaVerdeFixture(): Promise<{
    astaVerde: AstaVerde;
    mockUSDC: MockUSDC;
    admin: HardhatEthersSigner;
    user1: HardhatEthersSigner;
    user2: HardhatEthersSigner;
    user3: HardhatEthersSigner;
}> {
    const [admin, user1, user2, user3] = await ethers.getSigners();
    const users = [user1, user2, user3];

    const mockUSDC = await deployMockUSDC(admin, users);
    const astaVerde = await deployAstaVerde(admin, await mockUSDC.getAddress());

    await approveAstaVerde(mockUSDC, await astaVerde.getAddress(), [admin, ...users]);

    console.log("AstaVerde address:", await astaVerde.getAddress());
    console.log("MockUSDC address:", await mockUSDC.getAddress());
    console.log("Admin address:", await admin.getAddress());

    return { astaVerde, mockUSDC, admin, user1, user2, user3 };
}
