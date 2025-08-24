import { useCallback, useState, useMemo } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { wagmiConfig } from "../../../config/wagmi";
import { MarketplaceService } from "../../../services/blockchain/marketplaceService";
import { customToast } from "../../../shared/utils/customToast";
import type { BatchData, MarketplaceOperations } from "../types";

export function useMarketplace(): MarketplaceOperations & {
  isLoading: boolean;
  error: string | null;
  } {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Create marketplace service instance
  const marketplaceService = useMemo(() => {
    if (!publicClient) return null;
    return new MarketplaceService(publicClient, walletClient, wagmiConfig);
  }, [publicClient, walletClient]);

  // Buy batch operation
  const buyBatch = useCallback(
    async (batchId: number, usdcAmount: bigint, tokenAmount: number): Promise<string> => {
      if (!marketplaceService) {
        throw new Error("Marketplace service not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        const hash = await marketplaceService.buyBatch(batchId, tokenAmount);
        customToast.success("Purchase successful!");
        return hash;
      } catch (err) {
        const errorMessage = (err as Error)?.message || "Failed to buy batch";
        setError(errorMessage);

        if (!errorMessage.includes("User rejected") && !errorMessage.includes("User denied")) {
          customToast.error(errorMessage);
        }

        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [marketplaceService],
  );

  // Redeem token operation
  const redeemToken = useCallback(
    async (tokenId: bigint): Promise<string> => {
      if (!marketplaceService) {
        throw new Error("Marketplace service not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        const hash = await marketplaceService.redeemToken(tokenId);
        customToast.success("Token redeemed successfully!");
        return hash;
      } catch (err) {
        const errorMessage = (err as Error)?.message || "Failed to redeem token";
        setError(errorMessage);

        if (errorMessage.includes("User rejected") || errorMessage.includes("User denied")) {
          throw new Error("Transaction cancelled by user");
        }

        customToast.error(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [marketplaceService],
  );

  // Get current batch price
  const getCurrentBatchPrice = useCallback(
    async (batchId: number): Promise<bigint> => {
      if (!marketplaceService) {
        throw new Error("Marketplace service not initialized");
      }

      try {
        return await marketplaceService.getCurrentBatchPrice(batchId);
      } catch (err) {
        console.error("Error getting batch price:", err);
        throw err;
      }
    },
    [marketplaceService],
  );

  // Get batch info
  const getBatchInfo = useCallback(
    async (batchId: number): Promise<BatchData> => {
      if (!marketplaceService) {
        throw new Error("Marketplace service not initialized");
      }

      try {
        return await marketplaceService.getBatchInfo(batchId);
      } catch (err) {
        console.error("Error getting batch info:", err);
        throw err;
      }
    },
    [marketplaceService],
  );

  // Get tokens of owner
  const getTokensOfOwner = useCallback(
    async (ownerAddress: string): Promise<number[]> => {
      if (!marketplaceService) {
        throw new Error("Marketplace service not initialized");
      }

      try {
        return await marketplaceService.getTokensOfOwner(ownerAddress);
      } catch (err) {
        console.error("Error getting owner tokens:", err);
        throw err;
      }
    },
    [marketplaceService],
  );

  return {
    buyBatch,
    redeemToken,
    getCurrentBatchPrice,
    getBatchInfo,
    getTokensOfOwner,
    isLoading,
    error,
  };
}
