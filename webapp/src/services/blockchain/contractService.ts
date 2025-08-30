import type { PublicClient, WalletClient } from "viem";
import type { ContractConfig } from "../../shared/types/contracts";
import { getFunctionKind } from "../../lib/abiInference";

export class ContractService {
  constructor(
    private publicClient: PublicClient,
    private walletClient: WalletClient | undefined,
  ) {}

  async readContract(config: ContractConfig, functionName: string, args?: unknown[]): Promise<unknown> {
    const kind = getFunctionKind(config.abi, functionName);
    if (kind !== "read") throw new Error(`${functionName} is not a read-only function (kind=${kind})`);

    return this.publicClient.readContract({
      ...config,
      functionName,
      args: args || [],
    });
  }

  async writeContract(config: ContractConfig, functionName: string, args?: unknown[]): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error("Wallet not connected");
    }

    const kind = getFunctionKind(config.abi, functionName);
    if (kind !== "write") throw new Error(`${functionName} is not a write function (kind=${kind})`);

    // Simulate the transaction first
    const { request } = await this.publicClient.simulateContract({
      ...config,
      functionName,
      args: args || [],
      account: this.walletClient.account,
    });

    // Execute the transaction
    return this.walletClient!.writeContract(request);
  }

  async waitForTransaction(hash: `0x${string}`) {
    return this.publicClient.waitForTransactionReceipt({ hash });
  }

  async estimateGas(
    config: ContractConfig,
    functionName: string,
    args?: unknown[],
    account?: `0x${string}`,
  ): Promise<bigint> {
    if (!account && this.walletClient?.account) {
      account = this.walletClient.account.address;
    }

    if (!account) {
      throw new Error("No account available for gas estimation");
    }

    return this.publicClient.estimateContractGas({
      ...config,
      functionName,
      args: args || [],
      account,
    });
  }
}
