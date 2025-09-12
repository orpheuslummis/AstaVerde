import { multicall } from "@wagmi/core";
import type { Config } from "wagmi";
import type { PublicClient, WalletClient } from "viem";
import { formatUnits } from "viem";
import { getAstaVerdeContract, getUsdcContract } from "../../config/contracts";
import {
  BATCH_SIZE_FOR_TOKEN_QUERY,
  APPROVAL_BUFFER_FACTOR,
  TX_CONFIRMATION_TIMEOUT,
  TX_RETRY_COUNT,
  TX_RETRY_DELAY,
} from "../../config/constants";
import { ENV } from "../../config/environment";
import type { BatchData, TokenDataObj, TokenDataTuple } from "../../features/marketplace/types";

export class MarketplaceService {
  constructor(
    private publicClient: PublicClient,
    private walletClient: WalletClient | undefined,
    private wagmiConfig: Config,
  ) {}

  // Batch operations
  async getCurrentBatchPrice(batchId: number): Promise<bigint> {
    const contract = getAstaVerdeContract();
    return this.publicClient.readContract({
      ...contract,
      functionName: "getCurrentBatchPrice",
      args: [BigInt(batchId)],
    }) as Promise<bigint>;
  }

  async getBatchInfo(batchId: number): Promise<BatchData> {
    const contract = getAstaVerdeContract();
    const result = await this.publicClient.readContract({
      ...contract,
      functionName: "getBatchInfo",
      args: [BigInt(batchId)],
    });

    if (!Array.isArray(result) || result.length !== 5) {
      throw new Error(`Invalid batch info format for batch ${batchId}`);
    }

    const [batchIdResult, tokenIds, creationTime, price, itemsLeft] = result;

    return {
      batchId: BigInt(batchIdResult),
      tokenIds: (tokenIds as bigint[]).map(BigInt),
      creationTime: BigInt(creationTime),
      price: BigInt(price),
      itemsLeft: BigInt(itemsLeft),
    };
  }

  async buyBatch(batchId: number, tokenAmount: number): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error("Wallet not connected");
    }

    // Get fresh price at time of purchase
    const currentUnitPrice = await this.getCurrentBatchPrice(batchId);
    const exactTotalCost = currentUnitPrice * BigInt(tokenAmount);

    // Preflight: ensure marketplace not paused and inventory is available
    const astaVerde = getAstaVerdeContract();
    try {
      const paused = (await this.publicClient.readContract({
        ...astaVerde,
        functionName: "paused",
      })) as boolean;
      if (paused) {
        throw new Error("Marketplace is paused. Please try again later.");
      }
    } catch {
      // ignore if paused() unavailable in ABI/env
    }

    // Preflight: check remaining items before attempting tx
    try {
      const info = await this.getBatchInfo(batchId);
      if (BigInt(tokenAmount) > info.itemsLeft) {
        throw new Error("Not enough tokens available in this batch");
      }
    } catch {
      // If batch info fetch fails, continue and rely on on-chain checks
    }

    // Check USDC balance first
    const usdcContract = getUsdcContract();
    const balance = (await this.publicClient.readContract({
      ...usdcContract,
      functionName: "balanceOf",
      args: [this.walletClient!.account!.address],
    })) as bigint;

    console.log("Purchase attempt:", {
      batchId,
      tokenAmount,
      unitPrice: currentUnitPrice.toString(),
      totalCost: exactTotalCost.toString(),
      userBalance: balance.toString(),
      hasEnoughFunds: balance >= exactTotalCost,
    });

    if (balance < exactTotalCost) {
      throw new Error(`Insufficient USDC balance. Need ${exactTotalCost.toString()} but have ${balance.toString()}`);
    }

    // Check and handle USDC approval
    await this.ensureUsdcApproval(exactTotalCost);

    // Execute purchase
    const contract = getAstaVerdeContract();

    // Try simulate first for clearer errors; fall back to direct write if it fails
    let hash: `0x${string}`;
    try {
      const { request } = await this.publicClient.simulateContract({
        ...contract,
        functionName: "buyBatch",
        args: [BigInt(batchId), exactTotalCost, BigInt(tokenAmount)],
        account: this.walletClient.account,
      });
      hash = await this.walletClient.writeContract(request);
    } catch (simError) {
      try {
        hash = await this.walletClient.writeContract({
          ...contract,
          functionName: "buyBatch",
          args: [BigInt(batchId), exactTotalCost, BigInt(tokenAmount)],
          account: this.walletClient.account,
        });
      } catch (writeError) {
        throw new Error(this.getRevertReason(writeError));
      }
    }

    // Wait for confirmation with retry logic
    await this.waitForTransactionWithRetry(hash);

    return hash;
  }

  // Token operations
  async getTokensOfOwner(ownerAddress: string): Promise<number[]> {
    const contract = getAstaVerdeContract();

    // Get last token ID
    const lastTokenID = (await this.publicClient.readContract({
      ...contract,
      functionName: "lastTokenID",
    })) as bigint;

    const ownedTokens: number[] = [];
    const batches = Math.ceil(Number(lastTokenID) / BATCH_SIZE_FOR_TOKEN_QUERY);

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE_FOR_TOKEN_QUERY + 1;
      const end = Math.min((i + 1) * BATCH_SIZE_FOR_TOKEN_QUERY, Number(lastTokenID));

      const calls = Array.from({ length: end - start + 1 }, (_, index) => ({
        ...contract,
        functionName: "balanceOf",
        args: [ownerAddress, BigInt(start + index)],
      }));

      const results = await multicall(this.wagmiConfig, {
        contracts: calls as any[],
        allowFailure: true,
      });

      results.forEach((result, index) => {
        if (result.status === "success" && typeof result.result === "bigint" && result.result > 0n) {
          ownedTokens.push(start + index);
        }
      });
    }

    return ownedTokens;
  }

  async redeemToken(tokenId: bigint): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error("Wallet not connected");
    }

    const contract = getAstaVerdeContract();
    const { request } = await this.publicClient.simulateContract({
      ...contract,
      functionName: "redeemToken",
      args: [tokenId],
      account: this.walletClient.account,
    });

    return this.walletClient.writeContract(request);
  }

  async getTokenInfo(tokenId: bigint): Promise<TokenDataObj> {
    const contract = getAstaVerdeContract();

    // v2-only API: compose from dedicated getters
    const [producerRes, cidRes, redeemedRes] = await multicall(this.wagmiConfig, {
      contracts: [
        { ...contract, functionName: "getTokenProducer", args: [tokenId] },
        { ...contract, functionName: "getTokenCid", args: [tokenId] },
        { ...contract, functionName: "isRedeemed", args: [tokenId] },
      ] as any[],
      allowFailure: false,
    });

    const producer = producerRes as unknown as string;
    const cid = cidRes as unknown as string;
    const redeemed = redeemedRes as unknown as boolean;

    if (!producer || producer === "0x0000000000000000000000000000000000000000") {
      throw new Error(`Token ${tokenId} does not exist or has no valid producer`);
    }

    return {
      originalMinter: "0x0000000000000000000000000000000000000000", // v2: not exposed via public API
      tokenId,
      producer,
      cid,
      redeemed,
    } satisfies TokenDataObj;
  }

  // Helper methods
  private async ensureUsdcApproval(amount: bigint): Promise<void> {
    if (!this.walletClient) return;

    const usdcContract = getUsdcContract();
    const astaverdeContract = getAstaVerdeContract();

    // Check current allowance
    const allowance = (await this.publicClient.readContract({
      ...usdcContract,
      functionName: "allowance",
      args: [this.walletClient!.account!.address, astaverdeContract.address],
    })) as bigint;

    console.log("Approval check:", {
      currentAllowance: allowance.toString(),
      requiredAmount: amount.toString(),
      needsApproval: allowance < amount,
      walletAddress: this.walletClient!.account!.address,
      spenderAddress: astaverdeContract.address,
    });

    if (allowance < amount) {
      // Approve with a buffer to avoid prompting every single purchase
      const approvalAmount = amount * APPROVAL_BUFFER_FACTOR;

      try {
        // Skip simulation and directly execute approval
        // Simulation might be failing due to viem/wagmi issues with local network
        const approveTx = await this.walletClient!.writeContract({
          ...usdcContract,
          functionName: "approve",
          args: [astaverdeContract.address, approvalAmount],
          account: this.walletClient!.account,
        });

        await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
        console.log("Approval successful:", approveTx);
      } catch (error) {
        console.error("Approval error details:", error);
        throw error;
      }
    }
  }

  private async waitForTransactionWithRetry(hash: `0x${string}`): Promise<void> {
    let retryCount = 0;

    while (retryCount < TX_RETRY_COUNT) {
      try {
        const receipt = await this.publicClient.waitForTransactionReceipt({
          hash,
          timeout: TX_CONFIRMATION_TIMEOUT,
          confirmations: 1,
        });

        if (receipt.status === "success") {
          return;
        } else {
          throw new Error("Transaction failed");
        }
      } catch (error: any) {
        retryCount++;

        if (retryCount === TX_RETRY_COUNT) {
          // Final check
          try {
            const receipt = await this.publicClient.getTransactionReceipt({ hash });
            if (receipt && receipt.status === "success") {
              return;
            }
          } catch {
            // Ignore and throw timeout error
          }

          throw new Error("Transaction confirmation timed out. Please refresh to check status.");
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, TX_RETRY_DELAY));
      }
    }
  }

  private getRevertReason(error: unknown): string {
    const err = error as { data?: { message?: string }; shortMessage?: string; message?: string };
    return err?.data?.message || err?.shortMessage || err?.message || "Transaction failed without a reason.";
  }
}
