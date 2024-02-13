import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";

import { USDC_PRECISION } from "./helpers";

export async function deployAstaVerdeFixture() {
	async function deployMockUSDCFixture(admin: HardhatEthersSigner) {
		const mockUSDCFactory = await ethers.getContractFactory("MockUSDC");
		const mockUSDC = await mockUSDCFactory
			.connect(admin)
			.deploy(10000000n * USDC_PRECISION);
		await mockUSDC.waitForDeployment();

		return mockUSDC;
	}
	// async function deployAnotherERC20Fixture(admin: HardhatEthersSigner) {
	//   const anotherERC20Factory = await ethers.getContractFactory("AnotherERC20");
	//   const anotherERC20 = await anotherERC20Factory.connect(admin).deploy(10000000);
	//   await anotherERC20.waitForDeployment();

	//   return anotherERC20;
	// }

	// const anotherERC20 = await deployAnotherERC20Fixture(admin);
	const signers = await ethers.getSigners();
	const admin = signers[0];

	const mockUSDC = await deployMockUSDCFixture(admin);
	const mockUSDCAddress = await mockUSDC.getAddress();

	const astaVerdeFactory = await ethers.getContractFactory("AstaVerde");
	const astaVerde = await astaVerdeFactory
		.connect(admin)
		.deploy(admin, mockUSDCAddress);
	await astaVerde.waitForDeployment();

	console.log("astaVerde address:", await astaVerde.getAddress());
	console.log("mockUSDC address:", await mockUSDC.getAddress());
	console.log("admin address:", await admin.getAddress());

	return { astaVerde, mockUSDC };
}
