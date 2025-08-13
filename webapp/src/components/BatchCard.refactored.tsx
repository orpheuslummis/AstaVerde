// Example refactored BatchCard component using the new structure
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import {
    ChevronRightIcon,
    ShoppingCartIcon,
    TagIcon,
} from "@heroicons/react/24/solid";

// New imports using the reorganized structure
import { ENV } from "../config/environment";
import { useAppContext } from "../contexts/AppContext"; // This would also be refactored
import { useBatchOperations, type BatchCardProps } from "../features/marketplace";
import { customToast } from "../shared";
import { getPlaceholderImageUrl } from "../utils/placeholderImage"; // Would move to shared/utils
import TokenCard from "./TokenCard";
import Loader from "./Loader";

export function BatchCard({ batch, updateCard, isSoldOut }: BatchCardProps) {
    const { isConnected } = useAccount();
    const { refetchBatches } = useAppContext();
    const [tokenAmount, setTokenAmount] = useState(1);

    useEffect(() => {
        setTokenAmount((prev) => Math.min(prev, Number(batch.itemsLeft)));
    }, [batch.itemsLeft]);

    const handleTokenAmountChange = (newAmount: number) => {
        setTokenAmount(
            Math.max(1, Math.min(Number(batch.itemsLeft), newAmount)),
        );
    };

    const formattedPrice = useMemo(() => {
        if (batch.price === undefined) return "N/A";
        return formatUnits(batch.price, ENV.USDC_DECIMALS);
    }, [batch.price]);

    const placeholderImage = useMemo(() => {
        return getPlaceholderImageUrl(
            batch.batchId.toString(),
            batch.tokenIds.length.toString(),
        );
    }, [batch.batchId, batch.tokenIds]);

    const totalPrice = useMemo(
        () => (batch.price !== undefined
            ? batch.price * BigInt(tokenAmount)
            : 0n),
        [batch.price, tokenAmount],
    );

    const { handleApproveAndBuy, isLoading, hasEnoughUSDC } =
        useBatchOperations(batch.batchId, totalPrice);

    const handleBuyClick = async () => {
        if (batch.itemsLeft === 0n || isSoldOut) return;
        try {
            await handleApproveAndBuy(BigInt(tokenAmount), totalPrice);
            // Immediately refresh the batches after successful purchase
            await refetchBatches();
            if (updateCard) {
                updateCard();
            }
        } catch (error) {
            console.error("Error in approve and buy process:", error);
            if (error instanceof Error) {
                // Don't show error toast if it's already been shown by the hook
                if (!error.message.includes("Transaction cancelled by user") && 
                    !error.message.includes("Transaction confirmation timed out")) {
                    customToast.error(`Transaction failed: ${error.message}`);
                }
            } else {
                customToast.error(
                    "An unknown error occurred during the transaction",
                );
            }
        }
    };

    const getButtonText = () => {
        if (!isConnected) return "Buy";
        if (isLoading) return "Processing...";
        if (isSoldOut || batch.itemsLeft === 0n) return "Sold Out";
        if (!hasEnoughUSDC) return "Insufficient USDC";
        return "Buy";
    };

    const isButtonDisabled = !isConnected || isLoading || isSoldOut ||
        batch.itemsLeft === 0n || (!isConnected && !hasEnoughUSDC);

    // Rest of the component remains the same...
    // This example shows how imports and hook usage would be updated

    return (
        <div className="batch-card">
            {/* Component JSX remains the same */}
        </div>
    );
}