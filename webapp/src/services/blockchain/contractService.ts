import type { PublicClient, WalletClient } from "viem";
import type { ContractConfig } from "../../shared/types/contracts";
import { READ_ONLY_FUNCTIONS, WRITE_FUNCTIONS } from "../../config/constants";

export class ContractService {
  constructor(
    private publicClient: PublicClient,
    private walletClient: WalletClient | undefined,
  ) {}

  async readContract(config: ContractConfig, functionName: string, args?: unknown[]): Promise<unknown> {
    if (!READ_ONLY_FUNCTIONS.includes(functionName as any)) {
      throw new Error(`${functionName} is not a read-only function`);
    }

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

    if (!WRITE_FUNCTIONS.includes(functionName as any)) {
      throw new Error(`${functionName} is not a write function`);
    }

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
