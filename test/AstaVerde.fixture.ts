import { ethers } from "hardhat";

export async function deployMockUSDCFixture() {
  const signers = await ethers.getSigners();
  const admin = signers[0];

  const mockUSDCFactory = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await mockUSDCFactory.connect(admin).deploy(10000000);
  await mockUSDC.waitForDeployment();

  const address = await mockUSDC.getAddress();
  // console.log("mockUSDC address:", address);
  return { MockUSDC: mockUSDC, address };
}

export async function deployAstaVerdeFixture() {
  const signers = await ethers.getSigners();
  const admin = signers[0];

  const mockUSDC = await deployMockUSDCFixture();

  const astaVerdeFactory = await ethers.getContractFactory("AstaVerde");
  const astaVerde = await astaVerdeFactory.connect(admin).deploy(admin, mockUSDC.address);
  await astaVerde.waitForDeployment();

  // console.log("astaVerde address:", await astaVerde.getAddress());

  return { astaVerde };
}
