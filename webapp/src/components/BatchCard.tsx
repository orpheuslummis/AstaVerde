"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from 'wagmi';
import { Slider } from "../@/components/ui/slider";
import { USDC_DECIMALS } from "../app.config";
import { useAppContext } from "../contexts/AppContext";
import { useBatchOperations } from "../hooks/useContractInteraction";
import { Batch } from "../lib/batch";
import { getPlaceholderImageUrl } from "../utils/placeholderImage";

interface BatchCardProps {
	batch: Batch;
	updateCard?: () => void;
}

export const BatchCard = ({ batch, updateCard }: BatchCardProps) => {
	const { isConnected } = useAccount();
	const { refetchBatches } = useAppContext();
	const [tokenAmount, setTokenAmount] = useState(1);

	const placeholderImage = useMemo(() => getPlaceholderImageUrl(batch.id), [batch.id]);

	const priceInUSDC = useMemo(() => formatUnits(batch.price, USDC_DECIMALS), [batch.price]);
	const totalPrice = useMemo(() => Number(priceInUSDC) * tokenAmount, [priceInUSDC, tokenAmount]);

	const { handleApproveAndBuy, isLoading } = useBatchOperations(batch.id, totalPrice);

	const handleBuyClick = async () => {
		if (batch.itemsLeft === 0) return;
		try {
			await handleApproveAndBuy(tokenAmount, Number(priceInUSDC));
			if (updateCard) {
				updateCard();
			}
			refetchBatches();
		} catch (error) {
			console.error('Error in approve and buy process:', error);
		}
	};

	return (
		<div className="bg-white shadow-lg rounded-xl overflow-hidden w-full flex flex-col">
			<div className="relative h-48">
				<Image
					src={batch.imageUrl || placeholderImage}
					alt={`Batch ${batch.id}`}
					fill
					style={{ objectFit: 'cover' }}
				/>
			</div>
			<div className="p-6 flex-grow flex flex-col">
				<h2 className="text-2xl font-semibold mb-4">{`Batch ${batch.id}`}</h2>
				<div className="flex justify-between mb-4">
					<p className="text-gray-600">{batch.itemsLeft} items left</p>
					<p className="font-semibold">{priceInUSDC} USDC</p>
				</div>
				<div className="mt-auto">
					{batch.itemsLeft > 0 ? (
						<>
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
							<p className="font-bold mb-4">Total: {totalPrice.toFixed(2)} USDC</p>
							<button
								onClick={handleBuyClick}
								disabled={!isConnected || isLoading}
								className={`w-full p-3 rounded transition-colors duration-300 ${isConnected && !isLoading
									? "bg-green-500 text-white hover:bg-green-600"
									: "bg-gray-400 text-gray-200 cursor-not-allowed"
									}`}
							>
								{isLoading ? "Processing..." : "Buy"}
							</button>
						</>
					) : (
						<p className="text-red-500 font-bold mb-4">This batch is sold out</p>
					)}
				</div>
			</div>
		</div>
	);
};