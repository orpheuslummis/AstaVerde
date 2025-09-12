import { ethers } from "ethers";

for (let i = 0; i < 10; i++) {
    const randomWallet = ethers.Wallet.createRandom();
    console.log(randomWallet.address);
}
