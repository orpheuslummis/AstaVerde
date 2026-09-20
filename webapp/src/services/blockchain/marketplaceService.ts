import type { PublicClient, WalletClient } from "viem";
import { formatUnits } from "viem";
import { getAstaVerdeContract, getUsdcContract } from "../../config/contracts";
import {
  BATCH_SIZE_FOR_TOKEN_QUERY,
  APPROVAL_BUFFER_FACTOR,
  TX_CONFIRMATION_TIMEOUT,
  TX_RETRY_COUNT,
  TX_RETRY_DELAY,
  TX_REVERTED_MESSAGE,
  MARKETPLACE_PAUSED_MESSAGE,
  INSUFFICIENT_INVENTORY_MESSAGE,
  TX_STILL_PENDING_MESSAGE,
  SIMULATION_RETRY_DELAY,
  GAS_HEADROOM_PERCENT,
} from "../../config/constants";
import { ENV } from "../../config/environment";
import type { BatchData, TokenDataObj, TokenDataTuple } from "../../features/marketplace/types";
import { safeMulticall } from "../../lib/safeMulticall";

/**
 * Normalize a transaction hash to ensure it has the correct length (64 hex chars + 0x prefix).
 * This fixes an issue where leading zeros can be stripped during JSON serialization,
 * causing "hex string has length 62, want 64" errors.
 */
function normalizeHash(hash: `0x${string}`): `0x${string}` {
  if (!hash || !hash.startsWith("0x")) return hash;
  const hexPart = hash.slice(2);
  const padded = hexPart.padStart(64, "0");
  return `0x${padded}` as `0x${string}`;
}

export class MarketplaceService {
  constructor(
    private publicClient: PublicClient,
    private walletClient: WalletClient | undefined,
  ) {}

  private async assertWalletOnExpectedChain(): Promise<void> {
    if (!this.walletClient) return;

    const expectedChainId = this.publicClient.chain?.id;
    if (!expectedChainId) return;

    const walletClientAny = this.walletClient as unknown as {
      chain?: { id?: number };
      getChainId?: () => Promise<number>;
    };

    let walletChainId: number | undefined = walletClientAny.chain?.id;
    if (!walletChainId && typeof walletClientAny.getChainId === "function") {
      try {
        walletChainId = await walletClientAny.getChainId();
      } catch {
        return;
      }
    }

    if (walletChainId && walletChainId !== expectedChainId) {
      const expectedName = this.publicClient.chain?.name ?? `chainId ${expectedChainId}`;
      throw new Error(`Wrong network (wallet chainId ${walletChainId}). Please switch your wallet to ${expectedName}.`);
    }
  }

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

    await this.assertWalletOnExpectedChain();

    // Get fresh price at time of purchase
    const currentUnitPrice = await this.getCurrentBatchPrice(batchId);
    const exactTotalCost = currentUnitPrice * BigInt(tokenAmount);

    // Preflight: ensure marketplace not paused and inventory is available
    // Only the READ is guarded: a failing read degrades gracefully (we fall back
    // to the on-chain checks), but a successful read that says "paused" or
    // "sold out" is a user-facing verdict and must propagate to the caller.
    const astaVerde = getAstaVerdeContract();
    let paused: boolean | undefined;
    try {
      paused = (await this.publicClient.readContract({
        ...astaVerde,
        functionName: "paused",
      })) as boolean;
    } catch {
      // paused() unavailable in this ABI/env: fall through to on-chain checks
    }
    if (paused) {
      throw new Error(MARKETPLACE_PAUSED_MESSAGE);
    }

    // Preflight: check remaining items before attempting tx
    let itemsLeft: bigint | undefined;
    try {
      itemsLeft = (await this.getBatchInfo(batchId)).itemsLeft;
    } catch {
      // Batch info fetch failed: continue and rely on on-chain checks
    }
    if (itemsLeft !== undefined && BigInt(tokenAmount) > itemsLeft) {
      throw new Error(INSUFFICIENT_INVENTORY_MESSAGE);
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
      throw new Error(
        `Insufficient USDC balance. Need ${formatUnits(exactTotalCost, ENV.USDC_DECIMALS)} but have ${formatUnits(balance, ENV.USDC_DECIMALS)}.`,
      );
    }

    // Check and handle USDC approval
    await this.ensureUsdcApproval(exactTotalCost);

    // Execute purchase
    const contract = getAstaVerdeContract();

    // Simulate first for clearer errors and attach our own gas estimate, so the wallet
    // never has to estimate against an RPC node that may lag ours (a wallet that cannot
    // estimate shows "missing gas limit" and refuses). If the simulation fails, retry once
    // after a short pause: right after the approval confirms, some nodes have not yet seen
    // the new allowance. Only then fall back to a direct write.
    let rawHash: `0x${string}`;
    try {
      const buyArgs = [BigInt(batchId), exactTotalCost, BigInt(tokenAmount)] as const;
      // Captured so the closure keeps the non-null narrowing from the guard above.
      const walletClient = this.walletClient;
      const simulate = () =>
        this.publicClient.simulateContract({
          ...contract,
          functionName: "buyBatch",
          args: buyArgs,
          account: walletClient.account,
        });
      const simulated = await simulate().catch(async () => {
        await new Promise((resolve) => setTimeout(resolve, SIMULATION_RETRY_DELAY));
        return simulate();
      });
      const { request } = simulated;
      const gas = await this.publicClient.estimateContractGas({
        ...contract,
        functionName: "buyBatch",
        args: buyArgs,
        account: walletClient.account,
      });
      rawHash = await walletClient.writeContract({ ...request, gas: (gas * GAS_HEADROOM_PERCENT) / 100n });
    } catch {
      try {
        rawHash = await this.walletClient.writeContract({
          ...contract,
          functionName: "buyBatch",
          args: [BigInt(batchId), exactTotalCost, BigInt(tokenAmount)],
          account: this.walletClient.account,
        });
      } catch (writeError) {
        throw new Error(this.getRevertReason(writeError));
      }
    }
    const hash = normalizeHash(rawHash);

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

      const results = await safeMulticall(this.publicClient, {
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
    const [producerRes, cidRes, redeemedRes] = await safeMulticall(this.publicClient, {
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
        const isLocalChain = this.publicClient.chain?.id === 31337;
        let rawApproveTx: `0x${string}`;

        if (!isLocalChain) {
          try {
            const { request } = await this.publicClient.simulateContract({
              ...usdcContract,
              functionName: "approve",
              args: [astaverdeContract.address, approvalAmount],
              account: this.walletClient.account,
            });
            rawApproveTx = await this.walletClient.writeContract(request);
          } catch {
            rawApproveTx = await this.walletClient.writeContract({
              ...usdcContract,
              functionName: "approve",
              args: [astaverdeContract.address, approvalAmount],
              account: this.walletClient.account,
            });
          }
        } else {
          rawApproveTx = await this.walletClient.writeContract({
            ...usdcContract,
            functionName: "approve",
            args: [astaverdeContract.address, approvalAmount],
            account: this.walletClient.account,
          });
        }
        const approveTx = normalizeHash(rawApproveTx);

        await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
        console.log("Approval successful:", approveTx);
      } catch (error) {
        console.error("Approval error details:", error);
        throw Object.assign(new Error(`USDC approval failed: ${this.getRevertReason(error)}`), { cause: error });
      }
    }
  }

  private async waitForTransactionWithRetry(hash: `0x${string}`): Promise<void> {
    let retryCount = 0;

    while (retryCount < TX_RETRY_COUNT) {
      let receipt: { status: "success" | "reverted" } | undefined;

      try {
        // Re-poll only. The transaction is already broadcast at this point, so a
        // timeout here can never cause a duplicate send.
        receipt = await this.publicClient.waitForTransactionReceipt({
          hash,
          timeout: TX_CONFIRMATION_TIMEOUT,
          confirmations: 1,
        });
      } catch {
        retryCount++;

        if (retryCount === TX_RETRY_COUNT) {
          // Final check: the receipt may have landed between polls.
          let finalReceipt: { status: "success" | "reverted" } | undefined;
          try {
            finalReceipt = await this.publicClient.getTransactionReceipt({ hash });
          } catch {
            finalReceipt = undefined;
          }

          if (finalReceipt?.status === "success") return;
          if (finalReceipt) throw new Error(TX_REVERTED_MESSAGE);

          // No receipt yet: on L1 this means still pending, not failed.
          throw new Error(TX_STILL_PENDING_MESSAGE);
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, TX_RETRY_DELAY));
        continue;
      }

      // A receipt is final: a revert must surface immediately rather than being
      // re-polled until the budget runs out and reported as a timeout.
      if (receipt.status === "success") return;
      throw new Error(TX_REVERTED_MESSAGE);
    }
  }

  private getRevertReason(error: unknown): string {
    const seen = new Set<unknown>();
    let current: any = error;

    for (let depth = 0; depth < 6 && current && !seen.has(current); depth++) {
      seen.add(current);
      const message = current?.data?.message || current?.shortMessage || current?.message;
      if (typeof message === "string" && message.trim().length > 0) return message;
      current = current?.cause;
    }

    return "Transaction failed without a reason.";
  }
}
