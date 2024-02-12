import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";

export const USDC_PRECISION = 10n ** 6n;

export function createNewAddresses(num: number) {
	const addresses = [];
	for (let i = 0; i < num; i++) {
		addresses.push(ethers.Wallet.createRandom().address);
	}
	return addresses;
}

export async function mintUSDC(
	user: SignerWithAddress,
	mockUSDC: any,
	amount: bigint,
) {
	await mockUSDC.mint(user.address, amount);
}
