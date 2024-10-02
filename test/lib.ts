import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "ethers";

export const USDC_PRECISION = 10n ** 6n;

export function genAddresses(num: number) {
    const addresses = [];
    for (let i = 0; i < num; i++) {
        addresses.push(ethers.Wallet.createRandom().address);
    }
    return addresses;
}

export async function mintUSDC(user: SignerWithAddress, mockUSDC: any, amount: bigint) {
    await mockUSDC.mint(user.address, amount);
}
