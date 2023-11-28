import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/dist/src/signer-with-address";

import type { AstaVerde } from "../types/contracts/AstaVerde";

type Fixture<T> = () => Promise<T>;

declare module "mocha" {
  export interface Context {
    astaVerde: AstaVerde;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: Signers;
  }
}

export interface Signers {
  admin: SignerWithAddress;
  others: SignerWithAddress[];
}
