"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useBalance, useWalletClient } from "wagmi";
import { Slider } from "../@/components/ui/slider";
import { USDC_DECIMALS } from "../app.config";
import { useAppContext } from "../contexts/AppContext";
import { useBatchOperations } from "../hooks/useContractInteraction";
import { Batch } from "../lib/batch";
import { getPlaceholderImageUrl } from "../utils/placeholderImage";

interface BatchCardProps {
    batch: Batch;
    updateCard?: () => void;
    isSoldOut: boolean;
}

export const BatchCard = ({ batch, updateCard, isSoldOut }: BatchCardProps) => {
    const { isConnected } = useAccount();
    const { refetchBatches, getUsdcContractConfig } = useAppContext();
    const [tokenAmount, setTokenAmount] = useState(1);
    const { data: walletClient } = useWalletClient();

    const placeholderImage = useMemo(() => getPlaceholderImageUrl(batch.id), [batch.id]);

    const priceInUSDC = useMemo(
        () => (isSoldOut ? null : formatUnits(batch.price, USDC_DECIMALS)),
        [batch.price, isSoldOut],
    );
    const totalPrice = useMemo(
        () => (priceInUSDC ? Number(priceInUSDC) * tokenAmount : null),
        [priceInUSDC, tokenAmount],
    );

    const { handleApproveAndBuy, isLoading, hasEnoughUSDC } = useBatchOperations(batch.id, totalPrice || 0);

    const { data: usdcBalance } = useBalance({
        address: walletClient?.account.address,
        token: getUsdcContractConfig().address,
    });

    const usdcBalanceFormatted = useMemo(() => {
        if (!usdcBalance) return "0";
        return formatUnits(usdcBalance.value, USDC_DECIMALS);
    }, [usdcBalance]);

    const handleBuyClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (batch.itemsLeft === 0) return;
        try {
            await handleApproveAndBuy(tokenAmount, Number(priceInUSDC));
            if (updateCard) {
                updateCard();
            }
            refetchBatches();
        } catch (error) {
            console.error("Error in approve and buy process:", error);
        }
    };

    const getButtonText = () => {
        if (isLoading) return "Processing...";
        if (!isConnected) return "Buy";
        if (!hasEnoughUSDC) return "Insufficient USDC";
        return "Buy";
    };

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
                        max={Math.min(batch.itemsLeft, 10)}
                        step={1}
                        value={[tokenAmount]}
                        onValueChange={(value) => setTokenAmount(value[0])}
                        className="mb-4"
                    />
                    <p className="text-sm text-gray-600 mb-2">Selected: {tokenAmount}</p>
                    <p className="font-bold mb-4">Total: {totalPrice?.toFixed(2)} USDC</p>
                    <p className="text-sm text-gray-600 mb-2">Your USDC Balance: {usdcBalanceFormatted}</p>
                    <button
                        onClick={handleBuyClick}
                        disabled={!isConnected || isLoading || !hasEnoughUSDC}
                        className={`w-full p-3 rounded transition-colors duration-300 ${
                            isConnected && !isLoading && hasEnoughUSDC
                                ? "bg-green-500 text-white hover:bg-green-600"
                                : "bg-gray-400 text-gray-200 cursor-not-allowed"
                        }`}
                    >
                        {getButtonText()}
                    </button>
                </div>
            )}
        </div>
    );
};
