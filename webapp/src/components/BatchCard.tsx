"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { Slider } from "../@/components/ui/slider";
import { USDC_DECIMALS } from "../app.config";
import { useAppContext } from "../contexts/AppContext";
import { useBatchOperations } from "../hooks/useContractInteraction";
import { Batch } from "../lib/batch";
import { customToast } from "../utils/customToast";
import { getPlaceholderImageUrl } from "../utils/placeholderImage";

interface BatchCardProps {
    batch: Batch;
    updateCard?: () => void;
    isSoldOut: boolean;
}

export function BatchCard({ batch, updateCard, isSoldOut }: BatchCardProps) {
    const { isConnected } = useAccount();
    const { refetchBatches, getUsdcContractConfig } = useAppContext();
    const [tokenAmount, setTokenAmount] = useState(1n);
    const { data: walletClient } = useWalletClient();

    const placeholderImage = useMemo(() => {
        return getPlaceholderImageUrl(batch.id.toString(), batch.token_ids.length.toString());
    }, [batch.id, batch.token_ids.length]);

    const priceInUSDC = useMemo(
        () => (isSoldOut ? null : formatUnits(batch.price, USDC_DECIMALS)),
        [batch.price, isSoldOut],
    );
    const totalPrice = useMemo(() => (priceInUSDC ? batch.price * tokenAmount : null), [batch.price, tokenAmount]);

    const { handleApproveAndBuy, isLoading, hasEnoughUSDC } = useBatchOperations(batch.id, totalPrice || 0n);
    const { getCurrentBatchPrice, getBatchInfo } = useAppContext();

    const handleBuyClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (batch.itemsLeft === 0n || isSoldOut) return;
        try {
            // Fetch current batch price
            const currentPrice = await getCurrentBatchPrice(Number(batch.id));
            if (currentPrice !== batch.price) {
                customToast.error("Price has changed. Please refresh and try again.");
                return;
            }

            // Check if there are enough items left
            const batchInfo = await getBatchInfo(Number(batch.id));
            if (batchInfo.itemsLeft < tokenAmount) {
                customToast.error("Not enough items left in the batch.");
                return;
            }

            console.log("Buying batch with params:", {
                batchId: batch.id.toString(),
                usdcAmount: totalPrice?.toString(),
                tokenAmount: tokenAmount.toString(),
                currentPrice: currentPrice.toString(),
            });

            await handleApproveAndBuy(tokenAmount, totalPrice!);
            if (updateCard) {
                updateCard();
            }
            refetchBatches();
            customToast.success("Purchase successful!");
        } catch (error) {
            console.error("Error in approve and buy process:", error);
            if (error instanceof Error) {
                if (error.message.includes("user rejected")) {
                    customToast.error("Transaction rejected by user");
                } else if (error.message.includes("insufficient funds")) {
                    customToast.error("Insufficient USDC balance for this purchase");
                } else {
                    customToast.error(`Transaction failed: ${error.message}`);
                }
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

    const isButtonDisabled = !isConnected || isLoading || !hasEnoughUSDC || isSoldOut || batch.itemsLeft === 0n;

    return (
        <div
            className={`bg-white shadow-lg rounded-xl overflow-hidden w-full flex flex-col transition-transform duration-300 hover:scale-105 ${isSoldOut ? "opacity-60" : ""}`}
        >
            <Link href={`/batch/${batch.id}`} className="block">
                <div className="relative h-48">
                    <Image
                        src={batch.imageUrl || placeholderImage}
                        alt={`Batch ${batch.id}`}
                        fill
                        style={{ objectFit: "cover" }}
                    />
                    {isSoldOut && (
                        <div className="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
                            <span className="text-white text-xl font-bold">Sold Out</span>
                        </div>
                    )}
                </div>
                <div className="p-6">
                    <h2 className="text-2xl font-semibold mb-4">{`Batch ${batch.id}`}</h2>
                    <div className="flex justify-between mb-4">
                        <p className="text-gray-600">{isSoldOut ? "Sold Out" : `${batch.itemsLeft} items left`}</p>
                        {!isSoldOut && <p className="font-semibold">{priceInUSDC} USDC</p>}
                    </div>
                </div>
            </Link>
            {!isSoldOut && (
                <div className="px-6 pb-6">
                    <p className="mb-2">Select quantity</p>
                    <Slider
                        min={1}
                        max={Math.min(Number(batch.itemsLeft), 10)}
                        step={1}
                        value={[Number(tokenAmount)]}
                        onValueChange={(value) => setTokenAmount(BigInt(value[0]))}
                        className="mb-4"
                    />
                    <p className="text-sm text-gray-600 mb-2">Selected: {tokenAmount.toString()}</p>
                    <p className="font-bold mb-4">Total: {formatUnits(totalPrice || 0n, USDC_DECIMALS)} USDC</p>
                    <button
                        onClick={handleBuyClick}
                        disabled={isButtonDisabled}
                        className={`w-full p-3 rounded transition-colors duration-300 ${
                            isButtonDisabled
                                ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                                : "bg-green-500 text-white hover:bg-green-600"
                        }`}
                    >
                        {getButtonText()}
                    </button>
                </div>
            )}
        </div>
    );
}
