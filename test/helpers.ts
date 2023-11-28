import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";

export function createNewAddresses(num: number) {
  const addresses = [];
  for (let i = 0; i < num; i++) {
    addresses.push(ethers.Wallet.createRandom().address);
  }
  return addresses;
}

export async function mintMillionUSDC(user: SignerWithAddress, mockUSDC: any) {
  await mockUSDC.mint(user.address, 1000000n);
}
