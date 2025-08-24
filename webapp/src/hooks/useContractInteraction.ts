import { multicall } from "@wagmi/core";
import { useCallback, useState } from "react";
import { usePublicClient, useReadContract, useWalletClient, useWriteContract } from "wagmi";
import { wagmiConfig } from "../config/wagmi";
import { READ_ONLY_FUNCTIONS, WRITE_FUNCTIONS } from "../config/constants";
import type { ContractConfig, ExecuteFunction, ContractError } from "../types/contracts";

export function useContractInteraction(contractConfig: ContractConfig, functionName: string) {
  const [isSimulating] = useState(false);
  const [isPending] = useState(false);
  const [error] = useState<ContractError>(null);
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();
  // Note: We avoid pre-creating simulate hooks for write functions to prevent
  // unintended eth_call noise on non-admin accounts. We simulate only inside execute().

  const isReadOnlyFunction = READ_ONLY_FUNCTIONS.includes(functionName as (typeof READ_ONLY_FUNCTIONS)[number]);
  const isWriteFunction = WRITE_FUNCTIONS.includes(functionName as (typeof WRITE_FUNCTIONS)[number]);

  const { data: readData, refetch: refetchReadData } = useReadContract({
    ...contractConfig,
    functionName,
    query: {
      enabled: isReadOnlyFunction, // Only query if it's a read function
    },
  });

  const execute: ExecuteFunction = useCallback(
    async (...args: unknown[]) => {
      if (!publicClient || !contractConfig) return;

      try {
        let result;
        if (isReadOnlyFunction) {
          result = await publicClient.readContract({
            ...contractConfig,
            functionName,
            args,
          });
        } else if (isWriteFunction) {
          if (!walletClient) throw new Error("Wallet not connected");

          // Simulate the transaction first
          const { request } = await publicClient.simulateContract({
            ...contractConfig,
            functionName,
            args,
            account: walletClient.account,
          });

          // If simulation is successful, send the actual transaction
          const hash = await writeContractAsync(request);
          result = await publicClient.waitForTransactionReceipt({
            hash,
          });
        } else {
          throw new Error(`Unknown function: ${functionName}`);
        }
        return result;
      } catch (error) {
        console.error(`Error in ${functionName} interaction:`, error);
        throw error;
      }
    },
    [publicClient, walletClient, contractConfig, functionName, isReadOnlyFunction, isWriteFunction, writeContractAsync],
  );

  const mintBatch = useCallback(
    async (producers: string[], cids: string[]) => {
      console.log("mintBatch called with producers:", producers, "and cids:", cids);
      return execute(producers, cids);
    },
    [execute],
  );

  const buyBatch = useCallback(
    async (batchID: number, usdcAmount: bigint, tokenAmount: number) => {
      return execute(batchID, usdcAmount, tokenAmount);
    },
    [execute],
  );

  const claimPlatformFunds = useCallback(
    async (to: string) => {
      return execute(to);
    },
    [execute],
  );

  const getTokensOfOwner = useCallback(
    async (ownerAddress: string) => {
      try {
        if (!publicClient) {
          throw new Error("Public client not available");
        }

        const lastTokenID = await publicClient.readContract({
          ...contractConfig,
          functionName: "lastTokenID",
        });

        console.log("Last Token ID:", lastTokenID);

        const batchSize = 500; // Adjust based on your needs and RPC provider limits
        const batches = Math.ceil(Number(lastTokenID) / batchSize);
        const ownedTokens: number[] = [];

        for (let i = 0; i < batches; i++) {
          const start = i * batchSize + 1;
          const end = Math.min((i + 1) * batchSize, Number(lastTokenID));

          const calls = Array.from({ length: end - start + 1 }, (_, index) => ({
            ...contractConfig,
            functionName: "balanceOf",
            args: [ownerAddress, BigInt(start + index)],
          }));

          const results = await multicall(wagmiConfig, {
            contracts: calls,
            allowFailure: true,
          });

          results.forEach((result, index) => {
            if (result.status === "success" && typeof result.result === "bigint" && result.result > 0n) {
              ownedTokens.push(start + index);
            }
          });
        }

        console.log("Owned tokens:", ownedTokens);
        return ownedTokens;
      } catch (error) {
        console.error("Error in getTokensOfOwner:", error);
        throw error;
      }
    },
    [publicClient, contractConfig, wagmiConfig],
  );

  const getCurrentBatchPrice = useCallback(
    async (batchId: number) => {
      try {
        if (!publicClient) {
          throw new Error("Public client not available");
        }

        const price = await publicClient.readContract({
          ...contractConfig,
          functionName: "getCurrentBatchPrice",
          args: [BigInt(batchId)],
        });

        console.log(`Current price for batch ${batchId}:`, price);
        return price;
      } catch (error) {
        console.error("Error in getCurrentBatchPrice:", error);
        throw error;
      }
    },
    [publicClient, contractConfig],
  );

  const getRevertReason = (error: unknown): string => {
    const err = error as { data?: { message?: string }; message?: string };
    if (err.data && err.data.message) {
      return err.data.message;
    } else if (err.message) {
      return err.message;
    } else {
      return "Transaction failed without a reason.";
    }
  };

  const redeemToken = useCallback(
    async (tokenId: bigint) => {
      try {
        if (!walletClient) {
          throw new Error("Wallet not connected");
        }
        console.log("Redeeming token:", tokenId);
        const result = await execute(tokenId);
        console.log("Redeem token result:", result);
        return result;
      } catch (error) {
        console.error("Error in redeemToken:", error);

        // Check if user rejected the transaction
        const err = error as { message?: string; code?: number; cause?: { code?: number } };
        if (
          err.message?.includes("User rejected") ||
          err.message?.includes("User denied") ||
          err.code === 4001 ||
          err.cause?.code === 4001
        ) {
          throw new Error("Transaction cancelled by user");
        }

        const revertReason = getRevertReason(error);
        throw new Error(`Failed to redeem token: ${revertReason}`);
      }
    },
    [execute, walletClient],
  );

  const getBatchInfo = useCallback(
    async (batchId: number) => {
      console.log(`Fetching info for batch ${batchId}`);
      try {
        if (!publicClient) {
          throw new Error("Public client is not available");
        }

        const result = await execute(batchId);
        console.log(`Raw batch ${batchId} info:`, result);

        if (Array.isArray(result) && result.length === 5) {
          return result;
        } else {
          throw new Error(`Unexpected format for batch ${batchId} info`);
        }
      } catch (error) {
        console.error(`Error fetching batch ${batchId} info:`, error);
        throw error;
      }
    },
    [execute, publicClient],
  );

  return {
    execute,
    isSimulating,
    isPending,
    error,

    readData,
    refetchReadData,
    getTokensOfOwner,
    getCurrentBatchPrice,
    redeemToken,
    mintBatch,
    buyBatch,
    claimPlatformFunds,
    getBatchInfo,
  };
}
