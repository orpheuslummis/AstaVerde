"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useReadContracts } from 'wagmi';
import { Slider } from "../@/components/ui/slider";
import { USDC_DECIMALS } from "../app.config";
import { useBuyBatch } from "../hooks/useBuyBatch";
import { useHasMounted } from "../hooks/useHasMounted";
import { Batch } from "../lib/batch";
import { astaverdeContractConfig, getUsdcContractConfig } from "../lib/contracts";
import { getPlaceholderImageUrl } from "../utils/placeholderImage";

interface BatchCardProps {
	batch: Batch;
	updateCard?: () => void;
}

export const BatchCard = ({ batch, updateCard }: BatchCardProps) => {
	const { handleBuy, handleApprove, isSimulating, isPending, simulationError } = useBuyBatch(batch);
	const { useReadContract } = useContractContext();
	const { address, isConnected } = useAccount();

	const [tokenAmount, setTokenAmount] = useState(1);
	const hasMounted = useHasMounted();

	const placeholderImage = useMemo(() => getPlaceholderImageUrl(batch.id), [batch.id]);

	const { data: usdcBalanceData, isLoading: isBalanceLoading, error: balanceError } = useReadContracts({
		contracts: useMemo(() => [
			{
				address: getUsdcContractConfig().address,
				abi: erc20Abi,
				functionName: 'balanceOf',
				args: [address],
			},
			{
				address: getUsdcContractConfig().address,
				abi: erc20Abi,
				functionName: 'decimals',
			}
		], [address]),
		enabled: hasMounted && isConnected && !!address,
	});

	const priceInUSDC = useMemo(() => formatUnits(batch.price, USDC_DECIMALS), [batch.price]);
	const totalPrice = useMemo(() => Number(priceInUSDC) * tokenAmount, [priceInUSDC, tokenAmount]);

	const { data: allowance, refetch: refetchAllowance } = useReadContract({
		...getUsdcContractConfig(),
		functionName: 'allowance',
		args: [address, astaverdeContractConfig.address],
		enabled: hasMounted && isConnected && !!address,
	});

	const needsApproval = useMemo(() => {
		if (!allowance) return true;
		return allowance < parseUnits(totalPrice.toString(), USDC_DECIMALS);
	}, [allowance, totalPrice]);

	useEffect(() => {
		if (isConnected && address) {
			refetchAllowance();
		}
	}, [isConnected, address, refetchAllowance]);

	if (!hasMounted) {
		return <div>Loading...</div>;
	}

	const usdcBalance = usdcBalanceData ? {
		value: usdcBalanceData[0].result,
		decimals: usdcBalanceData[1].result,
	} : null;

	const hasEnoughBalance = usdcBalance && usdcBalance.value >= parseUnits(totalPrice.toString(), USDC_DECIMALS);
	const canBuy = isConnected && !!address && hasEnoughBalance;

	const handleApproveAndBuy = async () => {
		try {
			if (needsApproval) {
				await handleApprove();
				await refetchAllowance();
			}
			await handleBuy();
			if (updateCard) updateCard();
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
					<p className="mb-2">Select quantity</p>
					<Slider
						min={1}
						max={batch.itemsLeft}
						step={1}
						value={[tokenAmount]}
						onValueChange={(value) => setTokenAmount(value[0])}
						className="mb-4"
					/>
					<p className="text-sm text-gray-600 mb-2">Selected: {tokenAmount}</p>
					<p className="font-bold mb-4">Total: {totalPrice.toFixed(2)} USDC</p>
					<button
						onClick={handleApproveAndBuy}
						disabled={!canBuy || isPending || isSimulating}
						className={`w-full p-3 rounded transition-colors duration-300 ${canBuy && !isPending && !isSimulating
								? "bg-green-500 text-white hover:bg-green-600"
								: "bg-gray-400 text-gray-200 cursor-not-allowed"
							}`}
					>
						{isSimulating ? "Simulating..." : isPending ? (needsApproval ? "Approving..." : "Buying...") : (needsApproval ? "Approve & Buy" : "Buy")}
					</button>
					{simulationError && (
						<p className="mt-2 text-red-500">Error: {simulationError.message}</p>
					)}
					{isConnected ? (
						<div className="mt-4 text-sm">
							{isBalanceLoading ? (
								<p className="text-yellow-500">Loading USDC balance... This may take a moment.</p>
							) : balanceError ? (
								<p className="text-red-500">Error loading USDC balance. Please try again later.</p>
							) : !hasEnoughBalance ? (
								<p className="text-red-500">
									Insufficient USDC balance. You have {usdcBalance ? formatUnits(usdcBalance.value, USDC_DECIMALS) : '0'} USDC
								</p>
							) : null}
							{usdcBalance && !isBalanceLoading && !balanceError && (
								<p className="text-gray-600">Your USDC balance: {formatUnits(usdcBalance.value, USDC_DECIMALS)} USDC</p>
							)}
						</div>
					) : (
						<p className="mt-4 text-sm text-gray-500">Connect your wallet to buy this batch</p>
					)}
				</div>
			</div>
		</div>
	);
};