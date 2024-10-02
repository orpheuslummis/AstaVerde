"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { USDC_DECIMALS } from "../app.config";
import { useAppContext } from "../contexts/AppContext";
import { useBatchOperations } from "../hooks/useContractInteraction";
import type { Batch } from "../lib/batch";
import { customToast } from "../utils/customToast";
import { getPlaceholderImageUrl } from "../utils/placeholderImage";
import { ChevronRightIcon, ShoppingCartIcon, TagIcon } from "@heroicons/react/24/solid";
import TokenCard from "./TokenCard";

interface BatchCardProps {
    batch: Batch;
    updateCard?: () => void;
    isSoldOut: boolean;
}

export function BatchCard({ batch, updateCard, isSoldOut }: BatchCardProps) {
    const { isConnected } = useAccount();
    const { refetchBatches } = useAppContext();
    const [tokenAmount, setTokenAmount] = useState(1);
    const [showBuyOptions, setShowBuyOptions] = useState(false);

    const formattedPrice = useMemo(() => {
        if (batch.price === undefined) return "N/A";
        return formatUnits(batch.price, USDC_DECIMALS);
    }, [batch.price]);

    const placeholderImage = useMemo(() => {
        return getPlaceholderImageUrl(
            batch.id?.toString() ?? "0",
            batch.token_ids?.length?.toString() ?? "0"
        );
    }, [batch.id, batch.token_ids]);

    const totalPrice = useMemo(
        () => (batch.price !== undefined ? batch.price * BigInt(tokenAmount) : 0n),
        [batch.price, tokenAmount]
    );

    const batchIdForOperations = batch.id !== undefined ? batch.id : 0n;
    const { handleApproveAndBuy, isLoading, hasEnoughUSDC } = useBatchOperations(batchIdForOperations, totalPrice);

    const handleBuyClick = async () => {
        if (batch.itemsLeft === 0n || isSoldOut || batch.id === undefined) return;
        try {
            await handleApproveAndBuy(BigInt(tokenAmount), totalPrice);
            if (updateCard) {
                updateCard();
            }
            refetchBatches();
            customToast.success("Purchase successful!");
            setShowBuyOptions(false);
        } catch (error) {
            console.error("Error in approve and buy process:", error);
            if (error instanceof Error) {
                customToast.error(`Transaction failed: ${error.message}`);
            } else {
                customToast.error("An unknown error occurred during the transaction");
            }
        }
    };

    const getButtonText = () => {
        if (isLoading) return "Processing...";
        if (!isConnected) return "Connect Wallet";
        if (!hasEnoughUSDC) return "Insufficient USDC";
        if (isSoldOut || batch.itemsLeft === 0n) return "Sold Out";
        return "Buy";
    };

    const isButtonDisabled =
        !isConnected || isLoading || !hasEnoughUSDC || isSoldOut || batch.itemsLeft === 0n;

    const displayedTokens = batch.token_ids?.slice(0, 3) || [];
    const remainingTokens = (batch.token_ids?.length || 0) - displayedTokens.length;

    return (
        <div className={`batch-card hover:shadow-xl ${isSoldOut ? 'opacity-50' : ''}`}>
            <div className="flex flex-col p-4">
                <div className="flex items-center mb-4">
                    <div className="relative w-24 h-24 mr-4">
                        <Image
                            src={batch.imageUrl || placeholderImage}
                            alt={`Batch ${batch.id}`}
                            fill
                            className="rounded-lg object-cover"
                        />
                    </div>
                    <div className="flex-grow">
                        <h2 className="text-xl font-semibold mb-1">{`Batch ${batch.id}`}</h2>
                        <div className="flex items-center text-sm text-gray-600 mb-2">
                            <TagIcon className="w-4 h-4 mr-1" />
                            <span className="font-medium mr-2">{formattedPrice} USDC per unit</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                            <ShoppingCartIcon className="w-4 h-4 mr-1" />
                            <span>{isSoldOut ? "Sold Out" : `${batch.itemsLeft} left`}</span>
                        </div>
                    </div>
                </div>
                
                {!isSoldOut && (
                    <div className="mt-2">
                        <label htmlFor={`quantity-${batch.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity:
                        </label>
                        <input
                            type="range"
                            id={`quantity-${batch.id}`}
                            min="1"
                            max={batch.itemsLeft?.toString()}
                            value={tokenAmount}
                            onChange={(e) => setTokenAmount(parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-sm text-gray-600 mt-1">
                            <span>1</span>
                            <span>{tokenAmount}</span>
                            <span>{batch.itemsLeft?.toString()}</span>
                        </div>
                        <p className="text-sm font-medium mt-2">
                            Total: {formatUnits(totalPrice, USDC_DECIMALS)} USDC
                        </p>
                        <button
                            onClick={handleBuyClick}
                            disabled={isButtonDisabled}
                            className={`w-full btn mt-2 ${isButtonDisabled ? 'btn-secondary' : 'btn-primary'}`}
                        >
                            {getButtonText()}
                        </button>
                    </div>
                )}
            </div>

            {batch.token_ids && batch.token_ids.length > 0 && (
                <div className="p-4 border-t">
                    <h3 className="text-sm font-semibold mb-2">Tokens in this batch</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {displayedTokens.map((tokenId) => (
                            <Link
                                key={tokenId.toString()}
                                href={`/token/${tokenId}`}
                                className="aspect-square token-card-wrapper"
                            >
                                <TokenCard
                                    tokenId={tokenId}
                                    isCompact={true}
                                />
                            </Link>
                        ))}
                        {remainingTokens > 0 && (
                            <Link
                                href={`/batch/${batch.id}`}
                                className="flex items-center justify-center bg-gray-100 rounded-lg aspect-square hover:bg-gray-200 transition-colors"
                            >
                                <span className="text-sm font-semibold mr-1">+{remainingTokens}</span>
                                <ChevronRightIcon className="h-4 w-4" />
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}