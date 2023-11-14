import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";

export async function deployAstaVerdeFixture() {
  async function deployMockUSDCFixture(admin: HardhatEthersSigner) {
    const mockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await mockUSDCFactory.connect(admin).deploy(10000000);
    await mockUSDC.waitForDeployment();

    return mockUSDC;
  }
  const signers = await ethers.getSigners();
  const admin = signers[0];

  const mockUSDC = await deployMockUSDCFixture(admin);
  const mockUSDCAddress = await mockUSDC.getAddress();

  const astaVerdeFactory = await ethers.getContractFactory("AstaVerde");
  const astaVerde = await astaVerdeFactory.connect(admin).deploy(admin, mockUSDCAddress);
  await astaVerde.waitForDeployment();

  console.log("astaVerde address:", await astaVerde.getAddress());
  console.log("mockUSDC address:", await mockUSDC.getAddress());
  console.log("admin address:", await admin.getAddress());

  return { astaVerde, mockUSDC };
}
