import { useCallback, useState, useMemo } from "react";
import { useWalletClient, useBalance } from "wagmi";
import { MarketplaceService } from "../../../services/blockchain/marketplaceService";
import { getUsdcContract } from "../../../config/contracts";
import { customToast } from "../../../shared/utils/customToast";
import {
  INSUFFICIENT_INVENTORY_MESSAGE,
  MARKETPLACE_PAUSED_MESSAGE,
  TX_REVERTED_MESSAGE,
  TX_STILL_PENDING_MESSAGE,
} from "../../../config/constants";
import { useRateLimitedPublicClient } from "@/hooks/useRateLimitedPublicClient";

export function useBatchOperations(batchId: bigint, totalPrice: bigint) {
  const [isLoading, setIsLoading] = useState(false);
  const publicClient = useRateLimitedPublicClient();
  const { data: walletClient } = useWalletClient();

  // Create marketplace service
  const marketplaceService = useMemo(() => {
    if (!publicClient) return null;
    return new MarketplaceService(publicClient, walletClient);
  }, [publicClient, walletClient]);

  // Check USDC balance
  const { data: usdcBalance } = useBalance({
    address: walletClient?.account.address,
    token: getUsdcContract().address,
  });

  const hasEnoughUSDC = useMemo(() => {
    if (!usdcBalance) return false;
    return BigInt(usdcBalance.value) >= totalPrice;
  }, [usdcBalance, totalPrice]);

  // Handle approve and buy
  const handleApproveAndBuy = useCallback(
    async (tokenAmount: bigint) => {
      if (!marketplaceService) {
        throw new Error("Marketplace service not initialized");
      }

      if (!walletClient) {
        throw new Error("Wallet not connected");
      }

      setIsLoading(true);

      try {
        // Buy batch (service handles approval internally)
        await marketplaceService.buyBatch(Number(batchId), Number(tokenAmount));

        customToast.success("Purchase confirmed successfully!");
      } catch (error: unknown) {
        console.error("Error in approve and buy process:", error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        const lower = errorMessage.toLowerCase();
        const suppressToast =
          lower.includes("user rejected") || lower.includes("user denied") || lower.includes("cancelled by user");

        if (!suppressToast) {
          if (errorMessage === TX_STILL_PENDING_MESSAGE) {
            // On L1 a slow tx is not a failed tx: do not tell the user it failed.
            customToast.warning(errorMessage, 12000);
          } else if (
            errorMessage === TX_REVERTED_MESSAGE ||
            errorMessage === MARKETPLACE_PAUSED_MESSAGE ||
            errorMessage === INSUFFICIENT_INVENTORY_MESSAGE
          ) {
            // Preflight verdicts and reverts are already user-facing: show them
            // as-is rather than wrapping them in "Transaction failed: ...".
            customToast.error(errorMessage);
          } else if (errorMessage.includes("Wrong network")) {
            customToast.error(errorMessage);
          } else if (
            errorMessage.includes("Insufficient funds sent") ||
            errorMessage.includes("Insufficient USDC balance")
          ) {
            customToast.error("Insufficient USDC balance for this purchase.");
          } else if (errorMessage.startsWith("USDC approval failed:")) {
            customToast.error(errorMessage);
          } else {
            customToast.error(`Transaction failed: ${errorMessage}`);
          }
        }

        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [marketplaceService, walletClient, batchId],
  );

  return {
    handleApproveAndBuy,
    isLoading,
    hasEnoughUSDC,
  };
}
