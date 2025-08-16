import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { ENV } from "../config/environment";
import { useAppContext } from "../contexts/AppContext";
import { useBatchOperations } from "../features/marketplace";
import { customToast } from "../shared/utils/customToast";
import { getPlaceholderImageUrl } from "../utils/placeholderImage";
import {
    ChevronRightIcon,
    ShoppingCartIcon,
    TagIcon,
} from "@heroicons/react/24/solid";
import type { BatchCardProps } from "../types";
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
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('astaverde:refetch'));
            }
            if (updateCard) {
                updateCard();
            }
        } catch (error: any) {
            // The error handling is already done in the hook, so we just need to handle
            // any errors that weren't already handled
            if (!error?.message?.includes("User rejected") && 
                !error?.message?.includes("User denied") &&
                !error?.cause?.name?.includes("UserRejected")) {
                console.error("Error in approve and buy process:", error);
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

    const buttonContent = (
        <button
            data-testid="buy-button"
            onClick={handleBuyClick}
            disabled={isLoading || !isConnected || batch.itemsLeft === 0n ||
                isSoldOut}
            className={`w-full px-4 py-2 rounded-lg ${
                isLoading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-primary hover:bg-primary-dark"
            }`}
        >
            {isLoading
                ? (
                    <span className="flex items-center justify-center">
                        <Loader /> Processing...
                    </span>
                )
                : (
                    `Buy for ${formattedPrice} USDC`
                )}
        </button>
    );

    return (
        <div
            data-testid="batch-card"
            className={`batch-card hover:shadow-xl ${
                isSoldOut ? "opacity-50" : ""
            } dark:bg-gray-800 dark:border-gray-700`}
        >
            <div className="flex flex-col p-4">
                <Link
                    href={`/batch/${batch.batchId}`}
                    className="flex items-center mb-4"
                >
                    <div className="relative w-24 h-24 mr-4">
                        <Image
                            src={batch.imageUrl || placeholderImage}
                            alt={`Batch ${batch.batchId}`}
                            fill
                            className="rounded-lg object-cover"
                        />
                    </div>
                    <div className="flex-grow">
                        <h2 className="text-xl font-semibold mb-1 dark:text-white">
                            {`Batch ${batch.batchId}`}
                        </h2>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 mb-2">
                            <TagIcon className="w-4 h-4 mr-1" />
                            <span className="font-medium mr-2">
                                {formattedPrice} USDC per unit
                            </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <ShoppingCartIcon className="w-4 h-4 mr-1" />
                            <span>
                                {isSoldOut
                                    ? "Sold Out"
                                    : `${batch.itemsLeft} left`}
                            </span>
                        </div>
                    </div>
                </Link>

                {!isSoldOut && (
                    <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                            <label
                                htmlFor={`quantity-${batch.batchId}`}
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Quantity:
                            </label>
                            <div className="flex items-center">
                                <button
                                    onClick={() =>
                                        handleTokenAmountChange(
                                            tokenAmount - 1,
                                        )}
                                    className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-l"
                                    type="button"
                                >
                                    -
                                </button>
                                <span className="px-4 py-1 bg-gray-100 dark:bg-gray-600 font-medium">
                                    {tokenAmount}
                                </span>
                                <button
                                    onClick={() =>
                                        handleTokenAmountChange(
                                            tokenAmount + 1,
                                        )}
                                    className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-r"
                                    type="button"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        <input
                            data-testid="quantity-slider"
                            type="range"
                            id={`quantity-${batch.batchId}`}
                            min="1"
                            max={batch.itemsLeft.toString()}
                            step="1"
                            value={tokenAmount}
                            onChange={(e) =>
                                handleTokenAmountChange(
                                    Number.parseInt(e.target.value, 10),
                                )}
                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                        />
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <span>1</span>
                            <span>{batch.itemsLeft.toString()}</span>
                        </div>
                        <p className="text-sm font-medium mt-2 dark:text-white">
                            Total: {formatUnits(totalPrice, ENV.USDC_DECIMALS)} USDC
                        </p>
                        {isConnected
                            ? buttonContent
                            : (
                                <div className="tooltip-container">
                                    {buttonContent}
                                    <div className="tooltip-content">
                                        <p>
                                            Please connect your wallet to
                                            purchase tokens. Once connected,
                                            you'll be able to buy tokens from
                                            this batch.
                                        </p>
                                        <div className="tooltip-arrow"></div>
                                    </div>
                                </div>
                            )}
                    </div>
                )}
            </div>

            {batch.tokenIds.length > 0 && (
                <div className="p-4 border-t dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold dark:text-white">
                                Batch Details
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {batch.itemsLeft.toString()} token{Number(batch.itemsLeft) !== 1 ? 's' : ''} available
                            </p>
                        </div>
                        <Link
                            href={`/batch/${batch.batchId}`}
                            className="flex items-center text-sm text-primary hover:text-primary-dark transition-colors"
                        >
                            <span className="mr-1">View Details</span>
                            <ChevronRightIcon className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
