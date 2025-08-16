import { useCallback, useState, useMemo } from "react";
import { usePublicClient, useWalletClient, useBalance } from "wagmi";
import { wagmiConfig } from "../../../config/wagmi";
import { MarketplaceService } from "../../../services/blockchain/marketplaceService";
import { getUsdcContract } from "../../../config/contracts";
import { customToast } from "../../../shared/utils/customToast";

export function useBatchOperations(batchId: bigint, totalPrice: bigint) {
    const [isLoading, setIsLoading] = useState(false);
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();

    // Create marketplace service
    const marketplaceService = useMemo(() => {
        if (!publicClient) return null;
        return new MarketplaceService(publicClient, walletClient, wagmiConfig);
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
                if (errorMessage.includes("Insufficient funds sent")) {
                    customToast.error("Insufficient USDC balance for this purchase.");
                } else if (!errorMessage.includes("cancelled by user")) {
                    customToast.error(`Transaction failed: ${errorMessage}`);
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
