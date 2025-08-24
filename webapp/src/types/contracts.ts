import type { Address, Hex } from "viem";
import type { Config } from "wagmi";

export interface ContractConfig {
  address: Address;
  abi: readonly unknown[];
  chainId?: number;
}

export type ExecuteFunction = (...args: unknown[]) => Promise<unknown>;

export type ContractError = Error | null;

export interface TransactionResult {
  hash: Hex;
  wait: () => Promise<void>;
}

export interface SimulateResult {
  request: unknown;
  result: unknown;
}

export interface MulticallContract {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}

export interface MarketplaceError extends Error {
  cause?: {
    name?: string;
    reason?: string;
  };
  data?: unknown;
}

export interface VaultError extends Error {
  cause?: {
    name?: string;
    reason?: string;
  };
  data?: unknown;
}

export type WagmiConfig = Config;
